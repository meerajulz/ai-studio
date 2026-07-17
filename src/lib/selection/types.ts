/**
 * Smart Reference Selection — types (Milestone 20). The "Reference Selector" layer of
 * docs/AI_ARCHITECTURE.md: given the Creative Director's output + an identity's persisted Vision
 * knowledge, assemble the BEST *package* of references for THIS request (diverse/complementary, not
 * four near-identical Heroes). Pure + deterministic + provider-neutral — it returns an ordered list
 * of images; providers just receive them and never know how they were chosen.
 */
import type { IdentityImageScore } from "@/lib/vision";
import type { IdentityMetadata } from "@/lib/vision";

/** Every requirement the selector understands (the deterministic PromptRequirements interface). */
export type RequirementId =
  | "face"
  | "frontFace"
  | "profile"
  | "backView"
  | "smile"
  | "expression"
  | "visibleEyes"
  | "fullBody"
  | "upperBody"
  | "hands"
  | "feet"
  | "hair"
  | "chestTattoos"
  | "armTattoos"
  | "backTattoos"
  | "legTattoos"
  | "indoor"
  | "outdoor"
  | "elegantClothing"
  | "swimwear"
  | "businessWear"
  | "action";

/**
 * One active requirement. `weight` = importance in the package optimization. `soft` requirements
 * influence ranking/diversity but NEVER produce a coverage warning — e.g. "bikini" implies legs are
 * visible (prefer leg-tattoo refs *if the identity has them*), but it is not an error if she has none.
 * Explicit prompt requests ("back view showing tattoos") are HARD (warn when unmet).
 */
export type Requirement = { id: RequirementId; label: string; weight: number; soft: boolean };

/** The full deterministic requirement analysis of a prompt. `flags` = the spec interface (display). */
export type PromptRequirements = {
  flags: Record<RequirementId, boolean>;
  active: Requirement[]; // only the requested requirements, with weights
};

/**
 * A candidate reference image = a signed URL + its persisted Vision knowledge. `signals` is the
 * FUTURE-PROOFING hook: face-embedding similarity, user favorite, LoRA availability, learning-loop
 * scores, … plug in here as generic numbers with no selector redesign.
 */
export type SelectionCandidate = {
  mediaId: string;
  url: string;
  metadata: IdentityMetadata;
  score: IdentityImageScore;
  signals?: Record<string, number>;
};

/** How one image scores against the active requirements (0..100 each). */
export type ImageMatch = {
  mediaId: string;
  candidate: SelectionCandidate;
  perRequirement: Partial<Record<RequirementId, number>>;
  baseScore: number; // candidate.score.overall — the "which image is best" signal (tiebreak/fallback)
};

export type ReferenceRole =
  | "hero"
  | "face"
  | "body"
  | "tattoos"
  | "hair"
  | "expression"
  | "scene"
  | "support";

/** One chosen reference, with the explanation the milestone requires. */
export type SelectedReference = {
  mediaId: string;
  url: string;
  role: ReferenceRole;
  reason: string; // "Only image with visible leg tattoos.", "Highest full-body score.", …
  satisfies: RequirementId[]; // requirements this pick primarily covers
  matchScore: number; // its contribution strength (0..100)
};

export type SelectionResult = {
  requirements: PromptRequirements;
  ranked: ImageMatch[]; // all candidates, best base-first (transparency)
  package: SelectedReference[]; // the chosen, ordered set (best-first for the provider)
  warnings: string[]; // hard requirements with no suitable reference
  orderedReferenceUrls: string[]; // package URLs — provider-ready
};
