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

/** Build the identity-scoped context modules consult from the request (the app loads the DB rows). */
function buildContext(req: ConditioningRequest): ConditioningContext {
  return {
    identityId: req.identityId,
    hasAnalyzedCandidates: (req.candidates?.length ?? 0) > 0,
    trainedModels: req.trainedModels ?? [], // READY IdentityTrainedModel rows (Milestone 24)
    artifacts: req.artifacts ?? [], // IdentityArtifact rows (future adapters)
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
  let pulidReferenceUrl: string | null = null;
  let pulidIdWeight: number | null = null;
  let adapterInputs: Record<string, unknown> | null = null;
  const engineNotes: string[] = [];

  // Pick ONE primary identity technique on top of the Reference baseline. Hosted identity techniques
  // (LoRA via Kontext-LoRA, PuLID via flux-pulid) are MUTUALLY EXCLUSIVE in a single call — they can't
  // be stacked — so the engine chooses the highest-priority available one, or an explicit `preferEngine`
  // (the dev strategy benchmark). This is the composition refinement of Milestone 24.5.
  const candidates = enabled.filter((m) => m.kind !== "reference").sort(byPriority);
  const available: typeof candidates = [];
  for (const m of candidates) {
    const avail = await m.availability(ctx);
    if (avail.available) available.push(m);
    else engineNotes.push(`${m.id}: skipped — ${avail.reason}`);
  }
  let primary: IdentityModule | null;
  if (req.preferEngine === "reference") {
    primary = null; // force the reference baseline only (benchmark)
  } else if (req.preferEngine) {
    // Explicit request (benchmark) — any available module, even non-auto ones like PuLID.
    primary = available.find((m) => m.id === req.preferEngine) ?? null;
    if (!primary) engineNotes.push(`${req.preferEngine}: requested but not available — staying reference`);
  } else {
    // Auto — only AUTO-SELECT modules (a LoRA is a strict upgrade; PuLID is a trade-off, opt-in).
    primary = available.find((m) => m.autoSelect) ?? null;
  }
  for (const m of available) {
    if (m !== primary) engineNotes.push(`${m.id}: available, not primary this request`);
  }

  if (primary) {
    const c = await primary.contribute(ctx, req);
    // Only adopt it if it actually produced usable conditioning (e.g. PuLID found a frontal face).
    const usable = Boolean(
      c.loraModelId || c.loraWeightsUrl || c.pulidReferenceUrl || c.adapterInputs,
    );
    if (usable) {
      engines.push(primary.id);
      strategyParts.push(primary.id);
      loraModelId = c.loraModelId ?? null;
      loraWeightsUrl = c.loraWeightsUrl ?? null;
      loraTriggerWord = c.loraTriggerWord ?? null;
      loraScale = typeof c.loraScale === "number" ? c.loraScale : null;
      pulidReferenceUrl = c.pulidReferenceUrl ?? null;
      pulidIdWeight = typeof c.pulidIdWeight === "number" ? c.pulidIdWeight : null;
      adapterInputs = c.adapterInputs ?? null;
      engineNotes.push(`${primary.id}: ${c.reason}`);
    } else {
      engineNotes.push(`${primary.id}: ${c.reason} — no usable conditioning, staying reference`);
    }
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
    pulidReferenceUrl,
    pulidIdWeight,
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

  // Recommended = what AUTO would pick: reference baseline + the highest-priority usable AUTO-SELECT
  // module (LoRA). PuLID is a usable option (`conditioning.pulid` true) but never the auto default.
  const layer = modules
    .filter((m) => m.kind !== "reference" && m.autoSelect && usable[m.id])
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
