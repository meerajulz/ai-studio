import type { CreativeFocus, CreativeStyle } from "@/lib/creative";
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

export type GenerationResult = {
  generationId: string;
  media: MediaAsset; // the generated asset (source: "generated"), already in the Gallery
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
