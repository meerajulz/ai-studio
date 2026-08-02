/**
 * Identity Evaluation — Embedding Provider (Milestone 26). Provider-NEUTRAL.
 *
 * The Identity Evaluation Engine knows NOTHING about InsightFace/ArcFace/Replicate/Fal — only this
 * interface. It consumes embedding vectors (+ a version string) and computes similarity itself. Today's
 * concrete backend is a hosted endpoint; tomorrow it could be Fal, a self-hosted InsightFace service, or
 * a future model — with zero engine change (mirrors `ImageProvider` / `VisionProvider`).
 */

/** A face embedding + the evaluator VERSION that produced it (the cache key — scores never mix versions). */
export type FaceEmbedding = {
  vector: number[];
  dim: number;
  version: string; // e.g. "arcface-v1" — bump to invalidate every cached embedding at once
};

export type EmbeddingProviderErrorCode =
  | "MISSING_TOKEN"
  | "PROVIDER_UNAVAILABLE"
  | "EMBED_FAILED"
  | "TIMEOUT";

export class EmbeddingProviderError extends Error {
  readonly code: EmbeddingProviderErrorCode;
  constructor(code: EmbeddingProviderErrorCode, message: string) {
    super(message);
    this.name = "EmbeddingProviderError";
    this.code = code;
  }
}

export function isEmbeddingProviderError(e: unknown): e is EmbeddingProviderError {
  return e instanceof EmbeddingProviderError;
}

export interface EmbeddingProvider {
  id: string; // "replicate-arcface"
  model: string; // exact hosted model id (isolated inside the provider)
  /** Cache-key version. Everything cached under it; a new backend/model → a new version → auto-recompute. */
  version: string;
  isConfigured(): boolean;
  /** Embed the dominant face in an image. Returns `null` when no face is detected (not an error). */
  embedFace(imageUrl: string): Promise<FaceEmbedding | null>;
}
