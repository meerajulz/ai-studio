/**
 * Reference Engine (Milestone 22) — the ONLY working identity module today, and the always-on
 * baseline for every strategy.
 *
 * It wraps the existing Smart Reference Selection layer (`src/lib/selection`) — exposure filter →
 * reference package → Identity Anchor — with ZERO behavior change. This is the exact logic that
 * lived inline in `runImageGeneration`; it moved here verbatim so Generation now consumes it through
 * the Identity Engine. Provider-neutral: it returns ordered `ReferenceImage`s + an anchor.
 */
import type { ReferenceImage } from "@/lib/ai";
import type { IdentityVisualPackage } from "@/lib/identity/types";
import {
  ANCHOR_ROLES,
  allowedExposureForPrompt,
  buildCharacterPackage,
  deriveNeededRoles,
  filterCandidatesByExposure,
  rankIdentityAnchors,
  renderPackageForModel,
  resolvePackage,
  type AnchorRole,
  type CharacterPackage,
  type IdentityPackage,
  type SelectionCandidate,
} from "@/lib/selection";
import type { IdentityModule } from "../../modules/IdentityModule";
import type {
  ConditioningContribution,
  ConditioningRequest,
  IdentityPackageTrace,
  SelectionTrace,
} from "../../types";

/** Default reference cap when the model's real max is unknown at engine time (the adapter re-caps). */
const DEFAULT_MAX_REFERENCES = 4;

/** Map an Identity Package anchor role onto the provider-neutral `ReferenceImage` role vocabulary. */
function anchorRoleToRef(role: AnchorRole): ReferenceImage["role"] {
  if (role === "face") return "portrait";
  if (role === "body") return "fullBody";
  return "reference";
}

/** Build the provider-neutral trace Generation uses to refuse (faceAnchorSource) + show in Debug. */
function toPackageTrace(pkg: IdentityPackage, availableRoles: AnchorRole[]): IdentityPackageTrace {
  return {
    faceAnchorSource: pkg.faceAnchorSource,
    reason: pkg.reason,
    neededRoles: pkg.neededRoles,
    availableRoles,
    filledRoles: pkg.filledRoles,
    missingRoles: pkg.missingRoles,
    facetsCovered: pkg.facetsCoveredByReference,
    anchors: pkg.anchors.map((a) => ({
      role: a.role,
      roles: a.roles,
      score: Math.round(a.score),
      url: a.url,
      reasons: a.reasons,
    })),
  };
}

/** Flatten an Identity Visual Package into provider-neutral reference images (deduped by url). */
function toReferenceImages(pkg?: IdentityVisualPackage | null): ReferenceImage[] {
  if (!pkg) return [];
  const refs: ReferenceImage[] = [];
  const push = (url: string | null, role: ReferenceImage["role"]) => {
    if (url) refs.push({ url, role });
  };
  push(pkg.heroImageUrl, "hero");
  push(pkg.bestPortraitUrl, "portrait");
  push(pkg.bestFullBodyUrl, "fullBody");
  for (const url of pkg.referenceImageUrls) push(url, "reference");

  const seen = new Set<string>();
  return refs.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

/** The core selection — pure, parity-preserving. Exported so the verify script can assert parity. */
export function selectReferences(req: ConditioningRequest): ConditioningContribution {
  const { directive } = req;
  const candidates = req.candidates ?? [];
  const manualIds = req.manualReferenceMediaIds?.filter(Boolean) ?? [];

  let referenceImages: ReferenceImage[];
  let identityAnchor: ReferenceImage | undefined;
  let identityPackage: IdentityPackageTrace | null = null;
  let reason: string;
  let selection: SelectionTrace | null = null;
  let manual = false;

  if (manualIds.length && candidates.length) {
    // DEV manual override: EXACTLY these images, in THIS order — no package, no anchor, no safety.
    manual = true;
    const byId = new Map(candidates.map((c) => [c.mediaId, c] as const));
    referenceImages = manualIds
      .map((id) => byId.get(id))
      .filter((c): c is SelectionCandidate => c != null)
      .map((c) => ({ url: c.url, role: "reference" as const }));
    reason = `MANUAL reference selection (dev): ${referenceImages.length} image(s), exact order`;
  } else if (candidates.length) {
    // Identity Package (M25.2): the role-based anchor package DRIVES the references. Phase D — start from
    // the character's PERSISTED default; rebuild from live exposure-safe candidates if it's absent or
    // can't satisfy this request's exposure ceiling / Face-Anchor invariant (no regression).
    const exposure = filterCandidatesByExposure(directive, candidates);
    const exposureCeiling = allowedExposureForPrompt(directive);
    const max = req.maxReferences ?? DEFAULT_MAX_REFERENCES;

    const resolveFrom = (cp: CharacterPackage) => {
      const available = new Set(cp.anchors.flatMap((a) => a.roles));
      // Transformation-driven roles (M25.1). Without a plan, keep every available role (coverage).
      const neededRoles = req.transformation
        ? deriveNeededRoles({ ...req.transformation, available })
        : ANCHOR_ROLES.filter((r) => available.has(r) || r === "face");
      return {
        neededRoles,
        availableRoles: ANCHOR_ROLES.filter((r) => available.has(r)),
        pkg: resolvePackage({ characterPackage: cp, neededRoles, maxReferences: max, exposureCeiling }),
      };
    };

    let source = "persisted default";
    let resolved = req.characterPackage ? resolveFrom(req.characterPackage) : null;
    if (!resolved || resolved.pkg.faceAnchorSource === "none") {
      source = req.characterPackage ? "rebuilt (persisted insufficient)" : "rebuilt (no persisted package)";
      resolved = resolveFrom(buildCharacterPackage(req.identityId ?? "", exposure.safe));
    }
    const { neededRoles, pkg } = resolved;
    identityPackage = toPackageTrace(pkg, resolved.availableRoles);

    // Render the package for the provider (image_urls today; face #0 by invariant). Face → the anchor
    // slot (reuses the adapter's proven [anchor, ...scene] merge/cap); the rest → scene references.
    const rendered = renderPackageForModel(pkg, { kind: "image_urls", max });
    if (pkg.faceAnchorSource === "none") {
      // No confident face anchor → Generation refuses (NO_IDENTITY_ANCHOR). Send nothing.
      referenceImages = [];
      reason = pkg.reason;
    } else {
      identityAnchor = { url: rendered[0].url, role: "anchor" };
      referenceImages = rendered.slice(1).map((r) => ({ url: r.url, role: anchorRoleToRef(r.role) }));
      reason = `identity package (${source}): ${pkg.reason}`;
    }
    selection = {
      requirements: neededRoles,
      selected: pkg.anchors.map((a) => ({
        role: a.roles.join("/"),
        reason: a.reasons.join(", "),
        satisfies: a.coversFacets,
      })),
      warnings: pkg.missingRoles.map((r) => `no anchor for ${r}`),
      allowedExposure: pkg.exposureCeiling,
      excludedForSafety: exposure.excluded.length,
    };
  } else {
    referenceImages = toReferenceImages(req.visualPackage);
    reason = referenceImages.length
      ? `curated from the identity visual package, best-first: ${referenceImages
          .map((r) => r.role)
          .join(", ")}`
      : "no reference images available";
  }

  return {
    part: "reference",
    referenceImages,
    identityAnchor,
    identityPackage,
    reason,
    debug: {
      selection,
      // Anchor diagnostic uses ALL candidates (unchanged from the previous inline behavior).
      anchorRanking: rankIdentityAnchors(candidates).slice(0, 5),
      manual,
    },
  };
}

export const referenceEngine: IdentityModule = {
  id: "reference",
  label: "Reference Engine",
  kind: "reference",
  priority: 100,
  enabled: true,
  autoSelect: true, // the always-on baseline
  async availability() {
    // Always available — references are the universal baseline (even with no analyzed candidates it
    // gracefully falls back to the static Visual Package, and may simply return no references).
    return { available: true, reason: "reference conditioning is always available" };
  },
  async contribute(_ctx, req) {
    return selectReferences(req);
  },
};
