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

export type HairKnowledge = { visible: boolean; color: string | null; length: HairLength };

/** Head pose in degrees; (0,0,0) ≈ looking straight at camera. yaw = left/right turn. */
export type FacePose = { yaw: number; pitch: number; roll: number };

export type FaceKnowledge = {
  visible: boolean;
  orientation: FaceOrientation;
  confidence: number;
  pose: FacePose | null;
  smiling: boolean;
  eyesVisible: boolean;
};
export type BodyKnowledge = { framing: Framing; visibility: BodyVisibility; pose: string | null };
/** Visible tattoos only — never used for identification. `confidence` = how sure the provider is. */
export type TattooKnowledge = {
  location: string;
  description: string | null;
  confidence: number; // 0..1
};
export type LightingKnowledge = { setting: LightingSetting; quality: LightingQuality };

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
  tattooLocations: string[];
  averageQuality: number; // 0..100
  gaps: string[]; // e.g. "no full-body reference", "no clear front-facing face"
};

export const IDENTITY_METADATA_VERSION = "im-1";
