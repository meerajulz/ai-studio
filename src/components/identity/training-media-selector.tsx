"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2 } from "lucide-react";

import {
  uploadedMediaFilters,
  useProjectMedia,
  type MediaFilters,
} from "@/hooks/use-media";
import { useAddTrainingMedia } from "@/hooks/use-identities";
import type { MediaAsset } from "@/lib/media/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MediaFiltersBar } from "@/components/media/media-filters";
import { MediaGrid } from "@/components/media/media-grid";

type TrainingMediaSelectorProps = {
  projectId: string;
  identityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Media already linked to the identity (shown as disabled "Added"). */
  linkedMediaIds: Set<string>;
};

/**
 * Add training media by picking from the project's Gallery (the single source of truth —
 * never a second uploader). Reuses `MediaGrid` in selection mode.
 */
export function TrainingMediaSelector({
  projectId,
  identityId,
  open,
  onOpenChange,
  linkedMediaIds,
}: TrainingMediaSelectorProps) {
  const [filters, setFilters] = useState<MediaFilters>(uploadedMediaFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addMut = useAddTrainingMedia(identityId);

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

  function toggle(media: MediaAsset) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(media.id)) next.delete(media.id);
      else next.add(media.id);
      return next;
    });
  }

  function close() {
    setSelected(new Set());
    onOpenChange(false);
  }

  async function add() {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      await addMut.mutateAsync(ids);
      toast.success(`Added ${ids.length} to identity`);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add media");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add training media</DialogTitle>
          <DialogDescription>
            Pick images and videos from this project&apos;s Gallery. Already-added
            media is disabled.
          </DialogDescription>
        </DialogHeader>

        <MediaFiltersBar
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        />

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {isLoading ? (
            <LoadingState variant="grid" />
          ) : isError ? (
            <EmptyState
              title="Couldn't load media"
              description="Something went wrong loading the Gallery."
              action={
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No media to add"
              description="Upload images or videos in the Uploads tab first."
            />
          ) : (
            <MediaGrid
              items={items}
              selectable
              selectedIds={selected}
              onToggleSelect={toggle}
              disabledIds={linkedMediaIds}
              disabledLabel="Added"
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => void fetchNextPage()}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={addMut.isPending}>
            Cancel
          </Button>
          <Button onClick={add} disabled={selected.size === 0 || addMut.isPending}>
            {addMut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Adding…
              </>
            ) : (
              `Add ${selected.size || ""} to identity`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
