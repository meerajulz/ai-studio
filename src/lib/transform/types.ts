/**
 * Transformation Planner (Milestone 25.1) — types.
 *
 * The transform-first thesis: our providers are EDITORS, not generators. When a known character is
 * moved into a new context, the strongest instruction to an edit model is an explicit contract —
 * "keep X, change only Y" — not a bare scene description. This plan captures that contract; it is
 * derived purely from data we already have (identity Vision knowledge + the analyzed scene). See
 * docs/CHARACTER_TRANSFORMATION.md §5 / §11.
 */

export type TransformationPlan = {
  /** False → the prompt is sent unchanged (no identity, no references, or nothing grounded to preserve). */
  applies: boolean;
  /** Identity-defining traits to hold constant (grounded in the character's Vision knowledge). */
  preserve: string[];
  /** What the request asks to vary (derived from the analyzed scene + the idea). */
  change: string[];
  /** The composed preserve-vs-change instruction, prepended to the scene prompt. Empty when !applies. */
  instruction: string;
  /** A negative prompt reinforcing preservation — computed always; SENT only where a model supports it
   * (deferred: no model advertises support yet, so M25.1 surfaces it for debug + future wiring). */
  negativePrompt: string | null;
};

/** Dev-only debug view of the plan (mirrors the plan; no secrets). */
export type TransformationDebug = {
  applies: boolean;
  preserve: string[];
  change: string[];
  instruction: string;
  negativePrompt: string | null;
};
