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
  eligible: boolean; // passed the gate (face visible + frontal + has quality)
  chosen: boolean; // set by rankIdentityAnchors — the winning Face anchor
  reason: string; // human explanation of the outcome (chosen / why it lost / why ineligible)
};

/** Face prominence from resolution: a close-up is worth ~1.6× a full-body of equal face quality. */
const prominenceOf = (resolution: number): number => 0.4 + 0.6 * resolution;

/**
 * Identity-confidence policy (Milestone 25.2 Phase B): the minimum anchor `score` a face must reach to
 * be trusted as the Face Anchor. Below this we won't anchor identity on it (→ analyze the Hero on
 * demand, else refuse with NO_IDENTITY_ANCHOR). ONE tunable knob for the whole invariant — raise it to
 * be stricter about "who is this person" once the M26 evaluator provides real face similarity.
 */
export const FACE_ANCHOR_MIN_SCORE = 0.4;

/** Whether any candidate is a CONFIDENT face anchor (eligible AND score ≥ the confidence threshold). */
export function hasConfidentFace(candidates: SelectionCandidate[]): boolean {
  const best = pickIdentityAnchor(candidates);
  return best != null && scoreAnchor(best).score >= FACE_ANCHOR_MIN_SCORE;
}

/**
 * Score ONE candidate as an identity anchor — FACE quality × frontality × confidence × prominence.
 *
 * Eligibility is FACE-only: a headshot whose *body* is cropped is a GREAT face anchor, so the whole-image
 * `quality.cropped` flag ("important body parts cut off") must NOT disqualify it (that was the bug where a
 * clean portrait scored 0.000 and lost to a full-body). A face that is itself cut off already shows up as
 * low `face.quality` / high occlusion, so it's handled by the quality term, not the crop flag.
 */
export function scoreAnchor(c: SelectionCandidate): AnchorScore {
  const face = c.metadata.face;
  const q = face.quality;
  const orientation = face.orientation;
  const frontalness = FRONTALNESS[orientation];
  const faceQuality = q?.overall ?? 0;
  const resolution = q?.resolution ?? 0;
  const prominence = prominenceOf(resolution);
  const eligible = face.visible && frontalness > 0 && Boolean(q);
  const score = eligible ? frontalness * faceQuality * face.confidence * prominence : 0;

  // Per-candidate reason (why it's ineligible / weak). `rankIdentityAnchors` overrides for the winner.
  const reason = !face.visible
    ? "face not visible"
    : !q
      ? "no face-quality data"
      : frontalness === 0
        ? "face turned away (back)"
        : orientation.includes("profile")
          ? "profile angle"
          : score < FACE_ANCHOR_MIN_SCORE
            ? `weak face score ${score.toFixed(2)} (< ${FACE_ANCHOR_MIN_SCORE})`
            : "eligible";

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
    chosen: false,
    reason,
  };
}

/** Rank all candidates by anchor score, best first, and annotate the winner + why the rest lost. */
export function rankIdentityAnchors(candidates: SelectionCandidate[]): AnchorScore[] {
  const ranked = candidates.map(scoreAnchor).sort((a, b) => b.score - a.score);
  let winnerFound = false;
  for (const a of ranked) {
    if (!a.eligible) continue;
    if (!winnerFound) {
      a.chosen = true;
      a.reason = "chosen — strongest frontal face";
      winnerFound = true;
    } else if (a.reason === "eligible") {
      a.reason = "lower face score than the chosen anchor";
    }
  }
  return ranked;
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
