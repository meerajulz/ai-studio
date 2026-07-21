/**
 * Identity Engine (Milestone 22) — core types.
 *
 * Identity is now its own SUBSYSTEM. Generation is only one consumer: it asks the Identity Engine
 * "how should I condition this identity for this request?" and receives a provider-neutral
 * `ConditioningPlan`. It never learns whether the identity was conditioned via references, a trained
 * LoRA, or an adapter (PuLID/InstantID) — those are pluggable `IdentityModule`s behind the engine.
 *
 * Pure data + provider-neutral. See docs/IDENTITY_ENGINE.md.
 */
import type { ReferenceImage } from "@/lib/ai";
import type { CreativeDirective } from "@/lib/creative";
import type { AnchorScore, SelectionCandidate } from "@/lib/selection";
import type { IdentityVisualPackage } from "@/lib/identity/types";

/** Every identity-conditioning module we know about. Neutral ids — not tied to one technique. */
export type EngineId = "reference" | "lora" | "pulid" | "instantid";

/** How a module produces identity: from reference images, a trained model, or a runtime adapter. */
export type EngineKind = "reference" | "trainable" | "adapter";

/**
 * The composed conditioning strategy. Reference is always the baseline; trainable/adapter modules
 * LAYER on top → `reference`, `reference+lora`, `reference+pulid`, `reference+instantid`. Today only
 * the Reference module is enabled, so every plan is `reference` and output is unchanged.
 */
export type ConditioningStrategy =
  | "reference"
  | "reference+lora"
  | "reference+pulid"
  | "reference+instantid";

/** What Generation hands the Identity Engine for one request. Provider-neutral. */
export type ConditioningRequest = {
  identityId: string | null;
  directive: CreativeDirective;
  /** Analyzed training images (Smart Reference Selection input). Preferred source. */
  candidates: SelectionCandidate[];
  /** Static Visual Package — FALLBACK when no analyzed candidates exist. */
  visualPackage?: IdentityVisualPackage | null;
  /** DEV manual override: send EXACTLY these media ids, in order (bypasses selector/anchor/safety). */
  manualReferenceMediaIds?: string[];
  /** DEV cap on references sent (anchor kept first). */
  maxReferences?: number;
  /**
   * The identity's READY trained models + adapter artifacts (Milestone 24). The generation layer loads
   * these and passes them in; the engine keeps its purity (no DB). Empty → the LoRA/adapter modules are
   * simply unavailable and the plan stays `reference`.
   */
  trainedModels?: TrainedModelRef[];
  artifacts?: ArtifactRef[];
  /**
   * Force a specific identity technique as the primary (Milestone 24.5) — for the dev strategy
   * benchmark (`lora` vs `pulid`). Undefined = the engine picks the highest-priority available one.
   */
  preferEngine?: EngineId;
};

/**
 * Identity-scoped state a module consults to decide availability (does a trained model exist? an
 * adapter artifact?). For the foundation the engine passes empty `trainedModels`/`artifacts`, so
 * trainable/adapter modules report "not available" and never affect the plan. Future milestones
 * populate these from `IdentityTrainedModel` / `IdentityArtifact` with zero engine redesign.
 */
export type ConditioningContext = {
  identityId: string | null;
  hasAnalyzedCandidates: boolean;
  trainedModels: TrainedModelRef[];
  artifacts: ArtifactRef[];
};

export type TrainedModelRef = {
  id: string;
  engine: EngineId;
  version: number;
  triggerWord: string | null;
  artifactRef: string | null;
  modelCompatibility: string[];
};

export type ArtifactRef = {
  id: string;
  kind: string;
  engine: EngineId | null;
  ref: string;
};

/** Availability of a module for the current identity + request. */
export type ModuleAvailability = { available: boolean; reason: string };

/** One module's contribution to the plan. The engine merges contributions into a `ConditioningPlan`. */
export type ConditioningContribution = {
  part: EngineId;
  referenceImages?: ReferenceImage[];
  identityAnchor?: ReferenceImage;
  loraModelId?: string | null;
  /** Trained-LoRA weights URL + trigger phrase (Milestone 24) — set by the LoRA module. */
  loraWeightsUrl?: string | null;
  loraTriggerWord?: string | null;
  loraScale?: number | null;
  /** PuLID face reference + identity strength (Milestone 24.5) — set by the PuLID module. */
  pulidReferenceUrl?: string | null;
  pulidIdWeight?: number | null;
  adapterInputs?: Record<string, unknown> | null;
  reason: string;
  /** Partial debug the module can attach (reference module fills selection + anchor ranking). */
  debug?: Partial<ConditioningDebug>;
};

/**
 * Debug trace surfaced back through `GenerationDebug`. `selection` is structurally identical to the
 * generation layer's `ReferenceSelectionDebug` so the seam maps directly with no conversion.
 */
export type SelectionTrace = {
  requirements: string[];
  selected: { role: string; reason: string; satisfies: string[] }[];
  warnings: string[];
  allowedExposure: string;
  excludedForSafety: number;
};

export type ConditioningDebug = {
  strategy: ConditioningStrategy;
  engines: EngineId[];
  selection: SelectionTrace | null;
  anchorRanking: AnchorScore[];
  manual: boolean;
  engineNotes: string[]; // per non-reference module: why it did / didn't contribute
};

/**
 * The Identity Engine's answer to "how should I condition this identity?" — provider-neutral.
 * Generation applies `referenceImages` + `identityAnchor` exactly as today; `loraModelId` /
 * `adapterInputs` stay null until those engines ship.
 */
export type ConditioningPlan = {
  strategy: ConditioningStrategy;
  engines: EngineId[];
  referenceImages: ReferenceImage[];
  identityAnchor?: ReferenceImage;
  loraModelId: string | null;
  /** When the strategy includes a LoRA (Milestone 24): the weights URL + trigger phrase to apply. */
  loraWeightsUrl: string | null;
  loraTriggerWord: string | null;
  loraScale: number | null;
  /** When the strategy is PuLID (Milestone 24.5): the face reference + identity strength. */
  pulidReferenceUrl: string | null;
  pulidIdWeight: number | null;
  adapterInputs: Record<string, unknown> | null;
  reason: string;
  debug?: ConditioningDebug;
};
