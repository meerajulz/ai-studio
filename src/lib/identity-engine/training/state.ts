/**
 * Identity Engine (Milestone 23) — `TrainingState`, the USER-oriented training lifecycle.
 *
 * Deliberately DISTINCT from provider job statuses (QUEUED/RUNNING/FAILED live on `IdentityTrainingJob`)
 * and from the per-artifact `TrainedModelStatus` enum (DRAFT/READY/FAILED/ARCHIVED). The UI reasons
 * about THIS lifecycle — "can I train? am I training? is my model stale?" — never Fal's internal state.
 *
 * Pure + deterministic: derived from dataset readiness + the latest READY model's dataset lineage +
 * whether a job is in flight. `datasetVersion` on the model (M23 schema) is what makes OUTDATED possible.
 */

export type TrainingState =
  | "NOT_READY" // dataset too sparse/low-quality to train
  | "READY_TO_TRAIN" // dataset is good; no model yet
  | "TRAINING" // a training job is in flight
  | "TRAINED" // a usable model exists, current with the dataset
  | "OUTDATED" // a usable model exists but the dataset changed since (retrain suggested)
  | "ARCHIVED"; // the identity is archived

export const TRAINING_STATES: TrainingState[] = [
  "NOT_READY",
  "READY_TO_TRAIN",
  "TRAINING",
  "TRAINED",
  "OUTDATED",
  "ARCHIVED",
];

export type TrainingStateInput = {
  identityArchived: boolean;
  /** IdentityDataset.readinessScore (0..100), or null when never analyzed. */
  datasetReadinessScore: number | null;
  /** IdentityDataset.datasetVersion (the curated revision), or null when no dataset. */
  currentDatasetVersion: number | null;
  /** A job in PENDING/QUEUED/RUNNING for this identity. */
  hasActiveJob: boolean;
  /** The latest READY (non-archived) model + the dataset revision it was trained on. */
  latestReadyModel: { datasetVersion: number | null; archived: boolean } | null;
  /** Minimum readiness to allow training (default 50). */
  readinessThreshold?: number;
};

export function deriveTrainingState(input: TrainingStateInput): TrainingState {
  const threshold = input.readinessThreshold ?? 50;

  if (input.identityArchived) return "ARCHIVED";
  if (input.hasActiveJob) return "TRAINING";

  const model = input.latestReadyModel;
  if (model && !model.archived) {
    // A usable model exists — is it still current with the dataset?
    if (
      input.currentDatasetVersion != null &&
      model.datasetVersion != null &&
      model.datasetVersion < input.currentDatasetVersion
    ) {
      return "OUTDATED";
    }
    return "TRAINED";
  }

  // No usable model → gate on dataset readiness.
  if (input.datasetReadinessScore == null || input.datasetReadinessScore < threshold) {
    return "NOT_READY";
  }
  return "READY_TO_TRAIN";
}
