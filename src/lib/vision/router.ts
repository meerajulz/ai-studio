/**
 * Vision Provider Router (Milestone 18A) — mirrors the image router.
 *
 * Chooses a vision provider from a registry by CAPABILITIES + configuration, never by name. In 18A
 * the registry is empty (no providers yet); the first adapter lands in 18B. Ready for capability
 * routing (e.g. "needs faceEmbed") from day one.
 */
import { hasAllVision, type VisionCapability } from "./capabilities";
import { VisionError, type VisionProvider } from "./VisionProvider";

export type VisionRoutingDecision = {
  chosen: string;
  reason: string;
  considered: { id: string; configured: boolean; capabilities: VisionCapability[] }[];
};

export type VisionRoutingCriteria = {
  /** Capabilities the task needs (e.g. ["attributes", "quality"]). */
  needs?: VisionCapability[];
};

export function routeVisionProvider(
  registry: VisionProvider[],
  criteria: VisionRoutingCriteria = {},
): { provider: VisionProvider; decision: VisionRoutingDecision } {
  const considered = registry.map((p) => ({
    id: p.id,
    configured: p.isConfigured(),
    capabilities: [...p.capabilities] as VisionCapability[],
  }));

  const override = process.env.VISION_PROVIDER?.trim().toLowerCase();
  const configured = registry.filter((p) => p.isConfigured());
  const needs = criteria.needs ?? [];

  let provider: VisionProvider | undefined;
  let reason: string;

  if (override) {
    provider = registry.find((p) => p.id === override);
    if (!provider) {
      throw new VisionError("UNSUPPORTED", `VISION_PROVIDER="${override}" is not a known provider.`);
    }
    reason = `forced by VISION_PROVIDER=${override}`;
  } else if (needs.length > 0 && configured.some((p) => hasAllVision(p.capabilities, needs))) {
    provider = configured.find((p) => hasAllVision(p.capabilities, needs))!;
    reason = `first configured provider with [${needs.join(", ")}]`;
  } else {
    provider = configured[0];
    reason = provider ? "first configured provider" : "no vision provider configured";
  }

  if (!provider) {
    throw new VisionError("MISSING_TOKEN", "No vision provider is configured.");
  }

  return {
    provider,
    decision: { chosen: provider.id, reason, considered },
  };
}
