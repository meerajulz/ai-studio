/**
 * Identity-score calibration check (M27 follow-up, Phase 3) — pure, offline, no DB/hosted calls.
 *
 * Validates the display-only calibration: monotonicity, end clamps, landmark→target fidelity, band
 * assignment, the ordering/regression-robustness of `buildCalibration`, and that raw cosine is always
 * echoed through untouched. Run:  npx tsx scripts/verify-calibration.ts
 */
import {
  buildCalibration,
  calibrateIdentity,
  DEFAULT_CALIBRATION,
  type CalibrationLandmarks,
} from "../src/lib/identity-engine/evaluation/calibration";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`✗ ${msg}`);
  passed += 1;
  console.log(`  ✓ ${msg}`);
}
const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// Mirrors DEFAULT_CALIBRATION (measured 2026-08-04). realVsReal (0.55) < bestGen (0.57) on purpose —
// exercises the rank-based assignment where the best generations out-score real-vs-real.
const LANDMARKS: CalibrationLandmarks = {
  differentPerson: 0.08,
  weakGen: 0.31,
  goodGen: 0.45,
  bestGen: 0.57,
  realVsReal: 0.55,
  sameImage: 0.99,
};

function main() {
  console.log("Identity Calibration:");

  // 1. Raw cosine is carried through untouched (source of truth never lost).
  assert(calibrateIdentity(0.32).cosine === 0.32, "echoes raw cosine unchanged");

  // 2. End clamps — nothing escapes 0..100.
  assert(calibrateIdentity(-0.5).score === 0, "cosine ≤ 0 → score 0");
  assert(calibrateIdentity(1).score === 100 && calibrateIdentity(2).score === 100, "cosine ≥ 1 → score 100 (clamped)");

  // 3. Monotonic: as cosine rises the display score never decreases.
  let prev = -1;
  let monotone = true;
  for (let c = -0.2; c <= 1.0001; c += 0.02) {
    const s = calibrateIdentity(c).score;
    if (s < prev - 1e-9) monotone = false;
    prev = s;
  }
  assert(monotone, "score is monotonically non-decreasing in cosine");

  // 4. Landmarks hit their target display scores (the curve threads the measured points).
  assert(approx(calibrateIdentity(0.08).score, 8), "0.08 → 8 (different person)");
  assert(approx(calibrateIdentity(0.31).score, 42), "0.31 → 42 (weak)");
  assert(approx(calibrateIdentity(0.45).score, 74), "0.45 → 74 (good)");
  assert(approx(calibrateIdentity(0.55).score, 88), "0.55 → 88 (very good / real-vs-real)");
  assert(approx(calibrateIdentity(0.57).score, 96), "0.57 → 96 (excellent / best gen out-scores real-vs-real)");

  // 5. The headline case: raw 0.32 is NOT "32%". On the MEASURED scale it's a weak-but-real match (~44),
  //    not "32% of the identity gone" — the label/score come from where 0.32 sits between impostor (0.08)
  //    and real-vs-real (~0.55), not from the raw number.
  const c32 = calibrateIdentity(0.32);
  assert(c32.score > 38 && c32.score < 52 && c32.band.key === "weak", `0.32 → ${c32.score.toFixed(1)} "${c32.band.label}" (not "32%")`);

  // 6. Bands land on the right regimes (measured landmarks).
  const band = (c: number) => calibrateIdentity(c).band.key;
  assert(band(0.08) === "different-person", "0.08 → different-person");
  assert(band(0.31) === "weak", "0.31 → weak");
  assert(band(0.45) === "good", "0.45 → good");
  assert(band(0.55) === "very-good", "0.55 → very-good");
  assert(band(0.57) === "excellent", "0.57 → excellent (highest cosine earns top band)");
  assert(band(-0.1) === "different-person", "very low cosine → different-person");
  assert(band(0.95) === "excellent", "very high cosine → excellent");

  // 7. buildCalibration is robust to out-of-order / regressing measurements (still monotone).
  const noisy = buildCalibration({ differentPerson: 0.3, weakGen: 0.1, goodGen: 0.5, bestGen: 0.45, realVsReal: 0.7 });
  let np = -1;
  let nmono = true;
  for (let c = 0; c <= 1.0001; c += 0.02) {
    const s = calibrateIdentity(c, noisy).score;
    if (s < np - 1e-9) nmono = false;
    np = s;
  }
  assert(nmono, "noisy/regressing landmarks still yield a monotone curve");

  // 8. A rebuilt calibration from the same landmarks matches DEFAULT_CALIBRATION at the landmarks.
  const rebuilt = buildCalibration(LANDMARKS);
  assert(
    approx(calibrateIdentity(0.45, rebuilt).score, calibrateIdentity(0.45, DEFAULT_CALIBRATION).score),
    "rebuilding from the default landmarks reproduces the default curve",
  );

  // 9. Measured example — a hotter library where real-vs-real sits higher shifts scores down for the same
  //    raw cosine (proves calibration is data-driven, not a fixed table).
  const hot = buildCalibration({ differentPerson: 0.12, weakGen: 0.35, goodGen: 0.55, bestGen: 0.7, realVsReal: 0.85 });
  assert(calibrateIdentity(0.55, hot).score < calibrateIdentity(0.55, DEFAULT_CALIBRATION).score, "different distributions → different scores for the same cosine");

  console.log(`\nAll ${passed} checks passed.`);
}

main();
