"use client";

import { useState } from "react";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";

import {
  useInsightsSnapshot,
  useInstagramConnected,
} from "@/hooks/use-instagram";
import { RANGE_DAYS, type RangeDays } from "@/lib/instagram/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingState } from "@/components/shared/loading-state";
import { SectionTitle } from "@/components/shared/section-title";
import { DailyColumnChart } from "./daily-column-chart";
import { FollowTypeMeter } from "./follow-type-meter";
import { InstagramSetupCard } from "./setup-card";
import { StatTile } from "./stat-tile";
import { TopPostsTable } from "./top-posts-table";
import {
  formatCount,
  formatDayLabel,
  formatExact,
  formatPercent,
  sum,
} from "./format";

/**
 * The Instagram Insights dashboard.
 *
 * What this deliberately does NOT contain: a visitor list. Instagram records no such data
 * for any account type — the Graph API has no endpoint for it and neither does the app, so
 * every "see who viewed your profile" tool is inventing names or harvesting logins. What
 * Meta does measure is here: how many profile views, how far posts reached, and what share
 * of that reach came from people who don't follow the account.
 */
export function InsightsView() {
  const [days, setDays] = useState<RangeDays>(30);
  const connected = useInstagramConnected();
  const snapshot = useInsightsSnapshot(days, connected.data === true);

  if (connected.isLoading) {
    return <LoadingState rows={3} />;
  }

  if (connected.data === false) {
    return <InstagramSetupCard />;
  }

  const data = snapshot.data;
  const totalProfileViews = data
    ? sum(data.profileViews.map((p) => p.value))
    : 0;
  const totalReach = data ? sum(data.reach.map((p) => p.value)) : 0;

  return (
    <div className="grid gap-6">
      {/* Filters in one row above the charts. */}
      <SectionTitle
        title={data ? `@${data.account.username}` : "Instagram insights"}
        description={
          data
            ? `${formatDayLabel(data.range.since)} – ${formatDayLabel(data.range.until)} · ${formatExact(data.account.followersCount)} followers`
            : "Loading your account…"
        }
        action={
          <div className="flex items-center gap-1">
            {RANGE_DAYS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={option === days ? "secondary" : "ghost"}
                onClick={() => setDays(option)}
                aria-pressed={option === days}
              >
                {option}d
              </Button>
            ))}
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => snapshot.refetch()}
              disabled={snapshot.isFetching}
              aria-label="Refresh insights"
            >
              <RefreshCw
                className={snapshot.isFetching ? "animate-spin" : undefined}
              />
            </Button>
          </div>
        }
      />

      {snapshot.isError ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" aria-hidden />
              Instagram returned an error
            </CardTitle>
            <CardDescription>
              {snapshot.error instanceof Error
                ? snapshot.error.message
                : "Could not load insights."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {snapshot.isLoading ? <LoadingState variant="grid" rows={3} /> : null}

      {data ? (
        <>
          {/* Hero figure — the one number the view leads with. */}
          <Card>
            <CardHeader>
              <CardDescription>
                Profile views · last {days} days
              </CardDescription>
              <CardTitle className="text-5xl leading-none font-semibold">
                {formatExact(totalProfileViews)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                How many times your profile was opened. Instagram does not
                record who opened it, so this count is the whole of what exists
                — no app can turn it into names.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Accounts reached"
              value={formatCount(totalReach)}
              hint={`last ${days} days`}
            />
            <StatTile
              label="Reached by non-followers"
              value={formatPercent(
                data.followTypeReach?.nonFollowerShare ?? null,
              )}
              hint="share of total reach"
            />
            <StatTile
              label="Accounts engaged"
              value={
                data.accountsEngaged === null
                  ? "—"
                  : formatCount(data.accountsEngaged)
              }
              hint={`last ${days} days`}
            />
            <StatTile
              label="Followers"
              value={formatCount(data.account.followersCount)}
              hint={`${formatExact(data.account.mediaCount)} posts`}
            />
          </div>

          {/* Two metrics, two charts — never two scales on one axis. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile views per day</CardTitle>
                <CardDescription>
                  Times your profile was opened.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DailyColumnChart
                  points={data.profileViews}
                  label="Profile views"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Accounts reached per day</CardTitle>
                <CardDescription>
                  Unique accounts that saw your content.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DailyColumnChart points={data.reach} label="Reach" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Followers vs non-followers</CardTitle>
              <CardDescription>
                The closest Instagram gets to &ldquo;are strangers finding
                me&rdquo; — how many, never who.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.followTypeReach ? (
                <FollowTypeMeter data={data.followTypeReach} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Meta didn&apos;t return the follower breakdown for this range.
                  It needs instagram_manage_insights and some reach in the
                  window.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent posts by reach</CardTitle>
              <CardDescription>
                Which posts travelled furthest — the ones pulling in people who
                don&apos;t follow you yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopPostsTable posts={data.topPosts} />
            </CardContent>
          </Card>

          {data.gaps.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Info className="size-4" aria-hidden />
                  Metrics Meta didn&apos;t return
                </CardTitle>
                <CardDescription>
                  Shown rather than zeroed — a 0 here would read as
                  &ldquo;nobody&rdquo; when it means &ldquo;no answer&rdquo;.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-muted-foreground grid gap-1 text-sm">
                  {data.gaps.map((gap) => (
                    <li key={gap.metric}>
                      <code className="text-foreground">{gap.metric}</code> —{" "}
                      {gap.reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
