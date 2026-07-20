import type { ModelRoutingDecision, ProviderCapability, RoutingDecision } from "@/lib/ai";
import type { AnchorScore } from "@/lib/selection";
import type {
  CompiledStructure,
  CompositionPlan,
  CreativeFocus,
  CreativeStyle,
  IdentityReasoning,
  IntentAnalysis,
  Scene,
  SceneGraph,
} from "@/lib/creative";
import type { MediaAsset } from "@/lib/media/types";

/** Debug-safe summary of an Identity Visual Package (no signed URLs). */
export type VisualPackageSummary = {
  hasHeroImage: boolean;
  hasPortrait: boolean;
  hasFullBody: boolean;
  referenceImages: number;
  totalMedia: number;
};

export type GenerateImageInput = {
  /** The user's creative idea in plain words — the Creative Director enriches it. */
  prompt: string;
  /** Optional — attached for provenance only; identity-aware prompting is NOT built yet. */
  identityId?: string;
  /** Optional creative direction ("What style?"). Defaults to realistic in the Director. */
  style?: CreativeStyle;
  /** Optional emphasis ("What matters most?"). Defaults to auto-detect in the Director. */
  focus?: CreativeFocus;
  /**
   * DEV-only identity benchmark control: cap how many reference images are sent to the provider
   * (1–4). The Identity Anchor is always kept first, so `1` = anchor only. Lets us A/B identity
   * preservation with 1→4 references WITHOUT code changes. Ignored in production. Milestone 20.
   */
  maxReferences?: number;
  /**
   * DEV-only MANUAL reference override: send EXACTLY these training-media ids, in THIS order, to the
   * provider — bypassing the selector, the Identity Anchor, and the safety filter. For benchmarking
   * "does image A alone preserve identity? does A+B beat A+C?". Ignored in production. Milestone 20.
   */
  manualReferenceMediaIds?: string[];
  /**
   * DEV-only manual model id (identity benchmark — compare models with everything else identical).
   * Used only when `modelMode === "manual"`. Ignored in production. Milestone 20/21.
   */
  modelOverride?: string;
  /** Model selection mode (Milestone 21): "auto" = capability router picks; "manual" = the id above. */
  modelMode?: "auto" | "manual";
};

/**
 * Development-only trace of one generation — the Creative Director's full reasoning pipeline
 * (scene → intent → composition → prompt) plus the request actually sent to the provider.
 * Populated ONLY when NODE_ENV !== "production"; `undefined` in production so nothing internal
 * leaks. Contains no secrets.
 */
export type GenerationDebug = {
  idea: string; // what the user typed
  identity: IdentityReasoning; // Stage 0 — identity context
  scene: Scene; // Stage 1 — scene analysis
  graph: SceneGraph; // Stage 1.5 — spatial analysis (scene graph)
  intent: IntentAnalysis; // Stage 2 — intent analysis
  composition: CompositionPlan; // Stage 3 — composition plan
  compiledStructure: CompiledStructure; // Stage 4 — structured representation before rendering
  rulesApplied: string[]; // everything the Director added beyond the user's words
  compiledPrompt: string; // Stage 4 — the prompt sent to the provider
  provider: string; // chosen provider id
  model: string; // model actually used
  providerCapabilities: ProviderCapability[]; // what the chosen provider can do
  routing: RoutingDecision; // how the provider was chosen
  visualPackage: VisualPackageSummary | null; // identity reference images (Milestone 15)
  referenceImages: ReferenceImageDebug; // what was offered/sent to the provider (Milestone 17)
  referenceSelection: ReferenceSelectionDebug | null; // Smart Reference Selection trace (Milestone 20)
  anchorRanking: AnchorScore[]; // top identity-anchor candidates + face scoring breakdown (Milestone 20)
  conditioning: ConditioningDebugSummary | null; // Identity Engine strategy + engines (Milestone 22)
  modelRouting: ModelRoutingDecision | null; // capability model routing: chosen model + why (Milestone 21)
  responseMetadata: Record<string, unknown> | null; // provider response metadata (seed/timings/…)
  payload: Record<string, unknown>; // secret-free echo of the provider request
};

/** Which Identity Engine strategy conditioned this generation (Milestone 22). `reference` today. */
export type ConditioningDebugSummary = {
  strategy: string; // "reference" | "reference+lora" | …
  engines: string[]; // modules that contributed
  engineNotes: string[]; // per non-reference module: why it did / didn't contribute
};

/** Why the Smart Reference Selector chose this package (Milestone 20). `null` = static fallback used. */
export type ReferenceSelectionDebug = {
  requirements: string[]; // active prompt-requirement labels
  selected: { role: string; reason: string; satisfies: string[] }[];
  warnings: string[]; // hard requirements with no suitable reference
  allowedExposure: string; // max reference exposure the prompt permits (Reference Safety filter)
  excludedForSafety: number; // candidates dropped because they exceeded the allowed exposure
};

/** Which reference images were selected + sent to the provider, and why (Milestone 17). */
export type ReferenceImageDebug = {
  supportsReferenceImages: boolean;
  offered: number; // candidates AI Studio prepared (provider-neutral)
  offeredRoles: string[];
  sent: number; // what the provider/model actually used
  sentRoles: string[];
  sentImages: { url: string; role: string }[]; // the ACTUAL ordered images sent (dev thumbnails, M20)
  selectionReason: string;
  identityAnchor: boolean; // whether an Identity Anchor was prepended (Milestone 20)
  manual: boolean; // dev manual reference override was used (Milestone 20)
  modelMaxReferences: number | null; // the chosen model's own reference limit (Milestone 24)
  devCap: number | null; // dev References cap (1·2·3·4·Auto), null = Auto
  limitReason: string; // why fewer than offered were sent (empty when all offered were sent)
};

export type GenerationResult = {
  generationId: string;
  media: MediaAsset; // the generated asset (source: "generated"), already in the Gallery
  /** Dev-only Creative Director trace; `undefined` in production. */
  debug?: GenerationDebug;
};

export type GenerationStatusValue =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

/** One entry in a project's generation history — a recipe + its result (Decision 030). */
export type GenerationHistoryItem = {
  generationId: string;
  prompt: string;
  provider: string;
  model: string;
  identityId: string | null;
  status: GenerationStatusValue;
  createdAt: Date;
  media: MediaAsset | null; // the result (signed); null if it failed / has no output
};
