"use client";

import { useState } from "react";
import { ImageIcon, TriangleAlert } from "lucide-react";

import { useUploads } from "@/hooks/use-uploads";
import { useUploadManager } from "@/hooks/use-upload-manager";
import type { UploadedAsset } from "@/lib/media/types";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "./upload-dropzone";
import { UploadQueueItem } from "./upload-queue-item";
import { UploadedMediaCard } from "./uploaded-media-card";
import { DeleteUploadDialog } from "./delete-upload-dialog";

type UploadsViewProps = {
  projectId: string;
  blobReady: boolean;
};

/** Uploads tab of a project workspace: drag & drop, upload queue, and the stored grid. */
export function UploadsView({ projectId, blobReady }: UploadsViewProps) {
  const { data: uploads, isLoading, isError, refetch } = useUploads(projectId);
  const manager = useUploadManager(projectId, { onPersisted: () => refetch() });
  const [deleting, setDeleting] = useState<UploadedAsset | null>(null);

  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Uploads"
        description="Reference images and videos used as input for this project."
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
      ) : !uploads || uploads.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No uploads yet"
          description="Drag in images or videos to use as references for this project."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {uploads.map((asset) => (
            <UploadedMediaCard
              key={asset.id}
              asset={asset}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <DeleteUploadDialog
        projectId={projectId}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        asset={deleting}
      />
    </div>
  );
}
