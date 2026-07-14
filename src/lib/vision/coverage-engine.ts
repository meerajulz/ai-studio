/**
 * Identity Coverage Engine (Milestone 18B) — the first CONSUMER of Identity Intelligence knowledge.
 *
 * Given an identity's normalized `IdentityMetadata[]` (18A), produce a dimensioned **coverage
 * report**: how well the reference set covers each aspect of the identity (front face, profiles,
 * back, upper/full body, hair, tattoo areas, indoor/outdoor), with star scores, confidence, missing
 * areas, and structured suggestions. Pure + deterministic + provider-neutral — it reads only
 * knowledge, never a provider. Proves the architecture can drive Smart Reference Selection and
 * Training Quality Gates BEFORE any Vision API exists.
 *
 * Scoring algorithm + assumptions are documented in docs/IDENTITY_INTELLIGENCE.md.
 */
import type { IdentityMetadata } from "./types";

export const COVERAGE_ENGINE_VERSION = "cov-1";

export type CoverageDimensionId =
  | "face-front"
  | "face-left-profile"
  | "face-right-profile"
  | "face-back"
  | "body-upper"
  | "body-full"
  | "hair"
  | "tattoo-chest"
  | "tattoo-back"
  | "tattoo-left-arm"
  | "tattoo-right-arm"
  | "tattoo-leg"
  | "env-indoor"
  | "env-outdoor";

export type CoverageStatus = "not-applicable" | "missing" | "weak" | "covered";

export type DimensionScore = {
  id: CoverageDimensionId;
  label: string;
  stars: number; // 0..5
  score: number; // 0..1 (raw)
  confidence: number; // 0..1 (quality of the best contributing image)
  imageCount: number; // usable images contributing to this dimension
  status: CoverageStatus;
};

export type CoverageSuggestion = {
  dimension: CoverageDimensionId;
  label: string;
  severity: "missing" | "weak";
  message: string;
};

export type CoverageReport = {
  version: string;
  overall: number; // 0..100 weighted coverage over applicable dimensions
  identityConfidence: number; // 0..1
  hasTattoos: boolean;
  totalImages: number;
  usableImages: number;
  dimensions: DimensionScore[];
  missing: string[]; // labels of applicable dimensions with no coverage
  weak: string[]; // labels of applicable dimensions with weak coverage
  suggestions: CoverageSuggestion[]; // prioritized (most important gaps first)
};

/** Per-image match weight in [0,1] for a dimension (0 = no contribution). */
type Matcher = (m: IdentityMetadata) => number;

type DimensionSpec = {
  label: string;
  weight: number; // importance in the overall score
  face: boolean; // face-confidence weighted?
  tattoo: boolean; // only applicable if the identity has tattoos
  match: Matcher;
};

const hasLoc = (m: IdentityMetadata, ...keywords: string[]): boolean =>
  m.tattoos.some((t) => {
    const loc = t.location.toLowerCase();
    return keywords.some((k) => loc.includes(k));
  });

/** The coverage dimensions + how each maps onto normalized knowledge. */
const DIMENSIONS: Record<CoverageDimensionId, DimensionSpec> = {
  "face-front": {
    label: "Front face", weight: 3, face: true, tattoo: false,
    match: (m) => (m.face.visible && m.face.orientation === "front" ? 1 : 0),
  },
  "face-left-profile": {
    label: "Left profile", weight: 1, face: true, tattoo: false,
    match: (m) => (m.face.orientation === "left-profile" ? 1 : m.face.orientation === "profile" ? 0.5 : 0),
  },
  "face-right-profile": {
    label: "Right profile", weight: 1, face: true, tattoo: false,
    match: (m) => (m.face.orientation === "right-profile" ? 1 : m.face.orientation === "profile" ? 0.5 : 0),
  },
  "face-back": {
    label: "Back view", weight: 1, face: false, tattoo: false,
    match: (m) => (m.face.orientation === "back" ? 1 : 0),
  },
  "body-upper": {
    label: "Upper body", weight: 2, face: false, tattoo: false,
    match: (m) => (m.body.framing === "half-body" || m.body.visibility === "upper" ? 1 : 0),
  },
  "body-full": {
    label: "Full body", weight: 3, face: false, tattoo: false,
    match: (m) => (m.body.framing === "full-body" || m.body.visibility === "full" ? 1 : 0),
  },
  hair: {
    label: "Hair", weight: 2, face: false, tattoo: false,
    match: (m) => (m.hair.visible ? 1 : 0),
  },
  "tattoo-chest": {
    label: "Chest tattoos", weight: 1, face: false, tattoo: true,
    match: (m) => (hasLoc(m, "chest") ? 1 : 0),
  },
  "tattoo-back": {
    label: "Back tattoos", weight: 1, face: false, tattoo: true,
    match: (m) => (hasLoc(m, "back") ? 1 : 0),
  },
  "tattoo-left-arm": {
    label: "Left arm tattoos", weight: 1, face: false, tattoo: true,
    match: (m) => (hasLoc(m, "left arm", "left sleeve") ? 1 : 0),
  },
  "tattoo-right-arm": {
    label: "Right arm tattoos", weight: 1, face: false, tattoo: true,
    match: (m) => (hasLoc(m, "right arm", "right sleeve") ? 1 : 0),
  },
  "tattoo-leg": {
    label: "Leg tattoos", weight: 1, face: false, tattoo: true,
    match: (m) => (hasLoc(m, "leg") ? 1 : 0),
  },
  "env-indoor": {
    label: "Indoor references", weight: 0.5, face: false, tattoo: false,
    match: (m) => (m.lighting.setting === "indoor" || m.lighting.setting === "studio" ? 1 : 0),
  },
  "env-outdoor": {
    label: "Outdoor references", weight: 0.5, face: false, tattoo: false,
    match: (m) => (m.lighting.setting === "outdoor" ? 1 : 0),
  },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function scoreDimension(
  id: CoverageDimensionId,
  spec: DimensionSpec,
  usable: IdentityMetadata[],
  applicable: boolean,
): DimensionScore {
  // Each contributing image contributes: matchWeight × quality × (faceConfidence for face dims).
  const contributions = usable
    .map((m) => {
      const w = spec.match(m);
      if (w <= 0) return null;
      const q = m.quality.overall / 100;
      const c = spec.face ? m.face.confidence : 1;
      return { value: w * q * c, quality: q * c };
    })
    .filter((x): x is { value: number; quality: number } => x !== null);

  const imageCount = contributions.length;
  const best = imageCount ? Math.max(...contributions.map((x) => x.value)) : 0; // 0..1
  const breadth = Math.min(imageCount, 3) / 3; // more angles → higher
  const score = imageCount ? clamp(best * 0.6 + breadth * 0.4, 0, 1) : 0;
  const stars = imageCount === 0 ? 0 : clamp(Math.round(score * 5), 1, 5);
  const confidence = imageCount ? Math.max(...contributions.map((x) => x.quality)) : 0;

  const status: CoverageStatus = !applicable
    ? "not-applicable"
    : stars === 0
      ? "missing"
      : stars < 3
        ? "weak"
        : "covered";

  return { id, label: spec.label, stars, score, confidence, imageCount, status };
}

/**
 * Analyse an identity's coverage from its normalized image knowledge. `totalImages` lets callers
 * report "analyzed X of Y" when some images aren't analyzed yet.
 */
export function analyzeIdentityCoverage(
  metadatas: IdentityMetadata[],
  totalImages: number = metadatas.length,
): CoverageReport {
  const usable = metadatas.filter((m) => m.quality.usable);
  const hasTattoos = metadatas.some((m) => m.tattoos.length > 0);

  const dimensions: DimensionScore[] = (
    Object.entries(DIMENSIONS) as [CoverageDimensionId, DimensionSpec][]
  ).map(([id, spec]) => {
    // Tattoo dimensions only apply if the identity is observed to have tattoos at all — otherwise
    // "missing back tattoo" would be a false gap for a person with no tattoos (documented assumption).
    const applicable = spec.tattoo ? hasTattoos : true;
    return scoreDimension(id, spec, usable, applicable);
  });

  const applicable = dimensions.filter((d) => d.status !== "not-applicable");
  const weightOf = (d: DimensionScore) => DIMENSIONS[d.id].weight;
  const totalWeight = applicable.reduce((s, d) => s + weightOf(d), 0) || 1;
  const overall = Math.round(
    (applicable.reduce((s, d) => s + weightOf(d) * d.score, 0) / totalWeight) * 100,
  );
  const identityConfidence = applicable.length
    ? applicable.reduce((s, d) => s + d.confidence, 0) / applicable.length
    : 0;

  const missing = applicable.filter((d) => d.status === "missing").map((d) => d.label);
  const weak = applicable.filter((d) => d.status === "weak").map((d) => d.label);

  // Suggestions: most important gaps first (weight desc, then fewest stars).
  const suggestions: CoverageSuggestion[] = applicable
    .filter((d) => d.status === "missing" || d.status === "weak")
    .sort((a, b) => weightOf(b) - weightOf(a) || a.stars - b.stars)
    .map((d) => ({
      dimension: d.id,
      label: d.label,
      severity: d.status === "missing" ? "missing" : "weak",
      message:
        d.status === "missing"
          ? `Add a ${d.label.toLowerCase()} reference${DIMENSIONS[d.id].tattoo ? " (if applicable)" : ""}.`
          : `Add more or higher-quality ${d.label.toLowerCase()} references.`,
    }));

  return {
    version: COVERAGE_ENGINE_VERSION,
    overall,
    identityConfidence,
    hasTattoos,
    totalImages,
    usableImages: usable.length,
    dimensions,
    missing,
    weak,
    suggestions,
  };
}

/** Small helper: render a 0..5 score as filled/empty stars (for debug / verification / future UI). */
export function renderStars(stars: number): string {
  const n = clamp(Math.round(stars), 0, 5);
  return "★".repeat(n) + "☆".repeat(5 - n);
}
