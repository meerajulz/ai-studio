/**
 * Deterministic verification of Smart Reference Selection (Milestone 20).
 *
 * Fully OFFLINE — no DB, no Blob, no Vision/generation API. Builds mocked candidate images through the
 * REAL vision pipeline (normalize → score), runs the REAL Creative Director on three prompts, and
 * checks the selector picks a diverse, well-explained package (and warns when a hard requirement can't
 * be met). Proves Identity Intelligence drives better reference decisions before any live wiring.
 *
 * Run: `npx tsx scripts/verify-selection.ts`
 */
import { directCreative } from "../src/lib/creative";
import {
  buildReferencePackage,
  filterCandidatesByExposure,
  pickIdentityAnchor,
  rankIdentityAnchors,
  type SelectionCandidate,
} from "../src/lib/selection";
import {
  normalizeToIdentityMetadata,
  scoreIdentityImage,
  synthesizeIdentityAppearance,
  type VisionObservation,
} from "../src/lib/vision";

const HQ = { sharpness: 0.9, exposure: 0.6, faceVisible: true, width: 1024, height: 1536 };

function candidate(mediaId: string, attrs: Record<string, unknown>, quality = HQ): SelectionCandidate {
  const obs: VisionObservation = { provider: "mock", model: "mock", attributes: attrs, quality };
  const metadata = normalizeToIdentityMetadata(obs);
  return { mediaId, url: `https://example/${mediaId}.jpg`, metadata, score: scoreIdentityImage(metadata) };
}

// A varied identity library.
const FACE = candidate("face", {
  hairColor: "pink", hairLength: "long", hairVisible: true,
  faceVisible: true, faceOrientation: "front", faceConfidence: 0.97,
  framing: "headshot", bodyVisibility: "face", lightingSetting: "studio", lightingQuality: "even",
});
const SMILE = candidate("smile", {
  hairColor: "pink", hairLength: "long", hairVisible: true,
  faceVisible: true, faceOrientation: "front", faceConfidence: 0.95,
  smiling: true, faceExpression: { smiling: true, teethVisible: true, lookingAtCamera: true },
  framing: "half-body", bodyVisibility: "upper", lightingSetting: "indoor", lightingQuality: "soft",
});
const FULLBODY = candidate("fullbody", {
  hairColor: "pink", hairLength: "long", hairVisible: true,
  faceVisible: true, faceOrientation: "three-quarter", faceConfidence: 0.8,
  framing: "full-body", bodyVisibility: "full", clothing: ["bikini"],
  lightingSetting: "outdoor", lightingQuality: "even",
});
const LEGTATTOO = candidate("legtattoo", {
  hairColor: "pink", hairVisible: true,
  faceVisible: true, faceOrientation: "front", faceConfidence: 0.7,
  framing: "full-body", bodyVisibility: "full",
  tattoos: [{ location: "left thigh", confidence: 0.95 }, { location: "right calf", confidence: 0.9 }],
  lightingSetting: "indoor",
});
const BACK = candidate("back", {
  hairColor: "pink", hairVisible: true,
  faceVisible: false, faceOrientation: "back",
  framing: "full-body", bodyVisibility: "full",
  tattoos: [{ location: "upper back", confidence: 0.95 }, { location: "lower back", confidence: 0.9 }],
  lightingSetting: "indoor",
});
const BUSINESS = candidate("business", {
  hairColor: "pink", hairLength: "long", hairVisible: true,
  faceVisible: true, faceOrientation: "front", faceConfidence: 0.95,
  framing: "half-body", bodyVisibility: "upper", clothing: ["suit", "blazer"],
  lightingSetting: "indoor", lightingQuality: "soft",
});

const library = [FACE, SMILE, FULLBODY, LEGTATTOO, BACK, BUSINESS];

function run(idea: string, candidates: SelectionCandidate[]) {
  const directive = directCreative({ idea });
  const selection = buildReferencePackage(directive, candidates);
  console.log(`\n▶ "${idea}"`);
  console.log(`  requirements: ${selection.requirements.active.map((r) => r.label).join(", ") || "none"}`);
  for (const p of selection.package) console.log(`  • [${p.role}] ${p.mediaId} — ${p.reason}`);
  if (selection.warnings.length) console.log(`  ⚠ ${selection.warnings.join(" | ")}`);
  return selection;
}

const checks: [string, boolean][] = [];
const ids = (s: ReturnType<typeof run>) => s.package.map((p) => p.mediaId);
const roles = (s: ReturnType<typeof run>) => new Set(s.package.map((p) => p.role));

// 1) Yacht + bikini + smiling → favors smiling / full-body / outdoor / leg-tattoo; diverse, not 4 faces.
const yacht = run("Julieta smiling on a yacht in a bikini", library);
checks.push(["yacht: diverse package (≥3)", yacht.package.length >= 3]);
checks.push(["yacht: not all the same role", roles(yacht).size >= 2]);
checks.push(["yacht: includes the full-body image", ids(yacht).includes("fullbody")]);
checks.push(["yacht: includes the leg-tattoo image", ids(yacht).includes("legtattoo")]);
checks.push(["yacht: includes a smiling face", ids(yacht).includes("smile")]);
checks.push(["yacht: SCENE-LED — a body/scene ref leads, not a bare face", ["body", "tattoos", "support"].includes(yacht.package[0]?.role)]);
checks.push(["yacht: the full-body beach reference leads", yacht.package[0]?.mediaId === "fullbody"]);
checks.push(["yacht: a front-face reference is still present", yacht.package.some((p) => ["fullbody", "legtattoo", "smile"].includes(p.mediaId))]);
checks.push(["yacht: package stays within the cap (≤4)", yacht.package.length <= 4]);
checks.push(["yacht: reasons are all distinct", new Set(yacht.package.map((p) => p.reason)).size === yacht.package.length]);

// 2) Business portrait in an office → frontal, well-lit face, business, indoor.
const office = run("Business portrait in an office", library);
checks.push(["office: picks the business image", ids(office).includes("business")]);
checks.push(["office: leads with a face/hero", ["hero", "face"].includes(office.package[0]?.role)]);
checks.push(["office: no unmet-requirement warnings", office.warnings.length === 0]);

// 3a) Back view showing tattoos → prioritizes the back-tattoo reference, no warning.
const back = run("Back view showing tattoos", library);
checks.push(["back: selects the back image", ids(back).includes("back")]);
checks.push(["back: no warning (back ref exists)", back.warnings.length === 0]);

// 3b) Same prompt but NO back reference in the library → warns, still returns a package (never blocks).
const noBack = run("Back view showing tattoos", library.filter((c) => c.mediaId !== "back"));
checks.push(["no-back: emits a coverage warning", noBack.warnings.some((w) => /back/i.test(w))]);
checks.push(["no-back: still returns references (never blocks)", noBack.package.length >= 1]);

// 4) Identity description synthesis — majority-voted, region-based, rich, deduped, no age.
const appearance = synthesizeIdentityAppearance(library.map((c) => c.metadata)) ?? "";
console.log(`\n▶ Synthesized appearance (library):\n  ${appearance}`);
checks.push(["synthesis: mentions hair color", /pink/i.test(appearance)]);
checks.push(["synthesis: describes tattoo layout by region", /(sleeve|arm|chest|thigh|leg|calf|back|neck|piece)/i.test(appearance)]);
checks.push(["synthesis: region-based — no tattoo imagery nouns", !/snake|owl|dragon|skull/i.test(appearance)]);

// A crafted identity exercising rich descriptors, dedup, and the no-age rule.
const rich = normalizeToIdentityMetadata({
  provider: "mock",
  model: "mock",
  attributes: {
    hairColor: "pink", hairLength: "long", hairTexture: "wavy", hairVisible: true,
    accessories: ["ear gauges", "ear gauge", "septum piercing"],
    ageRange: "30-40",
    tattoos: [
      { location: "left forearm", description: "colorful illustrative", confidence: 0.9 },
      { location: "left upper arm", description: "colorful illustrative", confidence: 0.9 },
      { location: "chest", description: "large floral", confidence: 0.9 },
      { location: "right thigh", description: "ornamental", confidence: 0.9 },
    ],
  },
  quality: HQ,
});
const richAppearance = synthesizeIdentityAppearance([rich]) ?? "";
console.log(`\n▶ Synthesized appearance (rich):\n  ${richAppearance}`);
checks.push(["synthesis: NO inferred age", !/aged|years old|30-40/i.test(richAppearance)]);
checks.push(["synthesis: dedups ear gauge(s)", (richAppearance.match(/gauge/g) ?? []).length === 1]);
checks.push(["synthesis: collapses arm into a sleeve", /left sleeve/i.test(richAppearance)]);
checks.push(["synthesis: rich chest descriptor", /large floral chest piece/i.test(richAppearance)]);

// 5) Reference Safety — nude/lingerie references filtered out for non-explicit prompts.
const NUDE = candidate("nude", {
  hairColor: "pink", hairLength: "long", hairVisible: true,
  faceVisible: true, faceOrientation: "front", faceConfidence: 0.98, // would be a top anchor if allowed
  framing: "full-body", bodyVisibility: "full", clothing: ["nude"],
  visibleRegions: ["head", "neck", "shoulders", "torso", "waist", "hips", "arms", "legs"],
  lightingSetting: "indoor",
});
const withNude = [...library, NUDE];
const businessSafety = filterCandidatesByExposure(directCreative({ idea: "Business portrait in an office" }), withNude);
const beachSafety = filterCandidatesByExposure(directCreative({ idea: "Walking on the beach in a bikini" }), withNude);
const nudeSafety = filterCandidatesByExposure(directCreative({ idea: "Nude studio portrait" }), withNude);
console.log(`\n▶ Safety: business allows ${businessSafety.allowed} (excluded ${businessSafety.excluded.length}), beach allows ${beachSafety.allowed}, nude allows ${nudeSafety.allowed}`);
checks.push(["safety: business portrait EXCLUDES the nude reference", businessSafety.excluded.some((e) => e.candidate.mediaId === "nude")]);
checks.push(["safety: business portrait allows 'clothed' only", businessSafety.allowed === "clothed"]);
checks.push(["safety: beach allows swimwear but still EXCLUDES nude", beachSafety.allowed === "swimwear" && beachSafety.excluded.some((e) => e.candidate.mediaId === "nude")]);
checks.push(["safety: explicit nude prompt INCLUDES the nude reference", nudeSafety.safe.some((c) => c.mediaId === "nude")]);
checks.push(["safety: anchor never picks the nude image for a business prompt", pickIdentityAnchor(businessSafety.safe)?.mediaId !== "nude"]);

// 6) Identity Anchor — "who is this person?" — the strongest frontal face, independent of the scene.
const anchor = pickIdentityAnchor(library);
console.log(`\n▶ Identity anchor: ${anchor?.mediaId ?? "none"}`);
checks.push(["anchor: picks the strongest frontal face (the clean headshot)", anchor?.mediaId === "face"]);
checks.push(["anchor: none when every image is a back view", pickIdentityAnchor([BACK]) === null]);
checks.push(["anchor: is a real front-face candidate", anchor?.metadata.face.orientation === "front"]);

// Prominence: a close-up headshot must beat a full-body face even at HIGHER face confidence — the
// full-body's small face (low resolution) is penalized. (This is the "why did the full-body win" fix.)
const HEADSHOT = candidate("headshot", {
  hairColor: "pink", faceVisible: true, faceOrientation: "front", faceConfidence: 0.9,
  framing: "headshot", bodyVisibility: "face", lightingSetting: "studio", lightingQuality: "even",
});
const FULLBODYFACE = candidate("fullbodyface", {
  hairColor: "pink", faceVisible: true, faceOrientation: "front", faceConfidence: 0.95,
  framing: "full-body", bodyVisibility: "full", lightingSetting: "studio", lightingQuality: "even",
});
const promRank = rankIdentityAnchors([FULLBODYFACE, HEADSHOT]);
console.log(`\n▶ Anchor prominence: ${promRank.map((a) => `${a.mediaId} score=${a.score.toFixed(3)} (res ${Math.round(a.resolution * 100)}, prom ${Math.round(a.prominence * 100)})`).join(" | ")}`);
checks.push(["anchor: close-up beats a higher-confidence full-body (face prominence)", pickIdentityAnchor([FULLBODYFACE, HEADSHOT])?.mediaId === "headshot"]);

console.log("\nChecks:");
let ok = true;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? "✓" : "✗"} ${name}`);
  ok = ok && pass;
}
console.log(ok ? "\nAll checks passed." : "\nSOME CHECKS FAILED.");
process.exit(ok ? 0 : 1);
