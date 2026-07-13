"use client";

import { AlertCircle, Loader2, RotateCcw, X } from "lucide-react";

import { formatBytes } from "@/lib/blob/constants";
import type { UploadItem } from "@/hooks/use-upload-manager";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type UploadQueueItemProps = {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
};

/** A single in-flight upload row: progress + cancel while active, retry/remove on failure. */
export function UploadQueueItem({
  item,
  onCancel,
  onRetry,
  onRemove,
}: UploadQueueItemProps) {
  const active = item.status === "queued" || item.status === "uploading";
  const failed = item.status === "error" || item.status === "canceled";

  return (
    <div
      data-slot="upload-queue-item"
      className="bg-card flex items-center gap-4 rounded-lg border p-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium">{item.file.name}</p>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatBytes(item.file.size)}
          </span>
        </div>

        {active ? (
          <Progress value={item.progress} className="mt-2" />
        ) : (
          <p
            className={cnStatus(failed)}
            data-status={item.status}
          >
            {item.status === "canceled" ? (
              "Canceled"
            ) : (
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="size-3.5" />
                {item.error ?? "Upload failed"}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {active ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel upload"
            onClick={() => onCancel(item.id)}
          >
            {item.status === "uploading" ? (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Retry upload"
              onClick={() => onRetry(item.id)}
            >
              <RotateCcw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => onRemove(item.id)}
            >
              <X className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function cnStatus(failed: boolean): string {
  return failed
    ? "text-destructive mt-2 text-xs"
    : "text-muted-foreground mt-2 text-xs";
}
