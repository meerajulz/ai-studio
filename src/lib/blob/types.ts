export type MediaKind = "image" | "video";

/** Lightweight descriptor used for validation before upload (matches the browser `File`). */
export type FileDescriptor = {
  name: string;
  type: string; // MIME
  size: number; // bytes
};

/** The storage-layer result of a successful upload. */
export type StoredBlob = {
  url: string; // public URL
  pathname: string; // key within the store — needed to delete
  contentType: string;
  size: number; // bytes
  kind: MediaKind;
  uploadedAt: Date;
};

/**
 * The full "asset" view of uploaded media — media is a first-class asset, not just a
 * file (see MEDIA_PIPELINE.md). Persisted as `UploadedMedia` in the Upload System
 * milestone (7B); listed here so the storage layer and persistence agree on the shape.
 */
export type AssetMetadata = {
  originalFilename: string;
  contentType: string;
  size: number;
  kind: MediaKind;
  width?: number;
  height?: number;
  durationSeconds?: number; // videos
};

export type ValidationResult =
  | { ok: true; kind: MediaKind }
  | {
      ok: false;
      code: "EMPTY_FILE" | "INVALID_MIME_TYPE" | "FILE_TOO_LARGE";
      message: string;
    };
