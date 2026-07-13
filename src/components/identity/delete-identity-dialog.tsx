"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useDeleteIdentity } from "@/hooks/use-identities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type DeleteIdentityDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: { id: string; name: string } | null;
  /** Called after a successful delete (e.g. to navigate back to the list). */
  onDeleted?: () => void;
};

export function DeleteIdentityDialog({
  projectId,
  open,
  onOpenChange,
  identity,
  onDeleted,
}: DeleteIdentityDialogProps) {
  const deleteMut = useDeleteIdentity(projectId);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!identity) return;
    setLoading(true);
    try {
      await deleteMut.mutateAsync(identity.id);
      toast.success("Identity deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete identity",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete identity</DialogTitle>
          <DialogDescription>
            This permanently deletes{" "}
            <span className="text-foreground font-medium">
              {identity?.name}
            </span>{" "}
            and its training-media links. The underlying media and any generated
            results are <span className="font-medium">not</span> deleted. This
            can&apos;t be undone.
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
