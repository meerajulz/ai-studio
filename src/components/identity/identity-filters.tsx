"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import type { IdentityFilters } from "@/hooks/use-identities";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type IdentityFiltersBarProps = {
  filters: IdentityFilters;
  onChange: (patch: Partial<IdentityFilters>) => void;
};

/** Filter/sort controls for the identities list. "Active" shows the working set (Draft + Active). */
export function IdentityFiltersBar({ filters, onChange }: IdentityFiltersBarProps) {
  const [search, setSearch] = useState(filters.search);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) onChange({ search });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search identities…"
          className="w-48 pl-8"
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(value) =>
          onChange({ status: value as IdentityFilters["status"] })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.sort}
        onValueChange={(value) =>
          onChange({ sort: value as IdentityFilters["sort"] })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="name">Name</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
