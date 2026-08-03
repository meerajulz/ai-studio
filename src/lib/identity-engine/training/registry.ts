/**
 * Training Registry (Milestone 23) — the THIRD registry, symmetric with the Model Registry
 * (`ai/model-registry.ts`) and the Identity Module Registry (`identity-engine/registry.ts`).
 *
 * Lists provider trainers (Fal enabled; Replicate/OpenAI/Google/Future registered but disabled). The
 * app never hardcodes a training-provider name — it asks the registry which providers can train a given
 * engine. Adding a training provider is a config entry here, not an architectural change.
 */
import type { Trainer } from "./Trainer";
import { falTrainer } from "./trainers/fal-trainer";
import { replicateTrainer } from "./trainers/replicate-trainer";
import { openAiTrainer } from "./trainers/openai-trainer";
import { googleTrainer } from "./trainers/google-trainer";
import { futureTrainer } from "./trainers/future-trainer";

export const TRAINING_REGISTRY: Trainer[] = [
  falTrainer, // enabled — proven backend (implemented in M24)
  replicateTrainer, // disabled — placeholder
  openAiTrainer, // disabled — placeholder
  googleTrainer, // disabled — placeholder
  futureTrainer, // disabled — placeholder
];

const byPriority = (a: Trainer, b: Trainer) => b.priority - a.priority;

export const listTrainers = (): Trainer[] => TRAINING_REGISTRY;
export const getTrainer = (id: string): Trainer | undefined =>
  TRAINING_REGISTRY.find((t) => t.id === id);
export const enabledTrainers = (): Trainer[] => TRAINING_REGISTRY.filter((t) => t.enabled);

/** The enabled trainer that can train `engine` (optionally from a specific provider), highest priority. */
export const trainerFor = (engine: string, provider?: string): Trainer | undefined =>
  TRAINING_REGISTRY.filter(
    (t) => t.enabled && t.supports.includes(engine) && (!provider || t.id === provider),
  ).sort(byPriority)[0];
