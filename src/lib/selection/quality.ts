/**
 * Identity Package Quality (Milestone 27 Phase 3) — how strong is this package BEFORE we generate?
 *
 * Turns the per-role anchor fitness (from `explainPackage`) into a coverage checklist + a PREDICTED
 * preservation profile. These are heuristic predictions, NOT measurements — the caller must label them
 * "predicted". When a real evaluator ships for a dimension (M26), the measured value replaces the
 * prediction with no interface change. Pure + deterministic. See docs/REFERENCE_INTELLIGENCE.md.
 */
import { explainPackage } from "./explain";
import { heuristicRoleScorer } from "./roles";
import type { AnchorRole, RoleScorer, SelectionCandidate } from "./types";

export type CoverageStatus = "strong" | "weak" | "missing";
export type RoleCoverage = { role: AnchorRole; status: CoverageStatus; fitness: number }; // fitness 0..1

export type PredictedDimension = "face" | "hair" | "tattoo" | "body";

export type PackageQuality = {
  overall: number; // 0..100 (weighted, predicted)
  coverage: RoleCoverage[];
  predicted: Record<PredictedDimension, number | null>; // 0..1; null = the character has no signal (e.g. no tattoos)
};

const STRONG = 0.7;
const WEAK = 0.3;
const statusOf = (f: number): CoverageStatus => (f >= STRONG ? "strong" : f >= WEAK ? "weak" : "missing");

/** Which anchor role sources each predicted dimension, and its weight in the overall score. */
const DIM_ROLE: Record<PredictedDimension, AnchorRole> = { face: "face", hair: "hair", tattoo: "tattoo", body: "body" };
const DIM_WEIGHT: Record<PredictedDimension, number> = { face: 0.5, tattoo: 0.2, body: 0.2, hair: 0.1 };

/** Roles shown in the coverage checklist (in order). Tattoo is only shown when the character has tattoos. */
const COVERAGE_ROLES: AnchorRole[] = ["face", "body", "hair", "tattoo", "canonical"];

export function assessPackageQuality(
  candidates: SelectionCandidate[],
  scorer: RoleScorer = heuristicRoleScorer,
): PackageQuality {
  const ex = explainPackage(candidates, scorer);
  const roleWinnerFitness = new Map<AnchorRole, number>(); // 0..1
  const roleHasSignal = new Map<AnchorRole, boolean>();
  for (const r of ex.roles) {
    const winner = r.candidates.find((c) => c.chosen);
    roleWinnerFitness.set(r.role, (winner?.fitness ?? 0) / 100);
    roleHasSignal.set(r.role, r.candidates.some((c) => c.fitness > 0));
  }

  const coverage: RoleCoverage[] = [];
  for (const role of COVERAGE_ROLES) {
    if (role === "tattoo" && !roleHasSignal.get(role)) continue; // tattoo-free character → not a gap
    const fitness = roleWinnerFitness.get(role) ?? 0;
    coverage.push({ role, status: statusOf(fitness), fitness });
  }

  const predicted = { face: null, hair: null, tattoo: null, body: null } as Record<PredictedDimension, number | null>;
  for (const dim of Object.keys(DIM_ROLE) as PredictedDimension[]) {
    const role = DIM_ROLE[dim];
    predicted[dim] = roleHasSignal.get(role) ? (roleWinnerFitness.get(role) ?? 0) : null;
  }

  let weighted = 0;
  let totalWeight = 0;
  for (const dim of Object.keys(DIM_WEIGHT) as PredictedDimension[]) {
    const v = predicted[dim];
    if (v != null) {
      weighted += v * DIM_WEIGHT[dim];
      totalWeight += DIM_WEIGHT[dim];
    }
  }
  const overall = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;

  return { overall, coverage, predicted };
}
