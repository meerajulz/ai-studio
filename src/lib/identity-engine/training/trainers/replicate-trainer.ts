/**
 * ReplicateTrainer (Milestone 23) — registered but DISABLED. Proves the Training Registry is
 * provider-agnostic from day one; a future milestone flips `enabled` and implements the backend.
 */
import { stubTrainer } from "./stub";

export const replicateTrainer = stubTrainer({
  id: "replicate",
  label: "Replicate",
  supports: ["lora"],
  enabled: false,
  priority: 80,
});
