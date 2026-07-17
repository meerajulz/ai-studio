/**
 * Identity layer (server) — the application's API for identities + their training media.
 *
 * Owner-scoped everywhere. **Uses the media layer exclusively for media** (signing, lookups)
 * and never touches the blob layer. Provider-agnostic: no prompts/providers/AI here.
 *
 * Status is derived from completeness (Decision 027): new = DRAFT; adding the first training
 * media → ACTIVE; removing all training media → DRAFT; ARCHIVED is an explicit user action
 * that "sticks" until restore. There is no manual "Activate".
 */
import { IdentityStatus, Prisma, prisma, TrainingMediaRole } from "@/lib/db";
import { getMediaByIds } from "@/lib/media/server";
import { getPersistedKnowledge } from "@/lib/vision/persist";
import { summarizeMediaKnowledge } from "@/lib/vision";
import type { SelectionCandidate } from "@/lib/selection";
import type {
  CreateIdentityInput,
  IdentityContextInfo,
  IdentityDetail,
  IdentitySummary,
  IdentityVisualPackage,
  ListIdentitiesOptions,
  TrainingMediaItem,
  TrainingMediaRoleValue,
  UpdateIdentityInput,
} from "./types";

const dedupe = (ids: string[]) => [...new Set(ids)];

// ── ownership guards ─────────────────────────────────────────────────────────

async function assertProjectOwnership(userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
}

type OwnedIdentity = {
  id: string;
  projectId: string;
  status: IdentityStatus;
  displayImageId: string | null;
};

async function getOwnedIdentity(userId: string, identityId: string): Promise<OwnedIdentity> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: { id: true, projectId: true, status: true, displayImageId: true },
  });
  if (!identity) throw new Error("Identity not found");
  return identity;
}

async function assertLinkOwned(
  userId: string,
  identityId: string,
  linkId: string,
): Promise<void> {
  const owned = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Identity not found");
  const link = await prisma.identityMedia.findFirst({
    where: { id: linkId, identityId },
    select: { id: true },
  });
  if (!link) throw new Error("Training media not found");
}

/**
 * After any training-media change, re-derive status + hero image:
 *  - status (unless ARCHIVED): ACTIVE if it has media, else DRAFT.
 *  - hero: keep if still linked; otherwise fall back to the first link (or null).
 */
async function recomputeAfterMediaChange(
  identity: Pick<OwnedIdentity, "status" | "displayImageId">,
  identityId: string,
): Promise<void> {
  const links = await prisma.identityMedia.findMany({
    where: { identityId },
    orderBy: { position: "asc" },
    select: { mediaId: true },
  });
  const data: Prisma.IdentityUncheckedUpdateInput = {};

  if (identity.status !== IdentityStatus.ARCHIVED) {
    data.status = links.length > 0 ? IdentityStatus.ACTIVE : IdentityStatus.DRAFT;
  }

  const linkedIds = new Set(links.map((l) => l.mediaId));
  if (!identity.displayImageId || !linkedIds.has(identity.displayImageId)) {
    data.displayImageId = links[0]?.mediaId ?? null;
  }

  if (Object.keys(data).length > 0) {
    await prisma.identity.update({ where: { id: identityId }, data });
  }
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listIdentities(
  userId: string,
  projectId: string,
  options: ListIdentitiesOptions = {},
): Promise<IdentitySummary[]> {
  await assertProjectOwnership(userId, projectId);

  const where: Prisma.IdentityWhereInput = { userId, projectId };
  const status = options.status ?? "active";
  if (status === "active") {
    where.status = { in: [IdentityStatus.DRAFT, IdentityStatus.ACTIVE] };
  } else if (status === "draft") {
    where.status = IdentityStatus.DRAFT;
  } else if (status === "archived") {
    where.status = IdentityStatus.ARCHIVED;
  } // "all" → no status filter

  const search = options.search?.trim();
  if (search) where.name = { contains: search, mode: "insensitive" };

  const orderBy: Prisma.IdentityOrderByWithRelationInput =
    options.sort === "oldest"
      ? { createdAt: "asc" }
      : options.sort === "name"
        ? { name: "asc" }
        : { createdAt: "desc" };

  const rows = await prisma.identity.findMany({
    where,
    orderBy,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      displayImageId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { trainingMedia: true } },
    },
  });

  // Sign hero images in one batch via the media layer.
  const heroIds = rows
    .map((r) => r.displayImageId)
    .filter((id): id is string => id !== null);
  const heroAssets = await getMediaByIds(userId, dedupe(heroIds));
  const heroUrlById = new Map(heroAssets.map((a) => [a.id, a.url]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    mediaCount: r._count.trainingMedia,
    heroImageUrl: r.displayImageId ? (heroUrlById.get(r.displayImageId) ?? null) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getIdentity(
  userId: string,
  identityId: string,
): Promise<IdentityDetail> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      displayImageId: true,
      createdAt: true,
      updatedAt: true,
      trainingMedia: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          mediaId: true,
          position: true,
          isFavorite: true,
          role: true,
        },
      },
    },
  });
  if (!identity) throw new Error("Identity not found");

  const mediaIds = identity.trainingMedia.map((t) => t.mediaId);
  const [assets, knowledge] = await Promise.all([
    getMediaByIds(userId, mediaIds),
    getPersistedKnowledge(userId, mediaIds),
  ]);
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const trainingMedia: TrainingMediaItem[] = identity.trainingMedia
    .map((t) => {
      const media = assetById.get(t.mediaId);
      if (!media) return null;
      const k = knowledge.get(t.mediaId);
      return {
        linkId: t.id,
        media,
        position: t.position,
        isFavorite: t.isFavorite,
        role: t.role,
        knowledge: k
          ? summarizeMediaKnowledge(k.metadata, k.score, {
              provider: k.provider,
              model: k.model,
              version: k.version,
              analyzedAt: k.analyzedAt,
            })
          : null,
      } satisfies TrainingMediaItem;
    })
    .filter((x): x is TrainingMediaItem => x !== null);

  return {
    id: identity.id,
    name: identity.name,
    description: identity.description,
    status: identity.status,
    heroImageId: identity.displayImageId,
    heroImageUrl: identity.displayImageId
      ? (assetById.get(identity.displayImageId)?.url ?? null)
      : null,
    mediaCount: trainingMedia.length,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    trainingMedia,
  };
}

/**
 * A lightweight, owner-scoped identity snapshot for generation-time reasoning (Milestone 14).
 * Unlike `getIdentity`, it does NOT sign or load media — just the fields the Creative Director's
 * Identity Context stage needs. Returns `null` if the identity doesn't exist or isn't the user's.
 */
export async function getIdentityContext(
  userId: string,
  identityId: string,
): Promise<IdentityContextInfo | null> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: {
      id: true,
      name: true,
      description: true,
      displayImageId: true,
      _count: { select: { trainingMedia: true } },
    },
  });
  if (!identity) return null;
  return {
    id: identity.id,
    name: identity.name,
    description: identity.description,
    hasHeroImage: identity.displayImageId !== null,
    trainingMediaCount: identity._count.trainingMedia,
  };
}

/**
 * Build an identity's **Visual Package** (Milestone 15) — signed reference-image URLs a capable
 * provider can use for identity preservation. Owner-scoped. Reuses the media layer for signing;
 * never touches Blob. Returns `null` if the identity isn't the user's. Architecture prep only —
 * no LoRA/embeddings/training.
 */
export async function getIdentityVisualPackage(
  userId: string,
  identityId: string,
): Promise<IdentityVisualPackage | null> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: {
      displayImageId: true,
      trainingMedia: {
        orderBy: [{ isFavorite: "desc" }, { position: "asc" }],
        select: { mediaId: true, role: true },
      },
    },
  });
  if (!identity) return null;

  const ids = dedupe([
    ...(identity.displayImageId ? [identity.displayImageId] : []),
    ...identity.trainingMedia.map((t) => t.mediaId),
  ]);
  const assets = await getMediaByIds(userId, ids);
  const urlById = new Map(assets.map((a) => [a.id, a.url]));

  const urlForRole = (role: TrainingMediaRoleValue): string | null => {
    const hit = identity.trainingMedia.find((t) => t.role === role && urlById.has(t.mediaId));
    return hit ? (urlById.get(hit.mediaId) ?? null) : null;
  };

  const heroImageUrl = identity.displayImageId
    ? (urlById.get(identity.displayImageId) ?? null)
    : null;

  const referenceImageUrls = identity.trainingMedia
    .map((t) => urlById.get(t.mediaId))
    .filter((u): u is string => Boolean(u))
    .slice(0, 4);

  return {
    heroImageUrl,
    // No explicit "full body" role exists yet — approximate from roles (prep only).
    bestPortraitUrl: urlForRole("PRIMARY") ?? heroImageUrl,
    bestFullBodyUrl: urlForRole("POSE"),
    referenceImageUrls,
    metadata: { totalMedia: identity.trainingMedia.length },
  };
}

/**
 * Build Smart Reference Selection candidates (Milestone 20): each training image that has PERSISTED
 * Vision knowledge, paired with its signed URL. Only analyzed images become candidates — the selector
 * reasons purely over knowledge and generation NEVER analyzes. Owner-scoped; reuses the media layer
 * for signing. Empty when nothing is analyzed yet (callers fall back to the static Visual Package).
 */
export async function getIdentitySelectionCandidates(
  userId: string,
  identityId: string,
): Promise<SelectionCandidate[]> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: {
      trainingMedia: {
        orderBy: [{ isFavorite: "desc" }, { position: "asc" }],
        select: { mediaId: true },
      },
    },
  });
  if (!identity) return [];

  const mediaIds = identity.trainingMedia.map((t) => t.mediaId);
  if (mediaIds.length === 0) return [];

  const [assets, knowledge] = await Promise.all([
    getMediaByIds(userId, mediaIds),
    getPersistedKnowledge(userId, mediaIds),
  ]);
  const urlById = new Map(assets.map((a) => [a.id, a.url]));

  const candidates: SelectionCandidate[] = [];
  for (const mediaId of mediaIds) {
    const k = knowledge.get(mediaId);
    const url = urlById.get(mediaId);
    if (!k || !url) continue; // only analyzed images with a signed URL are candidates
    candidates.push({ mediaId, url, metadata: k.metadata, score: k.score });
  }
  return candidates;
}

// ── identity CRUD ──────────────────────────────────────────────────────────

export async function createIdentity(
  userId: string,
  projectId: string,
  input: CreateIdentityInput,
): Promise<IdentityDetail> {
  await assertProjectOwnership(userId, projectId);

  // Validate any pre-linked media: owned + in the same project. Preserve selection order.
  const requested = dedupe(input.mediaIds ?? []);
  let orderedMediaIds: string[] = [];
  if (requested.length > 0) {
    const media = await prisma.uploadedMedia.findMany({
      where: { id: { in: requested }, userId, projectId },
      select: { id: true },
    });
    const validSet = new Set(media.map((m) => m.id));
    orderedMediaIds = requested.filter((id) => validSet.has(id));
  }

  const created = await prisma.identity.create({
    data: {
      userId,
      projectId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: orderedMediaIds.length > 0 ? IdentityStatus.ACTIVE : IdentityStatus.DRAFT,
      displayImageId: orderedMediaIds[0] ?? null,
      trainingMedia:
        orderedMediaIds.length > 0
          ? {
              create: orderedMediaIds.map((mediaId, i) => ({
                mediaId,
                position: i,
              })),
            }
          : undefined,
    },
    select: { id: true },
  });

  return getIdentity(userId, created.id);
}

export async function updateIdentity(
  userId: string,
  identityId: string,
  input: UpdateIdentityInput,
): Promise<IdentityDetail> {
  const data: Prisma.IdentityUpdateManyMutationInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }

  const result = await prisma.identity.updateMany({
    where: { id: identityId, userId },
    data,
  });
  if (result.count === 0) throw new Error("Identity not found");
  return getIdentity(userId, identityId);
}

export async function archiveIdentity(
  userId: string,
  identityId: string,
): Promise<IdentityDetail> {
  const result = await prisma.identity.updateMany({
    where: { id: identityId, userId },
    data: { status: IdentityStatus.ARCHIVED },
  });
  if (result.count === 0) throw new Error("Identity not found");
  return getIdentity(userId, identityId);
}

/** Restore from ARCHIVED — status returns to completeness-derived ACTIVE/DRAFT. */
export async function restoreIdentity(
  userId: string,
  identityId: string,
): Promise<IdentityDetail> {
  await getOwnedIdentity(userId, identityId);
  const count = await prisma.identityMedia.count({ where: { identityId } });
  await prisma.identity.update({
    where: { id: identityId },
    data: { status: count > 0 ? IdentityStatus.ACTIVE : IdentityStatus.DRAFT },
  });
  return getIdentity(userId, identityId);
}

export async function deleteIdentity(
  userId: string,
  identityId: string,
): Promise<{ id: string }> {
  const result = await prisma.identity.deleteMany({
    where: { id: identityId, userId },
  });
  if (result.count === 0) throw new Error("Identity not found");
  return { id: identityId }; // cascade removes IdentityMedia links; media itself is untouched
}

// ── training media ─────────────────────────────────────────────────────────

export async function addTrainingMedia(
  userId: string,
  identityId: string,
  mediaIds: string[],
): Promise<IdentityDetail> {
  const identity = await getOwnedIdentity(userId, identityId);

  const requested = dedupe(mediaIds);
  const media = await prisma.uploadedMedia.findMany({
    where: { id: { in: requested }, userId, projectId: identity.projectId },
    select: { id: true },
  });
  const validSet = new Set(media.map((m) => m.id));
  const ordered = requested.filter((id) => validSet.has(id));

  const existing = await prisma.identityMedia.findMany({
    where: { identityId, mediaId: { in: ordered } },
    select: { mediaId: true },
  });
  const existingSet = new Set(existing.map((e) => e.mediaId));
  const toAdd = ordered.filter((id) => !existingSet.has(id));

  if (toAdd.length > 0) {
    const max = await prisma.identityMedia.aggregate({
      where: { identityId },
      _max: { position: true },
    });
    let position = (max._max.position ?? -1) + 1;
    await prisma.identityMedia.createMany({
      data: toAdd.map((mediaId) => ({ identityId, mediaId, position: position++ })),
      skipDuplicates: true,
    });
  }

  await recomputeAfterMediaChange(identity, identityId);
  return getIdentity(userId, identityId);
}

export async function removeTrainingMedia(
  userId: string,
  identityId: string,
  linkId: string,
): Promise<IdentityDetail> {
  const identity = await getOwnedIdentity(userId, identityId);
  const link = await prisma.identityMedia.findFirst({
    where: { id: linkId, identityId },
    select: { id: true },
  });
  if (!link) throw new Error("Training media not found");

  await prisma.identityMedia.delete({ where: { id: link.id } });
  await recomputeAfterMediaChange(identity, identityId);
  return getIdentity(userId, identityId);
}

export async function reorderTrainingMedia(
  userId: string,
  identityId: string,
  orderedLinkIds: string[],
): Promise<IdentityDetail> {
  await getOwnedIdentity(userId, identityId);
  const links = await prisma.identityMedia.findMany({
    where: { identityId },
    select: { id: true },
  });
  const valid = new Set(links.map((l) => l.id));
  const ordered = orderedLinkIds.filter((id) => valid.has(id));

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.identityMedia.update({ where: { id }, data: { position: index } }),
    ),
  );
  return getIdentity(userId, identityId);
}

export async function setTrainingMediaFavorite(
  userId: string,
  identityId: string,
  linkId: string,
  isFavorite: boolean,
): Promise<IdentityDetail> {
  await assertLinkOwned(userId, identityId, linkId);
  await prisma.identityMedia.update({ where: { id: linkId }, data: { isFavorite } });
  return getIdentity(userId, identityId);
}

export async function setTrainingMediaRole(
  userId: string,
  identityId: string,
  linkId: string,
  role: TrainingMediaRoleValue,
): Promise<IdentityDetail> {
  await assertLinkOwned(userId, identityId, linkId);
  await prisma.identityMedia.update({
    where: { id: linkId },
    data: { role: role as TrainingMediaRole },
  });
  return getIdentity(userId, identityId);
}

/** Set the Hero Image — must be one of the identity's linked training media. */
export async function setHeroImage(
  userId: string,
  identityId: string,
  mediaId: string,
): Promise<IdentityDetail> {
  await getOwnedIdentity(userId, identityId);
  const link = await prisma.identityMedia.findFirst({
    where: { identityId, mediaId },
    select: { id: true },
  });
  if (!link) throw new Error("Media is not part of this identity");
  await prisma.identity.update({
    where: { id: identityId },
    data: { displayImageId: mediaId },
  });
  return getIdentity(userId, identityId);
}
