/**
 * Smart Reference Selection — types (Milestone 20). The "Reference Selector" layer of
 * docs/AI_ARCHITECTURE.md: given the Creative Director's output + an identity's persisted Vision
 * knowledge, assemble the BEST *package* of references for THIS request (diverse/complementary, not
 * four near-identical Heroes). Pure + deterministic + provider-neutral — it returns an ordered list
 * of images; providers just receive them and never know how they were chosen.
 */
import type { IdentityImageScore } from "@/lib/vision";
import type { IdentityMetadata } from "@/lib/vision";
import type { ExposureLevel } from "@/lib/vision/exposure";

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

// ── Identity Package (Milestone 25.2) — see docs/REFERENCE_INTELLIGENCE.md ────────────────────────
//
// The provider-AGNOSTIC internal representation of WHO a character is + how to reference them. A
// provider only ever consumes a PROJECTION of this (`renderPackageForModel`). Every score is produced
// by a pluggable `RoleScorer` (heuristic today; the M26 Identity Evaluator tomorrow) so evaluator
// similarity drops into `ReferenceProfile.signals` with no redesign.

/** What an anchor is FOR in a generation (distinct from a raw image "type"). */
export type AnchorRole = "face" | "body" | "tattoo" | "hair" | "canonical" | "pose";

export const ANCHOR_ROLES: AnchorRole[] = ["face", "body", "tattoo", "hair", "canonical", "pose"];

/** The unit of channel arbitration — a facet an anchor can carry so the PROMPT need not describe it. */
export type IdentityFacet = "face" | "tattoos" | "hair" | "piercings" | "body";

/** How well one candidate serves each anchor role, with the reasons + the raw signals behind them. */
export type ReferenceProfile = {
  mediaId: string;
  url: string;
  fitness: Record<AnchorRole, number>; // 0..100 per role
  reasons: Record<AnchorRole, string[]>;
  signals: Record<string, number>; // raw scoring inputs — M26 evaluator similarity plugs in here
  exposure: ExposureLevel;
};

/** A pluggable role scorer (Milestone 25.2 heuristic; Milestone 26 evaluator). */
export type RoleScorer = {
  id: string;
  profile: (candidate: SelectionCandidate) => ReferenceProfile;
};

/** One chosen anchor. `roles` holds EVERY role this one image fills (coverage > uniqueness). */
export type IdentityAnchor = {
  role: AnchorRole; // the primary / highest-importance role
  roles: AnchorRole[]; // all roles this image is the anchor for (merge-by-image)
  mediaId: string;
  url: string;
  score: number; // fitness for the primary role
  importance: number; // ordering weight for THIS request (face is highest)
  reasons: string[];
  coversFacets: IdentityFacet[];
  exposure: ExposureLevel; // so a persisted default anchor can be dropped per-request over the ceiling
};

/** The persisted form of an anchor (Milestone 25.2 Phase D) — mediaId only; the signed URL is expiring
 * and re-derived at read time by `getCharacterPackage`. */
export type StoredAnchor = Omit<IdentityAnchor, "url">;

/** The character's STABLE default anchors over the whole library (persistable later — Phase D). */
export type CharacterPackage = {
  identityId: string;
  anchors: IdentityAnchor[]; // best per role across all analyzed images
  scorerId: string; // which RoleScorer produced it (heuristic | evaluator)
  computedFrom: { mediaCount: number; analyzedCount: number };
};

/** How the Face-Anchor invariant resolved. `none` → the transformation must be refused. */
export type FaceAnchorSource = "face" | "hero" | "none";

/** The per-REQUEST projection of the character package (needed roles + overrides + cap). */
export type IdentityPackage = {
  anchors: IdentityAnchor[]; // importance-ordered; face is anchors[0] (invariant)
  neededRoles: AnchorRole[];
  filledRoles: AnchorRole[];
  missingRoles: AnchorRole[]; // → the prompt must describe these facets (channel arbitration)
  missingRoleReasons: Partial<Record<AnchorRole, string>>; // WHY each missing role is unfilled (M27 Phase 2)
  facetsCoveredByReference: IdentityFacet[];
  exposureCeiling: ExposureLevel;
  faceAnchorSource: FaceAnchorSource;
  reason: string;
};
