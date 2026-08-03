/**
 * Reference exposure classification (Milestone 20 — Reference Safety).
 *
 * Classify an analyzed image by how much skin/clothing it shows, so the Smart Reference Selector can
 * avoid sending nude/lingerie references for non-explicit prompts (which trips the provider's NSFW
 * moderation → black placeholder images). DERIVED from the frozen `im-2` knowledge (clothing +
 * visible regions) — no schema change, no re-analysis. Pure + deterministic + provider-neutral.
 *
 * The scale is ordered least → most exposed; a prompt permits everything at or below its allowed
 * level (see selection/exposure.ts).
 */
import type { IdentityMetadata } from "./types";

export type ExposureLevel = "clothed" | "swimwear" | "lingerie" | "nude";

export const EXPOSURE_RANK: Record<ExposureLevel, number> = {
  clothed: 0,
  swimwear: 1,
  lingerie: 2,
  nude: 3,
};

/**
 * Classify an image's exposure from its `clothing` terms. **Positive-signal only** — we raise the
 * level ONLY on an explicit exposure term and otherwise default to `clothed`. (Empty `clothing`
 * usually means the provider simply didn't list a garment, NOT nudity — inferring "nude" from
 * missing clothing produced false positives that wrongly excluded good references.) The Gemini prompt
 * is asked to include "nude"/"lingerie"/"bikini" in `clothing` when relevant, so the true positives
 * are captured reliably.
 */
export function classifyExposure(m: IdentityMetadata): ExposureLevel {
  const clothing = m.clothing.map((c) => c.toLowerCase()).join(" ");
  if (/\b(nude|naked|topless|bottomless|undressed|bare-chested)\b/.test(clothing)) return "nude";
  if (/lingerie|underwear|\bbra\b|panties|thong|corset|bodysuit|negligee|boudoir/.test(clothing)) {
    return "lingerie";
  }
  if (/bikini|swimsuit|swimwear|one-piece|swim trunks|\btrunks\b|swim shorts/.test(clothing)) {
    return "swimwear";
  }
  return "clothed";
}
