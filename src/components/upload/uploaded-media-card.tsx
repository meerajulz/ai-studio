"use client";

import { Trash2 } from "lucide-react";

import { formatBytes } from "@/lib/blob/constants";
import type { UploadedAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type UploadedMediaCardProps = {
  asset: UploadedAsset;
  onDelete: (asset: UploadedAsset) => void;
  className?: string;
};

/**
 * A single persisted upload tile — thumbnail (image/video), type badge, and delete. Kept
 * minimal on purpose: the full Gallery is a later milestone; this only verifies uploads.
 */
export function UploadedMediaCard({
  asset,
  onDelete,
  className,
}: UploadedMediaCardProps) {
  const isVideo = asset.type === "VIDEO";

  return (
    <div
      data-slot="uploaded-media-card"
      className={cn(
        "bg-card group relative overflow-hidden rounded-lg border",
        className,
      )}
    >
      <div className="bg-muted relative flex aspect-square items-center justify-center overflow-hidden">
        {isVideo ? (
          <video
            src={asset.url}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.originalFilename ?? "Uploaded image"}
            className="h-full w-full object-cover"
          />
        )}
        <Badge variant="secondary" className="absolute left-2 top-2">
          {asset.type}
        </Badge>
        <Button
          variant="destructive"
          size="icon"
          aria-label="Delete upload"
          onClick={() => onDelete(asset)}
          className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 p-3">
        <p className="truncate text-sm font-medium">
          {asset.originalFilename ?? "Untitled"}
        </p>
        {asset.sizeBytes ? (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatBytes(asset.sizeBytes)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
