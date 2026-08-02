/**
 * Identity Evaluation Engine (Milestone 26) — score how well a generation preserved the character.
 *
 * Composes the enabled evaluator modules (face today) into one `IdentityEvaluation`, using cached,
 * versioned, provider-neutral embeddings. Persists to `IdentityEvaluation` so routing (M27) and
 * auto-promote (M28) can consume MEASURED scores. Non-blocking for the user (called after the image is
 * shown, or per benchmark cell). See docs/IDENTITY_EVALUATION.md.
 */
import { prisma } from "@/lib/db";
import { getGeneratedMediaByIds } from "@/lib/media/server";
import { getIdentitySelectionCandidates } from "@/lib/identity/server";
import { rankIdentityAnchors } from "@/lib/selection";
import { emptyEvaluation, type IdentityEvaluation } from "./IdentityEvaluator";
import { getEmbeddingProvider, isEmbeddingConfigured } from "./providers";
import { getOrComputeEmbedding } from "./cache";
import { enabledEvaluators } from "./evaluators/registry";
import type { EvalContext, EvalDimension, EvalResult } from "./evaluators/types";

const MAX_FACE_REFS = 5; // strongest reference faces to compare against (cached, so cheap after first run)

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
  let weighted = 0;
  let totalWeight = 0;
  const writable = evaln as unknown as Record<string, number | null>;
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

/** Persist an evaluation (idempotent per generation): replace any prior rows for this generation. */
async function persist(userId: string, e: IdentityEvaluation): Promise<IdentityEvaluation> {
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
    },
  });
  return e;
}

/**
 * Evaluate one generation against its identity and persist the result. Owner-scoped; safe to call after
 * the image is shown. Degrades cleanly: no identity / no provider key / no face → a reserved-metrics row
 * with an explanatory `method`, never a throw that would surface to the user.
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
  if (!isEmbeddingConfigured()) {
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

  const candidates = await getIdentitySelectionCandidates(userId, gen.identityId);
  const references = rankIdentityAnchors(candidates)
    .filter((a) => a.eligible)
    .slice(0, MAX_FACE_REFS)
    .map((a) => ({ mediaId: a.mediaId, url: a.url }));

  const ctx: EvalContext = {
    identityId: gen.identityId,
    generated: { mediaId: output.id, url: asset.url },
    references,
    embed: (img, source) => getOrComputeEmbedding(userId, img.mediaId, img.url, source),
  };

  const method = getEmbeddingProvider().version;
  const results: (EvalResult & { weight: number })[] = [];
  for (const e of enabledEvaluators()) {
    results.push({ ...(await e.evaluate(ctx)), weight: e.weight });
  }

  return persist(userId, composeEvaluation(gen.identityId, generationId, method, results));
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
