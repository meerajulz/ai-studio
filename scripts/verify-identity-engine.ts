/**
 * Deterministic verification of the Identity Engine (Milestone 22).
 *
 * Fully OFFLINE — no DB, no Blob, no Vision/generation API. Builds mocked candidates through the REAL
 * vision pipeline, then checks:
 *   1. PARITY — `planConditioning` reproduces the exact references + anchor the previous inline path
 *      produced (exposure filter → reference package → Identity Anchor). No regression.
 *   2. STRATEGY — the plan is `reference` today (only the Reference module is enabled).
 *   3. REGISTRY — reference is enabled; lora / pulid / instantid are registered but disabled.
 *   4. DATASET — `assembleDataset` returns a readiness score + rating + metrics for a mock library.
 *
 * Run: `npx tsx scripts/verify-identity-engine.ts`
 */
import { directCreative } from "../src/lib/creative";
import {
  buildReferencePackage,
  filterCandidatesByExposure,
  pickIdentityAnchor,
  type SelectionCandidate,
} from "../src/lib/selection";
import {
  normalizeToIdentityMetadata,
  scoreIdentityImage,
  type VisionObservation,
} from "../src/lib/vision";
import {
  assembleDataset,
  getCapabilities,
  IDENTITY_MODULES,
  loraEngine,
  planConditioning,
  referenceEngine,
  type ConditioningContext,
  type DatasetImage,
} from "../src/lib/identity-engine";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const HQ = { sharpness: 0.9, exposure: 0.6, faceVisible: true, width: 1024, height: 1536 };
function candidate(mediaId: string, attrs: Record<string, unknown>, quality = HQ): SelectionCandidate {
  const obs: VisionObservation = { provider: "mock", model: "mock", attributes: attrs, quality };
  const metadata = normalizeToIdentityMetadata(obs);
  return { mediaId, url: `https://example/${mediaId}.jpg`, metadata, score: scoreIdentityImage(metadata) };
}

const FACE = candidate("face", {
  hairColor: "pink", hairLength: "long", hairVisible: true,
  faceVisible: true, faceOrientation: "front", faceConfidence: 0.97,
  framing: "headshot", bodyVisibility: "face", lightingSetting: "studio", lightingQuality: "even",
});
const SMILE = candidate("smile", {
  hairColor: "pink", hairLength: "long", hairVisible: true,
  faceVisible: true, faceOrientation: "front", faceConfidence: 0.95, smiling: true,
  faceExpression: { smiling: true, teethVisible: true, lookingAtCamera: true },
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
const library = [FACE, SMILE, FULLBODY, LEGTATTOO];

async function main() {
  console.log("Identity Engine — verification\n");

  // 1. PARITY — reconstruct the OLD inline path and compare to the engine's plan.
  console.log("Parity with the previous inline reference path:");
  const idea = "Walking on the beach in a bikini";
  const directive = directCreative({ idea });

  const exposure = filterCandidatesByExposure(directive, library);
  const oldSelection = buildReferencePackage(directive, exposure.safe);
  const oldUrls = oldSelection.package.map((p) => p.url);
  const oldAnchor = pickIdentityAnchor(exposure.safe);

  const plan = await planConditioning({ identityId: "id_mock", directive, candidates: library });
  const newUrls = plan.referenceImages.map((r) => r.url);

  check("reference URLs + order identical", JSON.stringify(newUrls) === JSON.stringify(oldUrls),
    `${JSON.stringify(newUrls)} vs ${JSON.stringify(oldUrls)}`);
  check("Identity Anchor identical", (plan.identityAnchor?.url ?? null) === (oldAnchor?.url ?? null),
    `${plan.identityAnchor?.url} vs ${oldAnchor?.url}`);
  check("anchor role is 'anchor'", !plan.identityAnchor || plan.identityAnchor.role === "anchor");

  // 2. STRATEGY — reference only today.
  console.log("\nStrategy:");
  check("strategy === 'reference'", plan.strategy === "reference", plan.strategy);
  check("engines === ['reference']", JSON.stringify(plan.engines) === JSON.stringify(["reference"]));
  check("loraModelId is null", plan.loraModelId === null);
  check("adapterInputs is null", plan.adapterInputs === null);

  // Manual override still routes through the engine (dev benchmark parity).
  const manual = await planConditioning({
    identityId: "id_mock", directive, candidates: library,
    manualReferenceMediaIds: ["fullbody", "face"],
  });
  check("manual override keeps exact order", JSON.stringify(manual.referenceImages.map((r) => r.url)) ===
    JSON.stringify(["fullbody", "face"].map((id) => `https://example/${id}.jpg`)));
  check("manual override sets manual debug flag", manual.debug?.manual === true);
  check("manual override sends no anchor", manual.identityAnchor === undefined);

  // 3. REGISTRY — reference enabled; the rest registered but disabled.
  console.log("\nRegistry:");
  const byId = Object.fromEntries(IDENTITY_MODULES.map((m) => [m.id, m]));
  check("reference enabled", byId.reference?.enabled === true);
  check("lora registered + disabled", byId.lora != null && byId.lora.enabled === false);
  check("pulid registered + disabled", byId.pulid != null && byId.pulid.enabled === false);
  check("instantid registered + disabled", byId.instantid != null && byId.instantid.enabled === false);
  check("exactly one enabled module", IDENTITY_MODULES.filter((m) => m.enabled).length === 1);

  // 4. DATASET — readiness computed from mock knowledge.
  console.log("\nDataset readiness:");
  const images: DatasetImage[] = library.map((c) => ({ mediaId: c.mediaId, metadata: c.metadata, score: c.score }));
  const dataset = assembleDataset(images, { identityId: "id_mock" });
  check("readiness score in 0..100", dataset.readiness.score >= 0 && dataset.readiness.score <= 100,
    String(dataset.readiness.score));
  check("rating is a known bucket", ["excellent", "good", "fair", "poor"].includes(dataset.readiness.rating),
    dataset.readiness.rating);
  check("verdict is non-empty", dataset.readiness.verdict.length > 0);
  check("coverage report present", typeof dataset.metrics.coverage.overall === "number");
  check("curation recommends usable images", dataset.curation.recommendedImageIds.length > 0);
  check("analyzedCount matches library", dataset.analyzedCount === library.length);

  // 5. CAPABILITIES — what the identity can do now, and how it adapts after training.
  console.log("\nCapabilities:");
  const emptyCtx: ConditioningContext = {
    identityId: "id_mock", hasAnalyzedCandidates: true, trainedModels: [], artifacts: [],
  };
  const caps = await getCapabilities(emptyCtx);
  check("reference capability true", caps.reference === true);
  check("lora/pulid/instantid false today", !caps.lora && !caps.pulid && !caps.instantid);
  check("trainingAvailable true (trainable module registered)", caps.trainingAvailable === true);
  check("recommendedStrategy = 'reference'", caps.recommendedStrategy === "reference", caps.recommendedStrategy);

  // Post-training: enable the LoRA module + a READY model in context → capabilities adapt with NO UI change.
  const enabledLora = { ...loraEngine, enabled: true };
  const trainedCtx: ConditioningContext = {
    identityId: "id_mock", hasAnalyzedCandidates: true,
    trainedModels: [{ id: "m1", engine: "lora", version: 1, triggerWord: "jln", artifactRef: "blob://w", modelCompatibility: ["flux"] }],
    artifacts: [],
  };
  const capsTrained = await getCapabilities(trainedCtx, {}, [referenceEngine, enabledLora]);
  check("lora true once enabled + model ready", capsTrained.lora === true);
  check("recommendedStrategy adapts to 'reference+lora'", capsTrained.recommendedStrategy === "reference+lora",
    capsTrained.recommendedStrategy);
  const capsWrongModel = await getCapabilities(trainedCtx, { model: "sdxl" }, [referenceEngine, enabledLora]);
  check("lora gated by model compatibility (sdxl → false)", capsWrongModel.lora === false);
  const capsRightModel = await getCapabilities(trainedCtx, { model: "flux" }, [referenceEngine, enabledLora]);
  check("lora usable for a compatible model (flux → true)", capsRightModel.lora === true);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
