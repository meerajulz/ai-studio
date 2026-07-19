/**
 * Identity Engine (Milestone 22) — assemble an Identity's Training Dataset. Pure + provider-neutral.
 *
 * Combines metrics (coverage + diversity + quality), readiness (the score that becomes part of the
 * Identity), and curation (recommended/rejected images) from the identity's persisted Vision
 * knowledge. The caller (identity/server) maps `MediaVisionKnowledge` rows into `DatasetImage[]` and
 * persists the result to `IdentityDataset`. Never analyzes at generation time.
 */
import { computeDatasetMetrics } from "./metrics";
import { computeReadiness } from "./readiness";
import { curateDataset } from "./curation";
import type { DatasetImage, IdentityDataset } from "./types";

export function assembleDataset(
  images: DatasetImage[],
  opts: { identityId?: string | null; totalImages?: number; datasetVersion?: number } = {},
): IdentityDataset {
  const totalImages = opts.totalImages ?? images.length;
  const metrics = computeDatasetMetrics(
    images.map((i) => i.metadata),
    totalImages,
  );
  const readiness = computeReadiness(metrics);
  const curation = curateDataset(images, opts.datasetVersion ?? 1);

  return {
    identityId: opts.identityId ?? null,
    imageCount: totalImages,
    analyzedCount: images.length,
    metrics,
    readiness,
    curation,
  };
}
