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
  let adapterInputs: Record<string, unknown> | null = null;
  const engineNotes: string[] = [];

  // Layer any enabled trainable/adapter modules that are available for this identity (none today).
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
 * What can this identity do RIGHT NOW — so the UI adapts without hardcoding "if a LoRA exists…".
 * A capability is `true` only when its module is BOTH enabled and available for this identity+model.
 * Today: `{ reference: true, lora/pulid/instantid: false, trainingAvailable: true, recommended:
 * "reference" }`. After training flips the LoRA module on and a READY model exists →
 * `{ lora: true, recommendedStrategy: "reference+lora" }` with no UI change.
 */
export type IdentityCapabilities = {
  reference: boolean;
  lora: boolean;
  pulid: boolean;
  instantid: boolean;
  trainingAvailable: boolean;
  recommendedStrategy: ConditioningStrategy;
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

  return {
    reference: usable.reference ?? false,
    lora: usable.lora ?? false,
    pulid: usable.pulid ?? false,
    instantid: usable.instantid ?? false,
    // The engine SUPPORTS training for this identity (a trainable module is registered). A future
    // milestone also gates this on dataset readiness + a registered Trainer backend.
    trainingAvailable: modules.some((m) => m.kind === "trainable"),
    recommendedStrategy,
  };
}

/** The Identity Engine as an object, for callers that prefer the facade shape. */
export const identityEngine = { planConditioning, getCapabilities };
