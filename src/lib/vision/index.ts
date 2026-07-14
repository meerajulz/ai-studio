/**
 * Vision layer — provider-agnostic image UNDERSTANDING (Milestone 18A — architecture only).
 *
 * Turns identity images into KNOWLEDGE (structured `IdentityMetadata`), never storing a provider's
 * raw description. Mirrors the image layer: a `VisionProvider` interface + capabilities + a router.
 *
 * ⚠️ 18A ships ZERO providers on purpose (no Gemini/OpenAI/Florence/Qwen — no APIs). The registry is
 * empty; the first adapter is added in 18B behind this exact interface, so the rest of AI Studio
 * never changes. See docs/IDENTITY_INTELLIGENCE.md, docs/research/RESEARCH_02_VISION.md.
 */
import { routeVisionProvider as routeFromRegistry } from "./router";
import type { VisionProvider } from "./VisionProvider";
import type {
  VisionRoutingCriteria,
  VisionRoutingDecision,
} from "./router";

/**
 * Vision provider registry. **Empty in 18A** — 18B adds the first adapter here (per research, a VLM
 * such as Gemini / Qwen2.5-VL / Florence-2). Order is the routing preference.
 */
const REGISTRY: VisionProvider[] = [];

export function routeVisionProvider(criteria?: VisionRoutingCriteria): {
  provider: VisionProvider;
  decision: VisionRoutingDecision;
} {
  return routeFromRegistry(REGISTRY, criteria);
}

export function getVisionProvider(id?: string): VisionProvider {
  if (!id) return routeVisionProvider().provider;
  const provider = REGISTRY.find((p) => p.id === id);
  if (!provider) return routeVisionProvider().provider;
  return provider;
}

/** Whether ANY vision provider is configured (false in 18A — no providers yet). */
export function isVisionConfigured(): boolean {
  return REGISTRY.some((p) => p.isConfigured());
}

// Knowledge-building (pure, provider-neutral)
export { normalizeToIdentityMetadata } from "./normalize";
export { computeIdentityCoverage } from "./coverage";

// Contracts + types
export {
  visionCapabilities,
  hasVisionCapability,
  hasAllVision,
  type VisionCapabilities,
  type VisionCapability,
} from "./capabilities";
export {
  VisionError,
  isVisionError,
  type VisionProvider,
  type VisionRequest,
  type VisionErrorCode,
} from "./VisionProvider";
export {
  type VisionRoutingCriteria,
  type VisionRoutingDecision,
} from "./router";
export {
  IDENTITY_METADATA_VERSION,
  type BodyKnowledge,
  type FaceKnowledge,
  type HairKnowledge,
  type IdentityCoverage,
  type IdentityMetadata,
  type ImageEmbedding,
  type ImageQuality,
  type LightingKnowledge,
  type TattooKnowledge,
  type VisionObservation,
} from "./types";
