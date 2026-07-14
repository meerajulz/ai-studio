/**
 * Media layer (server) — the application's single public API for media.
 *
 * Every media consumer (Uploads, Gallery, Identities, and now AI Generation) depends on THIS.
 * Nothing outside this folder calls the blob layer directly. It owns ownership, persistence,
 * filtering/pagination, and turning stored assets into signed, renderable URLs.
 *
 * Media lives in TWO tables — `UploadedMedia` (source "uploaded") and `GeneratedMedia`
 * (source "generated", from AI). This layer **unions** them into one `MediaAsset` stream so
 * the Gallery shows both with no second pipeline (Decisions 024 + 029).
 *
 * Public API (owner-scoped):
 *   createMedia · createGeneratedMedia — persist an uploaded / AI-generated asset
 *   listProjectMedia — a project's media (uploaded ∪ generated), filtered/sorted/paginated
 *   getMedia · getMediaSignedUrl · getMediaByIds — read one/many with signed URLs
 *   updateMediaMetadata · deleteMedia — mutate (delete works across both tables)
 *   handleProjectUpload — issue a scoped client-upload token
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import {
  deleteAsset,
  getSignedUrl,
  isBlobConfigured,
  uploadAsset,
} from "@/lib/blob/server";
import {
  ALLOWED_MIME_TYPES,
  buildGeneratedPathname,
  buildUploadPathname,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/blob/constants";
import { StorageError } from "@/lib/blob/errors";
import { mediaKindForMime, validateFile } from "@/lib/blob/validation";
import { MediaType, Prisma, prisma } from "@/lib/db";
import type {
  ListProjectMediaOptions,
  MediaAsset,
  MediaMetadataPatch,
  MediaPage,
  MediaSort,
  MediaSource,
  PersistUploadInput,
} from "./types";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

/** Columns shared by `UploadedMedia` + `GeneratedMedia` — the raw shape behind a `MediaAsset`. */
const mediaSelect = {
  id: true,
  type: true,
  pathname: true,
  originalFilename: true,
  mimeType: true,
  width: true,
  height: true,
  durationSeconds: true,
  sizeBytes: true,
  createdAt: true,
} as const;

type MediaRecord = Prisma.UploadedMediaGetPayload<{ select: typeof mediaSelect }>;

/** Turn a stored record (from either table) into a UI asset, minting a fresh signed URL. */
async function toAsset(record: MediaRecord, source: MediaSource): Promise<MediaAsset> {
  const url = await getSignedUrl(record.pathname);
  return {
    id: record.id,
    source,
    type: record.type,
    url,
    originalFilename: record.originalFilename,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
    durationSeconds: record.durationSeconds,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt,
  };
}

async function assertProjectOwnership(userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
}

function projectUploadPrefix(projectId: string): string {
  return `projects/${projectId}/uploads/`;
}

// ── uploads ──────────────────────────────────────────────────────────────────

export async function createMedia(
  userId: string,
  input: PersistUploadInput,
): Promise<MediaAsset> {
  await assertProjectOwnership(userId, input.projectId);

  if (!input.pathname.startsWith(projectUploadPrefix(input.projectId))) {
    throw new StorageError("UPLOAD_FAILED", "Upload path does not match project.");
  }

  const check = validateFile({
    name: input.originalFilename,
    type: input.contentType,
    size: input.size,
  });
  if (!check.ok) throw new StorageError(check.code, check.message);

  const record = await prisma.uploadedMedia.create({
    data: {
      userId,
      projectId: input.projectId,
      type: check.kind === "video" ? MediaType.VIDEO : MediaType.IMAGE,
      blobUrl: input.blobUrl,
      pathname: input.pathname,
      originalFilename: input.originalFilename,
      mimeType: input.contentType,
      width: input.width ?? null,
      height: input.height ?? null,
      durationSeconds: input.durationSeconds ? Math.round(input.durationSeconds) : null,
      sizeBytes: input.size,
    },
    select: mediaSelect,
  });

  return toAsset(record, "uploaded");
}

// ── AI-generated media (persist bytes from a provider; Blob only via this layer) ─────────

export async function createGeneratedMedia(
  userId: string,
  params: {
    projectId: string;
    generationId: string;
    data: Buffer;
    contentType: string;
    originalFilename: string;
    width?: number;
    height?: number;
  },
): Promise<MediaAsset> {
  const kind = mediaKindForMime(params.contentType) ?? "image";
  const stored = await uploadAsset({
    pathname: buildGeneratedPathname(params.projectId, params.originalFilename),
    data: params.data,
    contentType: params.contentType,
  });

  const record = await prisma.generatedMedia.create({
    data: {
      userId,
      projectId: params.projectId,
      generationId: params.generationId,
      type: kind === "video" ? MediaType.VIDEO : MediaType.IMAGE,
      blobUrl: stored.url,
      pathname: stored.pathname,
      originalFilename: params.originalFilename,
      mimeType: params.contentType,
      width: params.width ?? null,
      height: params.height ?? null,
      sizeBytes: stored.size,
    },
    select: mediaSelect,
  });

  return toAsset(record, "generated");
}

// ── unified reads (uploaded ∪ generated) ─────────────────────────────────────

/** Composite (createdAt,id) cursor so pagination is stable across both tables. */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    return { createdAt: new Date(iso), id };
  } catch {
    return null;
  }
}
function compareRecords(a: MediaRecord, b: MediaRecord, sort: MediaSort): number {
  const delta = a.createdAt.getTime() - b.createdAt.getTime();
  const base = delta !== 0 ? delta : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return sort === "oldest" ? base : -base;
}

export async function listProjectMedia(
  userId: string,
  projectId: string,
  options: ListProjectMediaOptions = {},
): Promise<MediaPage> {
  await assertProjectOwnership(userId, projectId);

  const sort: MediaSort = options.sort === "oldest" ? "oldest" : "newest";
  const dir: "asc" | "desc" = sort === "oldest" ? "asc" : "desc";
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const source = options.source ?? "all";
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;

  // Common filters (valid on both tables — same columns).
  const common: Record<string, unknown> = {};
  if (options.kind === "image") common.type = MediaType.IMAGE;
  else if (options.kind === "video") common.type = MediaType.VIDEO;
  const search = options.search?.trim();
  if (search) common.originalFilename = { contains: search, mode: "insensitive" };
  if (cursor) {
    const op = dir === "desc" ? "lt" : "gt";
    common.OR = [
      { createdAt: { [op]: cursor.createdAt } },
      { AND: [{ createdAt: cursor.createdAt }, { id: { [op]: cursor.id } }] },
    ];
  }

  const orderBy = [{ createdAt: dir }, { id: dir }] as const;
  const groups: { record: MediaRecord; source: MediaSource }[][] = [];

  if (source === "all" || source === "uploaded") {
    const rows = await prisma.uploadedMedia.findMany({
      where: { userId, projectId, ...common } as Prisma.UploadedMediaWhereInput,
      orderBy: [...orderBy],
      take: limit,
      select: mediaSelect,
    });
    groups.push(rows.map((record) => ({ record, source: "uploaded" as const })));
  }
  if (source === "all" || source === "generated") {
    const rows = await prisma.generatedMedia.findMany({
      where: { userId, projectId, ...common } as Prisma.GeneratedMediaWhereInput,
      orderBy: [...orderBy],
      take: limit,
      select: mediaSelect,
    });
    groups.push(rows.map((record) => ({ record, source: "generated" as const })));
  }

  const merged = groups.flat().sort((a, b) => compareRecords(a.record, b.record, sort));
  const page = merged.slice(0, limit);
  const items = await Promise.all(page.map((x) => toAsset(x.record, x.source)));
  const last = page[page.length - 1];
  const nextCursor =
    page.length === limit && last
      ? encodeCursor(last.record.createdAt, last.record.id)
      : null;

  return { items, nextCursor };
}

export async function getMedia(userId: string, id: string): Promise<MediaAsset> {
  const uploaded = await prisma.uploadedMedia.findFirst({
    where: { id, userId },
    select: mediaSelect,
  });
  if (uploaded) return toAsset(uploaded, "uploaded");
  const generated = await prisma.generatedMedia.findFirst({
    where: { id, userId },
    select: mediaSelect,
  });
  if (generated) return toAsset(generated, "generated");
  throw new Error("Media not found");
}

/** Fetch several UPLOADED assets by id (owner-scoped) — used for identity training media. */
export async function getMediaByIds(
  userId: string,
  ids: string[],
): Promise<MediaAsset[]> {
  if (ids.length === 0) return [];
  const records = await prisma.uploadedMedia.findMany({
    where: { id: { in: ids }, userId },
    select: mediaSelect,
  });
  return Promise.all(records.map((r) => toAsset(r, "uploaded")));
}

export async function getMediaSignedUrl(userId: string, id: string): Promise<string> {
  const uploaded = await prisma.uploadedMedia.findFirst({
    where: { id, userId },
    select: { pathname: true },
  });
  if (uploaded) return getSignedUrl(uploaded.pathname);
  const generated = await prisma.generatedMedia.findFirst({
    where: { id, userId },
    select: { pathname: true },
  });
  if (generated) return getSignedUrl(generated.pathname);
  throw new Error("Media not found");
}

export async function updateMediaMetadata(
  userId: string,
  id: string,
  patch: MediaMetadataPatch,
): Promise<MediaAsset> {
  const data: Prisma.UploadedMediaUpdateManyMutationInput = {};
  if (patch.originalFilename !== undefined) data.originalFilename = patch.originalFilename;

  const result = await prisma.uploadedMedia.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new Error("Media not found");
  return getMedia(userId, id);
}

export async function deleteMedia(userId: string, id: string): Promise<{ id: string }> {
  const uploaded = await prisma.uploadedMedia.findFirst({
    where: { id, userId },
    select: { id: true, blobUrl: true },
  });
  if (uploaded) {
    await deleteAsset(uploaded.blobUrl);
    await prisma.uploadedMedia.delete({ where: { id: uploaded.id } });
    return { id: uploaded.id };
  }
  const generated = await prisma.generatedMedia.findFirst({
    where: { id, userId },
    select: { id: true, blobUrl: true },
  });
  if (generated) {
    await deleteAsset(generated.blobUrl);
    await prisma.generatedMedia.delete({ where: { id: generated.id } });
    return { id: generated.id };
  }
  throw new Error("Media not found");
}

// ── client-upload token issuance ─────────────────────────────────────────────

export async function handleProjectUpload(params: {
  body: HandleUploadBody;
  request: Request;
  userId: string | null;
}) {
  if (!isBlobConfigured()) {
    throw new StorageError(
      "MISSING_TOKEN",
      "Uploads are not configured (missing BLOB_READ_WRITE_TOKEN).",
    );
  }

  return handleUpload({
    body: params.body,
    request: params.request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      if (!params.userId) throw new Error("Unauthorized");
      const projectId = parseProjectId(clientPayload);
      await assertProjectOwnership(params.userId, projectId);
      if (!pathname.startsWith(projectUploadPrefix(projectId))) {
        throw new Error("Upload path does not match project.");
      }
      return {
        allowedContentTypes: [...ALLOWED_MIME_TYPES],
        maximumSizeInBytes: MAX_VIDEO_SIZE_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: params.userId, projectId }),
      };
    },
    onUploadCompleted: async () => {},
  });
}

export { buildUploadPathname };

function parseProjectId(clientPayload: string | null): string {
  if (!clientPayload) throw new Error("Missing upload context.");
  try {
    const parsed = JSON.parse(clientPayload) as { projectId?: unknown };
    if (typeof parsed.projectId === "string" && parsed.projectId.length > 0) {
      return parsed.projectId;
    }
  } catch {
    // fall through
  }
  throw new Error("Invalid upload context.");
}
