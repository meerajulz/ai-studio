"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";

import {
  useArchiveIdentity,
  useRestoreIdentity,
  useSetHeroImage,
  useUpdateIdentity,
} from "@/hooks/use-identities";
import type { IdentityDetail } from "@/lib/identity/types";
import { identityInputSchema, type IdentityInput } from "@/lib/validations/identity";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IdentityStatusBadge } from "./identity-status-badge";

type IdentitySettingsProps = {
  identity: IdentityDetail;
  onRequestDelete: () => void;
};

export function IdentitySettings({
  identity,
  onRequestDelete,
}: IdentitySettingsProps) {
  const updateMut = useUpdateIdentity(identity.id);
  const archiveMut = useArchiveIdentity(identity.id);
  const restoreMut = useRestoreIdentity(identity.id);
  const heroMut = useSetHeroImage(identity.id);

  const form = useForm<IdentityInput>({
    resolver: zodResolver(identityInputSchema),
    defaultValues: {
      name: identity.name,
      description: identity.description ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: identity.name,
      description: identity.description ?? "",
    });
  }, [identity.id, identity.name, identity.description, form]);

  const isSubmitting = form.formState.isSubmitting;
  const isArchived = identity.status === "ARCHIVED";

  async function onSubmit(values: IdentityInput) {
    try {
      await updateMut.mutateAsync(values);
      toast.success("Identity updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save");
    }
  }

  async function toggleArchive() {
    try {
      if (isArchived) {
        await restoreMut.mutateAsync();
        toast.success("Identity restored");
      } else {
        await archiveMut.mutateAsync();
        toast.success("Identity archived");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update status");
    }
  }

  async function changeHero(mediaId: string) {
    try {
      await heroMut.mutateAsync(mediaId);
      toast.success("Hero Image updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't set Hero Image");
    }
  }

  return (
    <div className="grid max-w-2xl gap-8">
      {/* Details */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input disabled={isSubmitting} {...field} />
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
                  <Textarea rows={3} disabled={isSubmitting} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Hero Image */}
      <div className="grid gap-2">
        <p className="text-sm font-medium">Hero Image</p>
        {identity.trainingMedia.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add training media first, then choose a Hero Image.
          </p>
        ) : (
          <Select
            value={identity.heroImageId ?? undefined}
            onValueChange={(value) => {
              if (value) void changeHero(value);
            }}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Choose a Hero Image" />
            </SelectTrigger>
            <SelectContent>
              {identity.trainingMedia.map((item) => (
                <SelectItem key={item.media.id} value={item.media.id}>
                  {item.media.originalFilename ?? "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Status */}
      <div className="grid gap-2">
        <p className="text-sm font-medium">Status</p>
        <div className="flex items-center gap-3">
          <IdentityStatusBadge status={identity.status} />
          <span className="text-muted-foreground text-sm">
            {isArchived
              ? "Archived — hidden from pickers."
              : "Set automatically from training media (Draft → Active)."}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleArchive}
            disabled={archiveMut.isPending || restoreMut.isPending}
            className="ml-auto"
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="size-4" />
                Restore
              </>
            ) : (
              <>
                <Archive className="size-4" />
                Archive
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border-destructive/30 grid gap-2 rounded-lg border p-4">
        <p className="text-sm font-medium">Danger zone</p>
        <p className="text-muted-foreground text-sm">
          Delete this identity and its training-media links. The underlying media
          and any generated results are not deleted.
        </p>
        <div>
          <Button variant="destructive" onClick={onRequestDelete}>
            Delete identity
          </Button>
        </div>
      </div>
    </div>
  );
}
