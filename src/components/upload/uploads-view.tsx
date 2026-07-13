"use client";

import { useMemo, useState } from "react";
import { ImageIcon, TriangleAlert } from "lucide-react";

import {
  defaultMediaFilters,
  useProjectMedia,
} from "@/hooks/use-media";
import { useUploadManager } from "@/hooks/use-upload-manager";
import type { MediaAsset } from "@/lib/media/types";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaViewer } from "@/components/media/media-viewer";
import { DeleteMediaDialog } from "@/components/media/delete-media-dialog";
import { UploadDropzone } from "./upload-dropzone";
import { UploadQueueItem } from "./upload-queue-item";

type UploadsViewProps = {
  projectId: string;
  blobReady: boolean;
};

/**
 * Uploads tab — the "add media" surface. Drag & drop + an upload queue, plus a grid of what's
 * been uploaded (reusing the shared media components). Browsing/filtering lives in Gallery.
 */
export function UploadsView({ projectId, blobReady }: UploadsViewProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProjectMedia(projectId, defaultMediaFilters);
  const manager = useUploadManager(projectId, { onPersisted: () => refetch() });
  const [viewing, setViewing] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Uploads"
        description="Add reference images and videos to this project. Browse them in the Gallery."
      />

      {blobReady ? (
        <UploadDropzone onFiles={manager.addFiles} />
      ) : (
        <div className="text-muted-foreground flex items-start gap-3 rounded-lg border border-dashed p-6 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-foreground font-medium">
              Storage isn&apos;t configured
            </p>
            <p>
              Set <code>BLOB_READ_WRITE_TOKEN</code> to enable uploads (see
              MEDIA_PIPELINE.md).
            </p>
          </div>
        </div>
      )}

      {manager.items.length > 0 ? (
        <div className="grid gap-2">
          {manager.items.map((item) => (
            <UploadQueueItem
              key={item.id}
              item={item}
              onCancel={manager.cancel}
              onRetry={manager.retry}
              onRemove={manager.remove}
            />
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState variant="grid" />
      ) : isError ? (
        <EmptyState
          title="Couldn't load uploads"
          description="Something went wrong while loading this project's media."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No uploads yet"
          description="Drag in images or videos to use as references for this project."
        />
      ) : (
        <MediaGrid
          items={items}
          onOpen={setViewing}
          onDelete={setDeleting}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
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
