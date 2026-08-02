/**
 * Face similarity provider router (Milestone 26) — mirrors the image / vision routers.
 *
 * The registry is intentionally EMPTY: the abstraction is validated first, the concrete provider
 * (AuraFace via a hosted endpoint, AWS Rekognition, …) is chosen LATER and dropped in as one entry with
 * zero engine change. Until then `getFaceSimilarityProvider()` returns the not-configured fallback and
 * evaluation degrades cleanly. `FACE_SIMILARITY_PROVIDER` env forces one once providers exist.
 */
import { notConfiguredProvider, type FaceSimilarityProvider } from "./FaceSimilarityProvider";

const REGISTRY: FaceSimilarityProvider[] = [
  // AuraFace / AWS Rekognition / … land here — one line each, no engine change.
];

/** The active provider (env override → first configured → not-configured fallback). */
export function getFaceSimilarityProvider(): FaceSimilarityProvider {
  const forced = process.env.FACE_SIMILARITY_PROVIDER;
  if (forced) {
    const hit = REGISTRY.find((p) => p.id === forced);
    if (hit) return hit;
  }
  return REGISTRY.find((p) => p.isConfigured()) ?? notConfiguredProvider;
}

/** Whether ANY face-similarity provider is configured (drives graceful "not-configured" evaluation). */
export function isFaceSimilarityConfigured(): boolean {
  return REGISTRY.some((p) => p.isConfigured());
}

export {
  type FaceSimilarityProvider,
  type Embedding,
  FaceSimilarityError,
  supportsEmbed,
  supportsCompare,
  notConfiguredProvider,
} from "./FaceSimilarityProvider";
