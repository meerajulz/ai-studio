/**
 * Observations → Knowledge (Milestone 18A — the architectural spine).
 *
 * A `VisionProvider` describes an image (loose `VisionObservation`). AI Studio does NOT store that —
 * it normalizes the observation into strict, provider-neutral `IdentityMetadata` knowledge. Pure +
 * deterministic; no I/O, no provider SDKs. Any provider's output flows through here, so swapping
 * providers never changes what AI Studio stores. See docs/IDENTITY_INTELLIGENCE.md.
 *
 * 18A ships the shape + safe defaults + a deterministic quality composite. Richer field parsing
 * arrives with the first real provider in 18B (which will emit well-keyed observations).
 */
import {
  IDENTITY_METADATA_VERSION,
  type BodyVisibility,
  type FaceOrientation,
  type Framing,
  type HairLength,
  type IdentityMetadata,
  type ImageEmbedding,
  type ImageQuality,
  type LightingQuality,
  type LightingSetting,
  type TattooKnowledge,
  type VisionObservation,
} from "./types";

// ── safe readers over the loose observation bags ─────────────────────────────
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const bool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
const clamp01 = (v: unknown, d = 0): number =>
  typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : d;
const numRaw = (v: unknown, d = 0): number =>
  typeof v === "number" && !Number.isNaN(v) ? v : d;
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const ORIENTATIONS = [
  "front",
  "three-quarter",
  "left-profile",
  "right-profile",
  "profile",
  "back",
  "unknown",
] as const;
const FRAMINGS = ["headshot", "half-body", "full-body", "unknown"] as const;
const BODY_VIS = ["face", "upper", "full", "unknown"] as const;
const HAIR_LEN = ["short", "medium", "long", "unknown"] as const;
const LIGHT_SET = ["indoor", "outdoor", "studio", "unknown"] as const;
const LIGHT_QUAL = ["soft", "harsh", "backlit", "even", "unknown"] as const;

function toEmbedding(vector: number[] | null | undefined, model: string): ImageEmbedding {
  return vector && vector.length ? { model, dims: vector.length, vector } : null;
}

function toTattoos(v: unknown): TattooKnowledge[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t) => {
      if (typeof t === "string") return { location: t, description: null, confidence: 1 };
      const r = rec(t);
      // Gemini may key the area as `location` or `region`.
      const location = str(r.location) ?? str(r.region);
      return location
        ? { location, description: str(r.description), confidence: clamp01(r.confidence, 1) }
        : null;
    })
    .filter((t): t is TattooKnowledge => t !== null);
}

/** Read a provider `confidence` bag into a clean {attribute: 0..1} map. */
function toConfidenceMap(v: unknown): Record<string, number> {
  const src = rec(v);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(src)) {
    if (typeof val === "number") out[k] = clamp01(val);
  }
  return out;
}

/** Deterministic technical-quality composite (0..100) + a usability gate. */
function toQuality(q: Record<string, unknown>): ImageQuality {
  const sharpness = clamp01(q.sharpness, 0);
  const exposure = clamp01(q.exposure, 0.5);
  const faceVisible = bool(q.faceVisible, false);
  const occlusion = bool(q.occlusion, false);
  const cropped = bool(q.cropped, false);
  const aesthetic = typeof q.aesthetic === "number" ? clamp01(q.aesthetic) : null;
  const resW = typeof q.width === "number" ? q.width : null;
  const resH = typeof q.height === "number" ? q.height : null;

  const overall = Math.round(
    (sharpness * 0.45 + exposure * 0.25 + (faceVisible ? 0.2 : 0) + (aesthetic ?? 0) * 0.1) * 100,
  );

  const issues: string[] = [];
  if (sharpness < 0.4) issues.push("low sharpness / blurry");
  if (exposure < 0.3 || exposure > 0.9) issues.push("poor exposure");
  if (!faceVisible) issues.push("face not clearly visible");
  if (occlusion) issues.push("subject occluded");
  if (cropped) issues.push("important body parts cropped");

  const usable = overall >= 50 && !occlusion && !cropped;

  return {
    sharpness,
    exposure,
    faceVisible,
    occlusion,
    cropped,
    resolution: resW && resH ? { width: resW, height: resH } : null,
    aesthetic,
    overall,
    usable,
    issues,
  };
}

/** Derive a coarse orientation from a head-yaw angle (degrees) when the provider gives only pose. */
function orientationFromYaw(yaw: number): FaceOrientation {
  const a = Math.abs(yaw);
  if (a <= 20) return "front";
  if (a <= 55) return "three-quarter";
  return yaw < 0 ? "left-profile" : "right-profile";
}

/** Turn one provider observation into AI Studio knowledge. Pure + deterministic. */
export function normalizeToIdentityMetadata(obs: VisionObservation): IdentityMetadata {
  const a = rec(obs.attributes);
  const scene = rec(obs.scene);

  const hasPose = a.faceYaw != null || a.facePitch != null || a.faceRoll != null;
  const pose = hasPose
    ? { yaw: numRaw(a.faceYaw), pitch: numRaw(a.facePitch), roll: numRaw(a.faceRoll) }
    : null;
  const orientation = str(a.faceOrientation)
    ? oneOf<FaceOrientation>(a.faceOrientation, ORIENTATIONS, "unknown")
    : pose
      ? orientationFromYaw(pose.yaw)
      : "unknown";

  return {
    version: IDENTITY_METADATA_VERSION,
    hair: {
      visible: bool(a.hairVisible, str(a.hairColor) !== null),
      color: str(a.hairColor),
      length: oneOf<HairLength>(a.hairLength, HAIR_LEN, "unknown"),
    },
    face: {
      visible: bool(a.faceVisible, true),
      orientation,
      // Default to a moderate confidence when a face is visible but the provider gave no score.
      confidence: clamp01(a.faceConfidence, bool(a.faceVisible, true) ? 0.7 : 0),
      pose,
      smiling: bool(a.smiling, false),
      eyesVisible: bool(a.eyesVisible, true),
    },
    body: {
      framing: oneOf<Framing>(a.framing, FRAMINGS, "unknown"),
      visibility: oneOf<BodyVisibility>(a.bodyVisibility, BODY_VIS, "unknown"),
      pose: str(a.pose),
    },
    tattoos: toTattoos(a.tattoos),
    accessories: strArr(a.accessories),
    facialHair: str(a.facialHair),
    ageRange: str(a.ageRange),
    expression: str(a.expression),
    clothing: strArr(a.clothing),
    lighting: {
      setting: oneOf<LightingSetting>(a.lightingSetting ?? scene.setting, LIGHT_SET, "unknown"),
      quality: oneOf<LightingQuality>(a.lightingQuality, LIGHT_QUAL, "unknown"),
    },
    environment: str(scene.environment),
    dominantColors: strArr(a.dominantColors),
    detectedObjects: strArr(obs.objects),
    quality: toQuality(rec(obs.quality)),
    embedding: toEmbedding(obs.embedding, obs.model),
    faceEmbedding: toEmbedding(obs.faceEmbedding, obs.model),
    caption: str(obs.caption),
    attributeConfidence: toConfidenceMap(a.confidence),
    source: { provider: obs.provider, model: obs.model, analyzedAt: new Date().toISOString() },
  };
}
