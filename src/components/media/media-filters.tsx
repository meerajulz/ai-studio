"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import type { MediaFilters } from "@/hooks/use-media";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type MediaFiltersBarProps = {
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
};

/**
 * Filter/sort controls for a media browser. Designed so generated AI media reuses the same
 * bar unchanged — the "Generated" source is a real option today (it just returns empty).
 */
export function MediaFiltersBar({ filters, onChange }: MediaFiltersBarProps) {
  // Debounce the filename search so we don't refetch on every keystroke.
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
          placeholder="Search filename…"
          className="w-48 pl-8"
        />
      </div>

      <Select
        value={filters.kind}
        onValueChange={(value) =>
          onChange({ kind: value as MediaFilters["kind"] })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="image">Images</SelectItem>
          <SelectItem value="video">Videos</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.source}
        onValueChange={(value) =>
          onChange({ source: value as MediaFilters["source"] })
        }
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="uploaded">Uploaded</SelectItem>
          <SelectItem value="generated">Generated</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.sort}
        onValueChange={(value) =>
          onChange({ sort: value as MediaFilters["sort"] })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
