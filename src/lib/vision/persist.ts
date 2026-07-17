/**
 * Persisted Vision knowledge (Milestone 20) — the bridge from the analysis pipeline to a permanent
 * KNOWLEDGE SYSTEM. Vision analyzes a training image ONCE (on demand / manual reanalyze) and we store
 * the provider-neutral, frozen `im-2` knowledge in `MediaVisionKnowledge`. Generation then reads this
 * — it must NEVER re-analyze the identity library.
 *
 * Owner-scoped. Reuses the media layer for signed URLs (never touches Blob). Stores ONLY knowledge —
 * never raw provider responses or debug values. Server-side only (called from actions).
 */
import { Prisma, prisma } from "@/lib/db";
import { getMediaByIds } from "@/lib/media/server";
import { analyzeIdentity } from "./index";
import { IDENTITY_METADATA_VERSION, type IdentityMetadata } from "./types";
import type { IdentityImageScore } from "./image-score";

/** A row of persisted knowledge, decoded back into the frozen knowledge types. */
export type PersistedMediaKnowledge = {
  mediaId: string;
  version: string;
  provider: string;
  model: string;
  overallScore: number;
  metadata: IdentityMetadata;
  score: IdentityImageScore;
  analyzedAt: Date;
};

/** Analyze ONE owner-scoped image and persist its knowledge. Returns the stored knowledge. */
export async function analyzeAndPersistMedia(
  userId: string,
  mediaId: string,
): Promise<PersistedMediaKnowledge> {
  const [asset] = await getMediaByIds(userId, [mediaId]);
  if (!asset) throw new Error("Media not found or not yours.");

  const { metadata, score } = await analyzeIdentity(asset.url);

  const row = await prisma.mediaVisionKnowledge.upsert({
    where: { mediaId },
    create: {
      mediaId,
      version: metadata.version,
      provider: metadata.source.provider,
      model: metadata.source.model,
      overallScore: score.overall,
      metadata: metadata as unknown as Prisma.InputJsonValue,
      score: score as unknown as Prisma.InputJsonValue,
    },
    update: {
      version: metadata.version,
      provider: metadata.source.provider,
      model: metadata.source.model,
      overallScore: score.overall,
      metadata: metadata as unknown as Prisma.InputJsonValue,
      score: score as unknown as Prisma.InputJsonValue,
      analyzedAt: new Date(),
    },
  });

  return decodeRow(row);
}

export type AnalyzeLibrarySummary = {
  total: number;
  analyzed: number;
  skipped: number; // already at the current version
  failed: number;
  failures: { mediaId: string; error: string }[];
};

/**
 * Analyze + persist every training image of an owner-scoped identity that isn't already at the
 * current metadata version. `force` re-analyzes everything. Sequential (Gemini is slow + rate-limited;
 * the async Job queue will parallelize this later).
 */
export async function analyzeIdentityLibrary(
  userId: string,
  identityId: string,
  opts: { force?: boolean } = {},
): Promise<AnalyzeLibrarySummary> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: { trainingMedia: { orderBy: { position: "asc" }, select: { mediaId: true } } },
  });
  if (!identity) throw new Error("Identity not found or not yours.");

  const mediaIds = identity.trainingMedia.map((t) => t.mediaId);
  const existing = await prisma.mediaVisionKnowledge.findMany({
    where: { mediaId: { in: mediaIds }, version: IDENTITY_METADATA_VERSION },
    select: { mediaId: true },
  });
  const upToDate = new Set(existing.map((e) => e.mediaId));

  const summary: AnalyzeLibrarySummary = {
    total: mediaIds.length,
    analyzed: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const mediaId of mediaIds) {
    if (!opts.force && upToDate.has(mediaId)) {
      summary.skipped += 1;
      continue;
    }
    try {
      await analyzeAndPersistMedia(userId, mediaId);
      summary.analyzed += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({
        mediaId,
        error: error instanceof Error ? error.message : "analysis failed",
      });
    }
  }
  return summary;
}

/** Batch-read persisted knowledge for the given media (owner-scoped via the media relation). */
export async function getPersistedKnowledge(
  userId: string,
  mediaIds: string[],
): Promise<Map<string, PersistedMediaKnowledge>> {
  if (mediaIds.length === 0) return new Map();
  const rows = await prisma.mediaVisionKnowledge.findMany({
    where: { mediaId: { in: mediaIds }, media: { userId } },
  });
  return new Map(rows.map((r) => [r.mediaId, decodeRow(r)]));
}

type KnowledgeRow = {
  mediaId: string;
  version: string;
  provider: string;
  model: string;
  overallScore: number;
  metadata: Prisma.JsonValue;
  score: Prisma.JsonValue;
  analyzedAt: Date;
};

function decodeRow(row: KnowledgeRow): PersistedMediaKnowledge {
  return {
    mediaId: row.mediaId,
    version: row.version,
    provider: row.provider,
    model: row.model,
    overallScore: row.overallScore,
    metadata: row.metadata as unknown as IdentityMetadata,
    score: row.score as unknown as IdentityImageScore,
    analyzedAt: row.analyzedAt,
  };
}
