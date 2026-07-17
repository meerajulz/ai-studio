/**
 * AI layer — the provider-agnostic entry point. Feature code depends only on the `ImageProvider`
 * interface + provider CAPABILITIES (Milestone 15), never on provider names. Adding a provider =
 * a new file under `providers/` + one entry in `REGISTRY`.
 * See docs/PROVIDER_INTERFACE.md, AI_GENERATION.md.
 */
import type { ImageProvider } from "./ImageProvider";
import { falProvider } from "./providers/fal";
import { huggingFaceProvider } from "./providers/huggingface";
import {
  routeImageProvider as routeFromRegistry,
  type RoutingCriteria,
  type RoutingDecision,
} from "./router";

/** Provider registry — order is the routing preference (premium first). */
const REGISTRY: ImageProvider[] = [falProvider, huggingFaceProvider];

/** Route to a provider by capability/config (see router). Bound to the registry. */
export function routeImageProvider(criteria?: RoutingCriteria): {
  provider: ImageProvider;
  decision: RoutingDecision;
} {
  return routeFromRegistry(REGISTRY, criteria);
}

/** Get a specific provider by id (e.g. to re-run a recipe on the same provider). */
export function getImageProvider(id?: string): ImageProvider {
  if (!id) return routeImageProvider().provider;
  const provider = REGISTRY.find((p) => p.id === id);
  return provider ?? routeImageProvider().provider;
}

/** Whether ANY image provider is configured (for graceful UI degradation). */
export function isImageProviderConfigured(): boolean {
  return REGISTRY.some((p) => p.isConfigured());
}

export {
  capabilities,
  hasAll,
  hasCapability,
  type ProviderCapabilities,
  type ProviderCapability,
} from "./capabilities";
export { type RoutingCriteria, type RoutingDecision } from "./router";
export {
  MODEL_REGISTRY,
  listModels,
  getModel,
  modelsForProvider,
  type ModelSpec,
  type PayloadKind,
} from "./model-registry";
export {
  chooseModel,
  type ModelMode,
  type ModelRoutingCriteria,
  type ModelRoutingDecision,
  type ConsideredModel,
} from "./model-router";
export {
  ProviderError,
  isProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
  type ReferenceImage,
} from "./ImageProvider";
