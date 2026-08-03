/**
 * Identity Engine (Milestone 22) — Identity Assets read-model. Owner-scoped, server-side.
 *
 * "Identity Assets" is the COMPOSED view the UI shows: references + hero + training dataset + trained
 * models. It reuses existing relations (`IdentityMedia`, `displayImage`) plus the new
 * `IdentityDataset` / `IdentityTrainedModel` tables — distinct from the generic `IdentityArtifact`
 * store. Read-only; supports multiple versioned trained models (never overwritten).
 */
import { prisma } from "@/lib/db";

export type TrainedModelSummary = {
  id: string;
  engine: string;
  provider: string;
  version: number;
  label: string;
  status: string;
  triggerWord: string | null;
  createdAt: Date;
};

export type IdentityAssets = {
  identityId: string;
  referenceCount: number; // linked training media
  hasHeroImage: boolean;
  dataset: {
    readinessScore: number;
    rating: string;
    imageCount: number;
    analyzedCount: number;
    computedAt: Date;
  } | null;
  trainedModels: TrainedModelSummary[];
};

/** Compose an identity's assets (owner-scoped). Returns null if the identity isn't the user's. */
export async function getIdentityAssets(
  userId: string,
  identityId: string,
): Promise<IdentityAssets | null> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: {
      displayImageId: true,
      _count: { select: { trainingMedia: true } },
      dataset: true,
      trainedModels: { orderBy: [{ engine: "asc" }, { version: "desc" }] },
    },
  });
  if (!identity) return null;

  return {
    identityId,
    referenceCount: identity._count.trainingMedia,
    hasHeroImage: identity.displayImageId != null,
    dataset: identity.dataset
      ? {
          readinessScore: identity.dataset.readinessScore,
          rating: identity.dataset.rating,
          imageCount: identity.dataset.imageCount,
          analyzedCount: identity.dataset.analyzedCount,
          computedAt: identity.dataset.computedAt,
        }
      : null,
    trainedModels: identity.trainedModels.map((m) => ({
      id: m.id,
      engine: m.engine,
      provider: m.provider,
      version: m.version,
      label: m.label,
      status: m.status,
      triggerWord: m.triggerWord,
      createdAt: m.createdAt,
    })),
  };
}
