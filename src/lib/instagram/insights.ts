/**
 * Instagram Insights — the query layer.
 *
 * Turns Graph API responses into the `InsightsSnapshot` the dashboard renders. Two API
 * shapes matter here, and they are not interchangeable:
 *
 *   - TIME SERIES (`period=day`, no `metric_type`): one value per day, in one call.
 *     `reach` still serves this.
 *   - TOTAL VALUE (`metric_type=total_value`): one number for the whole window. Meta moved
 *     `profile_views`, `accounts_engaged` and friends to this form, so a per-day series for
 *     them means one call per day. `dailyTotalSeries` does exactly that, bounded by p-limit.
 *
 * `fetchSeries` tries the cheap time-series form first and falls back to the per-day loop when
 * Meta rejects it (error 100), so the dashboard survives a metric moving between API versions.
 *
 * A metric that cannot be retrieved becomes a `MetricGap`, never a zero — a silent 0 would read
 * as "nobody visited" when it actually means "Meta didn't answer".
 */
import pLimit from "p-limit";

import { graphGet, isInstagramError, type InstagramConfig } from "./client";
import type {
  AccountProfile,
  DailyPoint,
  DateRange,
  FollowTypeReach,
  InsightsSnapshot,
  MetricGap,
  PostInsight,
  RangeDays,
} from "./types";

/** Meta throttles hard; 4 in flight is well inside the per-hour budget for a single account. */
const CONCURRENCY = 4;
/** How many recent posts to pull per-media insights for. */
const TOP_POSTS_LIMIT = 12;

// ---------------------------------------------------------------------------
// Date helpers — all windows are whole UTC days, which is what Meta buckets by.
// ---------------------------------------------------------------------------

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function unix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** The last `days` complete days, ending yesterday — today is still accruing and would dip. */
export function resolveRange(
  days: RangeDays,
  now: Date = new Date(),
): DateRange {
  const end = startOfUtcDay(now);
  const start = new Date(end.getTime() - days * 86_400_000);
  return {
    since: toIsoDate(start),
    until: toIsoDate(new Date(end.getTime() - 86_400_000)),
  };
}

function eachDay(range: DateRange): Date[] {
  const days: Date[] = [];
  const start = new Date(`${range.since}T00:00:00Z`);
  const end = new Date(`${range.until}T00:00:00Z`);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    days.push(new Date(d));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Graph API response shapes
// ---------------------------------------------------------------------------

type InsightsResponse = {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number; end_time?: string }>;
    total_value?: {
      value?: number;
      breakdowns?: Array<{
        dimension_keys?: string[];
        results?: Array<{ dimension_values?: string[]; value?: number }>;
      }>;
    };
  }>;
};

type MediaListResponse = {
  data?: Array<{
    id: string;
    permalink?: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }>;
};

// ---------------------------------------------------------------------------
// Metric fetchers
// ---------------------------------------------------------------------------

/** One call, one value per day. Throws if Meta no longer serves the metric this way. */
async function timeSeries(
  metric: string,
  range: DateRange,
  config: InstagramConfig,
): Promise<DailyPoint[]> {
  const body = await graphGet<InsightsResponse>(
    `${config.userId}/insights`,
    {
      metric,
      period: "day",
      // `until` is exclusive of its own day's bucket, so push one day past the window.
      since: unix(new Date(`${range.since}T00:00:00Z`)),
      until: unix(new Date(`${range.until}T00:00:00Z`)) + 86_400,
    },
    config,
  );

  const values = body.data?.[0]?.values ?? [];
  if (!values.length) {
    throw new Error(`No time-series data returned for ${metric}.`);
  }

  return values.map((point) => ({
    // Meta stamps a bucket with the END of its day; the day it describes is the one before.
    date: toIsoDate(
      new Date(new Date(point.end_time ?? "").getTime() - 86_400_000),
    ),
    value: point.value ?? 0,
  }));
}

/** One call per day for metrics Meta only serves as a window total. */
async function dailyTotalSeries(
  metric: string,
  range: DateRange,
  config: InstagramConfig,
): Promise<DailyPoint[]> {
  const limit = pLimit(CONCURRENCY);

  return Promise.all(
    eachDay(range).map((day) =>
      limit(async () => {
        const body = await graphGet<InsightsResponse>(
          `${config.userId}/insights`,
          {
            metric,
            period: "day",
            metric_type: "total_value",
            since: unix(day),
            until: unix(day) + 86_400,
          },
          config,
        );
        return {
          date: toIsoDate(day),
          value: body.data?.[0]?.total_value?.value ?? 0,
        };
      }),
    ),
  );
}

/**
 * A daily series for `metric`, whichever form Meta currently serves it in.
 * Never throws: a failure comes back as a gap so one dead metric can't blank the dashboard.
 */
async function fetchSeries(
  metric: string,
  range: DateRange,
  config: InstagramConfig,
  gaps: MetricGap[],
): Promise<DailyPoint[]> {
  try {
    return await timeSeries(metric, range, config);
  } catch (error) {
    // Error 100 is Meta's "that metric doesn't work that way" — retry as per-day totals.
    const retryable =
      !isInstagramError(error) || error.code === 100 || error.code === null;
    if (!retryable) {
      gaps.push({ metric, reason: (error as Error).message });
      return [];
    }
  }

  try {
    return await dailyTotalSeries(metric, range, config);
  } catch (error) {
    gaps.push({
      metric,
      reason:
        error instanceof Error ? error.message : `Could not load ${metric}.`,
    });
    return [];
  }
}

/** A window total for metrics that have no useful per-day shape. */
async function fetchTotal(
  metric: string,
  range: DateRange,
  config: InstagramConfig,
  gaps: MetricGap[],
): Promise<number | null> {
  try {
    const body = await graphGet<InsightsResponse>(
      `${config.userId}/insights`,
      {
        metric,
        period: "day",
        metric_type: "total_value",
        since: unix(new Date(`${range.since}T00:00:00Z`)),
        until: unix(new Date(`${range.until}T00:00:00Z`)) + 86_400,
      },
      config,
    );
    return body.data?.[0]?.total_value?.value ?? null;
  } catch (error) {
    gaps.push({
      metric,
      reason:
        error instanceof Error ? error.message : `Could not load ${metric}.`,
    });
    return null;
  }
}

/**
 * Reach split into followers vs non-followers (`breakdown=follow_type`).
 *
 * This is the closest thing Instagram offers to "are strangers finding me" — it answers HOW
 * MANY, never WHO. Meta exposes no per-viewer identity for reach or profile views.
 */
async function fetchFollowTypeReach(
  range: DateRange,
  config: InstagramConfig,
  gaps: MetricGap[],
): Promise<FollowTypeReach | null> {
  try {
    const body = await graphGet<InsightsResponse>(
      `${config.userId}/insights`,
      {
        metric: "reach",
        period: "day",
        metric_type: "total_value",
        breakdown: "follow_type",
        since: unix(new Date(`${range.since}T00:00:00Z`)),
        until: unix(new Date(`${range.until}T00:00:00Z`)) + 86_400,
      },
      config,
    );

    const results = body.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    if (!results.length) return null;

    let follower = 0;
    let nonFollower = 0;
    for (const result of results) {
      const key = result.dimension_values?.[0]?.toLowerCase() ?? "";
      if (key.includes("non")) nonFollower += result.value ?? 0;
      else follower += result.value ?? 0;
    }

    const total = follower + nonFollower;
    return {
      follower,
      nonFollower,
      nonFollowerShare: total > 0 ? nonFollower / total : null,
    };
  } catch (error) {
    gaps.push({
      metric: "reach (follow_type)",
      reason:
        error instanceof Error
          ? error.message
          : "Could not load the follower split.",
    });
    return null;
  }
}

async function fetchAccount(config: InstagramConfig): Promise<AccountProfile> {
  const body = await graphGet<{
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
  }>(
    config.userId,
    {
      fields:
        "id,username,name,profile_picture_url,followers_count,follows_count,media_count",
    },
    config,
  );

  return {
    id: body.id,
    username: body.username ?? "unknown",
    name: body.name ?? null,
    profilePictureUrl: body.profile_picture_url ?? null,
    followersCount: body.followers_count ?? 0,
    followsCount: body.follows_count ?? 0,
    mediaCount: body.media_count ?? 0,
  };
}

/** Recent posts plus their per-media insights, ranked by reach. */
async function fetchTopPosts(
  config: InstagramConfig,
  gaps: MetricGap[],
): Promise<PostInsight[]> {
  let media: NonNullable<MediaListResponse["data"]>;
  try {
    const body = await graphGet<MediaListResponse>(
      `${config.userId}/media`,
      {
        fields:
          "id,permalink,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count",
        limit: TOP_POSTS_LIMIT,
      },
      config,
    );
    media = body.data ?? [];
  } catch (error) {
    gaps.push({
      metric: "media",
      reason:
        error instanceof Error ? error.message : "Could not load recent posts.",
    });
    return [];
  }

  const limit = pLimit(CONCURRENCY);
  const posts = await Promise.all(
    media.map((item) =>
      limit(async (): Promise<PostInsight> => {
        const metrics: Record<string, number> = {};
        try {
          const body = await graphGet<InsightsResponse>(
            `${item.id}/insights`,
            { metric: "reach,likes,comments,saved,shares" },
            config,
          );
          for (const entry of body.data ?? []) {
            if (entry.name) {
              metrics[entry.name] =
                entry.values?.[0]?.value ?? entry.total_value?.value ?? 0;
            }
          }
        } catch {
          // Per-media insights are unavailable for some media types and for posts older than
          // the account's conversion to Professional. The post still belongs in the table with
          // its public counts, so this stays a local miss rather than a dashboard-wide gap.
        }

        const reach = metrics.reach ?? 0;
        const likes = metrics.likes ?? item.like_count ?? 0;
        const comments = metrics.comments ?? item.comments_count ?? 0;
        const saved = metrics.saved ?? 0;
        const shares = metrics.shares ?? 0;
        const interactions = likes + comments + saved + shares;

        return {
          id: item.id,
          permalink: item.permalink ?? "",
          caption: item.caption ?? null,
          thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
          mediaType: item.media_type ?? "IMAGE",
          timestamp: item.timestamp ?? "",
          reach,
          likes,
          comments,
          saved,
          shares,
          engagementRate: reach > 0 ? interactions / reach : null,
        };
      }),
    ),
  );

  return posts.sort((a, b) => b.reach - a.reach);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Everything the dashboard needs, in one pass. Independent queries run together; each
 * records a `MetricGap` rather than failing the whole snapshot. Only the account lookup is
 * fatal — without it there is nothing to show and the token is almost certainly the problem.
 */
export async function getInsightsSnapshot(
  days: RangeDays,
  config: InstagramConfig,
  now: Date = new Date(),
): Promise<InsightsSnapshot> {
  const range = resolveRange(days, now);
  const gaps: MetricGap[] = [];

  const [
    account,
    profileViews,
    reach,
    accountsEngaged,
    followTypeReach,
    topPosts,
  ] = await Promise.all([
    fetchAccount(config),
    fetchSeries("profile_views", range, config, gaps),
    fetchSeries("reach", range, config, gaps),
    fetchTotal("accounts_engaged", range, config, gaps),
    fetchFollowTypeReach(range, config, gaps),
    fetchTopPosts(config, gaps),
  ]);

  return {
    account,
    range,
    profileViews,
    reach,
    accountsEngaged,
    followTypeReach,
    topPosts,
    gaps,
  };
}
