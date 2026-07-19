/**
 * Identity Engine (Milestone 22) — public barrel.
 *
 * Identity is its own subsystem: Generation consumes `planConditioning` and never learns HOW an
 * identity is implemented (reference / LoRA / adapter). This barrel exposes the PURE, client-safe
 * surface (facade, registry, types, dataset/eval/training architecture). The owner-scoped read-models
 * that touch Prisma (`assets/assets`, `artifacts/artifacts`) are imported directly from their paths
 * by server code only. See docs/IDENTITY_ENGINE.md.
 */

// Facade + registry
export { planConditioning, getCapabilities, identityEngine, type IdentityCapabilities } from "./engine";
export { IDENTITY_MODULES, listModules, getModule } from "./registry";
export type { IdentityModule } from "./modules/IdentityModule";

// Core types
export type {
  EngineId,
  EngineKind,
  ConditioningStrategy,
  ConditioningRequest,
  ConditioningContext,
  ConditioningContribution,
  ConditioningPlan,
  ConditioningDebug,
  SelectionTrace,
  ModuleAvailability,
  TrainedModelRef,
  ArtifactRef,
} from "./types";

// Engines (reference is the only enabled one)
export { referenceEngine, selectReferences } from "./engines/reference/reference-engine";
export { loraEngine } from "./engines/lora/lora-engine";
export { pulidEngine } from "./engines/pulid/pulid-engine";
export { instantIdEngine } from "./engines/instantid/instantid-engine";
export type {
  TrainingJob,
  TrainingResult,
  TrainingMetadata,
  TrainedModel,
  TrainingOptions,
  TrainingStatus,
  TrainingProvider,
} from "./engines/lora/types";

// Dataset
export { assembleDataset } from "./dataset/dataset";
export { computeDatasetMetrics } from "./dataset/metrics";
export { computeReadiness } from "./dataset/readiness";
export { curateDataset } from "./dataset/curation";
export {
  DATASET_METRICS_VERSION,
  type DatasetImage,
  type DatasetMetrics,
  type DatasetReadiness,
  type DatasetRating,
  type DatasetCuration,
  type DuplicateReport,
  type IdentityDataset,
} from "./dataset/types";

// Training architecture + registry (Milestone 23)
export { TrainingEngine, trainingEngine } from "./training/TrainingEngine";
export type { Trainer } from "./training/Trainer";
export {
  TRAINING_REGISTRY,
  listTrainers,
  getTrainer,
  enabledTrainers,
  trainerFor,
} from "./training/registry";
export { falTrainer } from "./training/trainers/fal-trainer";
export { replicateTrainer } from "./training/trainers/replicate-trainer";
export { openAiTrainer } from "./training/trainers/openai-trainer";
export { googleTrainer } from "./training/trainers/google-trainer";
export { futureTrainer } from "./training/trainers/future-trainer";
export { deriveTrainingState, TRAINING_STATES, type TrainingState } from "./training/state";

// Evaluation architecture
export {
  emptyEvaluation,
  notConfiguredEvaluator,
  type IdentityEvaluation,
  type IdentityEvaluator,
} from "./evaluation/IdentityEvaluator";
