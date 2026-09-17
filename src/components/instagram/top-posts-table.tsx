import { ExternalLink } from "lucide-react";

import type { PostInsight } from "@/lib/instagram/types";
import { cn } from "@/lib/utils";
import { formatExact, formatPercent } from "./format";

type TopPostsTableProps = {
  posts: PostInsight[];
  className?: string;
};

function shortCaption(caption: string | null): string {
  if (!caption) return "(no caption)";
  const firstLine = caption.split("\n")[0].trim();
  return firstLine.length > 60
    ? `${firstLine.slice(0, 57)}…`
    : firstLine || "(no caption)";
}

function postDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Recent posts ranked by reach — which posts actually travelled.
 *
 * This doubles as the dashboard's table view: every number plotted elsewhere is readable
 * here as text, so nothing is gated behind color or a hover.
 */
export function TopPostsTable({ posts, className }: TopPostsTableProps) {
  if (!posts.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No posts with insights yet. Per-post insights only exist for posts
        published after the account became Professional.
      </p>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-left text-xs">
            <th className="py-2 pr-3 font-medium">Post</th>
            <th className="py-2 pr-3 text-right font-medium">Reach</th>
            <th className="py-2 pr-3 text-right font-medium">Likes</th>
            <th className="py-2 pr-3 text-right font-medium">Comments</th>
            <th className="py-2 pr-3 text-right font-medium">Saves</th>
            <th className="py-2 text-right font-medium">Engaged</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="border-border/60 border-b last:border-0"
            >
              <td className="max-w-[18rem] py-2 pr-3">
                <div className="grid gap-0.5">
                  {post.permalink ? (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground text-foreground/90 inline-flex items-center gap-1 truncate underline-offset-2 hover:underline"
                    >
                      <span className="truncate">
                        {shortCaption(post.caption)}
                      </span>
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <span className="truncate">
                      {shortCaption(post.caption)}
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {post.mediaType.toLowerCase().replace(/_/g, " ")} ·{" "}
                    {postDate(post.timestamp)}
                  </span>
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatExact(post.reach)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatExact(post.likes)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatExact(post.comments)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatExact(post.saved)}
              </td>
              <td className="text-muted-foreground py-2 text-right tabular-nums">
                {formatPercent(post.engagementRate, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
