/**
 * Creative Director — types (Milestone 13, Creative Director v2: Scene Understanding).
 *
 * The Creative Director is a deterministic, provider-agnostic reasoning pipeline that turns a
 * user's plain IDEA into a professional prompt:
 *
 *   idea → Scene Analysis → Intent Analysis → Composition Planning → Prompt Compilation
 *
 * Each stage has a single responsibility and returns structured data. No stage knows anything
 * about a provider; only the final compiled `prompt` leaves the layer. See docs/CREATIVE_DIRECTOR.md.
 */

/** Optional creative question #1 ("What style?"). */
export type CreativeStyle = "realistic" | "cinematic" | "illustration" | "fantasy";

/** Optional creative question #2 ("What matters most?"). "auto" lets the Director decide. */
export type CreativeFocus = "auto" | "face" | "environment" | "product" | "action";

/** The kind of a detected scene entity. `object` is the neutral catch-all. */
export type EntityKind =
  | "person"
  | "animal"
  | "furniture"
  | "plant"
  | "vehicle"
  | "food"
  | "product"
  | "architecture"
  | "fantasy"
  | "nature"
  | "object";

export type Environment = "indoor" | "outdoor" | "unknown";

/** A single thing detected in the idea, with where it appeared (drives primary ordering). */
export type SceneEntity = {
  token: string;
  kind: EntityKind;
  index: number;
};

/** Stage 1 output — the whole scene, not just the first keyword. */
export type Scene = {
  primarySubject: SceneEntity | null;
  secondarySubjects: SceneEntity[];
  objects: SceneEntity[];
  livingBeings: SceneEntity[];
  entities: SceneEntity[];
  environment: Environment;
  setting: string | null; // e.g. "living room", "beach", "city"
  location: string | null; // e.g. "Paris", "Tokyo"
  timeOfDay: string | null;
  weather: string | null;
  actions: string[];
  fantasyElements: string[];
};

/** What the user is actually trying to create (not just the subject). */
export type IntentType =
  | "portrait"
  | "lifestyle"
  | "interior-design"
  | "architecture"
  | "automotive"
  | "food-photography"
  | "product-photography"
  | "landscape"
  | "wildlife"
  | "concept-art"
  | "fashion"
  | "still-life";

/** Stage 2 output — the inferred creative intent + a human label + why. */
export type IntentAnalysis = {
  type: IntentType;
  label: string;
  rationale: string;
};

export type CameraDistance = "close-up" | "medium" | "wide" | "panoramic";
export type CameraAngle = "eye-level" | "low angle" | "high angle" | "aerial";
export type DepthOfField = "shallow" | "medium" | "deep";
export type RealismLevel =
  | "photorealistic"
  | "cinematic photorealistic"
  | "stylized illustration"
  | "concept art";

/** Stage 3 output — how to shoot the scene. */
export type CompositionPlan = {
  framing: string;
  cameraDistance: CameraDistance;
  cameraAngle: CameraAngle;
  composition: string;
  perspective: string | null;
  depthOfField: DepthOfField;
  lighting: string;
  realism: RealismLevel;
  qualityFloor: string[];
};

/**
 * A creative brief — the user's INTENT, never technical settings. `idea` is required; the
 * rest are optional (the Director fills sensible defaults).
 */
export type CreativeBrief = {
  idea: string;
  style?: CreativeStyle;
  focus?: CreativeFocus;
  /**
   * The selected identity, if any. The Director is AWARE an identity exists (architecture
   * prep) but does NOT do identity-aware prompting yet.
   */
  identityId?: string | null;
};

/** The Director's output: a professional prompt + reserved params + full reasoning trace. */
export type CreativeDirective = {
  prompt: string;
  params: Record<string, unknown>; // reserved (aspect/quality tier) — future
  meta: {
    version: string;
    idea: string;
    style: CreativeStyle;
    /** The full reasoning trace (also powers the dev Debug panel). */
    scene: Scene;
    intent: IntentAnalysis;
    composition: CompositionPlan;
    /** Everything the Director added beyond the user's own words. */
    appliedModifiers: string[];
    identityAware: boolean;
  };
};

export const CREATIVE_DIRECTOR_VERSION = "cd-2";
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
