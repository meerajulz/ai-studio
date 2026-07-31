/**
 * Reference Intelligence — role scoring (Milestone 25.2). Pure + deterministic.
 *
 * A `RoleScorer` rates how well one candidate serves each anchor role (face/body/tattoo/hair/canonical/
 * pose), with reasons + the raw signals behind the numbers. Today's `heuristicRoleScorer` derives
 * everything from persisted im-2 knowledge; the M26 Identity Evaluator will provide an
 * `evaluatorRoleScorer` with the SAME interface (similarity into `signals`) — no redesign. See
 * docs/REFERENCE_INTELLIGENCE.md.
 */
import { classifyExposure } from "@/lib/vision/exposure";

import { scoreAnchor } from "./anchor";
import type { AnchorRole, ReferenceProfile, RoleScorer, SelectionCandidate } from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Face role — reuse the Identity Anchor scorer (frontal × faceQuality × confidence × prominence). */
function faceRole(c: SelectionCandidate): { fitness: number; reasons: string[]; anchor: ReturnType<typeof scoreAnchor> } {
  const a = scoreAnchor(c);
  const reasons: string[] = [];
  if (!a.eligible) reasons.push(a.faceVisible ? "face not frontal / cropped" : "face not visible");
  else {
    reasons.push(`${a.orientation} face`, `conf ${a.confidence.toFixed(2)}`);
    if (a.eyeVisibility > 0.5) reasons.push("eyes visible");
    reasons.push(a.prominence > 0.85 ? "close-up" : a.prominence > 0.6 ? "mid-shot" : "small in frame");
  }
  return { fitness: clamp(a.score * 100), reasons, anchor: a };
}

/** Body role — full-body visibility + share of body in frame + sharpness, penalized when cropped. */
function bodyRole(c: SelectionCandidate): { fitness: number; reasons: string[]; pct: number } {
  const b = c.metadata.body;
  const q = c.metadata.quality;
  const base = { full: 90, upper: 55, face: 15, unknown: 10 }[b.visibility] ?? 10;
  const pct = b.visiblePercent != null ? b.visiblePercent / 100 : b.visibility === "full" ? 0.9 : b.visibility === "upper" ? 0.5 : 0.2;
  const fitness = clamp(base * (0.6 + 0.4 * pct) * (0.7 + 0.3 * q.sharpness) * (q.cropped ? 0.8 : 1));
  const reasons = [`${b.visibility} body visible`];
  if (pct > 0.7) reasons.push("full body in frame");
  if (q.cropped) reasons.push("partially cropped");
  return { fitness, reasons, pct };
}

/** Tattoo role — how many distinct tattoo regions are visible, weighted by extraction confidence. */
function tattooRole(c: SelectionCandidate): { fitness: number; reasons: string[]; regions: number; conf: number } {
  const regions = new Set(c.metadata.tattoos.filter((t) => t.region !== "other").map((t) => t.region));
  const conf = avg(c.metadata.tattoos.map((t) => t.confidence));
  const fitness = regions.size ? clamp((Math.min(regions.size, 6) / 6) * 100 * (0.5 + 0.5 * conf)) : 0;
  const reasons = regions.size
    ? [`${regions.size} tattoo region${regions.size === 1 ? "" : "s"} visible`, `conf ${conf.toFixed(2)}`]
    : ["no visible tattoos"];
  return { fitness, reasons, regions: regions.size, conf };
}

/** Hair role — hairstyle clearly visible; penalize wet / wind-blown (not the canonical hairstyle). */
function hairRole(c: SelectionCandidate): { fitness: number; reasons: string[] } {
  const h = c.metadata.hair;
  if (!h.visible) return { fitness: 0, reasons: ["hair not visible"] };
  let f = 60;
  const reasons = ["hair visible"];
  if (h.color) f += 15;
  if (h.length !== "unknown") f += 10;
  if (h.wet) { f -= 25; reasons.push("wet"); }
  if (h.windBlown) { f -= 20; reasons.push("wind-blown"); }
  return { fitness: clamp(f), reasons };
}

/** Canonical role — the highest-quality image that best REPRESENTS the character (quality × face clarity). */
function canonicalRole(c: SelectionCandidate, frontalness: number, faceQuality: number): { fitness: number; reasons: string[] } {
  const q = c.metadata.quality;
  const fitness = clamp(q.overall * (0.6 + 0.4 * frontalness) * (q.usable ? 1 : 0.5) * (0.7 + 0.3 * faceQuality));
  const reasons = [`overall quality ${Math.round(q.overall)}`];
  if (frontalness > 0.9) reasons.push("frontal, representative");
  if (!q.usable) reasons.push("below quality gate");
  return { fitness, reasons };
}

/** Pose role — a clear, distinct pose (request-specific matching happens in resolvePackage). */
function poseRole(c: SelectionCandidate): { fitness: number; reasons: string[] } {
  const pose = c.metadata.body.pose?.trim();
  if (!pose) return { fitness: 0, reasons: ["no clear pose"] };
  return { fitness: clamp(50 + 30 * c.metadata.quality.sharpness), reasons: [`pose: ${pose}`] };
}

/** The heuristic scorer (Milestone 25.2). Same shape the M26 evaluator scorer will implement. */
export const heuristicRoleScorer: RoleScorer = {
  id: "heuristic",
  profile(c: SelectionCandidate): ReferenceProfile {
    const face = faceRole(c);
    const body = bodyRole(c);
    const tattoo = tattooRole(c);
    const hair = hairRole(c);
    const canonical = canonicalRole(c, face.anchor.frontalness, face.anchor.faceQuality);
    const pose = poseRole(c);

    const fitness: Record<AnchorRole, number> = {
      face: face.fitness,
      body: body.fitness,
      tattoo: tattoo.fitness,
      hair: hair.fitness,
      canonical: canonical.fitness,
      pose: pose.fitness,
    };
    const reasons: Record<AnchorRole, string[]> = {
      face: face.reasons,
      body: body.reasons,
      tattoo: tattoo.reasons,
      hair: hair.reasons,
      canonical: canonical.reasons,
      pose: pose.reasons,
    };
    return {
      mediaId: c.mediaId,
      url: c.url,
      fitness,
      reasons,
      // Raw signals — the seam where the M26 evaluator adds face/tattoo/body/hair SIMILARITY.
      signals: {
        faceScore: face.anchor.score,
        frontalness: face.anchor.frontalness,
        faceQuality: face.anchor.faceQuality,
        prominence: face.anchor.prominence,
        bodyPercent: body.pct,
        tattooRegions: tattoo.regions,
        tattooConfidence: tattoo.conf,
        hairVisible: c.metadata.hair.visible ? 1 : 0,
        qualityOverall: c.metadata.quality.overall,
        ...(c.signals ?? {}),
      },
      exposure: classifyExposure(c.metadata),
    };
  },
};
