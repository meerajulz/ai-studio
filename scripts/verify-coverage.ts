/**
 * Deterministic verification of the Identity Coverage Engine (Milestone 18B).
 *
 * Fully OFFLINE — no DB, no Blob, no Vision provider. It builds MOCKED provider observations, runs
 * them through the real 18A normalizer (observation → knowledge), then the 18B coverage engine, and
 * prints the star report. This proves the Identity Intelligence architecture works end-to-end before
 * any Vision API exists.
 *
 * Run: `npx tsx scripts/verify-coverage.ts`
 */
import {
  analyzeIdentityCoverage,
  normalizeToIdentityMetadata,
  renderStars,
  toTattooRegion,
  type VisionObservation,
} from "../src/lib/vision";

/** Build a mock provider observation (what 18B's provider will eventually emit for real). */
function obs(a: Record<string, unknown>, quality: Record<string, unknown>): VisionObservation {
  return { provider: "mock", model: "mock-vlm", attributes: a, quality };
}

const HQ = { sharpness: 0.9, exposure: 0.6, faceVisible: true, width: 1024, height: 1536 };
const MQ = { sharpness: 0.6, exposure: 0.55, faceVisible: true, width: 800, height: 1000 };

// A mock identity "Julieta": strong front face + full body + hair, one left profile, some tattoos —
// but NO right profile, NO back view, NO back/right-arm tattoos.
const observations: VisionObservation[] = [
  obs(
    {
      hairColor: "pink", hairLength: "long", hairVisible: true,
      faceVisible: true, faceOrientation: "front", faceConfidence: 0.98,
      framing: "full-body", bodyVisibility: "full",
      tattoos: [
        { location: "chest" },
        { location: "left arm" },
        { location: "left thigh" },
        { location: "abdomen" },
      ],
      lightingSetting: "outdoor",
    },
    HQ,
  ),
  obs(
    {
      hairColor: "pink", hairLength: "long", hairVisible: true,
      faceVisible: true, faceOrientation: "front", faceConfidence: 0.95,
      framing: "half-body", bodyVisibility: "upper",
      tattoos: [{ location: "chest" }, { location: "left arm" }],
      lightingSetting: "indoor",
    },
    HQ,
  ),
  obs(
    {
      hairColor: "pink", hairLength: "long", hairVisible: true,
      faceVisible: true, faceOrientation: "left-profile", faceConfidence: 0.88,
      framing: "half-body", bodyVisibility: "upper",
      tattoos: [{ location: "left arm" }],
      lightingSetting: "indoor",
    },
    MQ,
  ),
];

const metadatas = observations.map(normalizeToIdentityMetadata);
const report = analyzeIdentityCoverage(metadatas);

console.log(`\nIdentity Coverage Report  (engine ${report.version})`);
console.log(`Overall: ${report.overall}/100 · confidence ${(report.identityConfidence * 100).toFixed(0)}% · ` +
  `${report.usableImages}/${report.totalImages} usable · tattoos: ${report.hasTattoos ? "yes" : "no"}`);
console.log("-".repeat(52));
for (const d of report.dimensions) {
  const flag = d.status === "not-applicable" ? "  (n/a)" : d.status === "missing" ? "  ← missing" : "";
  console.log(`${d.label.padEnd(20)} ${renderStars(d.stars)}${flag}`);
}
console.log("-".repeat(52));
console.log("Missing:", report.missing.length ? report.missing.join(", ") : "none");
console.log("\nSuggestions (prioritized):");
for (const s of report.suggestions) console.log(`  [${s.severity}] ${s.message}`);

// Assertions — deterministic expectations.
const by = (id: string) => report.dimensions.find((d) => d.id === id)!;
const checks: [string, boolean][] = [
  // 19A rescoring: a clearly-visible, high-quality aspect should read a FULL 5 stars (not 3).
  ["front face = 5 stars (clearly frontal)", by("face-front").stars === 5],
  ["hair = 5 stars (clearly visible)", by("hair").stars === 5],
  ["chest tattoos = 5 stars (clearly visible)", by("tattoo-chest").stars === 5],
  ["full body covered", by("body-full").status === "covered"],
  ["right profile missing", by("face-right-profile").status === "missing"],
  ["back view missing", by("face-back").status === "missing"],
  ["back tattoo missing (identity has tattoos)", by("tattoo-back").status === "missing"],
  ["left-arm tattoo covered", by("tattoo-left-arm").stars >= 3],
  // 19A taxonomy: thigh + abdomen no longer fall through to nothing.
  ["leg tattoo covered (left thigh → leg dim)", by("tattoo-leg").status === "covered"],
  ["abdomen tattoo covered (new dimension)", by("tattoo-abdomen").status === "covered"],
  ["region mapping: 'left thigh' → left-thigh", toTattooRegion("left thigh") === "left-thigh"],
  ["region mapping: 'left arm' → left-upper-arm", toTattooRegion("left arm") === "left-upper-arm"],
  ["region mapping: 'abdomen' → abdomen", toTattooRegion("abdomen") === "abdomen"],
  ["suggests right profile + back", report.missing.some((m) => /right profile/i.test(m)) && report.missing.some((m) => /back view/i.test(m))],
];
console.log("\nChecks:");
let ok = true;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? "✓" : "✗"} ${name}`);
  ok = ok && pass;
}
console.log(ok ? "\nAll checks passed." : "\nSOME CHECKS FAILED.");
process.exit(ok ? 0 : 1);
