"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import { Copy, RefreshCw, Shuffle, Trash2 } from "lucide-react";

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
  /** Generated media only — provided by the Gallery to run the creative loop. */
  onRegenerate?: (media: MediaAsset) => void;
  onVariation?: (media: MediaAsset) => void;
  busy?: boolean;
};

async function copyPrompt(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Prompt copied");
  } catch {
    toast.error("Couldn't copy the prompt");
  }
}

/** Full-size preview of a single asset + (for generated media) its recipe + creative actions. */
export function MediaViewer({
  media,
  open,
  onOpenChange,
  onDelete,
  onRegenerate,
  onVariation,
  busy,
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

            <div className="bg-muted flex max-h-[60vh] items-center justify-center overflow-hidden rounded-lg">
              {media.type === "VIDEO" ? (
                <video
                  src={media.url}
                  controls
                  autoPlay
                  className="max-h-[60vh] w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.url}
                  alt={media.originalFilename ?? "Image"}
                  className="max-h-[60vh] w-full object-contain"
                />
              )}
            </div>

            {media.recipe ? (
              <div className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-medium uppercase">
                    Recipe
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => copyPrompt(media.recipe!.prompt)}
                  >
                    <Copy className="size-3.5" />
                    Copy prompt
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {media.recipe.prompt}
                </p>
                <p className="text-muted-foreground text-xs">
                  {media.recipe.provider} · {media.recipe.model} ·{" "}
                  {format(new Date(media.recipe.createdAt), "PP")}
                </p>
                {onRegenerate || onVariation ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {onRegenerate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRegenerate(media)}
                      >
                        <RefreshCw className="size-3.5" />
                        Generate again
                      </Button>
                    ) : null}
                    {onVariation ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => onVariation(media)}
                      >
                        <Shuffle className="size-3.5" />
                        Variation
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

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
  if (media.source === "generated") parts.push("Generated");
  if (media.width && media.height) parts.push(`${media.width}×${media.height}`);
  if (media.durationSeconds) parts.push(`${media.durationSeconds}s`);
  if (media.sizeBytes) parts.push(formatBytes(media.sizeBytes));
  parts.push(format(new Date(media.createdAt), "PP"));
  return parts.join(" · ");
}
