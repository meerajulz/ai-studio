/**
 * Deterministic verification of Identity Image Scoring (Milestone 19).
 *
 * Fully OFFLINE — no DB, no Vision API. Builds mocked observations → 18A normalize → per-image
 * score + ranking. Proves the coverage-vs-scoring separation works before any Vision provider runs.
 *
 * Run: `npx tsx scripts/verify-scoring.ts`
 */
import {
  normalizeToIdentityMetadata,
  rankIdentityImages,
  type VisionObservation,
} from "../src/lib/vision";

function obs(label: string, a: Record<string, unknown>, quality: Record<string, unknown>): VisionObservation {
  return { provider: "mock", model: "mock", caption: label, attributes: a, quality };
}

// A: strong front-face full-body beach smile w/ tattoos. B: blurry back-view. C: decent indoor portrait.
const observations: [string, VisionObservation][] = [
  ["A: front full-body smile beach", obs("A", {
    hairColor: "pink", hairLength: "long", hairVisible: true,
    faceVisible: true, faceYaw: 3, smiling: true, eyesVisible: true,
    framing: "full-body", bodyVisibility: "full",
    tattoos: [{ location: "chest" }, { location: "left arm" }],
    lightingSetting: "outdoor", lightingQuality: "even",
  }, { sharpness: 0.92, exposure: 0.6, faceVisible: true })],
  ["B: blurry back view", obs("B", {
    hairColor: "pink", hairVisible: true,
    faceVisible: false, faceOrientation: "back",
    framing: "half-body", bodyVisibility: "upper",
    lightingSetting: "indoor", lightingQuality: "harsh",
  }, { sharpness: 0.25, exposure: 0.3, faceVisible: false, occlusion: true })],
  ["C: indoor portrait", obs("C", {
    hairColor: "pink", hairLength: "long", hairVisible: true,
    faceVisible: true, faceYaw: -15, smiling: false, eyesVisible: true,
    framing: "headshot", bodyVisibility: "face",
    lightingSetting: "indoor", lightingQuality: "soft",
  }, { sharpness: 0.8, exposure: 0.55, faceVisible: true })],
];

const labelled = observations.map(([label, o]) => ({ label, metadata: normalizeToIdentityMetadata(o) }));
const ranked = rankIdentityImages(labelled.map((x) => x.metadata));

console.log("\nIdentity Image Scoring — ranked best-first\n" + "-".repeat(60));
for (const { metadata, score } of ranked) {
  const label = labelled.find((x) => x.metadata === metadata)!.label;
  console.log(
    `${String(score.overall).padStart(3)}  ${label.padEnd(30)} ` +
      `face:${score.faceQuality} body:${score.bodyCoverage} tat:${score.tattooVisibility} ` +
      `light:${score.lighting} sharp:${score.sharpness}${score.expression ? " · " + score.expression : ""}`,
  );
  if (score.reasons.length) console.log(`     ${score.reasons.join(", ")}`);
}

// Deterministic expectations.
const byLabel = (needle: string) => {
  const md = labelled.find((x) => x.label.startsWith(needle))!.metadata;
  return ranked.find((r) => r.metadata === md)!.score;
};
const A = byLabel("A"), B = byLabel("B"), C = byLabel("C");
const checks: [string, boolean][] = [
  ["A ranks first (front + full body + smile)", ranked[0].metadata === labelled[0].metadata],
  ["B ranks last (blurry back)", ranked[ranked.length - 1].metadata === labelled[1].metadata],
  ["A overall > C overall > B overall", A.overall > C.overall && C.overall > B.overall],
  ["A expression = smiling", A.expression === "smiling"],
  ["A tattoo visibility > 0", A.tattooVisibility > 0],
  ["B not usable (blurry+occluded)", B.usable === false],
  // 19C — unknown vs zero: a back view has NO face quality (unavailable), not a bag of zeros.
  ["B face quality unavailable (face not visible)", labelled[1].metadata.face.quality === null],
  ["A face quality measured (object present)", labelled[0].metadata.face.quality !== null],
];
console.log("\nChecks:");
let ok = true;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? "✓" : "✗"} ${name}`);
  ok = ok && pass;
}
console.log(ok ? "\nAll checks passed." : "\nSOME CHECKS FAILED.");
process.exit(ok ? 0 : 1);
