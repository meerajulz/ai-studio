import type {
  CompositionPlan,
  CreativeFocus,
  CreativeStyle,
  IntentAnalysis,
  Scene,
} from "@/lib/creative";
import type { MediaAsset } from "@/lib/media/types";

export type GenerateImageInput = {
  /** The user's creative idea in plain words — the Creative Director enriches it. */
  prompt: string;
  /** Optional — attached for provenance only; identity-aware prompting is NOT built yet. */
  identityId?: string;
  /** Optional creative direction ("What style?"). Defaults to realistic in the Director. */
  style?: CreativeStyle;
  /** Optional emphasis ("What matters most?"). Defaults to auto-detect in the Director. */
  focus?: CreativeFocus;
};

/**
 * Development-only trace of one generation — the Creative Director's full reasoning pipeline
 * (scene → intent → composition → prompt) plus the request actually sent to the provider.
 * Populated ONLY when NODE_ENV !== "production"; `undefined` in production so nothing internal
 * leaks. Contains no secrets.
 */
export type GenerationDebug = {
  idea: string; // what the user typed
  scene: Scene; // Stage 1 — scene analysis
  intent: IntentAnalysis; // Stage 2 — intent analysis
  composition: CompositionPlan; // Stage 3 — composition plan
  rulesApplied: string[]; // everything the Director added beyond the user's words
  compiledPrompt: string; // Stage 4 — the prompt sent to the provider
  provider: string;
  model: string;
  payload: Record<string, unknown>; // secret-free echo of the provider request
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
