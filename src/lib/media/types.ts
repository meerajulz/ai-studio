/**
 * Media layer types — the application-level "asset" contract that ALL feature code depends
 * on (Gallery, Identities, Templates, Jobs, and future AI generation). Feature code talks
 * to the media layer, never to the blob layer directly (see docs/MEDIA_PIPELINE.md).
 *
 * A `MediaAsset` is source-tagged (`uploaded` now, `generated` later) so one UI can browse
 * everything without special-casing uploads.
 */

/** `"IMAGE" | "VIDEO"` — mirrors the Prisma `MediaType` enum without importing it here. */
export type MediaTypeValue = "IMAGE" | "VIDEO";

/** Where an asset came from. `generated` (AI outputs) plugs in during a later milestone. */
export type MediaSource = "uploaded" | "generated";

/**
 * Dimensions/duration probed from a file in the browser before/after upload. All optional —
 * probing is best-effort and must never block an upload.
 */
export type MediaDimensions = {
  width?: number;
  height?: number;
  durationSeconds?: number;
};

/** Result of a browser upload — everything needed to persist a media record. */
export type BrowserUploadResult = MediaDimensions & {
  pathname: string; // blob key (needed to sign + delete)
  blobUrl: string; // raw private URL (used for deletion)
  contentType: string;
  size: number; // bytes
  originalFilename: string;
};

/** Input to create a media record from an upload. Ownership is enforced server-side. */
export type PersistUploadInput = BrowserUploadResult & {
  projectId: string;
};

/**
 * The recipe behind a generated asset — a read-only view of its `Generation` (Decision 030).
 * The `Generation` record IS the recipe; this is how the Gallery exposes prompt/provider/model
 * for Copy Prompt / View Recipe / Generate Again. `null` for uploaded media.
 */
export type MediaRecipe = {
  generationId: string;
  prompt: string;
  provider: string;
  model: string;
  identityId: string | null;
  createdAt: Date;
};

/**
 * The serializable asset returned to the UI. `url` is a short-lived **signed** URL minted
 * per read (the store is private — Decision 021), so it is safe to render in `<img>`/`<video>`.
 */
export type MediaAsset = {
  id: string;
  source: MediaSource;
  type: MediaTypeValue;
  url: string; // signed view URL (expires)
  originalFilename: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  createdAt: Date;
  recipe: MediaRecipe | null; // generated media only (source: "generated")
};

/** Metadata fields a caller may update on an existing asset. Intentionally small for now. */
export type MediaMetadataPatch = {
  originalFilename?: string;
};

// ── Listing / filtering / pagination ────────────────────────────────────────

export type MediaKindFilter = "all" | "image" | "video";
export type MediaSourceFilter = "all" | "uploaded" | "generated";
export type MediaSort = "newest" | "oldest";

/** Options for `listProjectMedia`. Designed so generated media reuses the same filters. */
export type ListProjectMediaOptions = {
  kind?: MediaKindFilter;
  source?: MediaSourceFilter;
  sort?: MediaSort;
  search?: string; // matches original filename (case-insensitive)
  cursor?: string; // id of the last item from the previous page
  limit?: number;
};

/** One page of media, plus the cursor to fetch the next page (null when exhausted). */
export type MediaPage = {
  items: MediaAsset[];
  nextCursor: string | null;
};
