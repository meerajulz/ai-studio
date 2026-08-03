/**
 * Face similarity — provider interface (Milestone 26). Provider-NEUTRAL + CAPABILITY-BASED.
 *
 * The 2026 ecosystem splits two ways and we model BOTH instead of forcing everything into embeddings:
 *   • `embed`   — returns a face vector (self-hosted InsightFace/AuraFace, …). CACHEABLE: embed once,
 *                 reuse across every generation + benchmark (only new images cost a call).
 *   • `compare` — returns a similarity score directly (AWS Rekognition / Azure Face / Face++, …).
 *                 Zero infra, but not cacheable (both images are re-sent each call).
 *
 * A provider implements whichever it supports; the Face Evaluator prefers `embed` (for caching) and
 * falls back to `compare`. The Identity Evaluation Engine never sees any of this — it consumes only
 * normalized `FaceEvaluation` scores. Concrete providers (AuraFace, Rekognition, …) are POSTPONED until
 * the abstraction is settled (Decision: validate before optimizing). See docs/IDENTITY_EVALUATION.md.
 */

/** A face embedding + the provider VERSION that produced it (the cache key — scores never mix versions). */
export type Embedding = {
  vector: number[];
  dim: number;
  version: string; // e.g. "auraface-v1" — bump to invalidate every cached embedding at once
};

export type FaceSimilarityErrorCode = "MISSING_TOKEN" | "PROVIDER_UNAVAILABLE" | "PROVIDER_FAILED" | "TIMEOUT";

export class FaceSimilarityError extends Error {
  readonly code: FaceSimilarityErrorCode;
  constructor(code: FaceSimilarityErrorCode, message: string) {
    super(message);
    this.name = "FaceSimilarityError";
    this.code = code;
  }
}

export interface FaceSimilarityProvider {
  id: string; // "auraface" | "aws-rekognition" | …
  /** Cache-key version. A new backend/model → a new version → automatic recompute; scores never mix. */
  version: string;
  isConfigured(): boolean;
  /** Embed the dominant face (cacheable path). `null` = no face detected. Absent = provider can't embed. */
  embed?(imageUrl: string): Promise<Embedding | null>;
  /** Direct 0..1 similarity of the dominant face in two images. `null` = no face. Absent = can't compare. */
  compare?(aUrl: string, bUrl: string): Promise<number | null>;
}

export const supportsEmbed = (
  p: FaceSimilarityProvider,
): p is FaceSimilarityProvider & Required<Pick<FaceSimilarityProvider, "embed">> => typeof p.embed === "function";

export const supportsCompare = (
  p: FaceSimilarityProvider,
): p is FaceSimilarityProvider & Required<Pick<FaceSimilarityProvider, "compare">> =>
  typeof p.compare === "function";

/** The always-present fallback: no backend wired yet → evaluation reports `not-configured`, nothing breaks. */
export const notConfiguredProvider: FaceSimilarityProvider = {
  id: "not-configured",
  version: "not-configured",
  isConfigured: () => false,
};
