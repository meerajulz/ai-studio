/**
 * Creative Director — types (Milestone 12, Creative Director MVP).
 *
 * The Creative Director is the intelligent translation layer between a user's creative IDEA
 * and the AI provider. The user "thinks creatively"; the Director "thinks technically" and
 * emits a professional, provider-neutral prompt. No provider/model/prompt-engineering concepts
 * appear here. See docs/CREATIVE_DIRECTOR.md.
 */

/** Optional creative question #1 ("What style?"). */
export type CreativeStyle = "realistic" | "cinematic" | "illustration" | "fantasy";

/** Optional creative question #2 ("What matters most?"). "auto" lets the Director decide. */
export type CreativeFocus = "auto" | "face" | "environment" | "product" | "action";

/**
 * A creative brief — the user's INTENT, never technical settings. `idea` is required; the
 * rest are optional (the Director fills sensible defaults).
 */
export type CreativeBrief = {
  /** What the user typed, in plain words (e.g. "my dog"). */
  idea: string;
  /** Optional creative direction. Defaults to `realistic`. */
  style?: CreativeStyle;
  /** Optional emphasis. Defaults to `auto` (subject-detected). */
  focus?: CreativeFocus;
  /**
   * The selected identity, if any. The Director is AWARE an identity exists (architecture
   * prep) but does NOT do identity-aware prompting yet — this is reserved for a later milestone.
   */
  identityId?: string | null;
};

/** The Director's output: a professional prompt + reserved params + transparency metadata. */
export type CreativeDirective = {
  /** The professional, provider-neutral prompt to send to the image provider. */
  prompt: string;
  /**
   * Structured generation params (aspect ratio, quality tier, …). Reserved — the MVP emits
   * an empty object; the provider adapter is where params map to a specific API.
   */
  params: Record<string, unknown>;
  /** Not sent to the provider — for the recipe, "View Recipe", and future debugging. */
  meta: {
    /** Enrichment version, so recipes stay reproducible as the Director evolves. */
    version: string;
    /** The original idea, echoed back. */
    idea: string;
    /** The resolved style (after defaults). */
    style: CreativeStyle;
    /** The resolved focus (after auto-detection). */
    focus: CreativeFocus;
    /** Everything the Director added beyond the user's own words. */
    appliedModifiers: string[];
    /** Whether an identity was present (identity-aware prompting is future). */
    identityAware: boolean;
  };
};

export const CREATIVE_DIRECTOR_VERSION = "cd-1";
export const DEFAULT_STYLE: CreativeStyle = "realistic";
export const DEFAULT_FOCUS: CreativeFocus = "auto";

/** Style options for the UI (label + value). The only "creative question" surfaced today. */
export const CREATIVE_STYLE_OPTIONS: ReadonlyArray<{
  value: CreativeStyle;
  label: string;
}> = [
  { value: "realistic", label: "Realistic" },
  { value: "cinematic", label: "Cinematic" },
  { value: "illustration", label: "Illustration" },
  { value: "fantasy", label: "Fantasy" },
];
