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
