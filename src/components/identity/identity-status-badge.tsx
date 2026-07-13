import type { IdentityStatusValue } from "@/lib/identity/types";
import { Badge } from "@/components/ui/badge";

const variantByStatus: Record<
  IdentityStatusValue,
  "secondary" | "outline" | "ghost"
> = {
  DRAFT: "outline",
  ACTIVE: "secondary",
  ARCHIVED: "ghost",
};

const labelByStatus: Record<IdentityStatusValue, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

/** Small status pill for an identity (DRAFT / ACTIVE / ARCHIVED). */
export function IdentityStatusBadge({ status }: { status: IdentityStatusValue }) {
  return <Badge variant={variantByStatus[status]}>{labelByStatus[status]}</Badge>;
}
