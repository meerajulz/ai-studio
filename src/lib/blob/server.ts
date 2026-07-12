import { del, issueSignedToken, presignUrl, put } from "@vercel/blob";

import { BLOB_TOKEN_ENV } from "./constants";
import { StorageError } from "./errors";
import { mediaKindForMime } from "./validation";
import type { MediaKind, StoredBlob } from "./types";

type UploadBody = string | ArrayBuffer | Blob | Buffer | ReadableStream;

/**
 * Whether blob storage is configured (a read/write token is present). Lets callers
 * (e.g. the Uploads UI in 7B) degrade gracefully instead of hitting a thrown error.
 * On Vercel, connecting a Blob store to the project injects `BLOB_READ_WRITE_TOKEN`
 * automatically; locally, set it in `.env` (see `.env.example`).
 */
export function isBlobConfigured(): boolean {
  return Boolean(process.env[BLOB_TOKEN_ENV]);
}

function getBlobToken(): string {
  const token = process.env[BLOB_TOKEN_ENV];
  if (!token) {
    throw new StorageError(
      "MISSING_TOKEN",
      `${BLOB_TOKEN_ENV} is not set. Connect a Vercel Blob store to the project (or add the token to .env).`,
    );
  }
  return token;
}

function byteSize(data: UploadBody): number {
  if (typeof Blob !== "undefined" && data instanceof Blob) return data.size;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) return data.length;
  if (typeof data === "string") return Buffer.byteLength(data);
  return 0; // streams: unknown up front
}

/** Upload a file to blob storage (server side). */
export async function uploadAsset(params: {
  pathname: string;
  data: UploadBody;
  contentType?: string;
  addRandomSuffix?: boolean;
}): Promise<StoredBlob> {
  const token = getBlobToken();
  try {
    const res = await put(params.pathname, params.data, {
      access: "private",
      token,
      contentType: params.contentType,
      addRandomSuffix: params.addRandomSuffix ?? true,
    });
    const contentType =
      res.contentType ?? params.contentType ?? "application/octet-stream";
    const kind: MediaKind = mediaKindForMime(contentType) ?? "image";
    return {
      url: res.url,
      pathname: res.pathname,
      contentType,
      size: byteSize(params.data),
      kind,
      uploadedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError(
      "UPLOAD_FAILED",
      error instanceof Error ? error.message : "Upload failed.",
    );
  }
}

/** How long a signed view URL stays valid, by default (seconds). */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Build a short-lived signed URL to view a **private** blob (usable in `<img>`/`<video>`).
 * Our store is private (assets aren't publicly reachable by URL), so the Gallery/Identities
 * request a fresh signed URL per asset via its stored `pathname`. Two-step Vercel Blob
 * flow: issue a scoped delegation token, then presign a `get` URL from it.
 */
export async function getSignedUrl(
  pathname: string,
  opts?: { expiresInSeconds?: number },
): Promise<string> {
  const token = getBlobToken();
  try {
    const signedToken = await issueSignedToken({
      pathname,
      operations: ["get", "head"],
      token,
    });
    const ttl = opts?.expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "get",
      pathname,
      access: "private",
      validUntil: Date.now() + ttl * 1000,
    });
    return presignedUrl;
  } catch (error) {
    throw new StorageError(
      "SIGN_URL_FAILED",
      error instanceof Error ? error.message : "Failed to sign URL.",
    );
  }
}

/** Delete one or more assets by blob URL (or pathname). */
export async function deleteAsset(
  urlOrPathname: string | string[],
): Promise<void> {
  const token = getBlobToken();
  try {
    await del(urlOrPathname, { token });
  } catch (error) {
    throw new StorageError(
      "DELETE_FAILED",
      error instanceof Error ? error.message : "Delete failed.",
    );
  }
}
