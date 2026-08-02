/**
 * Identity embedding cache (Milestone 26) — compute ONCE, reuse forever (per version).
 *
 * Only relevant for `embed`-capable providers: a face vector is expensive, so we cache it in Neon keyed by
 * (mediaId, kind, version). Reference faces are embedded on first evaluation and reused across every later
 * generation + benchmark; only NEW generated images cost a call. A provider/model change bumps `version` →
 * cache miss → automatic recompute, and scores from different models never mix. `compare`-only providers
 * skip this entirely (they return a score directly, nothing to cache). Server-side only.
 */
import { Prisma, prisma } from "@/lib/db";
import { getFaceSimilarityProvider, supportsEmbed, type Embedding } from "./providers";

export type EmbeddingKind = "face"; // future: "tattoo" | "body" | …

/**
 * Cached embedding for an image at the CURRENT provider version, computing + storing it on a miss.
 * Returns `null` when the provider can't embed, or found no face.
 */
export async function getOrComputeEmbedding(
  userId: string,
  mediaId: string,
  imageUrl: string,
  source: "uploaded" | "generated",
  kind: EmbeddingKind = "face",
): Promise<Embedding | null> {
  const provider = getFaceSimilarityProvider();
  if (!supportsEmbed(provider)) return null;
  const version = provider.version;

  const cached = await prisma.mediaEmbedding.findUnique({
    where: { mediaId_kind_version: { mediaId, kind, version } },
    select: { vector: true, dim: true },
  });
  if (cached) return { vector: cached.vector as number[], dim: cached.dim, version };

  const embedding = await provider.embed(imageUrl);
  if (!embedding) return null;

  await prisma.mediaEmbedding.upsert({
    where: { mediaId_kind_version: { mediaId, kind, version } },
    create: {
      mediaId,
      source,
      userId,
      kind,
      provider: provider.id,
      model: provider.id,
      version,
      vector: embedding.vector as unknown as Prisma.InputJsonValue,
      dim: embedding.dim,
    },
    update: {}, // a concurrent writer already cached it — keep theirs
  });
  return embedding;
}
