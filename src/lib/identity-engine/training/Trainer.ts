/**
 * Identity Engine — the provider-agnostic Trainer contract.
 *
 * A `Trainer` is a training BACKEND provider (Fal, Replicate, OpenAI, …). The `TrainingEngine`
 * orchestrates jobs and delegates the actual work to a registered Trainer, so training providers are
 * swappable without touching the rest of AI Studio. M23 ships the **Training Registry** of provider
 * trainers (Fal enabled; others disabled). The registry fields (`label`/`enabled`/`priority`) mirror
 * `ModelSpec` (model registry) and `IdentityModule` (identity module registry) — three symmetrical
 * registries. No backend actually trains yet — `FalTrainer` is implemented in M24.
 */
import type {
  TrainingJob,
  TrainingOptions,
  TrainingResult,
  TrainingStatus,
} from "../engines/lora/types";

export interface Trainer {
  id: string; // "fal" | "replicate" | … — provider-agnostic
  label: string; // UI label, e.g. "Fal"
  /** Which identity engines this backend can train (e.g. ["lora"]). */
  supports: string[];
  enabled: boolean; // registered + selectable (only Fal today)
  priority: number; // Auto tiebreak (higher wins) — like ModelSpec.priority
  /** Submit a run. The packaged dataset URL + trigger word + steps travel in `opts` (Milestone 24). */
  startTraining(opts: TrainingOptions): Promise<TrainingJob>;
  pollStatus(job: TrainingJob): Promise<TrainingStatus>;
  fetchResult(job: TrainingJob): Promise<TrainingResult>;
  cancel(job: TrainingJob): Promise<void>;
}
