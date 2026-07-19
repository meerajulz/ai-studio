"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  useArchiveIdentity,
  useIdentity,
  useRestoreIdentity,
} from "@/hooks/use-identities";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdentityAvatar } from "./identity-avatar";
import { IdentityStatusBadge } from "./identity-status-badge";
import { IdentityOverview } from "./identity-overview";
import { IdentityTrainingMedia } from "./identity-training-media";
import { IdentityDatasetReadiness } from "./identity-dataset-readiness";
import { IdentityTrainedModels } from "./identity-trained-models";
import { IdentitySettings } from "./identity-settings";
import { IdentityFormDialog } from "./identity-form-dialog";
import { DeleteIdentityDialog } from "./delete-identity-dialog";

type IdentityDetailViewProps = {
  projectId: string;
  identityId: string;
};

export function IdentityDetailView({
  projectId,
  identityId,
}: IdentityDetailViewProps) {
  const router = useRouter();
  const listHref = `/projects/${projectId}/identities`;
  const { data: identity, isLoading, isError } = useIdentity(identityId);

  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const archiveMut = useArchiveIdentity(identityId);
  const restoreMut = useRestoreIdentity(identityId);

  async function toggleArchive() {
    if (!identity) return;
    try {
      if (identity.status === "ARCHIVED") {
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

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <LoadingState variant="list" rows={3} />
      </div>
    );
  }

  if (isError || !identity) {
    return (
      <EmptyState
        title="Identity not found"
        description="It may have been deleted, or you don't have access."
        action={
          <Button variant="outline" onClick={() => router.push(listHref)}>
            Back to identities
          </Button>
        }
      />
    );
  }

  const isArchived = identity.status === "ARCHIVED";

  return (
    <div className="grid gap-6">
      <Link
        href={listHref}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Identities
      </Link>

      <div className="flex items-start gap-4">
        <IdentityAvatar
          name={identity.name}
          heroImageUrl={identity.heroImageUrl}
          className="size-16"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{identity.name}</h2>
            <IdentityStatusBadge status={identity.status} />
          </div>
          {identity.description ? (
            <p className="text-muted-foreground text-sm">
              {identity.description}
            </p>
          ) : null}
          <p className="text-muted-foreground mt-0.5 text-xs">
            {identity.mediaCount} media
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => setTab("training")}>
            <ImagePlus className="size-4" />
            Add media
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Identity actions" />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleArchive}>
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
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as string)}>
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="training">Training Media</TabsTrigger>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="templates" disabled>
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" disabled>
            History
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <IdentityOverview identity={identity} />
        </TabsContent>
        <TabsContent value="training" className="pt-4">
          <IdentityTrainingMedia projectId={projectId} identity={identity} />
        </TabsContent>
        <TabsContent value="dataset" className="pt-4">
          <IdentityDatasetReadiness identityId={identity.id} />
        </TabsContent>
        <TabsContent value="models" className="pt-4">
          <IdentityTrainedModels identityId={identity.id} />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <IdentitySettings
            identity={identity}
            onRequestDelete={() => setDeleteOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <IdentityFormDialog
        projectId={projectId}
        open={editOpen}
        onOpenChange={setEditOpen}
        identity={{
          id: identity.id,
          name: identity.name,
          description: identity.description,
        }}
      />
      <DeleteIdentityDialog
        projectId={projectId}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        identity={{ id: identity.id, name: identity.name }}
        onDeleted={() => router.push(listHref)}
      />
    </div>
  );
}
