/**
 * Identity Engine (Milestone 22) — Identity Evaluation. ARCHITECTURE ONLY. No heavy ML.
 *
 * Eventually AI Studio compares a generated image against the identity and scores how well it was
 * preserved (face / tattoos / hair / accessories / pose / expression / lighting / composition →
 * overall). ALL metric slots are reserved now and return `null` — future evaluators (InsightFace for
 * face, embeddings for the rest) fill them without any schema or interface change. The default
 * evaluator is a no-op that reports `not-configured`, so callers can wire the seam today.
 */

/** One evaluation of a generated result against its identity. Mirrors the `IdentityEvaluation` model. */
export type IdentityEvaluation = {
  identityId: string;
  generationId: string | null;
  face: number | null;
  tattoos: number | null;
  hair: number | null;
  accessories: number | null;
  pose: number | null;
  expression: number | null;
  lighting: number | null;
  composition: number | null;
  overallIdentityScore: number | null;
  method: string; // "insightface" | "clip" | "not-configured"
  createdAt: Date;
};

export interface IdentityEvaluator {
  id: string;
  /** Score a generated image against the identity. */
  evaluate(identityId: string, generatedImageUrl: string): Promise<IdentityEvaluation>;
}

/** An empty evaluation with every metric reserved as `null` (the shape future evaluators fill). */
export function emptyEvaluation(
  identityId: string,
  generationId: string | null = null,
  method = "not-configured",
): IdentityEvaluation {
  return {
    identityId,
    generationId,
    face: null,
    tattoos: null,
    hair: null,
    accessories: null,
    pose: null,
    expression: null,
    lighting: null,
    composition: null,
    overallIdentityScore: null,
    method,
    createdAt: new Date(),
  };
}

/** Default evaluator — no ML configured. Returns the reserved-metrics shape so the seam is usable. */
export const notConfiguredEvaluator: IdentityEvaluator = {
  id: "not-configured",
  async evaluate(identityId: string): Promise<IdentityEvaluation> {
    return emptyEvaluation(identityId, null, "not-configured");
  },
};
