/**
 * Multi-anchor aggregation (M27 follow-up) — PURE, no I/O. Folds the per-anchor similarities of ONE
 * generated image into a single headline score + the full distribution.
 *
 * WHY: a good generation often resembles ONE real photo far more than another (a smiling output matches a
 * smiling anchor, not a neutral one). Averaging every anchor, or trusting a single anchor, unfairly
 * penalizes it. So we compute EVERY aggregate (mean / median / max / topK) and expose them; the headline
 * is a NAMED, swappable strategy so we can decide which one to trust from measured distributions
 * (`scripts/benchmark-auraface.ts`) instead of guessing. Default = `topKMean`, which reproduces the
 * pre-change score EXACTLY — this is a measurement/expressiveness change, not a behavioral one.
 */

export type AnchorAggregate = {
  count: number; // anchors actually compared
  mean: number; // average across ALL anchors
  median: number;
  max: number; // best-matching anchor (the "does it look like ANY real photo of them" signal)
  min: number; // worst-matching anchor
  topKMean: number; // average of the strongest K — robust to one weak anchor, ignores the tail
  k: number; // the K used for topKMean
};

/** How the single headline score is chosen from the distribution. `topKMean` = current behavior. */
export type AggregationStrategy = "topKMean" | "mean" | "median" | "max";

/** The default — reproduces the legacy top-K mean so switching in this module changes nothing yet. */
export const DEFAULT_STRATEGY: AggregationStrategy = "topKMean";

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Compute every aggregate over anchor similarities. `sims` must be non-empty; `k` ≥ 1. */
export function aggregateSims(sims: number[], k: number): AnchorAggregate {
  const desc = [...sims].sort((a, b) => b - a);
  const top = desc.slice(0, Math.max(1, Math.min(k, desc.length)));
  return {
    count: sims.length,
    mean: mean(sims),
    median: median(sims),
    max: desc[0],
    min: desc[desc.length - 1],
    topKMean: mean(top),
    k: top.length,
  };
}

/** Pick the headline score from the distribution per the chosen strategy. PURE. */
export function headlineScore(agg: AnchorAggregate, strategy: AggregationStrategy = DEFAULT_STRATEGY): number {
  switch (strategy) {
    case "mean":
      return agg.mean;
    case "median":
      return agg.median;
    case "max":
      return agg.max;
    case "topKMean":
    default:
      return agg.topKMean;
  }
}
