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
import type { IdentityMetadata, TattooRegion } from "./types";

export const COVERAGE_ENGINE_VERSION = "cov-2";

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
  | "tattoo-abdomen"
  | "tattoo-leg"
  | "tattoo-neck"
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

/**
 * How well ONE image represents a dimension:
 *   • `strength` (0..1) — how strongly the image depicts this aspect (front = 1, generic profile = 0.5…)
 *   • `confidence` (0..1) — how sure we are it's really there (face confidence, the matched tattoo's
 *     confidence, etc.). A clearly-visible aspect has high confidence → high stars. See scoreDimension.
 */
type DimMatch = { strength: number; confidence: number };
type Matcher = (m: IdentityMetadata) => DimMatch;

type DimensionSpec = {
  label: string;
  weight: number; // importance in the overall score
  tattoo: boolean; // only applicable if the identity has tattoos
  match: Matcher;
};

const NO: DimMatch = { strength: 0, confidence: 0 };
const hit = (strength: number, confidence: number): DimMatch => ({ strength, confidence });

/** Match tattoos by NORMALIZED region (19A). Confidence = the most confident matching tattoo. */
const tattooIn = (m: IdentityMetadata, regions: TattooRegion[]): DimMatch => {
  const hits = m.tattoos.filter((t) => regions.includes(t.region));
  return hits.length ? hit(1, Math.max(...hits.map((t) => t.confidence))) : NO;
};

/** Confidence a provider attaches to an attribute, with a sensible default when it gave none. */
const attrConf = (m: IdentityMetadata, key: string, fallback: number): number =>
  typeof m.attributeConfidence[key] === "number" ? m.attributeConfidence[key] : fallback;

/** The coverage dimensions + how each maps onto normalized knowledge. */
const DIMENSIONS: Record<CoverageDimensionId, DimensionSpec> = {
  "face-front": {
    label: "Front face", weight: 3, tattoo: false,
    match: (m) => (m.face.visible && m.face.orientation === "front" ? hit(1, m.face.confidence) : NO),
  },
  "face-left-profile": {
    label: "Left profile", weight: 1, tattoo: false,
    match: (m) =>
      m.face.orientation === "left-profile"
        ? hit(1, m.face.confidence)
        : m.face.orientation === "profile"
          ? hit(0.5, m.face.confidence)
          : NO,
  },
  "face-right-profile": {
    label: "Right profile", weight: 1, tattoo: false,
    match: (m) =>
      m.face.orientation === "right-profile"
        ? hit(1, m.face.confidence)
        : m.face.orientation === "profile"
          ? hit(0.5, m.face.confidence)
          : NO,
  },
  "face-back": {
    label: "Back view", weight: 1, tattoo: false,
    match: (m) => (m.face.orientation === "back" ? hit(1, 0.9) : NO),
  },
  "body-upper": {
    label: "Upper body", weight: 2, tattoo: false,
    match: (m) =>
      m.body.framing === "half-body" || m.body.visibility === "upper"
        ? hit(1, attrConf(m, "framing", 0.9))
        : NO,
  },
  "body-full": {
    label: "Full body", weight: 3, tattoo: false,
    match: (m) =>
      m.body.framing === "full-body" || m.body.visibility === "full"
        ? hit(1, attrConf(m, "framing", 0.9))
        : NO,
  },
  hair: {
    label: "Hair", weight: 2, tattoo: false,
    match: (m) => (m.hair.visible ? hit(1, attrConf(m, "hairColor", 0.9)) : NO),
  },
  "tattoo-chest": {
    label: "Chest tattoos", weight: 1, tattoo: true,
    match: (m) => tattooIn(m, ["chest", "chest-left", "chest-right"]),
  },
  "tattoo-back": {
    label: "Back tattoos", weight: 1, tattoo: true,
    match: (m) => tattooIn(m, ["back", "upper-back", "lower-back"]),
  },
  "tattoo-left-arm": {
    label: "Left arm tattoos", weight: 1, tattoo: true,
    match: (m) => tattooIn(m, ["left-shoulder", "left-upper-arm", "left-forearm", "left-hand"]),
  },
  "tattoo-right-arm": {
    label: "Right arm tattoos", weight: 1, tattoo: true,
    match: (m) => tattooIn(m, ["right-shoulder", "right-upper-arm", "right-forearm", "right-hand"]),
  },
  "tattoo-abdomen": {
    label: "Abdomen / hip tattoos", weight: 1, tattoo: true,
    match: (m) => tattooIn(m, ["abdomen", "hip"]),
  },
  "tattoo-leg": {
    label: "Leg tattoos", weight: 1, tattoo: true,
    match: (m) => tattooIn(m, ["left-thigh", "right-thigh", "left-calf", "right-calf", "feet"]),
  },
  "tattoo-neck": {
    label: "Neck tattoos", weight: 0.5, tattoo: true,
    match: (m) => tattooIn(m, ["neck"]),
  },
  "env-indoor": {
    label: "Indoor references", weight: 0.5, tattoo: false,
    match: (m) =>
      m.lighting.setting === "indoor" || m.lighting.setting === "studio"
        ? hit(1, attrConf(m, "lightingSetting", 0.8))
        : NO,
  },
  "env-outdoor": {
    label: "Outdoor references", weight: 0.5, tattoo: false,
    match: (m) => (m.lighting.setting === "outdoor" ? hit(1, attrConf(m, "lightingSetting", 0.8)) : NO),
  },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function scoreDimension(
  id: CoverageDimensionId,
  spec: DimensionSpec,
  usable: IdentityMetadata[],
  applicable: boolean,
): DimensionScore {
  // Per image: presence = how strongly + how confidently it depicts the dimension; the technical
  // quality is a RAMP (full credit at overall ≥ 70, scaling down below), never a hard multiplier.
  const contributions = usable
    .map((m) => {
      const { strength, confidence } = spec.match(m);
      if (strength <= 0) return null;
      const qualityFactor = clamp(m.quality.overall / 70, 0, 1);
      const presence = strength * confidence;
      return { best: presence * qualityFactor, confidence };
    })
    .filter((x): x is { best: number; confidence: number } => x !== null);

  const imageCount = contributions.length;
  const best = imageCount ? Math.max(...contributions.map((x) => x.best)) : 0; // 0..1
  // Breadth is a BONUS for extra angles, never a penalty against one strong image (19A rescoring):
  // one perfect image already ≈ full score; more images only lift a weak `best` toward 1.
  const breadthBonus = (Math.min(Math.max(imageCount - 1, 0), 2) / 2) * 0.25;
  const score = imageCount ? clamp(best + (1 - best) * breadthBonus, 0, 1) : 0;
  const stars = imageCount === 0 ? 0 : clamp(Math.round(score * 5), 1, 5);
  const confidence = imageCount ? Math.max(...contributions.map((x) => x.confidence)) : 0;

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
