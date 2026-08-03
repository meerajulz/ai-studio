/**
 * LoRA Engine (Milestone 22 architecture · Milestone 24 enabled).
 *
 * A `trainable` identity module: it conditions generation by attaching a trained LoRA adapter ON TOP
 * of the reference baseline → strategy `reference+lora`. `availability` is true once a READY
 * `IdentityTrainedModel` (engine `lora`, with weights) exists for the identity; `contribute` hands the
 * generation layer the weights URL + trigger phrase. The engine never trains — that's the Fal trainer.
 */
import type { IdentityModule } from "../../modules/IdentityModule";
import type {
  ConditioningContext,
  ConditioningContribution,
  ModuleAvailability,
} from "../../types";

/** Latest (highest-version) READY LoRA model with weights, if any. */
function latestLora(ctx: ConditioningContext) {
  return ctx.trainedModels
    .filter((m) => m.engine === "lora" && m.artifactRef)
    .sort((a, b) => b.version - a.version)[0];
}

export const loraEngine: IdentityModule = {
  id: "lora",
  label: "LoRA Engine",
  kind: "trainable",
  priority: 80,
  enabled: true, // Milestone 24 — enabled; availability still gates on a trained model existing
  autoSelect: true, // a trained LoRA is a strict upgrade → auto-used when present

  async availability(ctx: ConditioningContext): Promise<ModuleAvailability> {
    const ready = latestLora(ctx);
    if (!ready) {
      return { available: false, reason: "no trained LoRA model for this identity" };
    }
    return { available: true, reason: `LoRA v${ready.version} ready` };
  },

  async contribute(ctx: ConditioningContext): Promise<ConditioningContribution> {
    const model = latestLora(ctx) ?? null;
    return {
      part: "lora",
      loraModelId: model?.id ?? null,
      loraWeightsUrl: model?.artifactRef ?? null,
      loraTriggerWord: model?.triggerWord ?? null,
      loraScale: 1,
      reason: model ? `conditioning with LoRA v${model.version}` : "no LoRA model",
    };
  },
};
