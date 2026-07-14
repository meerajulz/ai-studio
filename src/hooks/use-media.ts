"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { deleteMediaAction, listMediaAction } from "@/actions/media";
import type {
  MediaKindFilter,
  MediaSourceFilter,
  MediaSort,
} from "@/lib/media/types";

/** The user-facing filter/sort state a media browser controls. */
export type MediaFilters = {
  kind: MediaKindFilter;
  source: MediaSourceFilter;
  sort: MediaSort;
  search: string;
};

export const defaultMediaFilters: MediaFilters = {
  kind: "all",
  source: "all",
  sort: "newest",
  search: "",
};

/** Uploaded-only view — for the Uploads tab + training-media picker (not the Gallery). */
export const uploadedMediaFilters: MediaFilters = {
  kind: "all",
  source: "uploaded",
  sort: "newest",
  search: "",
};

const PAGE_SIZE = 24;

export const mediaKeys = {
  all: (projectId: string) => ["media", projectId] as const,
  list: (projectId: string, filters: MediaFilters) =>
    ["media", projectId, filters] as const,
};

/**
 * Paginated media for a project (infinite scroll). Signed URLs are minted server-side per
 * fetch; `staleTime` keeps them well within the 1h signature TTL. Uploads and Gallery both
 * use this — the media layer is the single source.
 */
export function useProjectMedia(projectId: string, filters: MediaFilters) {
  return useInfiniteQuery({
    queryKey: mediaKeys.list(projectId, filters),
    queryFn: ({ pageParam }) =>
      listMediaAction(projectId, {
        kind: filters.kind,
        source: filters.source,
        sort: filters.sort,
        search: filters.search,
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000, // 5 min — comfortably inside the signed-URL TTL
  });
}

/** Delete a media asset and refresh every media list for the project. */
export function useDeleteMedia(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMediaAction(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: mediaKeys.all(projectId) }),
  });
}
