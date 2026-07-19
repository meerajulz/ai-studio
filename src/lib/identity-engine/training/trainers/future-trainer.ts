/**
 * FutureTrainer (Milestone 23) — registered but DISABLED. A deliberate placeholder that documents the
 * registry is open-ended: new training providers are config entries, not architectural events.
 */
import { stubTrainer } from "./stub";

export const futureTrainer = stubTrainer({
  id: "future",
  label: "Future",
  supports: [],
  enabled: false,
  priority: 10,
});
