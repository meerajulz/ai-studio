/**
 * Reference Safety filter (Milestone 20) — a selection CONSTRAINT alongside face quality, body
 * coverage, tattoos, and hairstyle. Given the prompt, decide the maximum exposure level allowed and
 * drop any candidate above it, so nude/lingerie references are never sent for non-explicit prompts
 * (which trips the provider's NSFW moderation). Pure + deterministic + provider-neutral.
 */
import type { CreativeDirective } from "@/lib/creative/types";
import { classifyExposure, EXPOSURE_RANK, type ExposureLevel } from "@/lib/vision";
import type { SelectionCandidate } from "./types";

/** The most-exposed reference level a prompt permits. Default is `clothed` (safe). */
export function allowedExposureForPrompt(directive: CreativeDirective): ExposureLevel {
  const idea = directive.meta.idea.toLowerCase();
  if (/\b(nude|naked|topless|explicit|nsfw|bottomless)\b/.test(idea)) return "nude";
  if (/lingerie|underwear|boudoir|negligee/.test(idea)) return "lingerie";
  if (/beach|pool|bikini|swim|swimsuit|swimwear|hot tub|jacuzzi/.test(idea)) return "swimwear";
  return "clothed";
}

export type ExposureFilterResult = {
  allowed: ExposureLevel;
  safe: SelectionCandidate[];
  excluded: { candidate: SelectionCandidate; exposure: ExposureLevel }[];
};

/**
 * Split candidates into those safe to send for THIS prompt (exposure ≤ allowed) and those excluded.
 * Applies to BOTH the scene references and the Identity Anchor — a nude image is never sent for a
 * business portrait, even for its face.
 */
export function filterCandidatesByExposure(
  directive: CreativeDirective,
  candidates: SelectionCandidate[],
): ExposureFilterResult {
  const allowed = allowedExposureForPrompt(directive);
  const maxRank = EXPOSURE_RANK[allowed];
  const safe: SelectionCandidate[] = [];
  const excluded: { candidate: SelectionCandidate; exposure: ExposureLevel }[] = [];
  for (const candidate of candidates) {
    const exposure = classifyExposure(candidate.metadata);
    if (EXPOSURE_RANK[exposure] <= maxRank) safe.push(candidate);
    else excluded.push({ candidate, exposure });
  }
  return { allowed, safe, excluded };
}
