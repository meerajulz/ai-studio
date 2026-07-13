/**
 * Media layer (browser) — the upload entry point for client components.
 *
 * Components call `uploadProjectMedia`; they never touch the blob SDK directly. This wraps
 * the blob layer's browser upload, builds the project-scoped path, and best-effort probes
 * the file's dimensions/duration so richer metadata is stored from day one.
 */
import { uploadAssetFromBrowser } from "@/lib/blob/client";
import { buildUploadPathname } from "@/lib/blob/constants";
import { mediaKindForMime } from "@/lib/blob/validation";
import type { BrowserUploadResult, MediaDimensions } from "./types";

/** Upload one file into a project. Reports progress; supports cancellation via `signal`. */
export async function uploadProjectMedia(params: {
  file: File;
  projectId: string;
  signal?: AbortSignal;
  onProgress?: (percentage: number) => void;
}): Promise<BrowserUploadResult> {
  const { file, projectId } = params;
  const pathname = buildUploadPathname(projectId, file.name);

  // Probe dimensions before uploading — a failure here must never block the upload.
  const dimensions = await probeDimensions(file).catch(() => ({}));

  const stored = await uploadAssetFromBrowser({
    file,
    pathname,
    clientPayload: JSON.stringify({ projectId }),
    abortSignal: params.signal,
    onProgress: params.onProgress,
  });

  return {
    pathname: stored.pathname,
    blobUrl: stored.url,
    contentType: stored.contentType,
    size: file.size,
    originalFilename: file.name,
    ...dimensions,
  };
}

/** Read width/height (images + videos) and duration (videos) in the browser. */
export function probeDimensions(file: File): Promise<MediaDimensions> {
  const kind = mediaKindForMime(file.type);
  if (kind === "image") return probeImage(file);
  if (kind === "video") return probeVideo(file);
  return Promise.resolve({});
}

function probeImage(file: File): Promise<MediaDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    img.src = url;
  });
}

function probeVideo(file: File): Promise<MediaDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: Number.isFinite(video.duration)
          ? video.duration
          : undefined,
      });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata."));
    };
    video.src = url;
  });
}
