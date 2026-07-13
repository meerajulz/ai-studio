"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import type { IdentitySummary } from "@/lib/identity/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IdentityAvatar } from "./identity-avatar";
import { IdentityStatusBadge } from "./identity-status-badge";

type IdentityCardProps = {
  projectId: string;
  identity: IdentitySummary;
  onEdit: (identity: IdentitySummary) => void;
  onArchive: (identity: IdentitySummary) => void;
  onRestore: (identity: IdentitySummary) => void;
  onDelete: (identity: IdentitySummary) => void;
};

/** One identity tile: Hero Image + name + description + media count + status + actions menu. */
export function IdentityCard({
  projectId,
  identity,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: IdentityCardProps) {
  const href = `/projects/${projectId}/identities/${identity.id}`;

  return (
    <div className="bg-card relative flex items-start gap-3 rounded-lg border p-4">
      <Link href={href} className="flex min-w-0 flex-1 items-start gap-3">
        <IdentityAvatar
          name={identity.name}
          heroImageUrl={identity.heroImageUrl}
          className="size-12"
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{identity.name}</p>
          {identity.description ? (
            <p className="text-muted-foreground truncate text-sm">
              {identity.description}
            </p>
          ) : null}
          <p className="text-muted-foreground mt-1 text-xs">
            {identity.mediaCount} media
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <IdentityStatusBadge status={identity.status} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Identity actions" />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(identity)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            {identity.status === "ARCHIVED" ? (
              <DropdownMenuItem onClick={() => onRestore(identity)}>
                <ArchiveRestore className="size-4" />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onArchive(identity)}>
                <Archive className="size-4" />
                Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(identity)}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
