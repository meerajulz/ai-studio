/**
 * Instagram Insights — domain types.
 *
 * Everything here describes data Meta actually returns for a Professional (Business or
 * Creator) account via the Instagram Graph API. Notably absent: any notion of a "profile
 * visitor". Instagram does not record WHO viewed a profile — not in the app, not in the
 * Graph API, not in any private endpoint — so no shape here carries a viewer identity.
 * `profileViews` is a COUNT and nothing more. See docs/INSTAGRAM_INSIGHTS.md.
 */

/** A single day of a metric's time series. `date` is ISO `YYYY-MM-DD` in the account's timezone. */
export type DailyPoint = {
  date: string;
  value: number;
};

/** A metric we could not retrieve, kept alongside the data so the UI can say WHY it's missing. */
export type MetricGap = {
  /** The metric name as requested from the Graph API, e.g. "profile_views". */
  metric: string;
  reason: string;
};

/** Reach split by whether the viewer follows the account (Graph API `breakdown=follow_type`). */
export type FollowTypeReach = {
  follower: number;
  nonFollower: number;
  /** Non-followers as a share of total reach, 0–1. `null` when total reach is 0. */
  nonFollowerShare: number | null;
};

/** One post, with the per-media insights that indicate whether it pulled in strangers. */
export type PostInsight = {
  id: string;
  permalink: string;
  caption: string | null;
  thumbnailUrl: string | null;
  mediaType: string;
  timestamp: string;
  reach: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  /** likes + comments + saved + shares, as a share of reach (0–1). `null` when reach is 0. */
  engagementRate: number | null;
};

/** The account's own profile fields (Graph API `/{ig-user-id}`). */
export type AccountProfile = {
  id: string;
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
};

/** The inclusive date window a snapshot covers, ISO `YYYY-MM-DD`. */
export type DateRange = {
  since: string;
  until: string;
};

/** Everything the dashboard renders, resolved in one pass. */
export type InsightsSnapshot = {
  account: AccountProfile;
  range: DateRange;
  profileViews: DailyPoint[];
  reach: DailyPoint[];
  accountsEngaged: number | null;
  followTypeReach: FollowTypeReach | null;
  topPosts: PostInsight[];
  /** Metrics Meta refused or doesn't serve for this account — surfaced, never silently dropped. */
  gaps: MetricGap[];
};

/** Supported lookback windows. The Graph API serves at most 30 days per insights call. */
export const RANGE_DAYS = [7, 14, 30] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];
