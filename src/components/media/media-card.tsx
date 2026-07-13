"use client";

import { Play, Trash2 } from "lucide-react";

import { formatBytes } from "@/lib/blob/constants";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MediaCardProps = {
  media: MediaAsset;
  onOpen?: (media: MediaAsset) => void;
  onDelete?: (media: MediaAsset) => void;
  className?: string;
};

/**
 * A single media tile — image or video — driven entirely by a `MediaAsset` (signed URL).
 * The canonical media tile: reused by Gallery and Uploads, and by Identities/Templates/AI
 * later. Source-agnostic — it never knows whether an asset was uploaded or AI-generated.
 */
export function MediaCard({ media, onOpen, onDelete, className }: MediaCardProps) {
  const isVideo = media.type === "VIDEO";

  return (
    <div
      data-slot="media-card"
      className={cn(
        "bg-card group relative overflow-hidden rounded-lg border",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(media)}
        aria-label={`Open ${media.originalFilename ?? "media"}`}
        className="bg-muted relative flex aspect-square w-full items-center justify-center overflow-hidden"
      >
        {isVideo ? (
          <>
            <video
              src={`${media.url}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/50 p-2 text-white">
                <Play className="size-5" />
              </span>
            </span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.originalFilename ?? "Uploaded image"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
        <Badge variant="secondary" className="absolute left-2 top-2">
          {media.type}
        </Badge>
      </button>

      {onDelete ? (
        <Button
          variant="destructive"
          size="icon"
          aria-label="Delete media"
          onClick={() => onDelete(media)}
          className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}

      <div className="flex items-center justify-between gap-2 p-3">
        <p className="truncate text-sm font-medium">
          {media.originalFilename ?? "Untitled"}
        </p>
        {media.sizeBytes ? (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatBytes(media.sizeBytes)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
