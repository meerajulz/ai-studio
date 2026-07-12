import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  formatBytes,
} from "./constants";
import { StorageError } from "./errors";
import type { FileDescriptor, MediaKind, ValidationResult } from "./types";

/** Returns the media kind for a MIME type, or null if unsupported. */
export function mediaKindForMime(mime: string): MediaKind | null {
  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
    return "image";
  }
  if ((ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
    return "video";
  }
  return null;
}

export function maxSizeForKind(kind: MediaKind): number {
  return kind === "image" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
}

/** Validate a file's MIME type and size. Provider-agnostic — pure, no I/O. */
export function validateFile(file: FileDescriptor): ValidationResult {
  if (!file.size || file.size <= 0) {
    return { ok: false, code: "EMPTY_FILE", message: "File is empty." };
  }

  const kind = mediaKindForMime(file.type);
  if (!kind) {
    return {
      ok: false,
      code: "INVALID_MIME_TYPE",
      message: `Unsupported file type: ${file.type || "unknown"}.`,
    };
  }

  const max = maxSizeForKind(kind);
  if (file.size > max) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is too large. Max ${kind} size is ${formatBytes(max)}.`,
    };
  }

  return { ok: true, kind };
}

/** Throws a `StorageError` when invalid; returns the media kind when valid. */
export function assertValidFile(file: FileDescriptor): MediaKind {
  const result = validateFile(file);
  if (!result.ok) {
    throw new StorageError(result.code, result.message);
  }
  return result.kind;
}
