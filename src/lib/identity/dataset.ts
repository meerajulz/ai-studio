/**
 * Identity ↔ Identity Engine glue (Milestone 22) — persist + read the Identity Dataset.
 *
 * Owner-scoped, server-side. `refreshIdentityDataset` recomputes dataset readiness from the identity's
 * PERSISTED Vision knowledge (never re-analyzing) and upserts `IdentityDataset` — called after the
 * library is analyzed. `getIdentityEngineOverview` composes the read-model the UI placeholders show
 * (dataset readiness + trained models + training jobs). No training/generation here.
 */
import { Prisma, prisma } from "@/lib/db";
import { getPersistedKnowledge } from "@/lib/vision/persist";
import {
  assembleDataset,
  computeReadiness,
  getCapabilities,
  type ConditioningContext,
  type DatasetImage,
  type DatasetMetrics,
  type EngineId,
  type IdentityCapabilities,
} from "@/lib/identity-engine";
import { getIdentityAssets, type TrainedModelSummary } from "@/lib/identity-engine/assets/assets";

/** Recompute + persist dataset readiness for an identity from its persisted knowledge. */
export async function refreshIdentityDataset(userId: string, identityId: string): Promise<void> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: { trainingMedia: { orderBy: { position: "asc" }, select: { mediaId: true } } },
  });
  if (!identity) return; // not the user's identity — silently skip

  const mediaIds = identity.trainingMedia.map((t) => t.mediaId);
  const knowledge = await getPersistedKnowledge(userId, mediaIds);
  const images: DatasetImage[] = mediaIds
    .map((id) => knowledge.get(id))
    .filter((k): k is NonNullable<typeof k> => k != null)
    .map((k) => ({ mediaId: k.mediaId, metadata: k.metadata, score: k.score }));

  const dataset = assembleDataset(images, { identityId, totalImages: mediaIds.length });
  const { readiness, metrics, curation } = dataset;

  const common = {
    readinessScore: readiness.score,
    rating: readiness.rating,
    imageCount: dataset.imageCount,
    analyzedCount: dataset.analyzedCount,
    metrics: metrics as unknown as Prisma.InputJsonValue,
    version: metrics.version,
    datasetVersion: curation.datasetVersion,
    recommendedImageIds: curation.recommendedImageIds,
    rejectedImageIds: curation.rejectedImageIds,
    rejectionReasons: curation.rejectionReasons as unknown as Prisma.InputJsonValue,
  };

  await prisma.identityDataset.upsert({
    where: { identityId },
    create: { identityId, userId, ...common },
    update: { ...common, computedAt: new Date() },
  });
}

export type DatasetReadinessView = {
  score: number;
  stars: number;
  rating: string;
  verdict: string;
  gaps: string[];
  imageCount: number;
  analyzedCount: number;
  computedAt: Date;
  metrics: {
    coverageOverall: number;
    frontalFaceCoverage: number;
    sideProfileCoverage: number;
    expressionDiversity: number;
    hairstyleCoverage: number;
    tattooVisibility: number;
    lightingDiversity: number;
    bodyVisibility: number;
    sharpness: number;
    blurIncidence: number;
    overallQuality: number;
  };
};

export type TrainingJobView = {
  id: string;
  engine: string;
  provider: string;
  status: string;
  datasetVersion: number;
  createdAt: Date;
};

export type IdentityEngineOverview = {
  capabilities: IdentityCapabilities; // what this identity can do now — UI adapts off this
  dataset: DatasetReadinessView | null;
  trainedModels: TrainedModelSummary[];
  trainingJobs: TrainingJobView[];
};

/** Compose the Identity Engine overview for the UI (owner-scoped). `null` if not the user's identity. */
export async function getIdentityEngineOverview(
  userId: string,
  identityId: string,
): Promise<IdentityEngineOverview | null> {
  const assets = await getIdentityAssets(userId, identityId);
  if (!assets) return null;

  const [row, jobs, readyModels, artifactRows] = await Promise.all([
    prisma.identityDataset.findUnique({ where: { identityId } }),
    prisma.identityTrainingJob.findMany({
      where: { identityId, userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // Only READY models can condition — they seed the capability context.
    prisma.identityTrainedModel.findMany({
      where: { identityId, userId, status: "READY" },
      select: { id: true, engine: true, version: true, triggerWord: true, artifactRef: true, modelCompatibility: true },
    }),
    prisma.identityArtifact.findMany({
      where: { identityId, userId },
      select: { id: true, kind: true, engine: true, ref: true },
    }),
  ]);

  // Capabilities: what this identity can do NOW (reference today; lora/pulid/instantid once their
  // modules are enabled AND a model/artifact exists). The UI reads this instead of hardcoding logic.
  const ctx: ConditioningContext = {
    identityId,
    hasAnalyzedCandidates: (row?.analyzedCount ?? 0) > 0,
    trainedModels: readyModels.map((m) => ({
      id: m.id,
      engine: m.engine as EngineId,
      version: m.version,
      triggerWord: m.triggerWord,
      artifactRef: m.artifactRef,
      modelCompatibility: m.modelCompatibility,
    })),
    artifacts: artifactRows.map((a) => ({
      id: a.id,
      kind: a.kind,
      engine: (a.engine as EngineId | null) ?? null,
      ref: a.ref,
    })),
  };
  const capabilities = await getCapabilities(ctx);

  let dataset: DatasetReadinessView | null = null;
  if (row) {
    const metrics = row.metrics as unknown as DatasetMetrics;
    // Verdict/gaps/stars are derived from the stored metrics (pure) — no re-analysis.
    const readiness = computeReadiness(metrics);
    dataset = {
      score: row.readinessScore,
      stars: readiness.stars,
      rating: row.rating,
      verdict: readiness.verdict,
      gaps: readiness.gaps,
      imageCount: row.imageCount,
      analyzedCount: row.analyzedCount,
      computedAt: row.computedAt,
      metrics: {
        coverageOverall: metrics.coverage.overall,
        frontalFaceCoverage: metrics.frontalFaceCoverage,
        sideProfileCoverage: metrics.sideProfileCoverage,
        expressionDiversity: metrics.expressionDiversity,
        hairstyleCoverage: metrics.hairstyleCoverage,
        tattooVisibility: metrics.tattooVisibility,
        lightingDiversity: metrics.lightingDiversity,
        bodyVisibility: metrics.bodyVisibility,
        sharpness: metrics.sharpness,
        blurIncidence: metrics.blurIncidence,
        overallQuality: metrics.overallQuality,
      },
    };
  }

  return {
    capabilities,
    dataset,
    trainedModels: assets.trainedModels,
    trainingJobs: jobs.map((j) => ({
      id: j.id,
      engine: j.engine,
      provider: j.provider,
      status: j.status,
      datasetVersion: j.datasetVersion,
      createdAt: j.createdAt,
    })),
  };
}
