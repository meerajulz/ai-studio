/**
 * Package optimization (Milestone 20, Steps 3–5) — the heart of Smart Reference Selection.
 *
 * Do NOT just take the four highest-scoring images (that yields four near-identical faces). Instead
 * maximize COVERAGE of the requested requirements: greedily pick the image that adds the most NEW
 * weighted requirement coverage (marginal gain), explain each pick, and warn about hard requirements
 * no image can satisfy. Never blocks generation. Pure + deterministic + provider-neutral.
 */
import { matchImage } from "./match";
import type {
  ImageMatch,
  PromptRequirements,
  ReferenceRole,
  Requirement,
  RequirementId,
  SelectedReference,
  SelectionCandidate,
  SelectionResult,
} from "./types";

/** A requirement counts as "covered" once some selected image scores at least this. */
const COVERED = 50;
/** Stop selecting once the best remaining image adds less than this weighted gain (avoid redundancy). */
const MIN_GAIN = 0.05;

const ROLE_OF: Record<RequirementId, ReferenceRole> = {
  face: "face", frontFace: "face", profile: "face", backView: "face", visibleEyes: "face",
  fullBody: "body", upperBody: "body", hands: "body", feet: "body",
  chestTattoos: "tattoos", armTattoos: "tattoos", backTattoos: "tattoos", legTattoos: "tattoos",
  hair: "hair",
  smile: "expression", expression: "expression",
  indoor: "scene", outdoor: "scene", action: "scene",
  elegantClothing: "support", swimwear: "support", businessWear: "support",
};

const ROLE_ORDER: ReferenceRole[] = ["hero", "face", "body", "tattoos", "hair", "expression", "scene", "support"];

export function selectReferencePackage(
  candidates: SelectionCandidate[],
  requirements: PromptRequirements,
  opts: { max?: number } = {},
): SelectionResult {
  const max = opts.max ?? 4;
  const matches = candidates.map((c) => matchImage(c, requirements));
  const ranked = [...matches].sort((a, b) => b.baseScore - a.baseScore);
  const active = requirements.active;

  // No requirements or no candidates → fall back to the strongest images by overall score.
  if (active.length === 0 || matches.length === 0) {
    const pkg: SelectedReference[] = ranked.slice(0, max).map((mth, i) => ({
      mediaId: mth.mediaId,
      url: mth.candidate.url,
      role: i === 0 ? "hero" : "support",
      reason: i === 0 ? "Highest overall image score." : "Strong supporting reference.",
      satisfies: [],
      matchScore: mth.baseScore,
    }));
    return finalize(requirements, ranked, pkg, []);
  }

  const labelOf = new Map(active.map((r) => [r.id, r.label] as const));
  // How many images can satisfy each requirement at all (for "only image with …" reasoning).
  const satisfierCount = new Map<RequirementId, number>(
    active.map((r) => [r.id, matches.filter((m) => (m.perRequirement[r.id] ?? 0) >= COVERED).length]),
  );

  const coverage: Partial<Record<RequirementId, number>> = {};
  const chosen: SelectedReference[] = [];
  const remaining = new Set(matches.map((m) => m.mediaId));
  const usedLabels = new Set<RequirementId>(); // keep each pick's reason distinct + informative

  const gainOf = (m: ImageMatch): number =>
    active.reduce((sum, r) => {
      const delta = (m.perRequirement[r.id] ?? 0) - (coverage[r.id] ?? 0);
      return sum + (delta > 0 ? (r.weight * delta) / 100 : 0);
    }, 0);

  while (chosen.length < max && remaining.size > 0) {
    let best: ImageMatch | null = null;
    let bestGain = 0;
    for (const m of matches) {
      if (!remaining.has(m.mediaId)) continue;
      const g = gainOf(m);
      if (g > bestGain || (best === null && g > 0)) {
        best = m;
        bestGain = g;
      }
    }
    if (!best || bestGain < MIN_GAIN) break;

    // Which requirements this pick newly improves (weighted delta), best-first.
    const improved = active
      .map((r) => ({ r, delta: (best!.perRequirement[r.id] ?? 0) - (coverage[r.id] ?? 0) }))
      .filter((x) => x.delta > 0 && (best!.perRequirement[x.r.id] ?? 0) >= COVERED)
      .sort((a, b) => b.r.weight * b.delta - a.r.weight * a.delta);

    // Label the pick by its most valuable NEW contribution, preferring a requirement not already used
    // as another pick's headline so each reason is distinct (e.g. two strong faces don't both say
    // "Best face" — the second is labelled by whatever else it uniquely adds).
    const preferred = improved.find((x) => !usedLabels.has(x.r.id));
    const top = (preferred ?? improved[0])?.r;
    const satisfies = improved.map((x) => x.r.id);
    const role: ReferenceRole = top ? ROLE_OF[top.id] : "support";
    const matchScore = top ? (best.perRequirement[top.id] ?? best.baseScore) : best.baseScore;
    const reason = top
      ? preferred
        ? satisfierCount.get(top.id) === 1
          ? `Only image with ${labelOf.get(top.id)}.`
          : `Best ${labelOf.get(top.id)}.`
        : `Additional strong ${labelOf.get(top.id)} reference.` // a better instance of an already-covered need
      : "Strong supporting reference.";
    if (top) usedLabels.add(top.id);

    chosen.push({ mediaId: best.mediaId, url: best.candidate.url, role, reason, satisfies, matchScore });
    remaining.delete(best.mediaId);
    for (const r of active) {
      coverage[r.id] = Math.max(coverage[r.id] ?? 0, best.perRequirement[r.id] ?? 0);
    }
  }

  // Always send at least one reference (the strongest) when candidates exist.
  if (chosen.length === 0 && ranked.length) {
    const hero = ranked[0];
    chosen.push({
      mediaId: hero.mediaId,
      url: hero.candidate.url,
      role: "hero",
      reason: "Highest overall image score (no requirement strongly matched).",
      satisfies: [],
      matchScore: hero.baseScore,
    });
  }

  const warnings = buildWarnings(active, coverage, labelOf);
  return finalize(requirements, ranked, orderPackage(chosen, active), warnings);
}

function buildWarnings(
  active: Requirement[],
  coverage: Partial<Record<RequirementId, number>>,
  labelOf: Map<RequirementId, string>,
): string[] {
  return active
    .filter((r) => !r.soft && (coverage[r.id] ?? 0) < COVERED)
    .map((r) => `${capitalize(labelOf.get(r.id) ?? r.id)} requested but no suitable reference exists.`);
}

/**
 * Order best-first for the provider by each pick's WEIGHTED value (its top satisfied requirement's
 * weight × match) — so a body/scene reference leads a body-dependent prompt, while a portrait still
 * leads with the face. The lead reference is the primary identity anchor for this request; if it's a
 * face it's labelled the "hero".
 */
function orderPackage(pkg: SelectedReference[], active: Requirement[]): SelectedReference[] {
  const weightOf = new Map(active.map((r) => [r.id, r.weight] as const));
  const value = (p: SelectedReference): number => {
    const primaryWeight = p.satisfies.length
      ? Math.max(...p.satisfies.map((id) => weightOf.get(id) ?? 0))
      : 0.5;
    return primaryWeight * p.matchScore;
  };
  const ordered = [...pkg].sort(
    (a, b) => value(b) - value(a) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
  if (ordered.length && ordered[0].role === "face") ordered[0] = { ...ordered[0], role: "hero" };
  return ordered;
}

function finalize(
  requirements: PromptRequirements,
  ranked: ImageMatch[],
  pkg: SelectedReference[],
  warnings: string[],
): SelectionResult {
  return {
    requirements,
    ranked,
    package: pkg,
    warnings,
    orderedReferenceUrls: pkg.map((p) => p.url),
  };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
