/**
 * Identity Engine (Milestone 22) — the provider-agnostic Trainer contract. ARCHITECTURE ONLY.
 *
 * A `Trainer` is a training BACKEND (the first will be Fal). The `TrainingEngine` orchestrates jobs
 * and delegates the actual work to a registered Trainer, so training providers are swappable without
 * touching the rest of AI Studio. No backend is implemented in this milestone.
 */
import type { IdentityDataset } from "../dataset/types";
import type {
  TrainingJob,
  TrainingOptions,
  TrainingResult,
  TrainingStatus,
} from "../engines/lora/types";

export interface Trainer {
  id: string; // "fal" | … — provider-agnostic
  /** Which engines this backend can train (e.g. ["lora"]). */
  supports: string[];
  startTraining(dataset: IdentityDataset, opts: TrainingOptions): Promise<TrainingJob>;
  pollStatus(job: TrainingJob): Promise<TrainingStatus>;
  fetchResult(job: TrainingJob): Promise<TrainingResult>;
  cancel(job: TrainingJob): Promise<void>;
}
