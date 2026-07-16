/**
 * Observations → Knowledge (Milestone 18A spine; enriched in 19A).
 *
 * A `VisionProvider` describes an image (loose `VisionObservation`). AI Studio does NOT store that —
 * it normalizes the observation into strict, provider-neutral `IdentityMetadata` knowledge. Pure +
 * deterministic; no I/O, no provider SDKs. Any provider's output flows through here, so swapping
 * providers never changes what AI Studio stores. See docs/IDENTITY_INTELLIGENCE.md.
 *
 * 19A enriches the model: a normalized tattoo-region taxonomy, structured body visibility, richer
 * face expression + per-component face quality, richer hair, and per-facet reference suitability.
 * Where a provider omits a signal, we DERIVE a deterministic fallback from what we do know — so every
 * field is always populated and provider-independent.
 */
import {
  IDENTITY_METADATA_VERSION,
  type BodyRegion,
  type BodyVisibility,
  type FaceExpression,
  type FaceOrientation,
  type FacePose,
  type FaceQuality,
  type Framing,
  type HairLength,
  type HairParting,
  type HairTexture,
  type HairUpdo,
  type IdentityMetadata,
  type ImageEmbedding,
  type ImageQuality,
  type LightingQuality,
  type LightingSetting,
  type ReferenceSuitability,
  type TattooKnowledge,
  type TattooRegion,
  type VisionObservation,
} from "./types";

// ── safe readers over the loose observation bags ─────────────────────────────
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const bool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
const clamp01 = (v: unknown, d = 0): number =>
  typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : d;
const numRaw = (v: unknown, d = 0): number =>
  typeof v === "number" && !Number.isNaN(v) ? v : d;
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const round = (v: number) => Math.round(v);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const ORIENTATIONS = [
  "front",
  "three-quarter",
  "left-profile",
  "right-profile",
  "profile",
  "back",
  "unknown",
] as const;
const FRAMINGS = ["headshot", "half-body", "full-body", "unknown"] as const;
const BODY_VIS = ["face", "upper", "full", "unknown"] as const;
const HAIR_LEN = ["short", "medium", "long", "unknown"] as const;
const HAIR_TEX = ["straight", "wavy", "curly", "unknown"] as const;
const HAIR_PART = ["center", "side", "none", "unknown"] as const;
const HAIR_UPDO = ["loose", "tied-back", "ponytail", "bun", "unknown"] as const;
const LIGHT_SET = ["indoor", "outdoor", "studio", "unknown"] as const;
const LIGHT_QUAL = ["soft", "harsh", "backlit", "even", "unknown"] as const;
const BODY_REGIONS = [
  "head",
  "neck",
  "shoulders",
  "torso",
  "waist",
  "hips",
  "arms",
  "hands",
  "legs",
  "feet",
] as const;

function toEmbedding(vector: number[] | null | undefined, model: string): ImageEmbedding {
  return vector && vector.length ? { model, dims: vector.length, vector } : null;
}

// ── Tattoo region taxonomy ───────────────────────────────────────────────────
/**
 * Map a provider's free-text tattoo location onto ONE canonical `TattooRegion`. Ordered
 * most-specific-first; a limb region with an unknown side falls back to `other` rather than guessing.
 */
export function toTattooRegion(location: string): TattooRegion {
  const s = location.toLowerCase();
  const side: "left" | "right" | null = /\bleft\b|\bl\b/.test(s)
    ? "left"
    : /\bright\b|\br\b/.test(s)
      ? "right"
      : null;
  const sided = <T extends string>(l: T, r: T): TattooRegion =>
    side === "left" ? (l as TattooRegion) : side === "right" ? (r as TattooRegion) : "other";

  // Arms / hands (check hand + forearm + shoulder before generic "arm"/"sleeve").
  if (/\bhand|knuckle|finger\b/.test(s)) return sided("left-hand", "right-hand");
  if (/fore ?arm|lower arm|wrist/.test(s)) return sided("left-forearm", "right-forearm");
  if (/shoulder|deltoid/.test(s)) return sided("left-shoulder", "right-shoulder");
  if (/upper arm|bicep|tricep|sleeve|\barm\b/.test(s)) return sided("left-upper-arm", "right-upper-arm");

  // Torso.
  if (/chest|sternum|pec|breast/.test(s)) {
    return side === "left" ? "chest-left" : side === "right" ? "chest-right" : "chest";
  }
  if (/abdomen|stomach|belly|torso|rib|midriff|navel/.test(s)) return "abdomen";
  if (/hip|pelvi|groin/.test(s)) return "hip";
  if (/upper back|shoulder blade|nape|trapez/.test(s)) return "upper-back";
  if (/lower back|lumbar/.test(s)) return "lower-back";
  if (/\bback\b|spine/.test(s)) return "back";
  if (/neck|throat/.test(s)) return "neck";

  // Legs / feet.
  if (/thigh|quad/.test(s)) return sided("left-thigh", "right-thigh");
  if (/calf|shin|lower leg/.test(s)) return sided("left-calf", "right-calf");
  if (/foot|feet|ankle|toe/.test(s)) return "feet";
  if (/\bleg\b/.test(s)) return sided("left-thigh", "right-thigh");

  return "other";
}

function toTattoos(v: unknown): TattooKnowledge[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t) => {
      if (typeof t === "string") {
        return { location: t, region: toTattooRegion(t), description: null, confidence: 1 };
      }
      const r = rec(t);
      // Gemini may key the area as `location` or `region`.
      const location = str(r.location) ?? str(r.region);
      if (!location) return null;
      // Prefer an explicit provider-supplied canonical region; else normalize the free text.
      const explicit = oneOf<TattooRegion>(r.region, TATTOO_REGION_VALUES, "other");
      const region = explicit !== "other" ? explicit : toTattooRegion(location);
      return {
        location,
        region,
        description: str(r.description),
        confidence: clamp01(r.confidence, 1),
      };
    })
    .filter((t): t is TattooKnowledge => t !== null);
}

const TATTOO_REGION_VALUES = [
  "left-shoulder", "left-upper-arm", "left-forearm", "left-hand",
  "right-shoulder", "right-upper-arm", "right-forearm", "right-hand",
  "chest-left", "chest-right", "chest", "abdomen", "hip",
  "upper-back", "lower-back", "back", "neck",
  "left-thigh", "right-thigh", "left-calf", "right-calf", "feet", "other",
] as const;

/** Read a provider `confidence` bag into a clean {attribute: 0..1} map. */
function toConfidenceMap(v: unknown): Record<string, number> {
  const src = rec(v);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(src)) {
    if (typeof val === "number") out[k] = clamp01(val);
  }
  return out;
}

/**
 * Deterministic technical-quality composite (0..100) + a usability gate. `aesthetic` is optional;
 * when absent we NORMALIZE over the present weights instead of scoring it 0 (19A fix — otherwise a
 * sharp, well-exposed, face-visible photo was capped at ~90 before it started).
 */
function toQuality(q: Record<string, unknown>): ImageQuality {
  const sharpness = clamp01(q.sharpness, 0);
  const exposure = clamp01(q.exposure, 0.5);
  const faceVisible = bool(q.faceVisible, false);
  const occlusion = bool(q.occlusion, false);
  const cropped = bool(q.cropped, false);
  const aesthetic = typeof q.aesthetic === "number" ? clamp01(q.aesthetic) : null;
  const resW = typeof q.width === "number" ? q.width : null;
  const resH = typeof q.height === "number" ? q.height : null;

  const parts: [value: number, weight: number][] = [
    [sharpness, 0.45],
    [exposure, 0.25],
    [faceVisible ? 1 : 0, 0.2],
  ];
  if (aesthetic !== null) parts.push([aesthetic, 0.1]);
  const totalWeight = parts.reduce((s, [, w]) => s + w, 0);
  const overall = Math.round(
    (parts.reduce((s, [v, w]) => s + v * w, 0) / totalWeight) * 100,
  );

  const issues: string[] = [];
  if (sharpness < 0.4) issues.push("low sharpness / blurry");
  if (exposure < 0.3 || exposure > 0.9) issues.push("poor exposure");
  if (!faceVisible) issues.push("face not clearly visible");
  if (occlusion) issues.push("subject occluded");
  if (cropped) issues.push("important body parts cropped");

  const usable = overall >= 50 && !occlusion && !cropped;

  return {
    sharpness,
    exposure,
    faceVisible,
    occlusion,
    cropped,
    resolution: resW && resH ? { width: resW, height: resH } : null,
    aesthetic,
    overall,
    usable,
    issues,
  };
}

/** Derive a coarse orientation from a head-yaw angle (degrees) when the provider gives only pose. */
function orientationFromYaw(yaw: number): FaceOrientation {
  const a = Math.abs(yaw);
  if (a <= 20) return "front";
  if (a <= 55) return "three-quarter";
  return yaw < 0 ? "left-profile" : "right-profile";
}

/** How dead-on the face is (1 = front). Prefers a real yaw angle; else maps the orientation. */
function frontalnessOf(orientation: FaceOrientation, pose: FacePose | null): number {
  if (pose && (pose.yaw !== 0 || orientation !== "unknown")) {
    return clamp(1 - Math.min(1, Math.abs(pose.yaw) / 90), 0, 1);
  }
  const byOrientation: Record<FaceOrientation, number> = {
    front: 1,
    "three-quarter": 0.6,
    "left-profile": 0.2,
    "right-profile": 0.2,
    profile: 0.2,
    back: 0,
    unknown: 0.5,
  };
  return byOrientation[orientation];
}

// ── Structured expression / gaze ─────────────────────────────────────────────
function toFaceExpression(
  a: Record<string, unknown>,
  orientation: FaceOrientation,
  eyesVisible: boolean,
): FaceExpression {
  const e = rec(a.faceExpression);
  const read = (k: string, d = false) => bool(e[k], bool(a[k], d));
  const smiling = read("smiling");
  const laughing = read("laughing");
  const mouthOpen = read("mouthOpen", laughing);
  // Default gaze from orientation when the provider is silent.
  const lookingAtCamera = "lookingAtCamera" in e || "lookingAtCamera" in a
    ? read("lookingAtCamera")
    : orientation === "front" && eyesVisible;
  return {
    smiling,
    teethVisible: read("teethVisible", laughing),
    laughing,
    mouthOpen,
    eyesClosed: read("eyesClosed", !eyesVisible),
    lookingAtCamera,
    lookingAway: "lookingAway" in e || "lookingAway" in a ? read("lookingAway") : !lookingAtCamera && eyesVisible,
    squinting: read("squinting"),
    serious: read("serious", !smiling && !laughing && !mouthOpen),
  };
}

// ── Per-component face quality (overall is DERIVED) ──────────────────────────
// 19C — unknown vs zero: return `null` (UNAVAILABLE) when there's no face to measure, never zeros.
function deriveFaceQuality(
  a: Record<string, unknown>,
  q: ImageQuality,
  orientation: FaceOrientation,
  pose: FacePose | null,
  framing: Framing,
  faceVisible: boolean,
  eyesVisible: boolean,
): FaceQuality | null {
  if (!faceVisible) return null;
  const frontalness = frontalnessOf(orientation, pose);
  const sharpness = q.sharpness;
  const lighting =
    typeof a.faceLighting === "number"
      ? clamp01(a.faceLighting)
      : clamp(1 - Math.min(1, Math.abs(q.exposure - 0.6) / 0.6), 0, 1);
  const occlusion =
    typeof a.faceOcclusion === "number" ? clamp01(a.faceOcclusion) : q.occlusion ? 0.6 : 0;
  const symmetry =
    typeof a.faceSymmetry === "number" ? clamp01(a.faceSymmetry) : 0.4 + 0.6 * frontalness;
  const eyeVisibility = eyesVisible ? 1 : 0;
  // No face bbox available → approximate the face's pixel share from framing.
  const resolution =
    typeof a.faceResolution === "number"
      ? clamp01(a.faceResolution)
      : { headshot: 1, "half-body": 0.6, "full-body": 0.35, unknown: 0.55 }[framing];

  const overall = clamp(
    sharpness * 0.25 +
      lighting * 0.15 +
      (1 - occlusion) * 0.15 +
      symmetry * 0.1 +
      frontalness * 0.2 +
      eyeVisibility * 0.1 +
      resolution * 0.05,
    0,
    1,
  );
  return { sharpness, lighting, occlusion, symmetry, frontalness, eyeVisibility, resolution, overall };
}

// ── Structured body visibility ───────────────────────────────────────────────
function toVisibleRegions(
  v: unknown,
  framing: Framing,
  visibility: BodyVisibility,
): BodyRegion[] {
  const explicit = strArr(v)
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is BodyRegion => (BODY_REGIONS as readonly string[]).includes(s));
  if (explicit.length) return [...new Set(explicit)];
  // Derive from framing / visibility when the provider gives no list.
  const full: BodyRegion[] = [...BODY_REGIONS];
  const upper: BodyRegion[] = ["head", "neck", "shoulders", "torso", "waist", "arms", "hands"];
  const head: BodyRegion[] = ["head", "neck", "shoulders"];
  if (framing === "full-body" || visibility === "full") return full;
  if (framing === "half-body" || visibility === "upper") return upper;
  if (framing === "headshot" || visibility === "face") return head;
  return [];
}

function toVisiblePercent(v: unknown, framing: Framing, visibility: BodyVisibility): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return clamp(round(v <= 1 ? v * 100 : v), 0, 100);
  const byFraming: Partial<Record<Framing, number>> = {
    "full-body": 100,
    "half-body": 55,
    headshot: 20,
  };
  const byVisibility: Partial<Record<BodyVisibility, number>> = { full: 90, upper: 50, face: 20 };
  const candidates = [byFraming[framing], byVisibility[visibility]].filter(
    (x): x is number => typeof x === "number",
  );
  return candidates.length ? Math.max(...candidates) : null;
}

// ── Reference suitability (provider-supplied, else derived) ──────────────────
function deriveReferenceSuitability(m: {
  faceVisible: boolean;
  faceQuality: FaceQuality | null;
  framing: Framing;
  visibility: BodyVisibility;
  quality: ImageQuality;
  tattooCount: number;
  tattooConfidence: number;
  hairVisible: boolean;
  hairLengthKnown: boolean;
  hairColorKnown: boolean;
  eyesVisible: boolean;
  smiling: boolean;
}): Omit<ReferenceSuitability, "reason"> {
  const q = m.quality.overall / 100;
  const faceReference = m.faceVisible && m.faceQuality ? clamp(m.faceQuality.overall, 0, 1) : 0;
  const bodyScore =
    m.framing === "full-body" || m.visibility === "full"
      ? 0.95
      : m.framing === "half-body" || m.visibility === "upper"
        ? 0.6
        : m.framing === "headshot" || m.visibility === "face"
          ? 0.2
          : 0.4;
  const bodyReference = clamp(bodyScore * (0.7 + 0.3 * q), 0, 1);
  const tattooReference =
    m.tattooCount > 0
      ? clamp((0.45 + Math.min(m.tattooCount, 4) * 0.12) * (0.6 + 0.4 * m.tattooConfidence), 0, 1)
      : 0;
  const hairstyleReference = m.hairVisible
    ? clamp(0.5 + (m.hairLengthKnown ? 0.2 : 0) + (m.hairColorKnown ? 0.2 : 0), 0, 1) * (0.7 + 0.3 * q)
    : 0.1;
  const expressionReference = m.faceVisible && m.eyesVisible ? clamp(0.55 + (m.smiling ? 0.2 : 0), 0, 1) : 0.2;
  // Hero = a strong all-rounder: good face + reasonable body + technically clean.
  const hero = clamp(faceReference * 0.5 + bodyReference * 0.3 + q * 0.2, 0, 1);
  return {
    hero: round(hero * 100) / 100,
    faceReference: round(faceReference * 100) / 100,
    bodyReference: round(bodyReference * 100) / 100,
    tattooReference: round(tattooReference * 100) / 100,
    hairstyleReference: round(hairstyleReference * 100) / 100,
    expressionReference: round(expressionReference * 100) / 100,
  };
}

/**
 * A human-readable, multi-clause explanation of what this image is good/bad for (19C). Provider-
 * neutral: derived from the resolved suitability + visibility so debugging is obvious ("Excellent
 * tattoo reference. Not suitable as a face reference — face not visible. Supporting reference, not a
 * Hero."). Thresholds: ≥0.75 excellent/strong · ≥0.5 useful · <0.5 weak/not-suitable.
 */
function buildSuitabilityReason(
  s: Omit<ReferenceSuitability, "reason">,
  ctx: { faceVisible: boolean; hasTattoos: boolean; hairVisible: boolean },
): string {
  const clauses: string[] = [];
  const grade = (v: number, noun: string, why?: string): string =>
    v >= 0.75
      ? `Excellent ${noun}.`
      : v >= 0.5
        ? `Useful ${noun}.`
        : `Weak ${noun}${why ? ` — ${why}` : ""}.`;

  // Face is the anchor of most identities → lead with it, and be explicit when it's unavailable.
  if (!ctx.faceVisible) clauses.push("Not suitable as a face reference — face not visible.");
  else clauses.push(grade(s.faceReference, "face reference"));

  if (ctx.hasTattoos) clauses.push(grade(s.tattooReference, "tattoo reference"));
  if (ctx.hairVisible) clauses.push(grade(s.hairstyleReference, "hairstyle reference"));
  clauses.push(grade(s.bodyReference, "body reference"));
  if (ctx.faceVisible) clauses.push(grade(s.expressionReference, "expression reference"));

  // Hero verdict last — the overall "use it as the identity's main image?" call.
  clauses.push(
    s.hero >= 0.75
      ? "Strong Hero candidate."
      : s.hero >= 0.5
        ? "Usable as a supporting reference, but not the Hero."
        : "Supporting reference only — not a Hero.",
  );
  return clauses.join(" ");
}

/** Normalize a parting phrased as "center part" / "side part" / "middle" onto the canonical union. */
function toHairParting(v: unknown): HairParting {
  const s = str(v)?.toLowerCase() ?? "";
  if (/cent(er|re)|middle/.test(s)) return "center";
  if (/side/.test(s)) return "side";
  if (/none|no part/.test(s)) return "none";
  return oneOf<HairParting>(s, HAIR_PART, "unknown");
}

function toHairUpdo(v: unknown): HairUpdo {
  const s = str(v)?.toLowerCase() ?? "";
  if (/pony/.test(s)) return "ponytail";
  if (/bun|top ?knot/.test(s)) return "bun";
  if (/tied|back|braid|up\b/.test(s)) return "tied-back";
  if (/loose|down|open/.test(s)) return "loose";
  return oneOf<HairUpdo>(s, HAIR_UPDO, "unknown");
}

/** Turn one provider observation into AI Studio knowledge. Pure + deterministic. */
export function normalizeToIdentityMetadata(obs: VisionObservation): IdentityMetadata {
  const a = rec(obs.attributes);
  const scene = rec(obs.scene);

  const hasPose = a.faceYaw != null || a.facePitch != null || a.faceRoll != null;
  const pose = hasPose
    ? { yaw: numRaw(a.faceYaw), pitch: numRaw(a.facePitch), roll: numRaw(a.faceRoll) }
    : null;
  const orientation = str(a.faceOrientation)
    ? oneOf<FaceOrientation>(a.faceOrientation, ORIENTATIONS, "unknown")
    : pose
      ? orientationFromYaw(pose.yaw)
      : "unknown";

  const faceVisible = bool(a.faceVisible, true);
  const eyesVisible = bool(a.eyesVisible, true);
  const framing = oneOf<Framing>(a.framing, FRAMINGS, "unknown");
  const visibility = oneOf<BodyVisibility>(a.bodyVisibility, BODY_VIS, "unknown");

  const quality = toQuality(rec(obs.quality));
  const faceQuality = deriveFaceQuality(a, quality, orientation, pose, framing, faceVisible, eyesVisible);
  const expression = toFaceExpression(a, orientation, eyesVisible);

  const hairColor = str(a.hairColor);
  const hairLength = oneOf<HairLength>(a.hairLength, HAIR_LEN, "unknown");
  const hairVisible = bool(a.hairVisible, hairColor !== null);
  const tattoos = toTattoos(a.tattoos);

  const suitabilityBag = rec(a.referenceSuitability);
  const suitNum = (k: string, fallback: number): number =>
    typeof suitabilityBag[k] === "number" ? clamp01(suitabilityBag[k]) : fallback;
  const derivedSuit = deriveReferenceSuitability({
    faceVisible,
    faceQuality,
    framing,
    visibility,
    quality,
    tattooCount: tattoos.length,
    tattooConfidence: tattoos.length ? Math.max(...tattoos.map((t) => t.confidence)) : 0,
    hairVisible,
    hairLengthKnown: hairLength !== "unknown",
    hairColorKnown: hairColor !== null,
    eyesVisible,
    smiling: expression.smiling,
  });
  // Resolve provider-supplied scores over derived fallbacks, then explain the result.
  const resolvedSuit = {
    hero: suitNum("hero", derivedSuit.hero),
    faceReference: suitNum("faceReference", derivedSuit.faceReference),
    bodyReference: suitNum("bodyReference", derivedSuit.bodyReference),
    tattooReference: suitNum("tattooReference", derivedSuit.tattooReference),
    hairstyleReference: suitNum("hairstyleReference", derivedSuit.hairstyleReference),
    expressionReference: suitNum("expressionReference", derivedSuit.expressionReference),
  };
  const providerReason = str(suitabilityBag.reason);
  const suitabilityReason = buildSuitabilityReason(resolvedSuit, {
    faceVisible,
    hasTattoos: tattoos.length > 0,
    hairVisible,
  });

  return {
    version: IDENTITY_METADATA_VERSION,
    hair: {
      visible: hairVisible,
      color: hairColor,
      length: hairLength,
      texture: oneOf<HairTexture>(str(a.hairTexture)?.toLowerCase(), HAIR_TEX, "unknown"),
      parting: toHairParting(a.hairParting),
      updo: toHairUpdo(a.hairUpdo),
      bangs: bool(a.hairBangs ?? a.bangs),
      wet: bool(a.hairWet),
      windBlown: bool(a.hairWindBlown ?? a.windBlown),
    },
    face: {
      visible: faceVisible,
      orientation,
      // Default to a moderate confidence when a face is visible but the provider gave no score.
      confidence: clamp01(a.faceConfidence, faceVisible ? 0.7 : 0),
      pose,
      smiling: expression.smiling,
      eyesVisible,
      expression,
      quality: faceQuality,
    },
    body: {
      framing,
      visibility,
      pose: str(a.pose),
      visibleRegions: toVisibleRegions(a.visibleRegions, framing, visibility),
      visiblePercent: toVisiblePercent(a.bodyVisiblePercent, framing, visibility),
    },
    tattoos,
    accessories: strArr(a.accessories),
    facialHair: str(a.facialHair),
    ageRange: str(a.ageRange),
    expression: str(a.expression) ?? (expression.smiling ? "smiling" : expression.serious ? "serious" : null),
    clothing: strArr(a.clothing),
    lighting: {
      setting: oneOf<LightingSetting>(a.lightingSetting ?? scene.setting, LIGHT_SET, "unknown"),
      quality: oneOf<LightingQuality>(a.lightingQuality, LIGHT_QUAL, "unknown"),
    },
    environment: str(scene.environment),
    dominantColors: strArr(a.dominantColors),
    detectedObjects: strArr(obs.objects),
    quality,
    referenceSuitability: {
      ...resolvedSuit,
      // Prefer our synthesized, multi-clause explanation; keep a provider reason only as a suffix.
      reason: providerReason ? `${suitabilityReason} (${providerReason})` : suitabilityReason,
    },
    embedding: toEmbedding(obs.embedding, obs.model),
    faceEmbedding: toEmbedding(obs.faceEmbedding, obs.model),
    caption: str(obs.caption),
    attributeConfidence: toConfidenceMap(a.confidence),
    source: { provider: obs.provider, model: obs.model, analyzedAt: new Date().toISOString() },
  };
}
