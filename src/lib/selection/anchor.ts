/**
 * Identity Anchor (Milestone 20 — architectural invariant).
 *
 * A different question from the Smart Reference Selector:
 *   • Reference Selector → "What images best DESCRIBE this request?" (scene: body, tattoos, smile…)
 *   • Identity Anchor    → "WHO is this person?"
 *
 * Every identity generation includes exactly ONE anchor: the strongest, most PROMINENT frontal face —
 * chosen on FACE quality only (never body coverage or overall image utility), with an explicit
 * **prominence** term so a clear close-up beats a full-body studio shot whose face is small. Pure +
 * deterministic + provider-neutral.
 */
import type { FaceOrientation } from "@/lib/vision";
import type { SelectionCandidate } from "./types";

/** How usable a face orientation is as an identity anchor (frontal is best; a back view is useless). */
const FRONTALNESS: Record<FaceOrientation, number> = {
  front: 1,
  "three-quarter": 0.7,
  "left-profile": 0.3,
  "right-profile": 0.3,
  profile: 0.3,
  back: 0,
  unknown: 0,
};

/** Full anchor-scoring breakdown for one candidate (for the dev diagnostic). */
export type AnchorScore = {
  mediaId: string;
  url: string;
  faceVisible: boolean;
  cropped: boolean;
  orientation: FaceOrientation;
  frontalness: number; // 0..1
  faceQuality: number; // 0..1 (per-component overall)
  sharpness: number;
  lighting: number;
  eyeVisibility: number;
  resolution: number; // face-size proxy (headshot≈1, full-body≈0.35)
  prominence: number; // derived from resolution — how much of the frame the face fills
  confidence: number;
  score: number; // final anchor score
  eligible: boolean; // passed the gate (visible, not cropped, some frontality)
};

/** Face prominence from resolution: a close-up is worth ~1.6× a full-body of equal face quality. */
const prominenceOf = (resolution: number): number => 0.4 + 0.6 * resolution;

/** Score ONE candidate as an identity anchor — FACE quality × frontality × confidence × prominence. */
export function scoreAnchor(c: SelectionCandidate): AnchorScore {
  const face = c.metadata.face;
  const q = face.quality;
  const orientation = face.orientation;
  const frontalness = FRONTALNESS[orientation];
  const faceQuality = q?.overall ?? 0;
  const resolution = q?.resolution ?? 0;
  const prominence = prominenceOf(resolution);
  const eligible = face.visible && !c.metadata.quality.cropped && frontalness > 0 && Boolean(q);
  const score = eligible ? frontalness * faceQuality * face.confidence * prominence : 0;
  return {
    mediaId: c.mediaId,
    url: c.url,
    faceVisible: face.visible,
    cropped: c.metadata.quality.cropped,
    orientation,
    frontalness,
    faceQuality,
    sharpness: q?.sharpness ?? 0,
    lighting: q?.lighting ?? 0,
    eyeVisibility: q?.eyeVisibility ?? 0,
    resolution,
    prominence,
    confidence: face.confidence,
    score,
    eligible,
  };
}

/** Rank all candidates by anchor score, best first (for the dev anchor diagnostic). */
export function rankIdentityAnchors(candidates: SelectionCandidate[]): AnchorScore[] {
  return candidates.map(scoreAnchor).sort((a, b) => b.score - a.score);
}

/**
 * Pick the identity anchor: the strongest, most prominent frontal face. Returns `null` when no
 * candidate shows a usable face (e.g. every image is a back view).
 */
export function pickIdentityAnchor(candidates: SelectionCandidate[]): SelectionCandidate | null {
  let best: SelectionCandidate | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = scoreAnchor(c);
    if (s.eligible && s.score > bestScore) {
      best = c;
      bestScore = s.score;
    }
  }
  return best;
}
