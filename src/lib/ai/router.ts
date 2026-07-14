/**
 * Provider Router (Milestone 15).
 *
 * Chooses an image provider from the registry based on CAPABILITIES and configuration — never on
 * hardcoded names in feature code. Today it prefers the premium provider (Fal) and can satisfy a
 * capability need (e.g. identity preservation); the architecture is ready for richer automatic
 * routing later. An `IMAGE_PROVIDER` env var forces a specific provider (useful for testing that
 * Hugging Face still works).
 */
import { hasAll, type ProviderCapability } from "./capabilities";
import { ProviderError, type ImageProvider } from "./ImageProvider";

export type RoutingDecision = {
  chosen: string; // provider id
  model: string; // provider default model
  reason: string;
  considered: {
    id: string;
    configured: boolean;
    capabilities: ProviderCapability[];
  }[];
};

export type RoutingCriteria = {
  /** Capabilities the generation would ideally use (e.g. identity preservation). Best-effort. */
  needs?: ProviderCapability[];
};

/**
 * Preference order: premium first. The router walks this list; the first provider that is
 * configured (and, when possible, satisfies `needs`) wins.
 */
export function routeImageProvider(
  registry: ImageProvider[],
  criteria: RoutingCriteria = {},
): { provider: ImageProvider; decision: RoutingDecision } {
  const considered = registry.map((p) => ({
    id: p.id,
    configured: p.isConfigured(),
    capabilities: [...p.capabilities] as ProviderCapability[],
  }));

  const override = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  const configured = registry.filter((p) => p.isConfigured());
  const needs = criteria.needs ?? [];

  let provider: ImageProvider | undefined;
  let reason: string;

  if (override) {
    provider = registry.find((p) => p.id === override);
    if (!provider) {
      throw new ProviderError(
        "MISSING_TOKEN",
        `IMAGE_PROVIDER="${override}" is not a known provider.`,
      );
    }
    reason = `forced by IMAGE_PROVIDER=${override}`;
  } else if (needs.length > 0 && configured.some((p) => hasAll(p.capabilities, needs))) {
    provider = configured.find((p) => hasAll(p.capabilities, needs))!;
    reason = `first configured provider with [${needs.join(", ")}]`;
  } else {
    provider = configured[0];
    reason =
      needs.length > 0
        ? `no configured provider has [${needs.join(", ")}] — fell back to first configured`
        : "premium-first: first configured provider";
  }

  if (!provider) {
    throw new ProviderError("MISSING_TOKEN", "No image provider is configured.");
  }

  return {
    provider,
    decision: { chosen: provider.id, model: provider.defaultModel, reason, considered },
  };
}
