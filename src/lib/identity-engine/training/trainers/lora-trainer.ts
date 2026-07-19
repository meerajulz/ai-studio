/**
 * LoRATrainer (Milestone 22) — ARCHITECTURE ONLY. The first concrete `Trainer` shape; its backend
 * will eventually be Fal. Every method throws `NOT_IMPLEMENTED` so nothing accidentally trains — the
 * milestone deliberately ships the interface, not the implementation. Future trainers (other methods
 * or providers) drop in beside this file and register with the `TrainingEngine`.
 */
import type { Trainer } from "../Trainer";
import type {
  TrainingJob,
  TrainingResult,
  TrainingStatus,
} from "../../engines/lora/types";

const NOT_IMPLEMENTED = "LoRA training is not implemented yet (Milestone 22 is architecture only).";

export const loraTrainer: Trainer = {
  id: "fal", // intended first backend; not wired
  supports: ["lora"],
  async startTraining(): Promise<TrainingJob> {
    throw new Error(NOT_IMPLEMENTED);
  },
  async pollStatus(): Promise<TrainingStatus> {
    throw new Error(NOT_IMPLEMENTED);
  },
  async fetchResult(): Promise<TrainingResult> {
    throw new Error(NOT_IMPLEMENTED);
  },
  async cancel(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  },
};
