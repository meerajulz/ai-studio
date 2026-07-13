"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  addTrainingMedia,
  archiveIdentity,
  createIdentity,
  deleteIdentity,
  getIdentity,
  listIdentities,
  removeTrainingMedia,
  reorderTrainingMedia,
  restoreIdentity,
  setHeroImage,
  setTrainingMediaFavorite,
  setTrainingMediaRole,
  updateIdentity,
} from "@/lib/identity/server";
import type {
  IdentityDetail,
  IdentitySummary,
  ListIdentitiesOptions,
  TrainingMediaRoleValue,
} from "@/lib/identity/types";
import { identityInputSchema } from "@/lib/validations/identity";

/**
 * Owner-scoped Server Actions for identities + their training media. Each resolves the
 * current user and delegates to the identity layer, which re-checks ownership (and uses the
 * media layer for all media). Provider-agnostic — no AI here.
 */

export async function listIdentitiesAction(
  projectId: string,
  options: ListIdentitiesOptions = {},
): Promise<IdentitySummary[]> {
  const userId = await requireUserId();
  return listIdentities(userId, projectId, options);
}

export async function getIdentityAction(id: string): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return getIdentity(userId, id);
}

export async function createIdentityAction(
  projectId: string,
  input: { name: string; description?: string; mediaIds?: string[] },
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  const parsed = identityInputSchema.parse({
    name: input.name,
    description: input.description,
  });
  return createIdentity(userId, projectId, {
    name: parsed.name,
    description: parsed.description,
    mediaIds: input.mediaIds,
  });
}

export async function updateIdentityAction(
  id: string,
  input: { name: string; description?: string },
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  const parsed = identityInputSchema.parse(input);
  return updateIdentity(userId, id, {
    name: parsed.name,
    description: parsed.description ?? "",
  });
}

export async function archiveIdentityAction(id: string): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return archiveIdentity(userId, id);
}

export async function restoreIdentityAction(id: string): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return restoreIdentity(userId, id);
}

export async function deleteIdentityAction(id: string): Promise<{ id: string }> {
  const userId = await requireUserId();
  return deleteIdentity(userId, id);
}

export async function addTrainingMediaAction(
  identityId: string,
  mediaIds: string[],
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return addTrainingMedia(userId, identityId, mediaIds);
}

export async function removeTrainingMediaAction(
  identityId: string,
  linkId: string,
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return removeTrainingMedia(userId, identityId, linkId);
}

export async function reorderTrainingMediaAction(
  identityId: string,
  orderedLinkIds: string[],
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return reorderTrainingMedia(userId, identityId, orderedLinkIds);
}

export async function setTrainingMediaFavoriteAction(
  identityId: string,
  linkId: string,
  isFavorite: boolean,
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return setTrainingMediaFavorite(userId, identityId, linkId, isFavorite);
}

export async function setTrainingMediaRoleAction(
  identityId: string,
  linkId: string,
  role: TrainingMediaRoleValue,
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return setTrainingMediaRole(userId, identityId, linkId, role);
}

export async function setHeroImageAction(
  identityId: string,
  mediaId: string,
): Promise<IdentityDetail> {
  const userId = await requireUserId();
  return setHeroImage(userId, identityId, mediaId);
}
