/**
 * Identity Engine (Milestone 22) — Dataset readiness. Pure + deterministic.
 *
 * Rolls the dataset metrics into a single 0..100 readiness score + ★ rating + verdict + prioritized
 * gaps. "This score becomes part of the Identity." The weighting favors representation coverage, then
 * technical quality, then diversity — the three things a downstream training run cares about.
 */
import type { DatasetMetrics, DatasetRating, DatasetReadiness } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function ratingFor(score: number): DatasetRating {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

const VERDICTS: Record<DatasetRating, string> = {
  excellent: "Excellent candidate for identity training.",
  good: "Good candidate — a few more references would strengthen it.",
  fair: "Fair — add coverage and quality before training for best results.",
  poor: "Not ready — the reference set is too sparse or low-quality to train reliably.",
};

export function computeReadiness(metrics: DatasetMetrics): DatasetReadiness {
  const coverageScore = metrics.coverage.overall; // 0..100
  const qualityScore = metrics.overallQuality * 100; // 0..100
  const diversityScore =
    ((metrics.expressionDiversity + metrics.lightingDiversity + metrics.bodyVisibility) / 3) * 100;

  const score = Math.round(
    clamp(0.45 * coverageScore + 0.3 * qualityScore + 0.25 * diversityScore, 0, 100),
  );
  const stars = clamp(Math.round(score / 20), 0, 5);
  const rating = ratingFor(score);

  // Gaps: the coverage engine's prioritized suggestions first, then low dataset-level signals.
  const gaps: string[] = metrics.coverage.suggestions.slice(0, 3).map((s) => s.message);
  if (metrics.blurIncidence > 0.25) gaps.push("Several references look blurry — replace or re-shoot them.");
  if (metrics.expressionDiversity < 0.3) gaps.push("Low expression diversity — add varied expressions.");
  if (metrics.lightingDiversity < 0.3) gaps.push("Low lighting diversity — add indoor/outdoor/studio shots.");
  if (metrics.bodyVisibility < 0.3) gaps.push("Few full/upper-body references.");

  return { score, stars, rating, verdict: VERDICTS[rating], gaps };
}
