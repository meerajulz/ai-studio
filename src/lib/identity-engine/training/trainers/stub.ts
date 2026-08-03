/**
 * Identity Engine (Milestone 23) — a NOT_IMPLEMENTED Trainer factory.
 *
 * Every provider trainer in the Training Registry is a stub in M23: the infrastructure (registry,
 * capabilities, lifecycle) is real, but no backend actually trains. `FalTrainer` is enabled (M24 fills
 * in its `startTraining`); the rest are registered but disabled to prove the registry is
 * provider-agnostic from day one. This factory builds the throwing shell so each trainer file stays a
 * one-line config.
 */
import type { Trainer } from "../Trainer";

export type StubTrainerConfig = {
  id: string;
  label: string;
  supports: string[];
  enabled: boolean;
  priority: number;
};

export function stubTrainer(config: StubTrainerConfig): Trainer {
  const notImplemented = () => {
    throw new Error(
      `Training via "${config.id}" is not implemented yet (M23 = infrastructure; the Fal LoRA backend lands in M24).`,
    );
  };
  return {
    ...config,
    async startTraining() {
      return notImplemented();
    },
    async pollStatus() {
      return notImplemented();
    },
    async fetchResult() {
      return notImplemented();
    },
    async cancel() {
      return notImplemented();
    },
  };
}
