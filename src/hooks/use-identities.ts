"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addTrainingMediaAction,
  archiveIdentityAction,
  createIdentityAction,
  deleteIdentityAction,
  getIdentityAction,
  getIdentityEngineOverviewAction,
  listIdentitiesAction,
  removeTrainingMediaAction,
  reorderTrainingMediaAction,
  restoreIdentityAction,
  setHeroImageAction,
  setTrainingMediaFavoriteAction,
  setTrainingMediaRoleAction,
  updateIdentityAction,
} from "@/actions/identities";
import type {
  IdentityDetail,
  IdentitySort,
  IdentityStatusFilter,
  TrainingMediaRoleValue,
} from "@/lib/identity/types";
import type { IdentityInput } from "@/lib/validations/identity";

export type IdentityFilters = {
  status: IdentityStatusFilter;
  search: string;
  sort: IdentitySort;
};

export const defaultIdentityFilters: IdentityFilters = {
  status: "active",
  search: "",
  sort: "newest",
};

export const identityKeys = {
  all: ["identities"] as const,
  list: (projectId: string, filters: IdentityFilters) =>
    ["identities", projectId, filters] as const,
  detail: (id: string) => ["identity", id] as const,
};

export function useIdentities(projectId: string, filters: IdentityFilters) {
  return useQuery({
    queryKey: identityKeys.list(projectId, filters),
    queryFn: () => listIdentitiesAction(projectId, filters),
  });
}

export function useIdentity(id: string) {
  return useQuery({
    queryKey: identityKeys.detail(id),
    queryFn: () => getIdentityAction(id),
    enabled: Boolean(id),
  });
}

/**
 * Identity Engine overview (Milestone 22) — dataset readiness + trained models + training jobs.
 * Keyed UNDER the identity detail so "Analyze library" (which invalidates `["identity", id]`) also
 * refreshes it. Read-only placeholder data; no training is triggered.
 */
export function useIdentityEngineOverview(id: string) {
  return useQuery({
    queryKey: [...identityKeys.detail(id), "engine"] as const,
    queryFn: () => getIdentityEngineOverviewAction(id),
    enabled: Boolean(id),
  });
}

export function useCreateIdentity(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IdentityInput & { mediaIds?: string[] }) =>
      createIdentityAction(projectId, input),
    onSuccess: (data) => {
      qc.setQueryData(identityKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

/** Shared detail-mutation wiring: cache the returned detail + refresh identity lists. */
function useDetailMutation<TArgs>(
  id: string,
  mutationFn: (args: TArgs) => Promise<IdentityDetail>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      qc.setQueryData(identityKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export const useUpdateIdentity = (id: string) =>
  useDetailMutation(id, (input: IdentityInput) => updateIdentityAction(id, input));

export const useArchiveIdentity = (id: string) =>
  useDetailMutation<void>(id, () => archiveIdentityAction(id));

export const useRestoreIdentity = (id: string) =>
  useDetailMutation<void>(id, () => restoreIdentityAction(id));

export const useAddTrainingMedia = (id: string) =>
  useDetailMutation(id, (mediaIds: string[]) =>
    addTrainingMediaAction(id, mediaIds),
  );

export const useRemoveTrainingMedia = (id: string) =>
  useDetailMutation(id, (linkId: string) =>
    removeTrainingMediaAction(id, linkId),
  );

export const useReorderTrainingMedia = (id: string) =>
  useDetailMutation(id, (orderedLinkIds: string[]) =>
    reorderTrainingMediaAction(id, orderedLinkIds),
  );

export const useSetTrainingMediaFavorite = (id: string) =>
  useDetailMutation(id, (args: { linkId: string; isFavorite: boolean }) =>
    setTrainingMediaFavoriteAction(id, args.linkId, args.isFavorite),
  );

export const useSetTrainingMediaRole = (id: string) =>
  useDetailMutation(id, (args: { linkId: string; role: TrainingMediaRoleValue }) =>
    setTrainingMediaRoleAction(id, args.linkId, args.role),
  );

export const useSetHeroImage = (id: string) =>
  useDetailMutation(id, (mediaId: string) => setHeroImageAction(id, mediaId));

/** List-level archive/restore (take the id as an argument) for the identities grid. */
export function useArchiveIdentityById() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveIdentityAction(id),
    onSuccess: (data) => {
      qc.setQueryData(identityKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useRestoreIdentityById() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreIdentityAction(id),
    onSuccess: (data) => {
      qc.setQueryData(identityKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useDeleteIdentity(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIdentityAction(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: identityKeys.detail(id) });
      qc.invalidateQueries({ queryKey: identityKeys.all });
      void projectId;
    },
  });
}
