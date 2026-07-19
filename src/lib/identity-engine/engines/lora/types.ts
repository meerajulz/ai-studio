/**
 * LoRA Engine (Milestone 22) — ARCHITECTURE ONLY. No training is implemented. These are the
 * provider-agnostic shapes a future trainer (first backend: Fal) and the persistence layer
 * (`IdentityTrainedModel` / `IdentityTrainingJob`) share. LoRA is only the FIRST trainable engine —
 * nothing here is hardcoded into the application.
 */
import type { EngineId } from "../../types";

export type TrainingProvider = string; // "fal" | … — provider-agnostic, never an enum

export type TrainingStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

/** Options for one training run. Provider-neutral; a Trainer maps these to its own API. */
export type TrainingOptions = {
  engine: EngineId; // "lora" (future engines reuse this shape)
  provider?: TrainingProvider; // omit → the TrainingEngine picks the registered trainer
  triggerWord?: string;
  /** The curated dataset revision to train on (see IdentityDataset.datasetVersion). */
  datasetVersion?: number;
  /** Base models this run should target (compatibility of the produced adapter). */
  baseModels?: string[];
  params?: Record<string, unknown>; // steps, rank, learning rate, … (trainer-specific)
};

/** A training run in flight. Mirrors `IdentityTrainingJob`. */
export type TrainingJob = {
  id: string;
  identityId: string;
  engine: EngineId;
  provider: TrainingProvider;
  status: TrainingStatus;
  providerJobId: string | null;
  datasetVersion: number;
  triggerWord: string | null;
  params: Record<string, unknown> | null;
  cost: number | null;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

/** The metadata that describes a produced trained model (as requested by the milestone). */
export type TrainingMetadata = {
  provider: TrainingProvider;
  status: TrainingStatus;
  version: number;
  triggerWord: string | null;
  createdDate: Date;
  cost: number | null;
  duration: number | null; // seconds
  modelCompatibility: string[];
};

/** The output of a finished run — a versioned, provider-agnostic artifact. Mirrors `IdentityTrainedModel`. */
export type TrainingResult = {
  modelId: string;
  identityId: string;
  engine: EngineId;
  artifactRef: string; // blob key / url of the weights
  metadata: TrainingMetadata;
};

/** A trained model as seen by conditioning (what the LoRA module consumes to condition generation). */
export type TrainedModel = {
  id: string;
  identityId: string;
  engine: EngineId;
  version: number;
  triggerWord: string | null;
  artifactRef: string | null;
  modelCompatibility: string[];
  status: TrainingStatus | "DRAFT" | "READY" | "ARCHIVED";
};
