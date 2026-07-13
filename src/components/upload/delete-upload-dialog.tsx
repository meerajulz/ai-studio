"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useDeleteUpload } from "@/hooks/use-uploads";
import type { UploadedAsset } from "@/lib/media/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type DeleteUploadDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: UploadedAsset | null;
};

export function DeleteUploadDialog({
  projectId,
  open,
  onOpenChange,
  asset,
}: DeleteUploadDialogProps) {
  const deleteMut = useDeleteUpload(projectId);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!asset) return;
    setLoading(true);
    try {
      await deleteMut.mutateAsync(asset.id);
      toast.success("Upload deleted");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete upload",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete upload</DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <span className="text-foreground font-medium">
              {asset?.originalFilename ?? "this file"}
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
