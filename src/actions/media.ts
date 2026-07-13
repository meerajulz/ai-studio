"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  createMedia,
  deleteMedia,
  getMedia,
  getMediaSignedUrl,
  listProjectMedia,
  updateMediaMetadata,
} from "@/lib/media/server";
import type {
  ListProjectMediaOptions,
  MediaAsset,
  MediaMetadataPatch,
  MediaPage,
  PersistUploadInput,
} from "@/lib/media/types";

/**
 * Owner-scoped Server Actions for media — the thin bridge between client features and the
 * media layer. Each resolves the current user and delegates; the media layer enforces
 * ownership again at the data boundary. Uploads and Gallery both consume these; future
 * features (Identities, Templates, AI) should too — never the blob layer.
 */

export async function listMediaAction(
  projectId: string,
  options: ListProjectMediaOptions = {},
): Promise<MediaPage> {
  const userId = await requireUserId();
  return listProjectMedia(userId, projectId, options);
}

export async function getMediaAction(id: string): Promise<MediaAsset> {
  const userId = await requireUserId();
  return getMedia(userId, id);
}

export async function createMediaAction(
  input: PersistUploadInput,
): Promise<MediaAsset> {
  const userId = await requireUserId();
  return createMedia(userId, input);
}

export async function updateMediaMetadataAction(
  id: string,
  patch: MediaMetadataPatch,
): Promise<MediaAsset> {
  const userId = await requireUserId();
  return updateMediaMetadata(userId, id, patch);
}

export async function refreshMediaUrlAction(id: string): Promise<string> {
  const userId = await requireUserId();
  return getMediaSignedUrl(userId, id);
}

export async function deleteMediaAction(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  return deleteMedia(userId, id);
}
