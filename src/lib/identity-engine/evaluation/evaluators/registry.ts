/**
 * Evaluator registry (Milestone 26) — face enabled; the rest registered-but-disabled placeholders so
 * new dimensions light up the engine with no redesign (symmetric with IDENTITY_MODULES / trainers).
 * Disabled evaluators exist only to document the shape; their score stays `null`.
 */
import { faceEvaluator } from "./face";
import type { Evaluator, EvalDimension } from "./types";

/** A no-op evaluator for a not-yet-built dimension (reserves the slot; always `null`). */
function disabled(dimension: EvalDimension): Evaluator {
  return {
    id: dimension,
    dimension,
    enabled: false,
    weight: 0,
    async evaluate() {
      return { dimension, score: null, detail: { reason: "evaluator not enabled" } };
    },
  };
}

export const EVALUATORS: Evaluator[] = [
  faceEvaluator,
  disabled("tattoo"),
  disabled("body"),
  disabled("hair"),
  disabled("pose"),
];

export const enabledEvaluators = (): Evaluator[] => EVALUATORS.filter((e) => e.enabled);
