"use client";

import { useCallback, useMemo, useState } from "react";
import { Images } from "lucide-react";

import {
  defaultMediaFilters,
  useProjectMedia,
  type MediaFilters,
} from "@/hooks/use-media";
import type { MediaAsset } from "@/lib/media/types";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { MediaFiltersBar } from "@/components/media/media-filters";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaViewer } from "@/components/media/media-viewer";
import { DeleteMediaDialog } from "@/components/media/delete-media-dialog";

type GalleryViewProps = {
  projectId: string;
};

/**
 * The Project Gallery — the central media browser for a project. Source-agnostic: it shows
 * uploaded images + videos today, and generated media will drop into the same grid/filters
 * with no UI change. Identities/Templates/AI should reuse this rather than build their own.
 */
export function GalleryView({ projectId }: GalleryViewProps) {
  const [filters, setFilters] = useState<MediaFilters>(defaultMediaFilters);
  const [viewing, setViewing] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProjectMedia(projectId, filters);

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const onChange = useCallback((patch: Partial<MediaFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const isFiltered =
    filters.search.trim() !== "" ||
    filters.kind !== "all" ||
    filters.source !== "all";

  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Gallery"
        description="Browse this project's media. Uploaded now; generated media appears here too."
      />

      <MediaFiltersBar filters={filters} onChange={onChange} />

      {isLoading ? (
        <LoadingState variant="grid" />
      ) : isError ? (
        <EmptyState
          title="Couldn't load media"
          description="Something went wrong while loading this project's media."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Images}
          title={isFiltered ? "No media matches" : "No media yet"}
          description={
            isFiltered
              ? "Try clearing the filters or search."
              : "Upload images or videos in the Uploads tab to see them here."
          }
        />
      ) : (
        <MediaGrid
          items={items}
          onOpen={setViewing}
          onDelete={setDeleting}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={loadMore}
        />
      )}

      <MediaViewer
        media={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        onDelete={setDeleting}
      />

      <DeleteMediaDialog
        projectId={projectId}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        media={deleting}
        onDeleted={() => setViewing(null)}
      />
    </div>
  );
}
