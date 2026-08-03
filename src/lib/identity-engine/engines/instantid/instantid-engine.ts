/**
 * InstantID Engine (Milestone 22) — PLACEHOLDER, DISABLED.
 *
 * An `adapter` (NON-TRAINABLE) identity module, sibling to PuLID: InstantID conditions generation
 * from a face embedding + keypoints at runtime → strategy `reference+instantid`, no training. Its
 * artifacts would live in `IdentityArtifact`. Registered `enabled: false`; no integration here.
 */
import type { IdentityModule } from "../../modules/IdentityModule";
import type {
  ConditioningContext,
  ConditioningContribution,
  ModuleAvailability,
} from "../../types";

export const instantIdEngine: IdentityModule = {
  id: "instantid",
  label: "InstantID Engine",
  kind: "adapter",
  priority: 65,
  enabled: false, // placeholder — not integrated
  autoSelect: false,

  async availability(ctx: ConditioningContext): Promise<ModuleAvailability> {
    const artifact = ctx.artifacts.find((a) => a.engine === "instantid");
    if (!artifact) return { available: false, reason: "no InstantID artifact for this identity" };
    return { available: true, reason: "InstantID artifact available" };
  },

  async contribute(ctx: ConditioningContext): Promise<ConditioningContribution> {
    const artifact = ctx.artifacts.find((a) => a.engine === "instantid") ?? null;
    return {
      part: "instantid",
      adapterInputs: artifact ? { instantid: { ref: artifact.ref } } : null,
      reason: artifact ? "conditioning with InstantID" : "no InstantID artifact",
    };
  },
};
