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
  const startedAt = Date.now();
  let cacheHits = 0;
  let cacheMisses = 0;
  let providerError: string | null = null;

  // Provider-neutral, instrumented capabilities. Errors degrade to null (one bad image / a flaky endpoint
  // never throws to the user); the embed wrapper tallies cache hit/miss for debug.
  const ctx: EvalContext = {
    identityId: gen.identityId,
    generated: { mediaId: output.id, url: asset.url, role: "generated" },
    references: await evaluationAnchors(userId, gen.identityId),
    embed: supportsEmbed(provider)
      ? async (img, source) => {
          try {
            const { embedding, cached } = await getOrComputeEmbedding(userId, img.mediaId, img.url, source);
            if (embedding) cached ? (cacheHits += 1) : (cacheMisses += 1);
            return embedding;
          } catch (e) {
            providerError = e instanceof Error ? e.message : "embed failed";
            return null;
          }
        }
      : undefined,
    compare: supportsCompare(provider)
      ? async (a, b) => {
          try {
            return await provider.compare(a, b);
          } catch (e) {
            providerError = e instanceof Error ? e.message : "compare failed";
            return null;
          }
        }
      : undefined,
  };

  const results: (EvalResult & { weight: number })[] = [];
  for (const e of enabledEvaluators()) {
    results.push({ ...(await e.evaluate(ctx)), weight: e.weight });
  }

  const method = providerError ? "provider-error" : provider.version;
  const metrics = {
    provider: provider.id,
    version: provider.version,
    evalMs: Date.now() - startedAt,
    cache: { hits: cacheHits, misses: cacheMisses },
    error: providerError,
    dimensions: results.map((r) => ({ dimension: r.dimension, score: r.score, confidence: r.confidence, details: r.details ?? null })),
  } as unknown as Prisma.InputJsonValue;

  return persist(userId, composeEvaluation(gen.identityId, generationId, method, results), metrics);
}

/** The UI-facing evaluation, flattened from the persisted row + its metrics (Milestone 26 Phase 2). */
export type EvaluationView = {
  face: number | null;
  overall: number | null;
  confidence: number | null;
  method: string;
  provider: string | null;
  evalMs: number | null;
  cacheHits: number | null;
  cacheMisses: number | null;
  anchors: { role: string; mediaId: string; sim: number }[];
};

type PersistedMetrics = {
  provider?: string;
  evalMs?: number;
  cache?: { hits?: number; misses?: number };
  dimensions?: { dimension: string; score: number | null; confidence: number | null; details?: { anchorSims?: { role: string; mediaId: string; sim: number }[] } }[];
};

/** Read the latest evaluation for a generation as the UI view (score + confidence + provider + timing +
 * cache + per-anchor). Owner-scoped; `null` if not evaluated. */
export async function getGenerationEvaluationView(
  userId: string,
  generationId: string,
): Promise<EvaluationView | null> {
  const row = await prisma.identityEvaluation.findFirst({
    where: { generationId, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  const m = (row.metrics as unknown as PersistedMetrics) ?? {};
  const faceDim = m.dimensions?.find((d) => d.dimension === "face");
  return {
    face: row.face,
    overall: row.overallIdentityScore,
    confidence: faceDim?.confidence ?? null,
    method: row.method,
    provider: m.provider ?? null,
    evalMs: m.evalMs ?? null,
    cacheHits: m.cache?.hits ?? null,
    cacheMisses: m.cache?.misses ?? null,
    anchors: faceDim?.details?.anchorSims ?? [],
  };
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
