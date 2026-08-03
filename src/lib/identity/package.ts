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
  explainPackage,
  hydrateAnchors,
  serializeAnchors,
  type CharacterPackage,
  type PackageExplanation,
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

/** The Identity Package Inspector read-model (Milestone 27 Phase 2) — per-role rankings + per-media contribution. */
export type PackageInspection = {
  analyzedCount: number; // analyzed candidates the builder can see right now
  persistedAnalyzedCount: number | null; // what the persisted package was built from
  stale: boolean; // more/fewer analyzed images than the persisted package → re-analyze to refresh
  explanation: PackageExplanation;
};

/**
 * Explain the Identity Package for the inspector UI: run the SAME role scorer the builder uses over the
 * identity's analyzed candidates and expose every candidate's per-role fitness + why it won/lost. Owner-
 * scoped (via `getIdentitySelectionCandidates`); candidate URLs are already freshly signed. Read-only.
 */
export async function getIdentityPackageInspection(
  userId: string,
  identityId: string,
): Promise<PackageInspection> {
  const candidates = await getIdentitySelectionCandidates(userId, identityId);
  const persisted = await prisma.identityPackage.findFirst({
    where: { identityId, userId },
    select: { analyzedCount: true },
  });
  const persistedAnalyzedCount = persisted?.analyzedCount ?? null;
  return {
    analyzedCount: candidates.length,
    persistedAnalyzedCount,
    stale: persistedAnalyzedCount != null && persistedAnalyzedCount !== candidates.length,
    explanation: explainPackage(candidates),
  };
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
