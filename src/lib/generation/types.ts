import type { MediaAsset } from "@/lib/media/types";

export type GenerateImageInput = {
  prompt: string;
  /** Optional — attached for provenance only; identity-aware prompting is NOT built yet. */
  identityId?: string;
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
