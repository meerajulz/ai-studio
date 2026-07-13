/**
 * Media layer (server) — the application's single public API for media.
 *
 * Every media consumer (Uploads, Gallery, and later Identities, Templates, Jobs, AI
 * generation) depends on THIS. Nothing outside this folder calls the blob layer directly.
 * It owns the rules the blob layer intentionally doesn't know about: ownership, persistence,
 * filtering/pagination, and turning stored assets into signed, renderable URLs.
 *
 *   blob layer  = how to store/sign/delete bytes (src/lib/blob)
 *   media layer = what an "asset" is, who owns it, how it's persisted + queried  ← here
 *
 * Public API (owner-scoped — every method takes the acting `userId`):
 *   createMedia          — persist an uploaded asset (after the browser stores the bytes)
 *   listProjectMedia     — a project's media, filtered/sorted/paginated, with signed URLs
 *   getMedia             — one asset with a fresh signed URL
 *   getMediaSignedUrl    — (re)mint a signed URL for one asset
 *   updateMediaMetadata  — patch stored metadata (e.g. rename)
 *   deleteMedia          — remove the blob + the record
 *   handleProjectUpload  — issue a scoped client-upload token (authorizes the upload)
 *
 * Planned (not yet — no consumer): move(), duplicate(), generateThumbnail(),
 * refreshSignedUrls() (bulk). Add them when a feature genuinely needs them.
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { deleteAsset, getSignedUrl, isBlobConfigured } from "@/lib/blob/server";
import {
  ALLOWED_MIME_TYPES,
  buildUploadPathname,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/blob/constants";
import { StorageError } from "@/lib/blob/errors";
import { validateFile } from "@/lib/blob/validation";
import { MediaType, Prisma, prisma } from "@/lib/db";
import type {
  ListProjectMediaOptions,
  MediaAsset,
  MediaMetadataPatch,
  MediaPage,
  PersistUploadInput,
} from "./types";

/** Default and maximum page sizes for listing. */
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

/** Fields selected from `UploadedMedia` for the UI-facing asset shape. */
const uploadSelect = {
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

type UploadRecord = Prisma.UploadedMediaGetPayload<{ select: typeof uploadSelect }>;

/** Turn a stored upload record into a UI asset, minting a fresh signed URL (private store). */
async function toAsset(record: UploadRecord): Promise<MediaAsset> {
  const url = await getSignedUrl(record.pathname);
  return {
    id: record.id,
    source: "uploaded",
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

/** Throw unless `projectId` exists and belongs to `userId`. */
async function assertProjectOwnership(
  userId: string,
  projectId: string,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Project not found");
  }
}

/** The path prefix every asset for a project must live under (see buildUploadPathname). */
function projectUploadPrefix(projectId: string): string {
  return `projects/${projectId}/uploads/`;
}

/**
 * Persist an uploaded asset after the browser has stored the bytes. Re-validates everything
 * the client claimed (ownership, path, MIME + size) so a crafted request can't attach a blob
 * to someone else's project or dodge the size/type limits.
 */
export async function createMedia(
  userId: string,
  input: PersistUploadInput,
): Promise<MediaAsset> {
  await assertProjectOwnership(userId, input.projectId);

  // The blob must live under this user's owned project path — never trust the client path.
  if (!input.pathname.startsWith(projectUploadPrefix(input.projectId))) {
    throw new StorageError("UPLOAD_FAILED", "Upload path does not match project.");
  }

  const check = validateFile({
    name: input.originalFilename,
    type: input.contentType,
    size: input.size,
  });
  if (!check.ok) {
    throw new StorageError(check.code, check.message);
  }

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
      durationSeconds: input.durationSeconds
        ? Math.round(input.durationSeconds)
        : null,
      sizeBytes: input.size,
    },
    select: uploadSelect,
  });

  return toAsset(record);
}

/**
 * List a project's media (owner-scoped), filtered/sorted/paginated, each with a fresh signed
 * URL. Source-agnostic by design: `generated` returns empty until AI outputs land, so the
 * Gallery UI can offer the filter today and get real results later with no UI change.
 */
export async function listProjectMedia(
  userId: string,
  projectId: string,
  options: ListProjectMediaOptions = {},
): Promise<MediaPage> {
  await assertProjectOwnership(userId, projectId);

  // No generated media exists yet — the filter is real, the data source isn't (return empty).
  if (options.source === "generated") {
    return { items: [], nextCursor: null };
  }

  const direction = options.sort === "oldest" ? "asc" : "desc";
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );

  const where: Prisma.UploadedMediaWhereInput = { userId, projectId };
  if (options.kind === "image") where.type = MediaType.IMAGE;
  else if (options.kind === "video") where.type = MediaType.VIDEO;
  const search = options.search?.trim();
  if (search) {
    where.originalFilename = { contains: search, mode: "insensitive" };
  }

  const records = await prisma.uploadedMedia.findMany({
    where,
    orderBy: [{ createdAt: direction }, { id: direction }],
    take: limit,
    ...(options.cursor
      ? { cursor: { id: options.cursor }, skip: 1 }
      : {}),
    select: uploadSelect,
  });

  const items = await Promise.all(records.map(toAsset));
  const nextCursor =
    records.length === limit ? records[records.length - 1].id : null;
  return { items, nextCursor };
}

/** Fetch a single asset (owner-scoped) with a fresh signed URL. */
export async function getMedia(userId: string, id: string): Promise<MediaAsset> {
  const record = await prisma.uploadedMedia.findFirst({
    where: { id, userId },
    select: uploadSelect,
  });
  if (!record) {
    throw new Error("Media not found");
  }
  return toAsset(record);
}

/** (Re)mint a short-lived signed URL for a single asset (owner-scoped). */
export async function getMediaSignedUrl(
  userId: string,
  id: string,
): Promise<string> {
  const record = await prisma.uploadedMedia.findFirst({
    where: { id, userId },
    select: { pathname: true },
  });
  if (!record) {
    throw new Error("Media not found");
  }
  return getSignedUrl(record.pathname);
}

/** Update stored metadata (owner-scoped). Small on purpose — currently just rename. */
export async function updateMediaMetadata(
  userId: string,
  id: string,
  patch: MediaMetadataPatch,
): Promise<MediaAsset> {
  const data: Prisma.UploadedMediaUpdateManyMutationInput = {};
  if (patch.originalFilename !== undefined) {
    data.originalFilename = patch.originalFilename;
  }

  const result = await prisma.uploadedMedia.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) {
    throw new Error("Media not found");
  }
  return getMedia(userId, id);
}

/** Delete an asset (owner-scoped) — removes the blob, then the record. */
export async function deleteMedia(
  userId: string,
  id: string,
): Promise<{ id: string }> {
  const record = await prisma.uploadedMedia.findFirst({
    where: { id, userId },
    select: { id: true, blobUrl: true },
  });
  if (!record) {
    throw new Error("Media not found");
  }

  await deleteAsset(record.blobUrl);
  await prisma.uploadedMedia.delete({ where: { id: record.id } });
  return { id: record.id };
}

/**
 * Issue a scoped client-upload token for the browser upload flow (`/api/uploads`).
 *
 * This lives in the media layer (not the blob layer) because minting the token is where
 * ownership is enforced: we authorize the *user* for the *project* and lock the token to
 * that project's path + the allowed MIME types and max size, before any bytes are sent.
 */
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
      if (!params.userId) {
        throw new Error("Unauthorized");
      }
      const projectId = parseProjectId(clientPayload);
      await assertProjectOwnership(params.userId, projectId);

      if (!pathname.startsWith(projectUploadPrefix(projectId))) {
        throw new Error("Upload path does not match project.");
      }

      return {
        allowedContentTypes: [...ALLOWED_MIME_TYPES],
        maximumSizeInBytes: MAX_VIDEO_SIZE_BYTES, // absolute ceiling; per-kind limit enforced on persist
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: params.userId, projectId }),
      };
    },
    // Completion is confirmed by the client calling `createMedia` (this webhook does not
    // fire against localhost), so nothing to do here.
    onUploadCompleted: async () => {},
  });
}

/** Build the canonical upload path for a file within a project (re-export for the client). */
export { buildUploadPathname };

function parseProjectId(clientPayload: string | null): string {
  if (!clientPayload) {
    throw new Error("Missing upload context.");
  }
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
