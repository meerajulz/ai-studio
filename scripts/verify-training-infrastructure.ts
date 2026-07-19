/**
 * Deterministic verification of the M23 Fal Training Infrastructure. Fully OFFLINE — no DB, no Fal.
 *
 * Checks the three things M23 delivers: (1) the Training Registry (Fal enabled; others disabled),
 * (2) the training capability surface (`getCapabilities().training`), and (3) the user-oriented
 * `TrainingState` lifecycle across all six states. No real training runs.
 *
 * Run: `npx tsx scripts/verify-training-infrastructure.ts`
 */
import {
  TRAINING_REGISTRY,
  enabledTrainers,
  trainerFor,
  getCapabilities,
  deriveTrainingState,
  TRAINING_STATES,
  type ConditioningContext,
  type TrainingState,
} from "../src/lib/identity-engine";
import { chooseModel, getModel } from "../src/lib/ai";

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

async function main() {
  console.log("M23 Fal Training Infrastructure — verification\n");

  // 1. Training Registry — symmetric with the model + identity-module registries.
  console.log("Training Registry:");
  const byId = Object.fromEntries(TRAINING_REGISTRY.map((t) => [t.id, t]));
  check("fal registered + enabled + supports lora",
    byId.fal?.enabled === true && byId.fal.supports.includes("lora"));
  check("replicate registered + disabled", byId.replicate != null && byId.replicate.enabled === false);
  check("openai registered + disabled", byId.openai != null && byId.openai.enabled === false);
  check("google registered + disabled", byId.google != null && byId.google.enabled === false);
  check("future registered + disabled", byId.future != null && byId.future.enabled === false);
  check("exactly one enabled trainer (fal)",
    enabledTrainers().length === 1 && enabledTrainers()[0].id === "fal");
  check("trainerFor('lora') → fal", trainerFor("lora")?.id === "fal");
  check("trainerFor('lora','replicate') → none (disabled)", trainerFor("lora", "replicate") === undefined);
  check("disabled trainer (replicate) throws NOT_IMPLEMENTED", await throwsMatching(
    () => byId.replicate.startTraining({ engine: "lora" }), /not implemented/i));
  check("fal.startTraining requires a packaged dataset (M24 real trainer)", await throwsMatching(
    () => byId.fal.startTraining({ engine: "lora" }), /dataset|imagesDataUrl/i));

  // 2. Training capability surface.
  console.log("\nCapabilities.training:");
  const ctx: ConditioningContext = {
    identityId: "id", hasAnalyzedCandidates: true, trainedModels: [], artifacts: [],
  };
  const caps = await getCapabilities(ctx);
  check("training.available true", caps.training.available === true);
  check("training.providers = ['fal']", JSON.stringify(caps.training.providers) === JSON.stringify(["fal"]));
  check("training.recommendedProvider = 'fal'", caps.training.recommendedProvider === "fal");
  check("conditioning block still present", caps.conditioning.reference === true);

  // 3. TrainingState lifecycle — all six states from mock inputs.
  console.log("\nTrainingState lifecycle:");
  const state = (over: Partial<Parameters<typeof deriveTrainingState>[0]>): TrainingState =>
    deriveTrainingState({
      identityArchived: false,
      datasetReadinessScore: 90,
      currentDatasetVersion: 1,
      hasActiveJob: false,
      latestReadyModel: null,
      ...over,
    });

  check("NOT_READY — low readiness, no model",
    state({ datasetReadinessScore: 20, latestReadyModel: null }) === "NOT_READY");
  check("NOT_READY — never analyzed",
    state({ datasetReadinessScore: null }) === "NOT_READY");
  check("READY_TO_TRAIN — good readiness, no model",
    state({ datasetReadinessScore: 90, latestReadyModel: null }) === "READY_TO_TRAIN");
  check("TRAINING — active job wins",
    state({ hasActiveJob: true }) === "TRAINING");
  check("TRAINED — model current with dataset",
    state({ latestReadyModel: { datasetVersion: 1, archived: false }, currentDatasetVersion: 1 }) === "TRAINED");
  check("OUTDATED — model older than dataset",
    state({ latestReadyModel: { datasetVersion: 1, archived: false }, currentDatasetVersion: 2 }) === "OUTDATED");
  check("ARCHIVED — identity archived overrides all",
    state({ identityArchived: true, hasActiveJob: true }) === "ARCHIVED");
  check("all six states are defined", TRAINING_STATES.length === 6);

  // 4. LoRA generation routing (M24) — a trained LoRA is consumed via fal-ai/flux-kontext-lora.
  console.log("\nLoRA generation routing:");
  const kl = getModel("fal-ai/flux-kontext-lora");
  check("flux-kontext-lora registered", kl != null);
  check("has 'lora' capability", kl?.capabilities.includes("lora") === true);
  check("single reference (maxReferences 1)", kl?.maxReferences === 1);
  check("payloadKind image_url_lora", kl?.payloadKind === "image_url_lora");
  const routed = chooseModel({
    provider: "fal",
    needs: ["imageEditing", "referenceImages", "identityPreservation", "lora"],
  });
  check("router picks flux-kontext-lora when 'lora' needed",
    routed.model.id === "fal-ai/flux-kontext-lora", routed.model.id);
  const noLora = chooseModel({
    provider: "fal",
    needs: ["imageEditing", "referenceImages", "identityPreservation", "multipleReferenceImages"],
  });
  check("router does NOT pick the LoRA model without 'lora' need",
    noLora.model.id !== "fal-ai/flux-kontext-lora", noLora.model.id);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

async function throwsMatching(fn: () => Promise<unknown>, re: RegExp): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof Error && re.test(e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
