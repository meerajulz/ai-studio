/**
 * Embedding Provider router (Milestone 26) — mirrors the image / vision provider routers.
 *
 * Chooses the configured `EmbeddingProvider` from a registry; the engine calls `getEmbeddingProvider()`
 * and never names a backend. Add Fal / self-hosted InsightFace as a sibling in the registry — no engine
 * change. `EMBEDDING_PROVIDER` env forces one for testing.
 */
import { replicateArcFaceProvider } from "./replicate-arcface";
import type { EmbeddingProvider } from "./EmbeddingProvider";

const REGISTRY: EmbeddingProvider[] = [replicateArcFaceProvider];

/** The active provider (env override → else first configured → else first registered as a stub). */
export function getEmbeddingProvider(): EmbeddingProvider {
  const forced = process.env.EMBEDDING_PROVIDER;
  if (forced) {
    const hit = REGISTRY.find((p) => p.id === forced);
    if (hit) return hit;
  }
  return REGISTRY.find((p) => p.isConfigured()) ?? REGISTRY[0];
}

/** Whether ANY embedding provider is configured (drives graceful "not-configured" evaluation). */
export function isEmbeddingConfigured(): boolean {
  return REGISTRY.some((p) => p.isConfigured());
}

export {
  type EmbeddingProvider,
  type FaceEmbedding,
  EmbeddingProviderError,
  isEmbeddingProviderError,
} from "./EmbeddingProvider";
