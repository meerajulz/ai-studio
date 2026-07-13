/**
 * Media layer — the application's media/asset boundary (see docs/MEDIA_PIPELINE.md).
 *
 * This barrel re-exports only shared, environment-agnostic types. Import the
 * environment-specific helpers directly, so server code never pulls in browser code:
 *   - server: `import { persistUpload, listProjectUploads } from "@/lib/media/server";`
 *   - browser: `import { uploadProjectMedia } from "@/lib/media/client";`
 */
export * from "./types";
