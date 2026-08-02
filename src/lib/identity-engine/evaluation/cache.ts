/**
 * Identity embedding cache (Milestone 26) — compute ONCE, reuse forever (per version).
 *
 * Every image's embedding is expensive (a hosted call), so we cache it in Neon keyed by
 * (mediaId, kind, version). Reference training images are embedded on first evaluation and reused across
 * every later generation + benchmark; only NEW generated images cost a call. A provider/model change bumps
 * the provider `version` → cache miss → automatic recompute, and scores from different models never mix.
 * Server-side only. See docs/IDENTITY_EVALUATION.md.
 */
import { Prisma, prisma } from "@/lib/db";
import { getEmbeddingProvider, type FaceEmbedding } from "./providers";

export type EmbeddingKind = "face"; // future: "tattoo" | "body" | …

/**
 * Return the cached embedding for an image at the CURRENT provider version, computing + storing it on a
 * miss. `null` when the provider found no face (cached as absence is NOT done — a re-upload/better crop
 * could change it; no-face simply returns null each call, which is cheap to short-circuit upstream).
 */
export async function getOrComputeEmbedding(
  userId: string,
  mediaId: string,
  imageUrl: string,
  source: "uploaded" | "generated",
  kind: EmbeddingKind = "face",
): Promise<FaceEmbedding | null> {
  const provider = getEmbeddingProvider();
  const version = provider.version;

  const cached = await prisma.mediaEmbedding.findUnique({
    where: { mediaId_kind_version: { mediaId, kind, version } },
    select: { vector: true, dim: true },
  });
  if (cached) return { vector: cached.vector as number[], dim: cached.dim, version };

  const embedding = kind === "face" ? await provider.embedFace(imageUrl) : null;
  if (!embedding) return null;

  await prisma.mediaEmbedding.upsert({
    where: { mediaId_kind_version: { mediaId, kind, version } },
    create: {
      mediaId,
      source,
      userId,
      kind,
      provider: provider.id,
      model: provider.model,
      version,
      vector: embedding.vector as unknown as Prisma.InputJsonValue,
      dim: embedding.dim,
    },
    update: {}, // a concurrent writer already cached it — keep theirs
  });
  return embedding;
}
