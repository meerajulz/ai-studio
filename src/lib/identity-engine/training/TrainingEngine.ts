/**
 * Identity Engine — the TrainingEngine orchestrator.
 *
 * Owns trainer SELECTION: given the requested engine (+ optional provider), pick a `Trainer` from the
 * Training Registry. It does NOT know any provider's API — that lives behind `Trainer` — nor does it
 * touch the database (job/model persistence is the server's `identity/training.ts`, mirroring
 * `identity/dataset.ts`). M23 seeds the default instance from the registry's ENABLED trainers; the
 * actual `train()` body (upload dataset → run → persist versioned model) is implemented in M24.
 */
import type { Trainer } from "./Trainer";
import { enabledTrainers } from "./registry";
import type { TrainingJob, TrainingOptions } from "../engines/lora/types";

export class TrainingEngine {
  private trainers: Trainer[];

  constructor(trainers: Trainer[] = enabledTrainers()) {
    this.trainers = [...trainers];
  }

  /** Register an additional training backend (e.g. in tests). */
  registerTrainer(trainer: Trainer): void {
    this.trainers.push(trainer);
  }

  /** Registered backends that can train the requested engine (highest priority first). */
  trainerFor(engine: string, provider?: string): Trainer | undefined {
    return this.trainers
      .filter((t) => t.supports.includes(engine) && (!provider || t.id === provider))
      .sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Start a training run for an identity. M23 resolves the trainer via the registry; the full lifecycle
   * (assemble curated dataset → trainer.startTraining → persist versioned `IdentityTrainedModel`) is
   * implemented in M24. Throws a clear, provider-agnostic error until then.
   */
  async train(_identityId: string, opts: TrainingOptions): Promise<TrainingJob> {
    const trainer = this.trainerFor(opts.engine, opts.provider);
    if (!trainer) {
      throw new Error(
        `No enabled trainer can train engine "${opts.engine}"${opts.provider ? ` via "${opts.provider}"` : ""}.`,
      );
    }
    throw new Error("TrainingEngine.train is implemented in M24 (M23 = infrastructure only).");
  }
}

/** The default engine instance — seeded from the Training Registry's enabled trainers (Fal). */
export const trainingEngine = new TrainingEngine();
