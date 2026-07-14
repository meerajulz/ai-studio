/** Storage limits, allowed types, env config, and path helpers for blob storage. */

/** Env var holding the Vercel Blob read/write token. */
export const BLOB_TOKEN_ENV = "BLOB_READ_WRITE_TOKEN";

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const;

/**
 * Blob path convention — uploads are scoped under their project so a project's assets
 * live together (and are easy to list/prune). Filenames are sanitized; the store adds a
 * random suffix to avoid collisions.
 */
export function buildUploadPathname(projectId: string, filename: string): string {
  return `projects/${projectId}/uploads/${sanitizeFilename(filename)}`;
}

/** Path convention for AI-generated media — kept separate from uploads under the project. */
export function buildGeneratedPathname(projectId: string, filename: string): string {
  return `projects/${projectId}/generated/${sanitizeFilename(filename)}`;
}

function sanitizeFilename(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+/, "");
  return safe || "file";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
