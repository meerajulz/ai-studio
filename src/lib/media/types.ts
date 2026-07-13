/**
 * Media layer types — the application-level "asset" contract that feature code depends on.
 *
 * Feature code (hooks, components, actions) talks to the media layer, never to the blob
 * layer directly (see docs/MEDIA_PIPELINE.md). These types describe what crosses that
 * boundary: what the browser reports after an upload, and what the app persists/reads back.
 */

/** `"IMAGE" | "VIDEO"` — mirrors the Prisma `MediaType` enum without importing it here. */
export type MediaTypeValue = "IMAGE" | "VIDEO";

/**
 * Dimensions/duration probed from a file in the browser before/after upload. All optional —
 * probing is best-effort and must never block an upload.
 */
export type MediaDimensions = {
  width?: number;
  height?: number;
  durationSeconds?: number;
};

/** Result of a browser upload — everything needed to persist an `UploadedMedia` record. */
export type BrowserUploadResult = MediaDimensions & {
  pathname: string; // blob key (needed to sign + delete)
  blobUrl: string; // raw private URL (used for deletion)
  contentType: string;
  size: number; // bytes
  originalFilename: string;
};

/** Input to persist an uploaded asset. Ownership is enforced server-side, not from here. */
export type PersistUploadInput = BrowserUploadResult & {
  projectId: string;
};

/**
 * The serializable asset returned to the UI. `url` is a short-lived **signed** URL minted
 * per read (the store is private — Decision 021), so it is safe to render in `<img>`/`<video>`.
 */
export type UploadedAsset = {
  id: string;
  type: MediaTypeValue;
  url: string; // signed view URL (expires)
  originalFilename: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  createdAt: Date;
};
