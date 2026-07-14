/**
 * Identity Image Scoring (Milestone 19) — PER-IMAGE quality ranking.
 *
 * The critical distinction (see docs/IDENTITY_INTELLIGENCE.md):
 *   • **Coverage** (identity-level) answers "what is MISSING across the reference set?"
 *   • **Image scoring** (per-image) answers "which INDIVIDUAL image is best?"
 * Both are needed for intelligent reference selection. This engine makes the identity library
 * self-curating: upload many, rank them, keep/select the strongest.
 *
 * Pure + deterministic + provider-neutral — it reads only normalized `IdentityMetadata` knowledge.
 */
import type { FaceOrientation, IdentityMetadata } from "./types";

export const IMAGE_SCORE_VERSION = "score-1";

export type IdentityImageScore = {
  faceQuality: number; // 0..100
  tattooVisibility: number; // 0..100 (0 if none visible)
  bodyCoverage: number; // 0..100 (how much of the body is in frame)
  hairVisibility: number; // 0..100
  lighting: number; // 0..100
  sharpness: number; // 0..100
  expression: string | null; // e.g. "smiling"
  overall: number; // 0..100 weighted
  usable: boolean;
  reasons: string[]; // human-readable strengths / weaknesses
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);

const ORIENTATION_PENALTY: Record<FaceOrientation, number> = {
  front: 0,
  "three-quarter": 8,
  "left-profile": 20,
  "right-profile": 20,
  profile: 20,
  back: 45,
  unknown: 10,
};

function scoreFaceQuality(m: IdentityMetadata): number {
  if (!m.face.visible) return 0;
  const sharp = m.quality.sharpness; // 0..1
  const base = m.face.confidence * 70 + sharp * 30;
  const penalty =
    ORIENTATION_PENALTY[m.face.orientation] +
    (m.quality.occlusion ? 20 : 0) +
    (m.face.eyesVisible ? 0 : 10);
  return round(clamp(base - penalty));
}

function scoreBodyCoverage(m: IdentityMetadata): number {
  switch (m.body.framing) {
    case "full-body":
      return 100;
    case "half-body":
      return 60;
    case "headshot":
      return 30;
    default:
      break;
  }
  switch (m.body.visibility) {
    case "full":
      return 90;
    case "upper":
      return 55;
    case "face":
      return 25;
    default:
      return 40;
  }
}

function scoreTattooVisibility(m: IdentityMetadata): number {
  if (m.tattoos.length === 0) return 0;
  return round(clamp(40 + m.tattoos.length * 15 + m.quality.sharpness * 20 - (m.quality.occlusion ? 15 : 0)));
}

function scoreHairVisibility(m: IdentityMetadata): number {
  if (!m.hair.visible) return 10;
  return round(clamp(60 + (m.hair.length !== "unknown" ? 20 : 0) + (m.hair.color ? 20 : 0)));
}

function scoreLighting(m: IdentityMetadata): number {
  const base =
    { even: 90, soft: 85, backlit: 55, harsh: 50, unknown: 65 }[m.lighting.quality] ?? 65;
  const exposurePenalty = Math.abs(m.quality.exposure - 0.6) * 60;
  return round(clamp(base - exposurePenalty));
}

export function scoreIdentityImage(m: IdentityMetadata): IdentityImageScore {
  const faceQuality = scoreFaceQuality(m);
  const tattooVisibility = scoreTattooVisibility(m);
  const bodyCoverage = scoreBodyCoverage(m);
  const hairVisibility = scoreHairVisibility(m);
  const lighting = scoreLighting(m);
  const sharpness = round(m.quality.sharpness * 100);
  const expression = m.expression ?? (m.face.smiling ? "smiling" : null);

  const overall = round(
    faceQuality * 0.35 +
      sharpness * 0.15 +
      bodyCoverage * 0.15 +
      lighting * 0.15 +
      hairVisibility * 0.1 +
      tattooVisibility * 0.1,
  );

  const reasons: string[] = [];
  if (m.face.visible && m.face.orientation === "front") reasons.push("front face");
  if (m.face.smiling) reasons.push("smiling");
  if (m.body.framing === "full-body") reasons.push("full body");
  if (m.tattoos.length > 0) reasons.push(`${m.tattoos.length} tattoo area(s) visible`);
  if (sharpness < 40) reasons.push("blurry");
  if (m.quality.occlusion) reasons.push("occluded");
  if (m.face.orientation === "back") reasons.push("face not visible (back)");
  if (lighting < 45) reasons.push("poor lighting");

  return {
    faceQuality,
    tattooVisibility,
    bodyCoverage,
    hairVisibility,
    lighting,
    sharpness,
    expression,
    overall,
    usable: m.quality.usable,
    reasons,
  };
}

export type ScoredImage = { metadata: IdentityMetadata; score: IdentityImageScore };

/** Score + rank an identity's images, strongest first. The basis for self-curating libraries. */
export function rankIdentityImages(metadatas: IdentityMetadata[]): ScoredImage[] {
  return metadatas
    .map((metadata) => ({ metadata, score: scoreIdentityImage(metadata) }))
    .sort((a, b) => b.score.overall - a.score.overall);
}
