"use client";

import { format } from "date-fns";
import { Trash2 } from "lucide-react";

import { formatBytes } from "@/lib/blob/constants";
import type { MediaAsset } from "@/lib/media/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MediaViewerProps = {
  media: MediaAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (media: MediaAsset) => void;
};

/** Full-size preview of a single asset — image or video player — with its metadata. */
export function MediaViewer({
  media,
  open,
  onOpenChange,
  onDelete,
}: MediaViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {media ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">
                {media.originalFilename ?? "Untitled"}
              </DialogTitle>
              <DialogDescription>{describe(media)}</DialogDescription>
            </DialogHeader>

            <div className="bg-muted flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg">
              {media.type === "VIDEO" ? (
                <video
                  src={media.url}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.url}
                  alt={media.originalFilename ?? "Image"}
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
            </div>

            {onDelete ? (
              <div className="flex justify-end">
                <Button variant="destructive" onClick={() => onDelete(media)}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function describe(media: MediaAsset): string {
  const parts: string[] = [media.type === "VIDEO" ? "Video" : "Image"];
  if (media.width && media.height) parts.push(`${media.width}×${media.height}`);
  if (media.durationSeconds) parts.push(`${media.durationSeconds}s`);
  if (media.sizeBytes) parts.push(formatBytes(media.sizeBytes));
  parts.push(format(new Date(media.createdAt), "PP"));
  return parts.join(" · ");
}
