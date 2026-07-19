/**
 * Identity Engine (Milestone 22) — the facade Generation consumes.
 *
 * `planConditioning(request)` composes the enabled `IdentityModule`s into ONE provider-neutral
 * `ConditioningPlan`. The Reference module is the always-on baseline; trainable/adapter modules that
 * are enabled AND available LAYER on top (highest priority first) → `reference+lora`, etc. Generation
 * applies the plan and never learns which technique produced it.
 *
 * Pure orchestration — no provider, no DB writes. The context is currently minimal (no trained
 * models / artifacts yet), so today every plan resolves to `reference` with unchanged output.
 */
import { IDENTITY_MODULES } from "./registry";
import { enabledTrainers } from "./training/registry";
import type { IdentityModule } from "./modules/IdentityModule";
import type {
  ConditioningContext,
  ConditioningPlan,
  ConditioningRequest,
  ConditioningStrategy,
  EngineId,
} from "./types";

/** Build the identity-scoped context modules consult. Foundation: no trained models / artifacts. */
function buildContext(req: ConditioningRequest): ConditioningContext {
  return {
    identityId: req.identityId,
    hasAnalyzedCandidates: (req.candidates?.length ?? 0) > 0,
    trainedModels: [], // future: hydrate from IdentityTrainedModel (READY only)
    artifacts: [], // future: hydrate from IdentityArtifact
  };
}

const byPriority = (a: IdentityModule, b: IdentityModule) => b.priority - a.priority;

export async function planConditioning(
  req: ConditioningRequest,
  modules: IdentityModule[] = IDENTITY_MODULES,
): Promise<ConditioningPlan> {
  const ctx = buildContext(req);
  const enabled = modules.filter((m) => m.enabled);

  // The Reference baseline is required — it is what preserves today's exact behavior.
  const reference = enabled.find((m) => m.kind === "reference");
  if (!reference) {
    throw new Error("Identity Engine: no enabled reference module (baseline required).");
  }

  const base = await reference.contribute(ctx, req);
  const referenceImages = base.referenceImages ?? [];
  const identityAnchor = base.identityAnchor;

  const engines: EngineId[] = ["reference"];
  const strategyParts: string[] = ["reference"];
  let loraModelId: string | null = null;
  let loraWeightsUrl: string | null = null;
  let loraTriggerWord: string | null = null;
  let loraScale: number | null = null;
  let adapterInputs: Record<string, unknown> | null = null;
  const engineNotes: string[] = [];

  // Layer any enabled trainable/adapter modules that are available for this identity.
  const layerable = enabled.filter((m) => m.kind !== "reference").sort(byPriority);
  for (const m of layerable) {
    const avail = await m.availability(ctx);
    if (!avail.available) {
      engineNotes.push(`${m.id}: skipped — ${avail.reason}`);
      continue;
    }
    const c = await m.contribute(ctx, req);
    engines.push(m.id);
    strategyParts.push(m.id);
    if (c.loraModelId) loraModelId = c.loraModelId;
    if (c.loraWeightsUrl) loraWeightsUrl = c.loraWeightsUrl;
    if (c.loraTriggerWord) loraTriggerWord = c.loraTriggerWord;
    if (typeof c.loraScale === "number") loraScale = c.loraScale;
    if (c.adapterInputs) adapterInputs = { ...(adapterInputs ?? {}), ...c.adapterInputs };
    engineNotes.push(`${m.id}: ${c.reason}`);
  }

  const strategy = strategyParts.join("+") as ConditioningStrategy;

  return {
    strategy,
    engines,
    referenceImages,
    identityAnchor,
    loraModelId,
    loraWeightsUrl,
    loraTriggerWord,
    loraScale,
    adapterInputs,
    reason: base.reason,
    debug: {
      strategy,
      engines,
      selection: base.debug?.selection ?? null,
      anchorRanking: base.debug?.anchorRanking ?? [],
      manual: base.debug?.manual ?? false,
      engineNotes,
    },
  };
}

/**
 * What can this identity do RIGHT NOW — so the UI adapts without hardcoding "if a LoRA exists…" or
 * "if Fal is the provider…". Two symmetric blocks:
 *   • `conditioning` — which techniques can condition generation (module enabled && available).
 *   • `training` — which providers can train this identity (from the Training Registry, M23).
 * Today: `conditioning.reference: true` (rest false, strategy "reference"); `training.available: true`
 * via `["fal"]`. When M24 enables the LoRA module + a trained model exists → `conditioning.lora: true`,
 * `recommendedStrategy: "reference+lora"`; when another training provider is added it just appears in
 * `training.providers`. No UI change either way.
 */
export type IdentityCapabilities = {
  conditioning: {
    reference: boolean;
    lora: boolean;
    pulid: boolean;
    instantid: boolean;
    recommendedStrategy: ConditioningStrategy;
  };
  training: {
    available: boolean;
    providers: string[];
    recommendedProvider: string | null;
  };
};

export async function getCapabilities(
  ctx: ConditioningContext,
  opts: { model?: string } = {},
  modules: IdentityModule[] = IDENTITY_MODULES,
): Promise<IdentityCapabilities> {
  // Per-module usability = enabled AND available for this identity.
  const usable: Record<string, boolean> = {};
  for (const m of modules) {
    usable[m.id] = m.enabled ? (await m.availability(ctx)).available : false;
  }

  // Model compatibility (forward-looking): a trained adapter only counts for a target model it was
  // built for. With no target model or no trained models, this is a no-op.
  if (opts.model && usable.lora) {
    usable.lora = ctx.trainedModels.some(
      (m) => m.engine === "lora" && m.modelCompatibility.includes(opts.model as string),
    );
  }

  // Recommended = reference baseline + the highest-priority usable trainable/adapter module.
  const layer = modules
    .filter((m) => m.kind !== "reference" && usable[m.id])
    .sort(byPriority)[0];
  const recommendedStrategy = (
    layer ? `reference+${layer.id}` : "reference"
  ) as ConditioningStrategy;

  // Training: which providers (Training Registry) can train a trainable module's engine for this
  // identity. Provider-agnostic — the UI reads `providers`, never a hardcoded name.
  const trainableEngines: string[] = modules.filter((m) => m.kind === "trainable").map((m) => m.id);
  const trainers = enabledTrainers()
    .filter((t) => t.supports.some((e) => trainableEngines.includes(e)))
    .sort((a, b) => b.priority - a.priority);

  return {
    conditioning: {
      reference: usable.reference ?? false,
      lora: usable.lora ?? false,
      pulid: usable.pulid ?? false,
      instantid: usable.instantid ?? false,
      recommendedStrategy,
    },
    training: {
      available: trainers.length > 0,
      providers: trainers.map((t) => t.id),
      recommendedProvider: trainers[0]?.id ?? null,
    },
  };
}

/** The Identity Engine as an object, for callers that prefer the facade shape. */
export const identityEngine = { planConditioning, getCapabilities };
