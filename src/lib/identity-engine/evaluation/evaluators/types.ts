/**
 * Identity Evaluation — pluggable evaluator modules (Milestone 26).
 *
 * This is an Identity Evaluation ENGINE, not a face evaluator: `face` is the first module; `tattoo` /
 * `body` / `hair` / `pose` are registered but disabled and land later WITHOUT touching the engine
 * (symmetric with the IdentityModule + Trainer registries). Each module scores ONE dimension 0..1 (or
 * `null` when it can't — e.g. no face detected) from provider-neutral embeddings.
 */
import type { FaceEmbedding } from "../providers";

export type EvalDimension = "face" | "tattoo" | "body" | "hair" | "pose";

/** One reference/target image the engine can embed (provider-neutral; the engine supplies `embed`). */
export type EvalImage = { mediaId: string; url: string };

export type EvalContext = {
  identityId: string;
  generated: EvalImage; // the generated image to score
  references: EvalImage[]; // the identity's reference images (already ranked/curated by the engine)
  /** Cache-backed embedder the engine injects (so evaluators stay provider-neutral + offline-testable). */
  embed: (img: EvalImage, source: "uploaded" | "generated") => Promise<FaceEmbedding | null>;
};

export type EvalResult = {
  dimension: EvalDimension;
  score: number | null; // 0..1, or null when not measurable
  detail?: Record<string, unknown>; // e.g. per-reference similarities (persisted in metrics)
};

export interface Evaluator {
  id: string;
  dimension: EvalDimension;
  enabled: boolean;
  weight: number; // contribution to overallIdentityScore
  evaluate(ctx: EvalContext): Promise<EvalResult>;
}
