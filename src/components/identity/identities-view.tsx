"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, UsersRound } from "lucide-react";

import {
  defaultIdentityFilters,
  useArchiveIdentityById,
  useIdentities,
  useRestoreIdentityById,
  type IdentityFilters,
} from "@/hooks/use-identities";
import type { IdentitySummary } from "@/lib/identity/types";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { IdentityCard } from "./identity-card";
import { IdentityFiltersBar } from "./identity-filters";
import { IdentityFormDialog } from "./identity-form-dialog";
import { DeleteIdentityDialog } from "./delete-identity-dialog";

type IdentitiesViewProps = {
  projectId: string;
};

/** The Identities tab: list of a project's identities with create / edit / archive / delete. */
export function IdentitiesView({ projectId }: IdentitiesViewProps) {
  const [filters, setFilters] = useState<IdentityFilters>(defaultIdentityFilters);
  const { data: identities, isLoading, isError, refetch } = useIdentities(
    projectId,
    filters,
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IdentitySummary | null>(null);
  const [deleting, setDeleting] = useState<IdentitySummary | null>(null);

  const archiveMut = useArchiveIdentityById();
  const restoreMut = useRestoreIdentityById();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(identity: IdentitySummary) {
    setEditing(identity);
    setFormOpen(true);
  }

  async function archive(identity: IdentitySummary) {
    try {
      await archiveMut.mutateAsync(identity.id);
      toast.success("Identity archived");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't archive");
    }
  }

  async function restore(identity: IdentitySummary) {
    try {
      await restoreMut.mutateAsync(identity.id);
      toast.success("Identity restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't restore");
    }
  }

  const isFiltered = filters.search.trim() !== "" || filters.status !== "active";

  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Identities"
        description="Reusable subjects — people, characters, pets, products — built from training media."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New identity
          </Button>
        }
      />

      <IdentityFiltersBar
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      />

      {isLoading ? (
        <LoadingState variant="grid" />
      ) : isError ? (
        <EmptyState
          title="Couldn't load identities"
          description="Something went wrong while loading this project's identities."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : !identities || identities.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={isFiltered ? "No identities match" : "No identities yet"}
          description={
            isFiltered
              ? "Try a different search or filter."
              : "Create an identity, then add training media from the Gallery."
          }
          action={
            !isFiltered ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                New identity
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {identities.map((identity) => (
            <IdentityCard
              key={identity.id}
              projectId={projectId}
              identity={identity}
              onEdit={openEdit}
              onArchive={archive}
              onRestore={restore}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <IdentityFormDialog
        projectId={projectId}
        open={formOpen}
        onOpenChange={setFormOpen}
        identity={editing}
      />
      <DeleteIdentityDialog
        projectId={projectId}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        identity={deleting}
      />
    </div>
  );
}
