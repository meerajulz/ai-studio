"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Images, UserRoundPlus } from "lucide-react";

import {
  defaultMediaFilters,
  useProjectMedia,
  type MediaFilters,
} from "@/hooks/use-media";
import {
  useGenerateVariation,
  useRegenerate,
} from "@/hooks/use-generation";
import type { MediaAsset } from "@/lib/media/types";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { MediaFiltersBar } from "@/components/media/media-filters";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaViewer } from "@/components/media/media-viewer";
import { DeleteMediaDialog } from "@/components/media/delete-media-dialog";
import { IdentityFormDialog } from "@/components/identity/identity-form-dialog";

type GalleryViewProps = {
  projectId: string;
};

/**
 * The Project Gallery — the central media browser for a project. Source-agnostic. Also the
 * entry point for the `Gallery → select → Create Identity` flow (selection mode).
 */
export function GalleryView({ projectId }: GalleryViewProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<MediaFilters>(defaultMediaFilters);
  const [viewing, setViewing] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const regenerateMut = useRegenerate(projectId);
  const variationMut = useGenerateVariation(projectId);
  const generating = regenerateMut.isPending || variationMut.isPending;

  function handleRegenerate(media: MediaAsset) {
    if (!media.recipe) return;
    toast.promise(regenerateMut.mutateAsync(media.recipe.generationId), {
      loading: "Generating…",
      success: "New image added to the Gallery",
      error: (e) => (e instanceof Error ? e.message : "Couldn't generate"),
    });
  }

  function handleVariation(media: MediaAsset) {
    if (!media.recipe) return;
    toast.promise(variationMut.mutateAsync(media.recipe.generationId), {
      loading: "Generating a variation…",
      success: "Variation added to the Gallery",
      error: (e) => (e instanceof Error ? e.message : "Couldn't generate"),
    });
  }

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

  function toggle(media: MediaAsset) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(media.id)) next.delete(media.id);
      else next.add(media.id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  const isFiltered =
    filters.search.trim() !== "" ||
    filters.kind !== "all" ||
    filters.source !== "all";

  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Gallery"
        description="Browse this project's media. Select items to build an identity."
        action={
          selectMode ? undefined : (
            <Button variant="outline" onClick={() => setSelectMode(true)}>
              <UserRoundPlus className="size-4" />
              Select for identity
            </Button>
          )
        }
      />

      <MediaFiltersBar filters={filters} onChange={onChange} />

      {selectMode ? (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-2 pl-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelect}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={selected.size === 0}
            >
              Create identity
            </Button>
          </div>
        </div>
      ) : null}

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
          onOpen={selectMode ? undefined : setViewing}
          onDelete={selectMode ? undefined : setDeleting}
          selectable={selectMode}
          selectedIds={selected}
          onToggleSelect={toggle}
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
        onRegenerate={handleRegenerate}
        onVariation={handleVariation}
        busy={generating}
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

      <IdentityFormDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        mediaIds={[...selected]}
        onCreated={(identity) => {
          setCreateOpen(false);
          exitSelect();
          router.push(`/projects/${projectId}/identities/${identity.id}`);
        }}
      />
    </div>
  );
}
