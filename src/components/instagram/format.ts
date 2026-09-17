/** Shared number/date formatting for the Insights dashboard. */

/** Compact for display: 1,284 / 12.9K / 4.2M. */
export function formatCount(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString("en-US");
}

/** Exact, thousands-separated — for tables and tooltips where the real number matters. */
export function formatExact(value: number): string {
  return value.toLocaleString("en-US");
}

/** A 0–1 ratio as a percentage. */
export function formatPercent(value: number | null, digits = 0): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** ISO `YYYY-MM-DD` as a short axis/tooltip label, e.g. "Sep 3". */
export function formatDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
