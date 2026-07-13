"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

import type { MediaAsset } from "@/lib/media/types";
import { MediaCard } from "./media-card";

type MediaGridProps = {
  items: MediaAsset[];
  onOpen?: (media: MediaAsset) => void;
  onDelete?: (media: MediaAsset) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** Selection mode (passed through to each MediaCard). */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (media: MediaAsset) => void;
  /** Ids that are non-selectable (e.g. already linked), with an optional badge label. */
  disabledIds?: Set<string>;
  disabledLabel?: string;
};

/**
 * Responsive media grid with optional infinite scroll. Images lazy-load natively; when
 * `hasNextPage` a sentinel near the bottom calls `onLoadMore` (IntersectionObserver).
 */
export function MediaGrid({
  items,
  onOpen,
  onDelete,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  selectable,
  selectedIds,
  onToggleSelect,
  disabledIds,
  disabledLabel,
}: MediaGridProps) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || !onLoadMore) return;
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, onLoadMore]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((media) => (
          <MediaCard
            key={media.id}
            media={media}
            onOpen={onOpen}
            onDelete={onDelete}
            selectable={selectable}
            selected={selectedIds?.has(media.id)}
            onToggleSelect={onToggleSelect}
            disabled={disabledIds?.has(media.id)}
            disabledLabel={disabledLabel}
          />
        ))}
      </div>
      {hasNextPage ? (
        <div ref={sentinel} className="flex justify-center py-4">
          {isFetchingNextPage ? (
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
