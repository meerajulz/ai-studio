/**
 * Storage layer (Vercel Blob) — shared, environment-agnostic exports (constants, types,
 * validation, errors).
 *
 * Import environment-specific helpers directly, NOT from this barrel:
 *   - server:  `import { uploadAsset, deleteAsset } from "@/lib/blob/server";`
 *   - browser: `import { uploadAssetFromBrowser } from "@/lib/blob/client";`
 *
 * See docs/MEDIA_PIPELINE.md.
 */
export * from "./constants";
export * from "./errors";
export * from "./types";
export * from "./validation";
