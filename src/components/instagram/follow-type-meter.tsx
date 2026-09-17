import type { FollowTypeReach } from "@/lib/instagram/types";
import { cn } from "@/lib/utils";
import { formatExact, formatPercent } from "./format";

type FollowTypeMeterProps = {
  data: FollowTypeReach;
  className?: string;
};

/**
 * Reach split into followers vs non-followers — the honest answer to "are strangers seeing
 * my account". It is a COUNT, not a visitor list: Instagram exposes no identity for reach.
 *
 * Two series, so the legend is always present and both segments carry a direct value. The
 * series colors are achromatic here, so identity never rests on hue.
 */
export function FollowTypeMeter({ data, className }: FollowTypeMeterProps) {
  const total = data.follower + data.nonFollower;
  const nonFollowerPercent = total > 0 ? (data.nonFollower / total) * 100 : 0;

  const segments = [
    {
      key: "non-follower",
      name: "Non-followers",
      value: data.nonFollower,
      percent: nonFollowerPercent,
      color: "var(--series-1)",
    },
    {
      key: "follower",
      name: "Followers",
      value: data.follower,
      percent: 100 - nonFollowerPercent,
      color: "var(--series-2)",
    },
  ];

  return (
    <div className={cn("grid gap-3", className)}>
      {total > 0 ? (
        // 2px of surface between the segments — the same gap used between columns.
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${Math.max(segment.percent, segment.value > 0 ? 1 : 0)}%`,
                backgroundColor: segment.color,
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className="h-3 w-full rounded-full"
          style={{ backgroundColor: "var(--series-track)" }}
        />
      )}

      {/* Legend + direct values. Text wears text tokens; the swatch beside it carries identity. */}
      <dl className="grid grid-cols-2 gap-3">
        {segments.map((segment) => (
          <div key={segment.key} className="grid gap-1">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.name}
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {formatExact(segment.value)}
              <span className="text-muted-foreground ml-1.5 font-normal">
                {formatPercent(total > 0 ? segment.value / total : null)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
