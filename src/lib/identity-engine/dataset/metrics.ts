/**
 * Identity Engine (Milestone 22) — Dataset metrics. Pure + deterministic + provider-neutral.
 *
 * Reuses `analyzeIdentityCoverage` (the 18B coverage engine) for representation coverage, then adds
 * diversity + technical-quality signals (expression / hairstyle / lighting diversity, body
 * visibility, blur incidence, near-duplicates). No heavy ML — everything is read from the persisted
 * `IdentityMetadata`. Duplicate detection is designed but deferred (needs embeddings / pHash).
 */
import { analyzeIdentityCoverage, type IdentityMetadata } from "@/lib/vision";
import {
  DATASET_METRICS_VERSION,
  type DatasetMetrics,
  type DuplicateReport,
} from "./types";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const frac = (n: number, d: number) => (d > 0 ? n / d : 0);

/** Diversity of a categorical signal: distinct observed values / an expected variety ceiling. */
function diversity(values: string[], ceiling: number): number {
  const distinct = new Set(values.filter((v) => v && v !== "unknown")).size;
  return clamp01(frac(distinct, ceiling));
}

/** A compact signature of an image's facial expression (for expression diversity). */
function expressionKey(m: IdentityMetadata): string {
  const e = m.face.expression;
  if (!m.face.visible) return "";
  return [
    e.smiling ? "smile" : "",
    e.laughing ? "laugh" : "",
    e.serious ? "serious" : "",
    e.mouthOpen ? "open" : "",
    e.eyesClosed ? "closed" : "",
    e.lookingAway ? "away" : "look",
  ]
    .filter(Boolean)
    .join("-");
}

/** A compact signature of a hairstyle (for hairstyle coverage/diversity). */
function hairKey(m: IdentityMetadata): string {
  if (!m.hair.visible) return "";
  return [m.hair.length, m.hair.texture, m.hair.updo, m.hair.parting]
    .filter((v) => v && v !== "unknown")
    .join("-");
}

export function computeDatasetMetrics(
  metadatas: IdentityMetadata[],
  totalImages: number = metadatas.length,
): DatasetMetrics {
  const coverage = analyzeIdentityCoverage(metadatas, totalImages);
  const usable = metadatas.filter((m) => m.quality.usable);
  const n = usable.length;

  const frontal = usable.filter((m) => m.face.visible && m.face.orientation === "front").length;
  const profile = usable.filter((m) =>
    ["profile", "left-profile", "right-profile"].includes(m.face.orientation),
  ).length;
  const fullOrUpper = usable.filter(
    (m) =>
      m.body.framing === "full-body" ||
      m.body.framing === "half-body" ||
      m.body.visibility === "full" ||
      m.body.visibility === "upper",
  ).length;

  const hasTattoos = metadatas.some((m) => m.tattoos.length > 0);
  // Tattoo visibility = average of the coverage engine's tattoo dimension scores (0 when none).
  const tattooDims = coverage.dimensions.filter((d) => d.id.startsWith("tattoo-") && d.status !== "not-applicable");
  const tattooVisibility = hasTattoos && tattooDims.length
    ? clamp01(tattooDims.reduce((s, d) => s + d.score, 0) / tattooDims.length)
    : 0;

  const sharpnessMean = n ? usable.reduce((s, m) => s + (m.quality.sharpness ?? 0), 0) / n : 0;
  const blurIncidence = n ? frac(usable.filter((m) => (m.quality.sharpness ?? 1) < 0.5).length, n) : 0;
  const overallQuality = n ? usable.reduce((s, m) => s + (m.quality.overall ?? 0), 0) / n / 100 : 0;

  // Duplicate detection is designed but not implemented — requires embeddings / perceptual hash.
  const duplicates: DuplicateReport = { method: "none", count: 0, pairs: [] };

  return {
    version: DATASET_METRICS_VERSION,
    coverage,
    frontalFaceCoverage: clamp01(frac(frontal, Math.max(1, n))),
    sideProfileCoverage: clamp01(frac(profile, Math.max(1, n))),
    expressionDiversity: diversity(usable.map(expressionKey), 5),
    hairstyleCoverage: diversity(usable.map(hairKey), 3),
    tattooVisibility,
    lightingDiversity: diversity(
      usable.map((m) => `${m.lighting.setting}/${m.lighting.quality}`),
      4,
    ),
    bodyVisibility: clamp01(frac(fullOrUpper, Math.max(1, n))),
    sharpness: clamp01(sharpnessMean),
    blurIncidence: clamp01(blurIncidence),
    duplicates,
    overallQuality: clamp01(overallQuality),
  };
}
