/**
 * Identity ↔ Reference Intelligence glue (Milestone 25.2 Phase D) — persist + read the character's
 * default Identity Package.
 *
 * Owner-scoped, server-side. `refreshCharacterPackage` rebuilds the best-per-role anchor package from the
 * identity's PERSISTED Vision knowledge (never re-analyzing) and upserts `IdentityPackage` — called after
 * the library is analyzed. `getCharacterPackage` reads it back, re-signing anchor URLs at read time (the
 * stored form holds stable mediaIds, not expiring URLs) and dropping anchors whose media was deleted.
 * Generation starts from this package; the planner overrides per-request. See docs/REFERENCE_INTELLIGENCE.md.
 */
import { Prisma, prisma } from "@/lib/db";
import { getMediaByIds } from "@/lib/media/server";
import {
  buildCharacterPackage,
  hydrateAnchors,
  serializeAnchors,
  type CharacterPackage,
  type StoredAnchor,
} from "@/lib/selection";
import { getIdentitySelectionCandidates } from "./server";

/** Package-engine version — bump when the anchor shape or scoring changes materially. */
const PACKAGE_VERSION = "ip-1";

/** Recompute + persist the character's default Identity Package from its analyzed knowledge. */
export async function refreshCharacterPackage(userId: string, identityId: string): Promise<void> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: { _count: { select: { trainingMedia: true } } },
  });
  if (!identity) return; // not the user's identity — silently skip

  const candidates = await getIdentitySelectionCandidates(userId, identityId);
  const pkg = buildCharacterPackage(identityId, candidates);

  const common = {
    anchors: serializeAnchors(pkg.anchors) as unknown as Prisma.InputJsonValue,
    scorerId: pkg.scorerId,
    imageCount: identity._count.trainingMedia,
    analyzedCount: candidates.length,
    version: PACKAGE_VERSION,
  };

  await prisma.identityPackage.upsert({
    where: { identityId },
    create: { identityId, userId, ...common },
    update: { ...common, computedAt: new Date() },
  });
}

/**
 * Read the persisted default Identity Package, re-signing anchor URLs. Returns `null` when none has been
 * computed yet (the caller — the Reference Engine — then rebuilds per-request). Owner-scoped.
 */
export async function getCharacterPackage(
  userId: string,
  identityId: string,
): Promise<CharacterPackage | null> {
  const row = await prisma.identityPackage.findFirst({
    where: { identityId, userId },
    select: { anchors: true, scorerId: true, imageCount: true, analyzedCount: true },
  });
  if (!row) return null;

  const stored = row.anchors as unknown as StoredAnchor[];
  const mediaIds = [...new Set(stored.map((a) => a.mediaId))];
  const assets = await getMediaByIds(userId, mediaIds);
  const urlById = new Map(assets.map((a) => [a.id, a.url]));

  return {
    identityId,
    anchors: hydrateAnchors(stored, urlById), // drops anchors whose media was deleted
    scorerId: row.scorerId,
    computedFrom: { mediaCount: row.imageCount, analyzedCount: row.analyzedCount },
  };
}
