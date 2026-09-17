"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getInsightsSnapshotAction,
  isInstagramConnectedAction,
} from "@/actions/instagram";
import type { InsightsSnapshot, RangeDays } from "@/lib/instagram/types";

/** TanStack Query hooks over the Instagram Server Actions. */

export function useInstagramConnected() {
  return useQuery<boolean>({
    queryKey: ["instagram", "connected"],
    queryFn: () => isInstagramConnectedAction(),
    staleTime: 5 * 60_000,
  });
}

export function useInsightsSnapshot(days: RangeDays, enabled = true) {
  return useQuery<InsightsSnapshot>({
    queryKey: ["instagram", "snapshot", days],
    queryFn: () => getInsightsSnapshotAction(days),
    enabled,
    // Insights update hourly at best, and every refetch spends Graph API quota.
    staleTime: 10 * 60_000,
    retry: false,
  });
}
