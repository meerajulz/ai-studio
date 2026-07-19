/**
 * Identity Engine (Milestone 22) — the TrainingEngine orchestrator. ARCHITECTURE ONLY.
 *
 * Owns the training lifecycle: pick a `Trainer` for the requested engine, start a run, persist the
 * job + resulting versioned `IdentityTrainedModel` (never overwriting prior versions), and surface
 * status. It does NOT know any provider's API — that lives behind `Trainer`. No trainers are
 * registered by default in this milestone, so `train()` reports that training is unavailable.
 */
import type { Trainer } from "./Trainer";
import type { TrainingJob, TrainingOptions } from "../engines/lora/types";

export class TrainingEngine {
  private trainers: Trainer[] = [];

  /** Register a training backend (e.g. a Fal LoRA trainer). None registered by default. */
  registerTrainer(trainer: Trainer): void {
    this.trainers.push(trainer);
  }

  /** Find a registered backend that can train the requested engine (+ optional provider). */
  trainerFor(engine: string, provider?: string): Trainer | undefined {
    return this.trainers.find(
      (t) => t.supports.includes(engine) && (!provider || t.id === provider),
    );
  }

  /**
   * Start a training run for an identity. Architecture only: with no registered trainer this throws a
   * clear, provider-agnostic error. A future milestone assembles the curated dataset, delegates to
   * the trainer, and persists the job + a new `IdentityTrainedModel` version.
   */
  async train(_identityId: string, opts: TrainingOptions): Promise<TrainingJob> {
    const trainer = this.trainerFor(opts.engine, opts.provider);
    if (!trainer) {
      throw new Error(
        `No trainer registered for engine "${opts.engine}" — training is not available yet.`,
      );
    }
    throw new Error("TrainingEngine.train is not implemented yet (architecture only).");
  }
}

/** The default engine instance (no trainers registered — training unavailable in this milestone). */
export const trainingEngine = new TrainingEngine();
