/**
 * Identity-score CALIBRATION (M27 follow-up, Phase 3) — display-only, PURE, no I/O.
 *
 * The evaluator stores a RAW ArcFace cosine (source of truth; see cosine.ts + evaluators/face.ts). Raw
 * cosine does NOT live on an intuitive 0–100 scale: same-identity real-vs-real clusters ~0.5–0.8, the
 * verification threshold sits ~0.28–0.4, and real-vs-generated is systematically depressed. Showing the
 * raw value as "32%" reads like failure when it's a borderline-positive match. This module maps a raw
 * cosine → a calibrated display score + a human band, WITHOUT touching the stored score.
 *
 * The mapping is a piecewise-linear curve through control points and a set of band cuts — both derived
 * from MEASURED distributions (run `scripts/benchmark-auraface.ts`, read its DISTRIBUTION SUMMARY, then
 * call `buildCalibration(...)` with the five means). `DEFAULT_CALIBRATION` is PROVISIONAL — placeholder
 * landmarks from ArcFace literature + the illustrative target scores; replace it with measured numbers
 * before trusting the display. NOT wired into any UI yet.
 */

/** A calibration control point: a raw cosine and the 0–100 display score it should map to. */
export type CalibrationPoint = { cosine: number; score: number };

/** A band cut: any raw cosine ≥ `minCosine` (and below the next-higher cut) falls in this band. */
export type BandCut = { minCosine: number; key: IdentityBandKey; label: string };

export type IdentityBandKey = "different-person" | "weak" | "good" | "very-good" | "excellent";

/** A full calibration: a monotone score curve + descending band cuts. */
export type Calibration = { curve: CalibrationPoint[]; bands: BandCut[] };

export type CalibratedIdentity = {
  /** The raw cosine, unchanged — always carried through so the source of truth is never lost. */
  cosine: number;
  /** 0–100 calibrated display score (unrounded; the UI decides precision). */
  score: number;
  band: { key: IdentityBandKey; label: string };
};

/**
 * The measured landmarks that define a calibration — one mean cosine per identity regime. Feed these
 * from the benchmark's DISTRIBUTION SUMMARY. `sameImage` defaults to ~1.0 (a deterministic model embeds
 * identical bytes to itself) so it's optional.
 */
export type CalibrationLandmarks = {
  differentPerson: number; // mean impostor cosine (wrong person)
  weakGen: number; // a poor generation that still resembles the identity
  goodGen: number; // an average/typical good generation
  bestGen: number; // the strongest generations you see
  realVsReal: number; // two real photos of the same identity
  sameImage?: number; // an image vs a re-encode of itself (default 0.99)
};

// The band ladder in ASCENDING severity, each with its target DISPLAY score. Assignment is by cosine
// RANK (lowest measured cosine → bottom rung), NOT by landmark name — so if a regime measures out of its
// expected order (e.g. best generations scoring as high as real-vs-real, which they do), the higher
// cosine simply earns the better label. The scores are a product decision; the cosines come from data.
const LADDER: { key: IdentityBandKey; label: string; score: number }[] = [
  { key: "different-person", label: "Different person", score: 8 },
  { key: "weak", label: "Weak", score: 42 },
  { key: "good", label: "Good", score: 74 },
  { key: "very-good", label: "Very good", score: 88 },
  { key: "excellent", label: "Excellent", score: 96 },
];
const SAME_IMAGE_SCORE = 100;

/** Linear interpolation of `x` over control points sorted ascending by cosine; clamped at both ends. */
function interpolate(x: number, points: CalibrationPoint[]): number {
  if (x <= points[0].cosine) return points[0].score;
  const last = points[points.length - 1];
  if (x >= last.cosine) return last.score;
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    if (x <= b.cosine) {
      const a = points[i - 1];
      const span = b.cosine - a.cosine;
      const t = span === 0 ? 0 : (x - a.cosine) / span;
      return a.score + t * (b.score - a.score);
    }
  }
  return last.score;
}

/**
 * Map a raw cosine → calibrated display score + band. PURE. `cosine` is echoed back untouched so callers
 * always keep the ground truth alongside the presentation value.
 */
export function calibrateIdentity(cosine: number, cal: Calibration = DEFAULT_CALIBRATION): CalibratedIdentity {
  const score = Math.max(0, Math.min(100, interpolate(cosine, cal.curve)));
  // bands are stored descending by minCosine; the first one the cosine clears wins.
  const cut = cal.bands.find((b) => cosine >= b.minCosine) ?? cal.bands[cal.bands.length - 1];
  return { cosine, score, band: { key: cut.key, label: cut.label } };
}

/**
 * Build a calibration from measured landmarks. The five landmark cosines are SORTED ascending and the
 * band ladder (score + label) is assigned by RANK — so score AND label are monotone in cosine BY
 * CONSTRUCTION, regardless of whether the regimes measured in their expected order. The score curve
 * threads each ranked point (plus (0,0) and (1,100) end anchors); band cuts sit at the MIDPOINT between
 * adjacent landmarks.
 */
export function buildCalibration(l: CalibrationLandmarks): Calibration {
  const sameImage = l.sameImage ?? 0.99;
  // Rank the measured cosines; the i-th smallest gets the i-th ladder rung. Higher cosine → better band.
  const cosines = [l.differentPerson, l.weakGen, l.goodGen, l.bestGen, l.realVsReal].sort((a, b) => a - b);
  const ranked = cosines.map((cosine, i) => ({ cosine, ...LADDER[i] }));

  const curve: CalibrationPoint[] = [
    { cosine: 0, score: 0 },
    ...ranked.map((p) => ({ cosine: p.cosine, score: p.score })),
    { cosine: sameImage, score: SAME_IMAGE_SCORE },
    { cosine: 1, score: SAME_IMAGE_SCORE },
  ].sort((a, b) => a.cosine - b.cosine);

  // Band cut for each rung = midpoint to the rung below it (the lowest rung cuts at 0).
  const bands: BandCut[] = ranked.map((p, i) => ({
    minCosine: i === 0 ? 0 : (ranked[i - 1].cosine + p.cosine) / 2,
    key: p.key,
    label: p.label,
  }));
  return { curve: dedupeByCosine(curve), bands: bands.reverse() }; // bands descending for `find`
}

/** Collapse control points that share a cosine (keeps the last), preserving ascending order. */
function dedupeByCosine(points: CalibrationPoint[]): CalibrationPoint[] {
  const out: CalibrationPoint[] = [];
  for (const p of points) {
    if (out.length && out[out.length - 1].cosine === p.cosine) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

/**
 * MEASURED default — from the first `scripts/benchmark-auraface.ts` run (2026-08-04) on the Julieta
 * library: impostor 0.081, real-vs-real 0.44–0.59, generated best-anchor 0.32 / 0.56 / 0.57. Small n
 * (impostor n=1, real-vs-real n=2, generated n=3), so still tighten as more data lands — but these are
 * measurements, not literature guesses. NOTE the real scale is compressed: real-vs-real tops out ~0.5–0.6
 * and the best generations reach it, so "excellent" lives around 0.55, not the ~0.7 first assumed.
 */
export const DEFAULT_CALIBRATION: Calibration = buildCalibration({
  differentPerson: 0.08,
  weakGen: 0.31,
  goodGen: 0.45,
  bestGen: 0.57,
  realVsReal: 0.55,
  sameImage: 0.99,
});
