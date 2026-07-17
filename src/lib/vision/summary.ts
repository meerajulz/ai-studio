/**
 * Media knowledge summaries (Milestone 20 hardening) — turn persisted Vision knowledge into
 * display-ready shapes for the Training Media page, so users can see what the system learned about
 * each image WITHOUT opening the developer `/debug/vision`. Pure + deterministic; reads only the
 * frozen `im-2` knowledge (never calls a provider).
 */
import { analyzeIdentityCoverage, type DimensionScore } from "./coverage-engine";
import { classifyExposure, type ExposureLevel } from "./exposure";
import type { IdentityImageScore } from "./image-score";
import type { IdentityMetadata } from "./types";

/** Compact per-image summary rendered on a training-media card. */
export type MediaKnowledgeSummary = {
  overallScore: number; // 0..100 image score
  usable: boolean;
  heroSuitability: number; // 0..100
  suitability: { face: number; body: number; tattoo: number; hair: number; expression: number };
  covered: string[]; // dimension labels covered by THIS image (e.g. "Front face", "Leg tattoos")
  hair: string | null; // "Pink · long · wavy"
  environment: string | null; // "Indoor"
  exposure: ExposureLevel; // Reference Safety class (clothed/swimwear/lingerie/nude)
  provider: string;
  model: string;
  version: string;
  analyzedAt: string; // ISO
};

/** Full per-image knowledge for the expand panel (summary + the raw knowledge + coverage rows). */
export type MediaKnowledgeDetail = {
  summary: MediaKnowledgeSummary;
  metadata: IdentityMetadata;
  score: IdentityImageScore;
  coverage: DimensionScore[]; // single-image coverage contribution
};

const pct = (v: number) => Math.round(v * 100);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type KnowledgeSource = { provider: string; model: string; version: string; analyzedAt: Date | string };

export function summarizeMediaKnowledge(
  metadata: IdentityMetadata,
  score: IdentityImageScore,
  source: KnowledgeSource,
): MediaKnowledgeSummary {
  const s = metadata.referenceSuitability;
  const coverage = analyzeIdentityCoverage([metadata]);
  const covered = coverage.dimensions.filter((d) => d.status === "covered").map((d) => d.label);

  const hairWords = [metadata.hair.color, metadata.hair.length, metadata.hair.texture].filter(
    (x): x is string => Boolean(x) && x !== "unknown",
  );
  const environment =
    metadata.lighting.setting !== "unknown" ? cap(metadata.lighting.setting) : metadata.environment;

  return {
    overallScore: score.overall,
    usable: metadata.quality.usable,
    heroSuitability: pct(s.hero),
    suitability: {
      face: pct(s.faceReference),
      body: pct(s.bodyReference),
      tattoo: pct(s.tattooReference),
      hair: pct(s.hairstyleReference),
      expression: pct(s.expressionReference),
    },
    covered,
    hair: hairWords.length ? hairWords.map(cap).join(" · ") : null,
    environment,
    exposure: classifyExposure(metadata),
    provider: source.provider,
    model: source.model,
    version: source.version,
    analyzedAt: typeof source.analyzedAt === "string" ? source.analyzedAt : source.analyzedAt.toISOString(),
  };
}

/** Build the full detail (used by the expand panel). */
export function buildMediaKnowledgeDetail(
  metadata: IdentityMetadata,
  score: IdentityImageScore,
  source: KnowledgeSource,
): MediaKnowledgeDetail {
  return {
    summary: summarizeMediaKnowledge(metadata, score, source),
    metadata,
    score,
    coverage: analyzeIdentityCoverage([metadata]).dimensions,
  };
}
