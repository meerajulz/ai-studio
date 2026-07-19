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
  buildReferencePackage,
  filterCandidatesByExposure,
  pickIdentityAnchor,
  rankIdentityAnchors,
  type SelectedReference,
  type SelectionCandidate,
} from "@/lib/selection";
import type { IdentityModule } from "../../modules/IdentityModule";
import type {
  ConditioningContribution,
  ConditioningRequest,
  SelectionTrace,
} from "../../types";

/** Map a Smart Reference Selection role onto the provider-neutral `ReferenceImage` role vocabulary. */
function toReferenceRole(role: SelectedReference["role"]): ReferenceImage["role"] {
  switch (role) {
    case "hero":
      return "hero";
    case "face":
      return "portrait";
    case "body":
      return "fullBody";
    default:
      return "reference";
  }
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
  let reason: string;
  let selection: SelectionTrace | null = null;
  let manual = false;
  // Reference Safety filter: drop nude/lingerie references for non-explicit prompts (applied to BOTH
  // the scene selection AND the Identity Anchor below).
  let safeCandidates = candidates;

  if (manualIds.length && candidates.length) {
    // DEV manual override: EXACTLY these images, in THIS order — no selector, no anchor, no safety.
    manual = true;
    const byId = new Map(candidates.map((c) => [c.mediaId, c] as const));
    referenceImages = manualIds
      .map((id) => byId.get(id))
      .filter((c): c is SelectionCandidate => c != null)
      .map((c) => ({ url: c.url, role: "reference" as const }));
    reason = `MANUAL reference selection (dev): ${referenceImages.length} image(s), exact order`;
    safeCandidates = []; // no auto-anchor in manual mode
  } else if (candidates.length) {
    const exposure = filterCandidatesByExposure(directive, candidates);
    safeCandidates = exposure.safe;
    const sel = buildReferencePackage(directive, exposure.safe);
    referenceImages = sel.package.map((p) => ({ url: p.url, role: toReferenceRole(p.role) }));
    reason = referenceImages.length
      ? `smart selection: ${sel.package.map((p) => `${p.role} — ${p.reason}`).join("; ")}`
      : "no suitable references selected";
    selection = {
      requirements: sel.requirements.active.map((r) => r.label),
      selected: sel.package.map((p) => ({ role: p.role, reason: p.reason, satisfies: p.satisfies })),
      warnings: sel.warnings,
      allowedExposure: exposure.allowed,
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

  // Identity Anchor — chosen INDEPENDENTLY of the scene selector ("who is this person?"); only when we
  // have analyzed candidates (it needs face knowledge). Never enters the selector's reasoning.
  const anchorCandidate = !manual && safeCandidates.length ? pickIdentityAnchor(safeCandidates) : null;
  const identityAnchor: ReferenceImage | undefined = anchorCandidate
    ? { url: anchorCandidate.url, role: "anchor" }
    : undefined;

  return {
    part: "reference",
    referenceImages,
    identityAnchor,
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
  async availability() {
    // Always available — references are the universal baseline (even with no analyzed candidates it
    // gracefully falls back to the static Visual Package, and may simply return no references).
    return { available: true, reason: "reference conditioning is always available" };
  },
  async contribute(_ctx, req) {
    return selectReferences(req);
  },
};
