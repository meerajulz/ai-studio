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
import {
  analyzeAndPersistMedia,
  analyzeIdentityLibrary,
  getPersistedKnowledge,
  type AnalyzeLibrarySummary,
} from "@/lib/vision/persist";
import { buildMediaKnowledgeDetail, type MediaKnowledgeDetail } from "@/lib/vision";
import {
  getIdentityEngineOverview,
  refreshIdentityDataset,
  type IdentityEngineOverview,
} from "@/lib/identity/dataset";

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

/**
 * Analyze + persist Vision knowledge for a whole identity library (Milestone 20). Runs the Vision
 * provider once per un-analyzed training image and stores the frozen `im-2` knowledge, which Smart
 * Reference Selection then consumes at generation time. Slow (Gemini is ~seconds/image) — the async
 * Job queue will parallelize this later; for now it's user-initiated.
 */
export async function analyzeIdentityLibraryAction(
  identityId: string,
  opts: { force?: boolean } = {},
): Promise<AnalyzeLibrarySummary> {
  const userId = await requireUserId();
  const summary = await analyzeIdentityLibrary(userId, identityId, opts);
  // Identity Engine (Milestone 22): recompute + persist dataset readiness from the fresh knowledge.
  await refreshIdentityDataset(userId, identityId);
  return summary;
}

/**
 * Identity Engine overview (Milestone 22) — dataset readiness + trained models + training jobs for
 * the placeholder UI. Read-only; reads persisted `IdentityDataset` / model / job rows (no analysis,
 * no training). Owner-scoped.
 */
export async function getIdentityEngineOverviewAction(
  identityId: string,
): Promise<IdentityEngineOverview | null> {
  const userId = await requireUserId();
  return getIdentityEngineOverview(userId, identityId);
}

/** Re-analyze + persist Vision knowledge for a single training image (Milestone 20). */
export async function reanalyzeMediaAction(mediaId: string): Promise<{ overallScore: number }> {
  const userId = await requireUserId();
  const knowledge = await analyzeAndPersistMedia(userId, mediaId);
  return { overallScore: knowledge.overallScore };
}

/**
 * Read the FULL persisted Vision knowledge for one image (Milestone 20 — the Training Media expand
 * panel). Reads `MediaVisionKnowledge` only; NEVER calls Gemini. Owner-scoped. `null` if unanalyzed.
 */
export async function getMediaVisionKnowledgeAction(
  mediaId: string,
): Promise<MediaKnowledgeDetail | null> {
  const userId = await requireUserId();
  const map = await getPersistedKnowledge(userId, [mediaId]);
  const k = map.get(mediaId);
  if (!k) return null;
  return buildMediaKnowledgeDetail(k.metadata, k.score, {
    provider: k.provider,
    model: k.model,
    version: k.version,
    analyzedAt: k.analyzedAt,
  });
}
