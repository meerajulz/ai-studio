/**
 * PuLID Engine (Milestone 22) — PLACEHOLDER, DISABLED.
 *
 * An `adapter` (NON-TRAINABLE) identity module: PuLID injects a precomputed face-ID embedding at
 * generation time → strategy `reference+pulid`, with no training run. It is registered `enabled:
 * false` to prove the architecture supports non-trainable engines alongside trainable ones. Its
 * embedding artifact would live in `IdentityArtifact` (kind: "id-vector"). No integration here.
 */
import type { IdentityModule } from "../../modules/IdentityModule";
import type {
  ConditioningContext,
  ConditioningContribution,
  ModuleAvailability,
} from "../../types";

export const pulidEngine: IdentityModule = {
  id: "pulid",
  label: "PuLID Engine",
  kind: "adapter",
  priority: 70,
  enabled: false, // placeholder — not integrated

  async availability(ctx: ConditioningContext): Promise<ModuleAvailability> {
    const artifact = ctx.artifacts.find((a) => a.engine === "pulid" || a.kind === "id-vector");
    if (!artifact) return { available: false, reason: "no PuLID identity embedding for this identity" };
    return { available: true, reason: "PuLID embedding available" };
  },

  async contribute(ctx: ConditioningContext): Promise<ConditioningContribution> {
    const artifact = ctx.artifacts.find((a) => a.engine === "pulid" || a.kind === "id-vector") ?? null;
    return {
      part: "pulid",
      adapterInputs: artifact ? { pulid: { ref: artifact.ref } } : null,
      reason: artifact ? "conditioning with PuLID embedding" : "no PuLID embedding",
    };
  },
};
