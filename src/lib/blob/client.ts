import { upload } from "@vercel/blob/client";

import { mediaKindForMime } from "./validation";
import type { StoredBlob } from "./types";

/**
 * Browser-side upload via Vercel Blob's client flow. Requires a server route
 * (`handleUploadUrl`, default `/api/uploads`) that issues client tokens. This is the only
 * place the browser talks to the Vercel Blob SDK — the media layer wraps it.
 */
export async function uploadAssetFromBrowser(params: {
  file: File;
  pathname: string;
  handleUploadUrl?: string;
  clientPayload?: string;
  abortSignal?: AbortSignal;
  onProgress?: (percentage: number) => void;
}): Promise<StoredBlob> {
  const res = await upload(params.pathname, params.file, {
    access: "private",
    handleUploadUrl: params.handleUploadUrl ?? "/api/uploads",
    contentType: params.file.type,
    clientPayload: params.clientPayload,
    abortSignal: params.abortSignal,
    onUploadProgress: params.onProgress
      ? (event) => params.onProgress?.(event.percentage)
      : undefined,
  });

  const contentType = res.contentType ?? params.file.type;
  return {
    url: res.url,
    pathname: res.pathname,
    contentType,
    size: params.file.size,
    kind: mediaKindForMime(contentType) ?? "image",
    uploadedAt: new Date(),
  };
}
