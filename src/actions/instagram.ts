"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  getInsightsSnapshot,
  getInstagramConfig,
  isInstagramConfigured,
  type InsightsSnapshot,
  type RangeDays,
} from "@/lib/instagram";

/**
 * Owner-scoped Server Actions for Instagram Insights.
 *
 * The bridge between the dashboard and the Graph API layer. Every action resolves the session
 * first: the account token is a single shared credential, so the session check IS the
 * authorization boundary — without it any visitor could read the account's analytics.
 */

/** Whether the Graph API credentials are present, so the UI can show setup steps instead of an error. */
export async function isInstagramConnectedAction(): Promise<boolean> {
  await requireUserId();
  return isInstagramConfigured();
}

export async function getInsightsSnapshotAction(
  days: RangeDays,
): Promise<InsightsSnapshot> {
  await requireUserId();
  return getInsightsSnapshot(days, getInstagramConfig());
}
