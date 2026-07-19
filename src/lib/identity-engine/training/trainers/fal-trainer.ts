/**
 * FalTrainer (Milestone 23) — the first, ENABLED provider trainer. Provider-named (Fal), it `supports`
 * the `lora` engine. In M23 it is registered + enabled so the infrastructure treats training as
 * available, but its `startTraining` still throws NOT_IMPLEMENTED — **M24** replaces the stub body with
 * real Fal LoRA training (upload dataset → start Fal job → poll → fetch weights → persist a versioned
 * model). Renamed from the M22 technique-named `loraTrainer`: the registry lists PROVIDERS; the
 * technique is carried by `TrainingOptions.engine`.
 */
import { stubTrainer } from "./stub";

export const falTrainer = stubTrainer({
  id: "fal",
  label: "Fal",
  supports: ["lora"],
  enabled: true, // the proven training backend — implemented in M24
  priority: 100,
});
