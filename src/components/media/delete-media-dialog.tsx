"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useDeleteMedia } from "@/hooks/use-media";
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

type DeleteMediaDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaAsset | null;
  /** Called after a successful delete (e.g. to close a viewer). */
  onDeleted?: () => void;
};

/** Shared confirm-delete for a media asset — used by Uploads and Gallery. */
export function DeleteMediaDialog({
  projectId,
  open,
  onOpenChange,
  media,
  onDeleted,
}: DeleteMediaDialogProps) {
  const deleteMut = useDeleteMedia(projectId);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!media) return;
    setLoading(true);
    try {
      await deleteMut.mutateAsync(media.id);
      toast.success("Media deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete media",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete media</DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <span className="text-foreground font-medium">
              {media?.originalFilename ?? "this file"}
            </span>{" "}
            from storage. This action can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
