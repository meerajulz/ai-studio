/**
 * Image matching (Milestone 20, Step 2) — score each candidate image against each active requirement
 * (0..100), reading ONLY the persisted, provider-neutral Vision knowledge. Pure + deterministic.
 */
import type { IdentityMetadata, TattooRegion } from "@/lib/vision";
import type { ImageMatch, PromptRequirements, RequirementId, SelectionCandidate } from "./types";

const CHEST: TattooRegion[] = ["chest", "chest-left", "chest-right"];
const ARM: TattooRegion[] = [
  "left-shoulder", "left-upper-arm", "left-forearm", "left-hand",
  "right-shoulder", "right-upper-arm", "right-forearm", "right-hand",
];
const BACK: TattooRegion[] = ["back", "upper-back", "lower-back"];
const LEG: TattooRegion[] = ["left-thigh", "right-thigh", "left-calf", "right-calf", "feet"];

const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Tattoo confidence for a region group (0..1), 0 when the identity has none there. */
function tattooConf(m: IdentityMetadata, regions: TattooRegion[]): number {
  const hits = m.tattoos.filter((t) => regions.includes(t.region));
  return hits.length ? Math.max(...hits.map((t) => t.confidence)) : 0;
}

/** Score ONE requirement for one image's knowledge (0..100). */
function scoreRequirement(m: IdentityMetadata, score: SelectionCandidate["score"], id: RequirementId): number {
  const suit = m.referenceSuitability;
  const face = m.face;
  const tattoo = (regions: TattooRegion[]) => pct(tattooConf(m, regions) * suit.tattooReference * 100);

  switch (id) {
    case "face":
      return face.visible ? pct(suit.faceReference * 100) : 0;
    case "frontFace":
      return face.visible && face.orientation === "front"
        ? pct(suit.faceReference * 100)
        : face.orientation === "three-quarter"
          ? pct(suit.faceReference * 60)
          : 0;
    case "profile":
      return face.orientation === "left-profile" || face.orientation === "right-profile" || face.orientation === "profile"
        ? pct(suit.faceReference * 100)
        : 0;
    case "backView":
      return face.orientation === "back" ? 100 : 0;
    case "smile":
      return face.expression.smiling ? pct(suit.expressionReference * 100) : 0;
    case "expression":
      return face.expression.smiling || face.expression.laughing || face.expression.serious
        ? pct(suit.expressionReference * 100)
        : face.visible
          ? 40
          : 0;
    case "visibleEyes":
      return face.visible && face.eyesVisible ? 100 : 0;
    case "fullBody":
      return pct(Math.max(score.bodyCoverage, suit.bodyReference * 100) * (m.body.framing === "full-body" || m.body.visibility === "full" ? 1 : 0.5));
    case "upperBody":
      return m.body.framing === "half-body" || m.body.visibility === "upper" || m.body.framing === "full-body"
        ? pct(Math.max(60, suit.bodyReference * 100))
        : pct(score.bodyCoverage * 0.6);
    case "hands":
      return m.body.visibleRegions.includes("hands") ? 100 : 0;
    case "feet":
      return m.body.visibleRegions.includes("feet") ? 100 : 0;
    case "hair":
      return m.hair.visible ? pct(suit.hairstyleReference * 100) : 0;
    case "chestTattoos":
      return tattoo(CHEST);
    case "armTattoos":
      return tattoo(ARM);
    case "backTattoos":
      return tattoo(BACK);
    case "legTattoos":
      return tattoo(LEG);
    case "indoor":
      return m.lighting.setting === "indoor" || m.lighting.setting === "studio" ? 100 : 0;
    case "outdoor":
      return m.lighting.setting === "outdoor" ? 100 : 0;
    case "elegantClothing":
      return matchesClothing(m, ["gown", "dress", "suit", "elegant", "formal", "evening"]) ? 100 : 0;
    case "swimwear":
      return matchesClothing(m, ["bikini", "swimsuit", "swimwear", "swim"]) ? 100 : 0;
    case "businessWear":
      return matchesClothing(m, ["suit", "blazer", "business", "shirt", "formal"]) ? 100 : 0;
    case "action":
      return m.body.pose ? 70 : 50; // weak signal — knowledge doesn't capture motion well
    default:
      return 0;
  }
}

function matchesClothing(m: IdentityMetadata, keywords: string[]): boolean {
  const clothing = m.clothing.map((c) => c.toLowerCase()).join(" ");
  return keywords.some((k) => clothing.includes(k));
}

/** Score one candidate against all active requirements. */
export function matchImage(candidate: SelectionCandidate, requirements: PromptRequirements): ImageMatch {
  const perRequirement: Partial<Record<RequirementId, number>> = {};
  for (const req of requirements.active) {
    perRequirement[req.id] = scoreRequirement(candidate.metadata, candidate.score, req.id);
  }
  return { mediaId: candidate.mediaId, candidate, perRequirement, baseScore: candidate.score.overall };
}
