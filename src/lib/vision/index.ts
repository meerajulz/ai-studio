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
import { normalizeToIdentityMetadata } from "./normalize";
import { scoreIdentityImage, type IdentityImageScore } from "./image-score";
import { geminiVisionProvider } from "./providers/gemini";
import { routeVisionProvider as routeFromRegistry } from "./router";
import type { VisionProvider } from "./VisionProvider";
import type { IdentityMetadata } from "./types";
import type {
  VisionRoutingCriteria,
  VisionRoutingDecision,
} from "./router";

/**
 * Vision provider registry (Milestone 19). Order is the routing preference. Gemini is the first
 * provider; OpenAI / Qwen / Florence slot in exactly like image providers — feature code routes on
 * capabilities, never on the name. A provider is only *used* when configured (its API key is set).
 */
const REGISTRY: VisionProvider[] = [geminiVisionProvider];

/**
 * Analyse ONE identity image → knowledge + per-image score. Routes to a configured vision provider
 * (needs attributes + quality), gets OBSERVATIONS, normalizes to `IdentityMetadata`, and scores it.
 * The single entry point for building identity knowledge. (The provider call is the only I/O.)
 */
export async function analyzeIdentity(imageUrl: string): Promise<{
  metadata: IdentityMetadata;
  score: IdentityImageScore;
}> {
  const { provider } = routeVisionProvider({ needs: ["attributes", "quality"] });
  const observation = await provider.analyzeImage({ imageUrl });
  const metadata = normalizeToIdentityMetadata(observation);
  const score = scoreIdentityImage(metadata);
  return { metadata, score };
}

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
export { normalizeToIdentityMetadata, toTattooRegion } from "./normalize";
export { synthesizeIdentityAppearance } from "./synthesize";
export { classifyExposure, EXPOSURE_RANK, type ExposureLevel } from "./exposure";
export {
  summarizeMediaKnowledge,
  buildMediaKnowledgeDetail,
  type MediaKnowledgeSummary,
  type MediaKnowledgeDetail,
  type KnowledgeSource,
} from "./summary";
export { computeIdentityCoverage } from "./coverage";

// Identity Coverage Engine (identity-level: "what is missing?") — Milestone 18B
export {
  analyzeIdentityCoverage,
  renderStars,
  COVERAGE_ENGINE_VERSION,
  type CoverageDimensionId,
  type CoverageReport,
  type CoverageStatus,
  type CoverageSuggestion,
  type DimensionScore,
} from "./coverage-engine";

// Identity Image Scoring (per-image: "which image is best?") — Milestone 19
export {
  scoreIdentityImage,
  rankIdentityImages,
  IMAGE_SCORE_VERSION,
  type IdentityImageScore,
  type ScoredImage,
} from "./image-score";

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
  type BodyRegion,
  type FaceExpression,
  type FaceKnowledge,
  type FaceOrientation,
  type FacePose,
  type FaceQuality,
  type HairKnowledge,
  type HairParting,
  type HairTexture,
  type HairUpdo,
  type IdentityCoverage,
  type IdentityMetadata,
  type ImageEmbedding,
  type ImageQuality,
  type LightingKnowledge,
  type ReferenceSuitability,
  type TattooKnowledge,
  type TattooRegion,
  type VisionObservation,
} from "./types";
