"use client";

import { format } from "date-fns";

import type { IdentityDetail } from "@/lib/identity/types";
import { IdentityStatusBadge } from "./identity-status-badge";

type IdentityOverviewProps = {
  identity: IdentityDetail;
};

/**
 * Overview sub-tab — minimal today (hero, name, description, status, count, dates), the
 * permanent home for future stats / templates / history / provider artifacts / AI defaults.
 */
export function IdentityOverview({ identity }: IdentityOverviewProps) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Name", value: identity.name },
    {
      label: "Description",
      value: identity.description ?? (
        <span className="text-muted-foreground">—</span>
      ),
    },
    { label: "Status", value: <IdentityStatusBadge status={identity.status} /> },
    { label: "Training media", value: `${identity.mediaCount}` },
    { label: "Created", value: format(new Date(identity.createdAt), "PP") },
    { label: "Updated", value: format(new Date(identity.updatedAt), "PP") },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-lg border">
        {identity.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={identity.heroImageUrl}
            alt={identity.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No Hero Image
          </div>
        )}
      </div>

      <dl className="grid gap-3 self-start">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[140px_1fr] items-center gap-3 border-b pb-3 last:border-0"
          >
            <dt className="text-muted-foreground text-sm">{row.label}</dt>
            <dd className="text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
