/**
 * Identity Evaluation Engine (Milestone 26) — the evaluation half that mirrors generation.
 *
 *   generation:  Character → Identity Package → Transformation → Provider → Image
 *   evaluation:  Image → Identity Evaluation → {Face, Tattoo, Body, Hair} evaluators → Identity Score
 *
 * Composes the enabled evaluator modules into ONE `IdentityEvaluation` of normalized scores and persists
 * it, so routing (M27) and auto-promote (M28) consume MEASURED data. It knows nothing about how a score
 * was produced — embeddings, a compare API, or a future model all arrive as `{score, confidence}`.
 * See docs/IDENTITY_EVALUATION.md.
 */
import { Prisma, prisma } from "@/lib/db";
import { getGeneratedMediaByIds } from "@/lib/media/server";
import { getIdentitySelectionCandidates } from "@/lib/identity/server";
import { getCharacterPackage } from "@/lib/identity/package";
import { rankIdentityAnchors } from "@/lib/selection";
import { emptyEvaluation, type IdentityEvaluation } from "./IdentityEvaluator";
import {
  getFaceSimilarityProvider,
  isFaceSimilarityConfigured,
  supportsCompare,
  supportsEmbed,
} from "./providers";
import { getOrComputeEmbedding } from "./cache";
import { enabledEvaluators } from "./evaluators/registry";
import type { EvalContext, EvalDimension, EvalImage, EvalResult } from "./evaluators/types";

const MAX_FACE_REFS = 5; // fallback cap when there is no persisted package

/** Map an evaluator dimension to its `IdentityEvaluation` column (dims without a column live in metrics). */
const DIMENSION_COLUMN: Partial<Record<EvalDimension, keyof IdentityEvaluation>> = {
  face: "face",
  tattoo: "tattoos",
  hair: "hair",
  pose: "pose",
};

/** PURE: fold evaluator results into an `IdentityEvaluation` (+ weighted overall). Offline-testable. */
export function composeEvaluation(
  identityId: string,
  generationId: string | null,
  method: string,
  results: (EvalResult & { weight: number })[],
): IdentityEvaluation {
  const evaln = emptyEvaluation(identityId, generationId, method);
  const writable = evaln as unknown as Record<string, number | null>;
  let weighted = 0;
  let totalWeight = 0;
  for (const r of results) {
    const col = DIMENSION_COLUMN[r.dimension];
    if (col && r.score != null) writable[col] = r.score;
    if (r.score != null && r.weight > 0) {
      weighted += r.score * r.weight;
      totalWeight += r.weight;
    }
  }
  evaln.overallIdentityScore = totalWeight > 0 ? weighted / totalWeight : null;
  return evaln;
}

/** The character's SEMANTIC anchors for evaluation — Face + Canonical from the Identity Package. */
async function evaluationAnchors(userId: string, identityId: string): Promise<EvalImage[]> {
  const pkg = await getCharacterPackage(userId, identityId);
  if (pkg) {
    const anchors = pkg.anchors
      .filter((a) => a.roles.includes("face") || a.roles.includes("canonical"))
      .map((a) => ({ mediaId: a.mediaId, url: a.url, role: a.roles.includes("face") ? "face" : "canonical" }));
    const seen = new Set<string>();
    const deduped = anchors.filter((a) => (seen.has(a.mediaId) ? false : seen.add(a.mediaId)));
    if (deduped.length) return deduped;
  }
  // Fallback (identity not analyzed into a package yet): the strongest analyzed faces.
  const candidates = await getIdentitySelectionCandidates(userId, identityId);
  return rankIdentityAnchors(candidates)
    .filter((a) => a.eligible)
    .slice(0, MAX_FACE_REFS)
    .map((a) => ({ mediaId: a.mediaId, url: a.url, role: "face" }));
}

/** Persist an evaluation (idempotent per generation): replace any prior rows for this generation. */
async function persist(
  userId: string,
  e: IdentityEvaluation,
  metrics: Prisma.InputJsonValue | null = null,
): Promise<IdentityEvaluation> {
  if (e.generationId) {
    await prisma.identityEvaluation.deleteMany({ where: { generationId: e.generationId, userId } });
  }
  await prisma.identityEvaluation.create({
    data: {
      userId,
      identityId: e.identityId,
      generationId: e.generationId,
      face: e.face,
      tattoos: e.tattoos,
      hair: e.hair,
      accessories: e.accessories,
      pose: e.pose,
      expression: e.expression,
      lighting: e.lighting,
      composition: e.composition,
      overallIdentityScore: e.overallIdentityScore,
      method: e.method,
      metrics: metrics ?? undefined,
    },
  });
  return e;
}

/**
 * Evaluate one generation against its identity and persist the result. Owner-scoped; safe to call after
 * the image is shown. Degrades cleanly: no identity / no provider / no face → a reserved-metrics row with
 * an explanatory `method`, never a throw that would surface to the user.
 */
export async function evaluateGeneration(
  userId: string,
  generationId: string,
): Promise<IdentityEvaluation> {
  const gen = await prisma.generation.findFirst({
    where: { id: generationId, userId },
    select: { id: true, identityId: true },
  });
  if (!gen?.identityId) {
    return persist(userId, emptyEvaluation(gen?.identityId ?? "", generationId, "no-identity"));
  }
  if (!isFaceSimilarityConfigured()) {
    return persist(userId, emptyEvaluation(gen.identityId, generationId, "not-configured"));
  }

  const output = await prisma.generatedMedia.findFirst({
    where: { generationId, userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!output) return persist(userId, emptyEvaluation(gen.identityId, generationId, "no-output"));
  const [asset] = await getGeneratedMediaByIds(userId, [output.id]);
  if (!asset) return persist(userId, emptyEvaluation(gen.identityId, generationId, "no-output"));

  const provider = getFaceSimilarityProvider();
  const ctx: EvalContext = {
    identityId: gen.identityId,
    generated: { mediaId: output.id, url: asset.url, role: "generated" },
    references: await evaluationAnchors(userId, gen.identityId),
    embed: supportsEmbed(provider)
      ? (img, source) => getOrComputeEmbedding(userId, img.mediaId, img.url, source)
      : undefined,
    compare: supportsCompare(provider) ? (a, b) => provider.compare(a, b) : undefined,
  };

  const results: (EvalResult & { weight: number })[] = [];
  for (const e of enabledEvaluators()) {
    results.push({ ...(await e.evaluate(ctx)), weight: e.weight });
  }

  const metrics = {
    provider: provider.id,
    version: provider.version,
    dimensions: results.map((r) => ({ dimension: r.dimension, score: r.score, confidence: r.confidence, details: r.details ?? null })),
  } as unknown as Prisma.InputJsonValue;

  return persist(userId, composeEvaluation(gen.identityId, generationId, provider.version, results), metrics);
}

/** Read the latest persisted evaluation for a generation (owner-scoped). */
export async function getGenerationEvaluation(
  userId: string,
  generationId: string,
): Promise<IdentityEvaluation | null> {
  const row = await prisma.identityEvaluation.findFirst({
    where: { generationId, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return {
    identityId: row.identityId,
    generationId: row.generationId,
    face: row.face,
    tattoos: row.tattoos,
    hair: row.hair,
    accessories: row.accessories,
    pose: row.pose,
    expression: row.expression,
    lighting: row.lighting,
    composition: row.composition,
    overallIdentityScore: row.overallIdentityScore,
    method: row.method,
    createdAt: row.createdAt,
  };
}
