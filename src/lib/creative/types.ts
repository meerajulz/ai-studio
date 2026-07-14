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

/** Where a node sits in the frame. */
export type SpatialPosition =
  | "center"
  | "left"
  | "right"
  | "foreground"
  | "background"
  | "top"
  | "bottom";

/** A normalized spatial relationship type between two nodes. */
export type SpatialRelationType =
  | "on"
  | "under"
  | "in front of"
  | "behind"
  | "left of"
  | "right of"
  | "next to"
  | "inside"
  | "above"
  | "below"
  | "over"
  | "holding"
  | "looking at"
  | "riding";

/** One thing in the scene graph — an entity with optional descriptor + frame position. */
export type SceneNode = {
  id: string;
  token: string; // e.g. "sofa"
  kind: EntityKind;
  descriptor: string | null; // e.g. "red", "wooden", "tall"
  position: SpatialPosition | null;
};

/** A directed spatial edge: `from` <type> `to` (node ids). */
export type SceneRelationship = {
  from: string;
  type: SpatialRelationType;
  to: string;
};

/**
 * Stage 1.5 output — a lightweight, INTERNAL scene graph (nodes + relationships). Exists only
 * during prompt generation; never stored in the database.
 */
export type SceneGraph = {
  nodes: SceneNode[];
  relationships: SceneRelationship[];
  root: string | null; // the anchor/primary node id
};

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
 * Identity Context — a PASSIVE snapshot of a selected identity, loaded by the generation layer
 * (which does the I/O) and handed to the Director. Identity never reasons or touches a provider;
 * it only provides context for the Director to reason over. `providerArtifacts` is reserved for a
 * future milestone (LoRA/embeddings) and is unused today.
 */
export type IdentityContext = {
  id: string;
  name: string;
  description: string | null;
  hasHeroImage: boolean;
  trainingMediaCount: number;
  providerArtifacts?: Record<string, never>; // reserved — NOT used yet
};

/** Stage 0 output — how the Director wove the identity into its reasoning (for meta/debug). */
export type IdentityReasoning = {
  present: boolean;
  name: string | null;
  /** The subject reference woven into the scene, e.g. "Emma, a young woman with red hair". */
  referencePhrase: string | null;
  /** Signals the Director considered (transparency only — no provider artifacts used yet). */
  signals: {
    hasDescription: boolean;
    hasHeroImage: boolean;
    trainingMediaCount: number;
  };
};

/**
 * A creative brief — the user's INTENT, never technical settings. `idea` is required; the
 * rest are optional (the Director fills sensible defaults).
 */
export type CreativeBrief = {
  idea: string;
  style?: CreativeStyle;
  focus?: CreativeFocus;
  /** Provenance only — the identity id attached to the generation record. */
  identityId?: string | null;
  /**
   * Optional Identity Context (Milestone 14). When present, the Director's Identity stage weaves
   * the identity into its reasoning. Passive — loaded upstream; the Director never fetches it.
   */
  identity?: IdentityContext | null;
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
    identity: IdentityReasoning;
    scene: Scene;
    graph: SceneGraph;
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
