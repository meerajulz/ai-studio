/**
 * Identity Anchor (Milestone 20 — architectural invariant).
 *
 * A different question from the Smart Reference Selector:
 *   • Reference Selector → "What images best DESCRIBE this request?" (scene: body, tattoos, smile…)
 *   • Identity Anchor    → "WHO is this person?"
 *
 * Every identity generation includes exactly ONE anchor: the strongest frontal face — highest face
 * quality, highest identity confidence, never cropped — whose sole job is to tell the model who the
 * subject is. It is chosen INDEPENDENTLY of the scene selector and never appears in the selector's
 * reasoning/Debug; the provider adapter prepends it to the reference list before sending. Pure +
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

/**
 * Pick the identity anchor from an identity's analyzed candidates: the strongest, cleanest frontal
 * face. Returns `null` when no candidate shows a usable face (e.g. every image is a back view) — the
 * generation then simply proceeds without an anchor.
 */
export function pickIdentityAnchor(candidates: SelectionCandidate[]): SelectionCandidate | null {
  let best: SelectionCandidate | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const face = c.metadata.face;
    // Its only responsibility is identity → require a visible, uncropped face.
    if (!face.visible || c.metadata.quality.cropped) continue;
    const frontal = FRONTALNESS[face.orientation];
    if (frontal === 0) continue;
    const faceQuality = face.quality?.overall ?? 0; // 0..1
    const score = frontal * faceQuality * face.confidence;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
