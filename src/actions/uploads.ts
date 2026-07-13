"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  deleteUpload,
  listProjectUploads,
  persistUpload,
} from "@/lib/media/server";
import type { PersistUploadInput, UploadedAsset } from "@/lib/media/types";

/**
 * Owner-scoped Server Actions for uploaded media. Each one resolves the current user and
 * delegates to the media layer, which enforces ownership again at the data boundary — a
 * user can only ever persist, list, or delete media within their own projects.
 */

export async function listUploads(projectId: string): Promise<UploadedAsset[]> {
  const userId = await requireUserId();
  return listProjectUploads(userId, projectId);
}

export async function createUpload(
  input: PersistUploadInput,
): Promise<UploadedAsset> {
  const userId = await requireUserId();
  return persistUpload(userId, input);
}

export async function removeUpload(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  return deleteUpload(userId, id);
}
