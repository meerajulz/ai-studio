/**
 * Reference Intelligence — the Identity Package (Milestone 25.2). Pure + deterministic + provider-agnostic.
 *
 *   buildCharacterPackage  → the character's STABLE default anchors (best per role over the library)
 *   resolvePackage         → the per-REQUEST projection (needed roles + overrides + Face invariant + cap)
 *   renderPackageForModel  → the ONLY provider-aware step (image_urls today; named slots later)
 *
 * The Face Anchor is a pipeline INVARIANT: always first, never dropped; no confident face → Hero → else
 * refuse. See docs/REFERENCE_INTELLIGENCE.md.
 */
import type { ExposureLevel } from "@/lib/vision/exposure";

import { heuristicRoleScorer } from "./roles";
import {
  ANCHOR_ROLES,
  type AnchorRole,
  type CharacterPackage,
  type IdentityAnchor,
  type IdentityFacet,
  type IdentityPackage,
  type ReferenceProfile,
  type RoleScorer,
  type SelectionCandidate,
} from "./types";

/** Importance for ordering — Face is always highest; the rest are scene-tunable later (Phase B). */
const ROLE_IMPORTANCE: Record<AnchorRole, number> = {
  face: 100,
  canonical: 70,
  tattoo: 65,
  body: 60,
  hair: 45,
  pose: 40,
};

/** Which identity facets an anchor lets the PROMPT stop describing (channel arbitration). */
const ROLE_FACETS: Record<AnchorRole, IdentityFacet[]> = {
  face: ["face", "piercings"],
  body: ["body"],
  tattoo: ["tattoos"],
  hair: ["hair"],
  canonical: [],
  pose: [],
};

const EXPOSURE_RANK: Record<ExposureLevel, number> = { clothed: 0, swimwear: 1, lingerie: 2, nude: 3 };

const facetsForRoles = (roles: AnchorRole[]): IdentityFacet[] => [
  ...new Set(roles.flatMap((r) => ROLE_FACETS[r])),
];

/**
 * Build the character's DEFAULT package: the best candidate per role across the whole (analyzed) library.
 * Anchors are MERGED by image — if one photo is the argmax for several roles, it fills them all (one slot,
 * many roles: coverage > uniqueness). Persistable later behind `getCharacterPackage` (Phase D).
 */
export function buildCharacterPackage(
  identityId: string,
  candidates: SelectionCandidate[],
  scorer: RoleScorer = heuristicRoleScorer,
): CharacterPackage {
  const profiles = candidates.map((c) => scorer.profile(c));

  // Best candidate per role (fitness > 0).
  const bestByRole = new Map<AnchorRole, ReferenceProfile>();
  for (const role of ANCHOR_ROLES) {
    let best: ReferenceProfile | null = null;
    for (const p of profiles) {
      if (p.fitness[role] > 0 && (!best || p.fitness[role] > best.fitness[role])) best = p;
    }
    if (best) bestByRole.set(role, best);
  }

  // Merge by image: group the roles each winning image took.
  const rolesByMedia = new Map<string, AnchorRole[]>();
  for (const [role, p] of bestByRole) {
    rolesByMedia.set(p.mediaId, [...(rolesByMedia.get(p.mediaId) ?? []), role]);
  }

  const anchors: IdentityAnchor[] = [];
  for (const [mediaId, roles] of rolesByMedia) {
    const p = profiles.find((x) => x.mediaId === mediaId)!;
    const primary = roles.slice().sort((a, b) => ROLE_IMPORTANCE[b] - ROLE_IMPORTANCE[a])[0];
    anchors.push({
      role: primary,
      roles: roles.slice().sort((a, b) => ROLE_IMPORTANCE[b] - ROLE_IMPORTANCE[a]),
      mediaId,
      url: p.url,
      score: p.fitness[primary],
      importance: ROLE_IMPORTANCE[primary],
      reasons: p.reasons[primary],
      coversFacets: facetsForRoles(roles),
    });
  }
  anchors.sort((a, b) => b.importance - a.importance);

  return {
    identityId,
    anchors,
    scorerId: scorer.id,
    computedFrom: { mediaCount: candidates.length, analyzedCount: profiles.length },
  };
}

/** Which anchor roles THIS request actually needs — driven by the Transformation Plan (M25.1). */
export function deriveNeededRoles(input: {
  preserve: string[];
  change: string[];
  available: Set<AnchorRole>; // roles the character actually has an anchor for
}): AnchorRole[] {
  const has = (list: string[], re: RegExp) => list.some((x) => re.test(x));
  const roles: AnchorRole[] = ["face"]; // invariant
  if (input.available.has("body") && has(input.preserve, /body|proportion/i)) roles.push("body");
  if (input.available.has("tattoo") && has(input.preserve, /tattoo/i)) roles.push("tattoo");
  // Hair is only worth a slot when it is PRESERVED (i.e. NOT being changed).
  if (input.available.has("hair") && !has(input.change, /hair/i)) roles.push("hair");
  if (input.available.has("pose") && has(input.change, /pose/i)) roles.push("pose");
  if (input.available.has("canonical")) roles.push("canonical"); // fidelity anchor, lowest priority
  return roles;
}

/**
 * Project the character package onto ONE request: keep the needed roles, enforce the Face-Anchor
 * invariant (face → hero → refuse), drop refs over the model's cap (never the face), and report which
 * facets a reference now carries (so the prompt can stop describing them).
 */
export function resolvePackage(input: {
  characterPackage: CharacterPackage;
  neededRoles: AnchorRole[];
  maxReferences: number;
  exposureCeiling: ExposureLevel;
  heroUrl?: string | null;
}): IdentityPackage {
  const { characterPackage, neededRoles, maxReferences, exposureCeiling, heroUrl } = input;
  const needed = new Set(neededRoles);

  // Anchors serving at least one needed role, ordered by importance.
  let kept = characterPackage.anchors
    .filter((a) => a.roles.some((r) => needed.has(r)))
    .sort((a, b) => b.importance - a.importance);

  // Face-Anchor invariant.
  let faceAnchorSource: IdentityPackage["faceAnchorSource"] = "none";
  const faceAnchor = kept.find((a) => a.roles.includes("face"));
  if (faceAnchor) {
    faceAnchorSource = "face";
  } else if (heroUrl) {
    faceAnchorSource = "hero";
    kept = [
      {
        role: "face",
        roles: ["face"],
        mediaId: "hero",
        url: heroUrl,
        score: 0,
        importance: ROLE_IMPORTANCE.face,
        reasons: ["fallback: Hero image (no confident face anchor)"],
        coversFacets: ROLE_FACETS.face,
      },
      ...kept,
    ];
  }
  // else faceAnchorSource stays "none" → the caller MUST refuse the transformation.

  // Ensure the face anchor is position 0.
  kept.sort((a, b) => (a.roles.includes("face") ? -1 : b.roles.includes("face") ? 1 : b.importance - a.importance));

  // Cap to the model's reference limit — never drop the face (index 0).
  if (kept.length > maxReferences) {
    const face = kept[0];
    kept = [face, ...kept.slice(1, Math.max(1, maxReferences))];
  }

  const filledRoles = [...new Set(kept.flatMap((a) => a.roles))].filter((r) => needed.has(r));
  const missingRoles = neededRoles.filter((r) => !filledRoles.includes(r));
  const facetsCoveredByReference = [...new Set(kept.flatMap((a) => a.coversFacets))];

  const reason =
    faceAnchorSource === "none"
      ? "No identity anchor — refuse."
      : `${kept.length} anchor(s): ${kept.map((a) => a.roles.join("/")).join(", ")} (face via ${faceAnchorSource}).`;

  return {
    anchors: kept,
    neededRoles,
    filledRoles,
    missingRoles,
    facetsCoveredByReference,
    exposureCeiling,
    faceAnchorSource,
    reason,
  };
}

// ── Provider projection — the ONLY provider-aware step ────────────────────────────────────────────

/** What a specific model accepts. Default is the universal ordered-urls shape. */
export type ReferenceSchema =
  | { kind: "image_urls"; max: number }
  | { kind: "named"; slots: Partial<Record<AnchorRole, 1>> };

/** One rendered reference for a provider (url + the role it plays; slot for named schemas). */
export type RenderedReference = { url: string; role: AnchorRole; slot?: string };

/** Translate the internal Identity Package into what a provider actually consumes. */
export function renderPackageForModel(pkg: IdentityPackage, schema: ReferenceSchema): RenderedReference[] {
  if (schema.kind === "named") {
    // Map each requested slot to the best anchor that serves it (future: face_reference/controlnet/…).
    const out: RenderedReference[] = [];
    for (const role of Object.keys(schema.slots) as AnchorRole[]) {
      const anchor = pkg.anchors.find((a) => a.roles.includes(role));
      if (anchor) out.push({ url: anchor.url, role, slot: role });
    }
    return out;
  }
  // image_urls: ordered best-first (face #0), capped.
  return pkg.anchors.slice(0, schema.max).map((a) => ({ url: a.url, role: a.role }));
}

/** Rank exposure so a package's ceiling can gate what may be sent (reused by exposure filtering). */
export const exposureRank = (e: ExposureLevel): number => EXPOSURE_RANK[e];
