/**
 * Identity Evaluation — pluggable evaluator modules (Milestone 26).
 *
 * This is an Identity Evaluation ENGINE, not a face evaluator: every dimension follows the SAME pattern
 * (`face` first; `tattoo` / `body` / `hair` / `pose` register-disabled and light up with no engine
 * change — symmetric with the IdentityModule + Trainer registries). Each module returns a normalized
 * `{ score, confidence, details }`; the engine only aggregates. Providers are hidden behind the injected
 * `embed` / `compare` capabilities, so an evaluator never knows whether a score came from embeddings, a
 * direct-comparison API, or a future multimodal model.
 */
import type { Embedding } from "../providers";

export type EvalDimension = "face" | "tattoo" | "body" | "hair" | "pose";

/** One reference/target image, optionally labeled by its Identity-Package role (Face/Canonical/…). */
export type EvalImage = { mediaId: string; url: string; role?: string };

export type EvalContext = {
  identityId: string;
  generated: EvalImage; // the generated image to score
  references: EvalImage[]; // the identity's semantic anchors (Face/Canonical), supplied by the engine
  /** Cache-backed embedder (present when the active provider supports `embed`). Provider-neutral. */
  embed?: (img: EvalImage, source: "uploaded" | "generated") => Promise<Embedding | null>;
  /** Direct 0..1 comparison (present when the active provider supports `compare`). Provider-neutral. */
  compare?: (aUrl: string, bUrl: string) => Promise<number | null>;
};

/** The uniform result EVERY evaluator returns (face, tattoo, body, … all the same shape). */
export type EvalResult = {
  dimension: EvalDimension;
  score: number | null; // 0..1, or null when not measurable
  confidence: number | null; // 0..1 — how trustworthy this score is (e.g. anchor coverage)
  details?: Record<string, unknown>; // per-anchor breakdown, provider notes, … (persisted in metrics)
};

export interface Evaluator {
  id: string;
  dimension: EvalDimension;
  enabled: boolean;
  weight: number; // contribution to overallIdentityScore
  evaluate(ctx: EvalContext): Promise<EvalResult>;
}
