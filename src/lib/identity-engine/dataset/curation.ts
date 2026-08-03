/**
 * Identity Engine (Milestone 22) — Dataset curation. Pure + deterministic + provider-neutral.
 *
 * Splits the analyzed library into RECOMMENDED vs REJECTED images (with reasons) — the curated
 * revision a future trainer consumes. Uses only persisted knowledge (quality gate + sharpness +
 * occlusion + crop). No training here; this reserves the seam so the LoRA trainer never re-derives it.
 */
import type { DatasetCuration, DatasetImage } from "./types";

/** Reject an image and record why (first failing reason wins for a concise message). */
function rejectionReason(img: DatasetImage): string | null {
  const q = img.metadata.quality;
  if (!q.usable) return q.issues[0] ?? "failed the quality gate";
  if ((q.sharpness ?? 1) < 0.4) return "too blurry";
  if (q.cropped) return "important detail cropped out";
  if (q.occlusion) return "face/body heavily occluded";
  return null;
}

export function curateDataset(
  images: DatasetImage[],
  datasetVersion: number = 1,
): DatasetCuration {
  const recommendedImageIds: string[] = [];
  const rejectedImageIds: string[] = [];
  const rejectionReasons: Record<string, string> = {};

  for (const img of images) {
    const reason = rejectionReason(img);
    if (reason) {
      rejectedImageIds.push(img.mediaId);
      rejectionReasons[img.mediaId] = reason;
    } else {
      recommendedImageIds.push(img.mediaId);
    }
  }

  return { datasetVersion, recommendedImageIds, rejectedImageIds, rejectionReasons };
}
