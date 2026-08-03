/**
 * Identity Package explainability (Milestone 27 Phase 2) — turn the builder into a debuggable tool.
 *
 * `buildCharacterPackage` keeps only the argmax per role and discards the losers. `explainPackage` keeps
 * EVERYTHING: for each role, every candidate ranked by fitness with the reason it won or lost; and per
 * media, which roles it won and its contribution. Pure + deterministic; reuses the same `RoleScorer` the
 * builder uses, so what you see is exactly what drove the package. See docs/REFERENCE_INTELLIGENCE.md.
 */
import type { ExposureLevel } from "@/lib/vision/exposure";

import { heuristicRoleScorer } from "./roles";
import { ANCHOR_ROLES, type AnchorRole, type RoleScorer, type SelectionCandidate } from "./types";

/** One candidate's standing for a single role, with why it won / lost. */
export type RoleCandidate = {
  mediaId: string;
  url: string;
  fitness: number; // 0..100
  reasons: string[]; // the scorer's per-role reasons
  exposure: ExposureLevel;
  chosen: boolean; // the role winner
  rejection: string; // "chosen" | "lower than chosen (59 < 82)" | "no <role> signal"
};

export type RoleExplanation = {
  role: AnchorRole;
  chosenMediaId: string | null;
  candidates: RoleCandidate[]; // ranked best-first
};

/** One media asset's contribution across all roles (item 9 — the per-asset inspector row). */
export type MediaContribution = {
  mediaId: string;
  url: string;
  exposure: ExposureLevel;
  fitness: Record<AnchorRole, number>;
  wonRoles: AnchorRole[]; // roles this asset is the chosen anchor for
};

export type PackageExplanation = {
  roles: RoleExplanation[];
  media: MediaContribution[];
};

/** Explain the whole package: per-role rankings + per-media contribution. Pure. */
export function explainPackage(
  candidates: SelectionCandidate[],
  scorer: RoleScorer = heuristicRoleScorer,
): PackageExplanation {
  const profiles = candidates.map((c) => scorer.profile(c));

  const roles: RoleExplanation[] = ANCHOR_ROLES.map((role) => {
    const ranked = profiles
      .map((p) => ({ mediaId: p.mediaId, url: p.url, fitness: p.fitness[role], reasons: p.reasons[role], exposure: p.exposure }))
      .sort((a, b) => b.fitness - a.fitness);
    const winner = ranked.find((c) => c.fitness > 0) ?? null;
    const candidates: RoleCandidate[] = ranked.map((c) => {
      const chosen = winner != null && c.mediaId === winner.mediaId;
      const rejection = chosen
        ? "chosen"
        : c.fitness <= 0
          ? `no ${role} signal`
          : `lower than chosen (${Math.round(c.fitness)} < ${Math.round(winner!.fitness)})`;
      return { ...c, chosen, rejection };
    });
    return { role, chosenMediaId: winner?.mediaId ?? null, candidates };
  });

  const winnerByRole = new Map(roles.map((r) => [r.role, r.chosenMediaId] as const));
  const media: MediaContribution[] = profiles.map((p) => ({
    mediaId: p.mediaId,
    url: p.url,
    exposure: p.exposure,
    fitness: p.fitness,
    wonRoles: ANCHOR_ROLES.filter((role) => winnerByRole.get(role) === p.mediaId),
  }));

  return { roles, media };
}
