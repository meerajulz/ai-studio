"use client";

import { Check, Play, Trash2 } from "lucide-react";

import { formatBytes } from "@/lib/blob/constants";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MediaCardProps = {
  media: MediaAsset;
  onOpen?: (media: MediaAsset) => void;
  onDelete?: (media: MediaAsset) => void;
  /** Selection mode (e.g. Gallery "create identity" or the training-media picker). */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (media: MediaAsset) => void;
  /** Non-selectable + muted (e.g. already linked). Shows `disabledLabel` if given. */
  disabled?: boolean;
  disabledLabel?: string;
  className?: string;
};

/**
 * A single media tile — image or video — driven entirely by a `MediaAsset` (signed URL).
 * The canonical media tile: reused by Gallery, Uploads, and Identities (browse + select).
 * Source-agnostic — it never knows whether an asset was uploaded or AI-generated.
 */
export function MediaCard({
  media,
  onOpen,
  onDelete,
  selectable,
  selected,
  onToggleSelect,
  disabled,
  disabledLabel,
  className,
}: MediaCardProps) {
  const isVideo = media.type === "VIDEO";

  function handleClick() {
    if (disabled) return;
    if (selectable) onToggleSelect?.(media);
    else onOpen?.(media);
  }

  return (
    <div
      data-slot="media-card"
      className={cn(
        "bg-card group relative overflow-hidden rounded-lg border transition-shadow",
        selected && "ring-primary ring-2",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={selectable ? Boolean(selected) : undefined}
        aria-label={`${selectable ? "Select" : "Open"} ${media.originalFilename ?? "media"}`}
        className="bg-muted relative flex aspect-square w-full items-center justify-center overflow-hidden disabled:cursor-not-allowed"
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

        {selectable ? (
          <span
            className={cn(
              "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/80 bg-black/30",
            )}
          >
            {selected ? <Check className="size-4" /> : null}
          </span>
        ) : null}

        {disabled && disabledLabel ? (
          <Badge variant="secondary" className="absolute bottom-2 right-2">
            {disabledLabel}
          </Badge>
        ) : null}
      </button>

      {onDelete && !selectable ? (
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
