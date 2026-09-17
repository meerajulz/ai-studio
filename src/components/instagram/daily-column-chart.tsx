"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { DailyPoint } from "@/lib/instagram/types";
import { formatCount, formatDayLabel, formatExact } from "./format";

type DailyColumnChartProps = {
  points: DailyPoint[];
  /** Names the single series — the chart has no legend, so this has to say what is plotted. */
  label: string;
  className?: string;
};

/** Round a max up to a clean axis top: 1,000 / 2,500 / 40,000. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

/**
 * One metric, one column per day.
 *
 * A single series, so there is no legend (the caller's title names it) and no second axis —
 * a second metric gets its own chart rather than a second scale. Only the peak is directly
 * labeled; every other value lives in the hover tooltip and the axis ticks.
 */
export function DailyColumnChart({
  points,
  label,
  className,
}: DailyColumnChartProps) {
  const [active, setActive] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm",
          className,
        )}
      >
        No {label.toLowerCase()} data for this range.
      </div>
    );
  }

  const max = Math.max(...points.map((point) => point.value));
  const axisMax = niceMax(max);
  const peakIndex = points.findIndex((point) => point.value === max);
  const ticks = [axisMax, axisMax / 2, 0];

  // With many days, labelling every column collides — show roughly six.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const activePoint = active === null ? null : points[active];

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex gap-3">
        {/* Y axis — carries the values that aren't directly labeled. */}
        <div className="text-muted-foreground flex h-48 w-10 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums">
          {ticks.map((tick) => (
            <span key={tick}>{formatCount(Math.round(tick))}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Hairline gridlines, one step off the surface and deliberately recessive. */}
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col justify-between"
          >
            {ticks.map((tick) => (
              <div key={tick} className="border-border border-t" />
            ))}
          </div>

          {/* 2px of surface separates touching columns — the gap does the dividing, not a stroke. */}
          <div
            className="relative flex h-48 items-end gap-[2px]"
            onMouseLeave={() => setActive(null)}
          >
            {points.map((point, index) => {
              const heightPercent =
                axisMax > 0 ? (point.value / axisMax) * 100 : 0;
              const isActive = active === index;
              return (
                <div
                  key={point.date}
                  className="group/column relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatDayLabel(point.date)}: ${formatExact(point.value)} ${label.toLowerCase()}`}
                >
                  {index === peakIndex && max > 0 ? (
                    <span className="text-foreground pointer-events-none absolute -top-1 text-[11px] font-medium tabular-nums">
                      {formatCount(point.value)}
                    </span>
                  ) : null}
                  <div
                    className="w-full max-w-6 rounded-t-[4px] transition-opacity"
                    style={{
                      height: `${Math.max(heightPercent, point.value > 0 ? 1.5 : 0)}%`,
                      backgroundColor: "var(--series-1)",
                      opacity: active === null || isActive ? 1 : 0.55,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {activePoint ? (
            <div className="bg-popover text-popover-foreground ring-foreground/10 pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-md px-2 py-1 text-xs shadow-sm ring-1">
              <span className="text-muted-foreground">
                {formatDayLabel(activePoint.date)}
              </span>{" "}
              <span className="font-medium tabular-nums">
                {formatExact(activePoint.value)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* X axis */}
      <div className="text-muted-foreground flex gap-[2px] pl-13 text-[11px]">
        {points.map((point, index) => (
          // The slot is one column wide, so a label is centred over it and allowed to
          // overflow — truncating inside the slot would clip every date to "A…".
          <span key={point.date} className="relative h-4 flex-1">
            {index % labelEvery === 0 ? (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                {formatDayLabel(point.date)}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
