"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { identityInputSchema, type IdentityInput } from "@/lib/validations/identity";
import { useCreateIdentity, useUpdateIdentity } from "@/hooks/use-identities";
import type { IdentityDetail } from "@/lib/identity/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type IdentityFormDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this identity; otherwise it creates a new one. */
  identity?: { id: string; name: string; description: string | null } | null;
  /** Media to pre-link on create (e.g. from a Gallery selection). */
  mediaIds?: string[];
  /** Called after a successful create (e.g. to navigate to the new identity). */
  onCreated?: (identity: IdentityDetail) => void;
};

export function IdentityFormDialog({
  projectId,
  open,
  onOpenChange,
  identity,
  mediaIds,
  onCreated,
}: IdentityFormDialogProps) {
  const isEdit = Boolean(identity);
  const createMut = useCreateIdentity(projectId);
  const updateMut = useUpdateIdentity(identity?.id ?? "");

  const form = useForm<IdentityInput>({
    resolver: zodResolver(identityInputSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: identity?.name ?? "",
        description: identity?.description ?? "",
      });
    }
  }, [open, identity, form]);

  const isSubmitting = form.formState.isSubmitting;
  const selectedCount = mediaIds?.length ?? 0;

  async function onSubmit(values: IdentityInput) {
    try {
      if (isEdit && identity) {
        await updateMut.mutateAsync(values);
        toast.success("Identity updated");
      } else {
        const created = await createMut.mutateAsync({ ...values, mediaIds });
        toast.success("Identity created");
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit identity" : "New identity"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this identity's details."
              : selectedCount > 0
                ? `Create an identity from ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}. You can add more media later.`
                : "Name your identity. You can add training media after creating."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Emma"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A short description (optional)"
                      rows={3}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : isEdit ? (
                  "Save changes"
                ) : (
                  "Create identity"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
