/**
 * Vision layer — types (Milestone 18A — architecture only).
 *
 * THE GUIDING PRINCIPLE (see docs/IDENTITY_INTELLIGENCE.md):
 *   **The Vision provider gives OBSERVATIONS. AI Studio stores KNOWLEDGE.**
 *
 * A provider (a VLM, etc.) may say "woman with pink hair wearing a black bikini". AI Studio never
 * stores that sentence — it normalizes it into structured `IdentityMetadata` (hair {color,length,
 * visible}, face {orientation,confidence}, body, tattoos, quality, lighting, embedding). This split
 * — loose `VisionObservation` in, strict knowledge out — is the architectural spine of every future
 * Vision feature. See docs/research/RESEARCH_02_VISION.md §11.
 *
 * No APIs, no persistence, no providers in this milestone — types + pure logic only.
 */

// ── Provider output: OBSERVATIONS (raw, loose, provider-neutral) ─────────────

/**
 * What a `VisionProvider` returns — the provider's own observations. Deliberately loose (a caption
 * + best-effort attribute/quality/scene bags + optional embeddings). AI Studio NORMALIZES this into
 * `IdentityMetadata`; this shape is NEVER persisted as knowledge.
 */
export type VisionObservation = {
  caption?: string | null;
  attributes?: Record<string, unknown>;
  objects?: string[];
  quality?: Record<string, unknown>;
  scene?: Record<string, unknown>;
  embedding?: number[] | null; // whole-image embedding vector
  faceEmbedding?: number[] | null; // face embedding (SIMILARITY, not identification)
  provider: string;
  model: string;
  raw?: unknown; // provider payload, for dev debug only — never stored as knowledge
};

// ── AI Studio KNOWLEDGE: structured, normalized, provider-neutral ────────────

export type FaceOrientation =
  | "front"
  | "three-quarter"
  | "left-profile"
  | "right-profile"
  | "profile" // generic profile when the side is unknown
  | "back"
  | "unknown";
export type Framing = "headshot" | "half-body" | "full-body" | "unknown";
export type BodyVisibility = "face" | "upper" | "full" | "unknown";
export type HairLength = "short" | "medium" | "long" | "unknown";
export type LightingSetting = "indoor" | "outdoor" | "studio" | "unknown";
export type LightingQuality = "soft" | "harsh" | "backlit" | "even" | "unknown";

// ── Hair (Milestone 19A — richer style signals) ─────────────────────────────
export type HairTexture = "straight" | "wavy" | "curly" | "unknown";
export type HairParting = "center" | "side" | "none" | "unknown";
export type HairUpdo = "loose" | "tied-back" | "ponytail" | "bun" | "unknown";

export type HairKnowledge = {
  visible: boolean;
  color: string | null;
  length: HairLength;
  texture: HairTexture;
  parting: HairParting;
  updo: HairUpdo;
  bangs: boolean; // bangs / fringe present
  wet: boolean;
  windBlown: boolean;
};

/** Head pose in degrees; (0,0,0) ≈ looking straight at camera. yaw = left/right turn. */
export type FacePose = { yaw: number; pitch: number; roll: number };

/**
 * Structured facial expression / gaze (Milestone 19A). Booleans so routing can later ask
 * for, e.g., "an image where the identity is smiling with teeth" or "looking at camera".
 */
export type FaceExpression = {
  smiling: boolean;
  teethVisible: boolean;
  laughing: boolean;
  mouthOpen: boolean;
  eyesClosed: boolean;
  lookingAtCamera: boolean;
  lookingAway: boolean;
  squinting: boolean;
  serious: boolean;
};

/**
 * Per-component face quality (Milestone 19A). All components are "higher = better" EXCEPT
 * `occlusion`, which is the *amount* of occlusion (0 = clear .. 1 = fully blocked). `overall`
 * is DERIVED from the components — see `deriveFaceQuality` in normalize.ts. This replaces the
 * single opaque face score with signals routing can reason about ("great face, poor lighting").
 *
 * 19C — **unknown vs zero:** face quality is only meaningful when a face is visible. When it is
 * NOT, `face.quality` is `null` (*unavailable*), never a bag of zeros — a back view has NO face
 * quality, not a face quality of 0%. Consumers must treat `null` as "not measured".
 */
export type FaceQuality = {
  sharpness: number; // 0..1
  lighting: number; // 0..1
  occlusion: number; // 0..1 (0 = none, 1 = fully occluded)
  symmetry: number; // 0..1
  frontalness: number; // 0..1 (1 = dead-on front)
  eyeVisibility: number; // 0..1
  resolution: number; // 0..1 (relative pixel coverage of the face)
  overall: number; // 0..1 derived composite
};

export type FaceKnowledge = {
  visible: boolean;
  orientation: FaceOrientation;
  confidence: number;
  pose: FacePose | null;
  smiling: boolean; // kept for back-compat; mirrors `expression.smiling`
  eyesVisible: boolean;
  expression: FaceExpression;
  quality: FaceQuality | null; // null = unavailable (face not visible) — never zeros
};

/** Coarse visible body regions (Milestone 19A) — drives request-aware selection later. */
export type BodyRegion =
  | "head"
  | "neck"
  | "shoulders"
  | "torso"
  | "waist"
  | "hips"
  | "arms"
  | "hands"
  | "legs"
  | "feet";

export type BodyKnowledge = {
  framing: Framing;
  visibility: BodyVisibility;
  pose: string | null;
  visibleRegions: BodyRegion[];
  visiblePercent: number | null; // 0..100, approximate share of the body in frame
};

/**
 * Normalized tattoo body-region taxonomy (Milestone 19A). The provider may say "left arm";
 * the normalizer maps free text into ONE of these canonical regions so coverage + selection
 * are provider-independent. Generic `chest`/`back` cover the side-unknown case; `other` is
 * the safe catch-all.
 */
export type TattooRegion =
  | "left-shoulder"
  | "left-upper-arm"
  | "left-forearm"
  | "left-hand"
  | "right-shoulder"
  | "right-upper-arm"
  | "right-forearm"
  | "right-hand"
  | "chest-left"
  | "chest-right"
  | "chest"
  | "abdomen"
  | "hip"
  | "upper-back"
  | "lower-back"
  | "back"
  | "neck"
  | "left-thigh"
  | "right-thigh"
  | "left-calf"
  | "right-calf"
  | "feet"
  | "other";

/** Visible tattoos only — never used for identification. `confidence` = how sure the provider is. */
export type TattooKnowledge = {
  location: string; // raw provider text, kept for provenance
  region: TattooRegion; // normalized canonical region
  description: string | null;
  confidence: number; // 0..1
};
export type LightingKnowledge = { setting: LightingSetting; quality: LightingQuality };

/**
 * How useful this image is as a training reference, per FACET (Milestone 19A). Each 0..1.
 * Provider-supplied when available, else deterministically derived from knowledge. This is
 * METADATA that Smart Reference Selection (M20) will consume — it is NOT routing itself.
 */
export type ReferenceSuitability = {
  hero: number;
  faceReference: number;
  bodyReference: number;
  tattooReference: number;
  hairstyleReference: number;
  expressionReference: number;
  reason: string | null;
};

/** Technical quality of a reference image — drives the "reject poor references" gate. */
export type ImageQuality = {
  sharpness: number; // 0..1
  exposure: number; // 0..1
  faceVisible: boolean;
  occlusion: boolean;
  cropped: boolean; // important body parts cut off
  resolution: { width: number; height: number } | null;
  aesthetic: number | null; // 0..1, optional
  overall: number; // 0..100 composite
  usable: boolean; // passes the quality gate
  issues: string[]; // human-readable reasons it's weak
};

/** A stored embedding (for similarity / dedup / ranking / consistency). */
export type ImageEmbedding = { model: string; dims: number; vector: number[] } | null;

/** The KNOWLEDGE record AI Studio stores per identity image (normalized from observations). */
export type IdentityMetadata = {
  version: string;
  hair: HairKnowledge;
  face: FaceKnowledge;
  body: BodyKnowledge;
  tattoos: TattooKnowledge[];
  accessories: string[]; // glasses, sunglasses, hat, …
  facialHair: string | null;
  ageRange: string | null; // coarse only
  expression: string | null;
  clothing: string[];
  lighting: LightingKnowledge;
  environment: string | null;
  dominantColors: string[];
  detectedObjects: string[];
  quality: ImageQuality;
  referenceSuitability: ReferenceSuitability;
  embedding: ImageEmbedding;
  faceEmbedding: ImageEmbedding;
  caption: string | null; // human display / semantic search only
  /**
   * Per-attribute extraction confidence (0..1), keyed by attribute (e.g. `hairColor`,
   * `faceOrientation`). Lets routing avoid low-confidence signals ("don't use this image to
   * represent chest tattoos — the model was only 42% sure"). Empty when the provider gives none.
   */
  attributeConfidence: Record<string, number>;
  source: { provider: string; model: string; analyzedAt: string };
};

/**
 * The per-IDENTITY aggregate across all of its analyzed images. Answers "what does this identity's
 * reference set cover, and what's missing?" — the basis for automatic Hero/reference selection and
 * request-aware selection. (Extension beyond RESEARCH_02 §11's per-image record — see Decision 040.)
 */
export type IdentityCoverage = {
  totalImages: number;
  analyzedImages: number;
  usableImages: number;
  hasFrontFace: boolean;
  hasProfile: boolean;
  hasFullBody: boolean;
  hasUpperBody: boolean;
  hairColors: string[];
  tattooLocations: string[]; // raw provider text (provenance)
  tattooRegions: TattooRegion[]; // normalized canonical regions present across the set
  averageQuality: number; // 0..100
  gaps: string[]; // e.g. "no full-body reference", "no clear front-facing face"
};

/**
 * **FROZEN contract (Milestone 19C).** `im-2` is the stable, provider-neutral knowledge schema.
 * Future Vision providers (OpenAI, Qwen, Florence, …) must NORMALIZE their observations INTO this
 * shape — not extend it arbitrarily. Adding fields "just because a provider offers them" is how a
 * schema grows 300 unused columns. Any real change here is a deliberate, versioned bump (`im-3`)
 * with a migration story, not a drive-by addition. See docs/IDENTITY_INTELLIGENCE.md → "Frozen v2".
 */
export const IDENTITY_METADATA_VERSION = "im-2";
