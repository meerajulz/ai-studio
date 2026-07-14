"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import { Copy, ImageOff, RotateCcw } from "lucide-react";

import type { GenerationHistoryItem } from "@/lib/generation/types";
import type { MediaAsset } from "@/lib/media/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type GenerationHistoryProps = {
  items: GenerationHistoryItem[];
  onOpen: (media: MediaAsset) => void;
  onUsePrompt: (prompt: string) => void;
};

async function copyPrompt(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Prompt copied");
  } catch {
    toast.error("Couldn't copy the prompt");
  }
}

/** Recent generations for the project — reuses existing data (Generation + its result). */
export function GenerationHistory({
  items,
  onOpen,
  onUsePrompt,
}: GenerationHistoryProps) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div
          key={item.generationId}
          className="bg-card flex items-start gap-3 rounded-lg border p-2"
        >
          <button
            type="button"
            onClick={() => item.media && onOpen(item.media)}
            disabled={!item.media}
            aria-label={item.media ? "Open result" : "No result"}
            className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-md disabled:cursor-default"
          >
            {item.media ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.media.url}
                alt={item.prompt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-muted-foreground flex h-full items-center justify-center">
                <ImageOff className="size-5" />
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm">{item.prompt}</p>
            <div className="text-muted-foreground mt-1 text-xs">
              {item.status !== "SUCCEEDED" ? (
                <Badge variant="outline">{item.status}</Badge>
              ) : (
                <span>
                  {item.model} · {format(new Date(item.createdAt), "PP")}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy prompt"
              onClick={() => copyPrompt(item.prompt)}
            >
              <Copy className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUsePrompt(item.prompt)}
            >
              <RotateCcw className="size-3.5" />
              Use
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
