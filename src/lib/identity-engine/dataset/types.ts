/**
 * Identity Engine (Milestone 22) — Identity Dataset types.
 *
 * An Identity's Training Dataset is more than a list of images: it knows its own coverage, quality,
 * diversity, and READINESS. It is the source every future training method reads from. Computed from
 * persisted Vision knowledge (never re-analyzed at generation time) and provider-neutral.
 */
import type { CoverageReport, IdentityImageScore, IdentityMetadata } from "@/lib/vision";

export const DATASET_METRICS_VERSION = "de-1";

/** One analyzed training image, keyed so curation can name recommended/rejected media. */
export type DatasetImage = {
  mediaId: string;
  metadata: IdentityMetadata;
  score: IdentityImageScore;
};

/** Near-duplicate detection (design only — perceptual-hash / embedding impl deferred). */
export type DuplicateReport = {
  method: string; // "none" until embeddings/pHash land
  count: number;
  pairs: { a: string; b: string; similarity: number }[];
};

/** Dimensioned dataset metrics (0..1 unless noted). Coverage is delegated to the vision engine. */
export type DatasetMetrics = {
  version: string;
  coverage: CoverageReport; // REUSES analyzeIdentityCoverage (front/profile/back/body/hair/tattoo/env)
  frontalFaceCoverage: number;
  sideProfileCoverage: number;
  expressionDiversity: number;
  hairstyleCoverage: number;
  tattooVisibility: number;
  lightingDiversity: number;
  bodyVisibility: number;
  sharpness: number; // mean image sharpness (higher = less blur)
  blurIncidence: number; // fraction of images flagged blurry
  duplicates: DuplicateReport;
  overallQuality: number; // 0..1 (mean image quality.overall / 100)
};

export type DatasetRating = "excellent" | "good" | "fair" | "poor";

/** The readiness verdict that "becomes part of the Identity". */
export type DatasetReadiness = {
  score: number; // 0..100
  stars: number; // 0..5
  rating: DatasetRating;
  verdict: string; // "Excellent candidate for identity training."
  gaps: string[]; // prioritized, human-readable
};

/** Curation metadata reserved for training — which images a future trainer should use / skip. */
export type DatasetCuration = {
  datasetVersion: number;
  recommendedImageIds: string[];
  rejectedImageIds: string[];
  rejectionReasons: Record<string, string>; // mediaId → reason
};

/** The assembled dataset — metrics + readiness + curation + counts. Persisted to `IdentityDataset`. */
export type IdentityDataset = {
  identityId: string | null;
  imageCount: number;
  analyzedCount: number;
  metrics: DatasetMetrics;
  readiness: DatasetReadiness;
  curation: DatasetCuration;
};
