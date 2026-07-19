/**
 * LoRA Engine (Milestone 22) — ARCHITECTURE ONLY, DISABLED.
 *
 * A `trainable` identity module: it conditions generation by attaching a trained LoRA adapter (via
 * `loraModelId`) ON TOP of the reference baseline → strategy `reference+lora`. It is registered but
 * `enabled: false`, and `availability` reports "no trained model" until (a future milestone) training
 * ships and a READY `IdentityTrainedModel` exists for the identity. Nothing here trains anything.
 */
import type { IdentityModule } from "../../modules/IdentityModule";
import type {
  ConditioningContext,
  ConditioningContribution,
  ModuleAvailability,
} from "../../types";

export const loraEngine: IdentityModule = {
  id: "lora",
  label: "LoRA Engine",
  kind: "trainable",
  priority: 80,
  enabled: false, // architecture only — no training implemented yet

  async availability(ctx: ConditioningContext): Promise<ModuleAvailability> {
    const ready = ctx.trainedModels.find((m) => m.engine === "lora" && m.artifactRef);
    if (!ready) {
      return { available: false, reason: "no trained LoRA model for this identity" };
    }
    return { available: true, reason: `LoRA v${ready.version} ready` };
  },

  async contribute(ctx: ConditioningContext): Promise<ConditioningContribution> {
    // Reached only once enabled + a model is ready (future). Layers the model onto the baseline.
    const model = ctx.trainedModels.find((m) => m.engine === "lora" && m.artifactRef) ?? null;
    return {
      part: "lora",
      loraModelId: model?.id ?? null,
      reason: model ? `conditioning with LoRA v${model.version}` : "no LoRA model",
    };
  },
};
