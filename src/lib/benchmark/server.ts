/**
 * Model Benchmark (Milestone 24.8) — the permanent, model-pluggable comparison harness (server).
 *
 * A RUN holds one source + one prompt constant and generates one CELL per model, so the results are
 * genuinely comparable across models. It REUSES the tested generation path (`generateImage`) with the
 * existing dev seams — `modelOverride` (Decision 053) forces the model and `manualReferenceMediaIds`
 * (Decision 051) pins the identical source — and tags each `Generation` in `params.benchmark`
 * (schema-free). The grid is reassembled by querying that tag. Human-judged today; M26 (Identity
 * Evaluation) auto-scores the same stored cells. See docs/MODEL_BENCHMARK.md.
 */
import { randomUUID } from "node:crypto";

import { getModel, MODEL_REGISTRY } from "@/lib/ai/model-registry";
import { Prisma, prisma } from "@/lib/db";
import { generateImage } from "@/lib/generation/server";
import { evaluateGeneration } from "@/lib/identity-engine";
import type { BenchmarkCellTag, GenerationStatusValue } from "@/lib/generation/types";
import { getGeneratedMediaByIds } from "@/lib/media/server";
import type {
  BenchmarkableModel,
  BenchmarkCellOutcome,
  BenchmarkCellView,
  BenchmarkRunSummary,
  BenchmarkRunView,
  RunBenchmarkCellInput,
  RunBenchmarkInput,
  RunBenchmarkResult,
} from "./types";

const LIST_SCAN_LIMIT = 300; // recent generations scanned to group runs (dev tool)

/** The models a user can enter into a benchmark: enabled, hand-pickable, and reference-capable editors. */
export function listBenchmarkableModels(): BenchmarkableModel[] {
  return MODEL_REGISTRY.filter(
    (m) =>
      m.enabled &&
      !m.autoOnly &&
      m.capabilities.includes("imageEditing") &&
      m.capabilities.includes("referenceImages"),
  ).map((m) => ({
    id: m.id,
    label: m.label,
    vendor: m.vendor,
    maxReferences: m.maxReferences,
    note: m.note,
  }));
}

/** Safely read the `params.benchmark` tag off a stored generation. */
function readBenchmarkTag(params: Prisma.JsonValue | null): BenchmarkCellTag | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const b = (params as Record<string, unknown>).benchmark;
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  if (typeof o.runId !== "string" || typeof o.modelId !== "string") return null;
  return {
    runId: o.runId,
    modelId: o.modelId,
    sourceLabel: typeof o.sourceLabel === "string" ? o.sourceLabel : undefined,
    cellIndex: typeof o.cellIndex === "number" ? o.cellIndex : undefined,
  };
}

/** Run ONE benchmark cell (one model). Never throws — a provider failure becomes a FAILED outcome so
 * one bad model doesn't abort the whole run. The generation is persisted+tagged either way. Exported so
 * the UI can drive the loop client-side (one cell per request), avoiding a long, timeout-prone action. */
export async function runBenchmarkCell(
  userId: string,
  projectId: string,
  cell: RunBenchmarkCellInput,
): Promise<BenchmarkCellOutcome> {
  const modelLabel = getModel(cell.modelId)?.label ?? cell.modelId;
  const startedAt = Date.now();
  try {
    const result = await generateImage(userId, projectId, {
      prompt: cell.prompt,
      identityId: cell.identityId,
      manualReferenceMediaIds: cell.sourceMediaIds, // identical source for every model
      modelOverride: cell.modelId,
      modelMode: "manual",
      maxReferences: cell.maxReferences,
      benchmark: {
        runId: cell.runId,
        modelId: cell.modelId,
        sourceLabel: cell.sourceLabel,
        cellIndex: cell.cellIndex,
      },
    });
    const genMs = Date.now() - startedAt;
    // Auto-score identity preservation (Milestone 26/27). Best-effort — a measurement failure or a missing
    // provider key must never fail the benchmark cell.
    let faceScore: number | null = null;
    let overall: number | null = null;
    try {
      const evaluation = await evaluateGeneration(userId, result.generationId);
      faceScore = evaluation.face;
      overall = evaluation.overallIdentityScore;
    } catch {
      faceScore = null;
    }
    return {
      modelId: cell.modelId,
      modelLabel,
      cellIndex: cell.cellIndex,
      generationId: result.generationId,
      status: "SUCCEEDED",
      faceScore,
      overall,
      genMs,
    };
  } catch (e) {
    return {
      modelId: cell.modelId,
      modelLabel,
      cellIndex: cell.cellIndex,
      generationId: null,
      status: "FAILED",
      error: e instanceof Error ? e.message : "generation failed",
    };
  }
}

/**
 * Run a benchmark: the same source + prompt across every requested model, SEQUENTIALLY (each cell is a
 * real, paid provider call — sequential avoids surprise parallel spend + provider rate limits). Returns
 * the per-cell outcomes; the durable grid is read back via `getBenchmarkRun`. Ownership is enforced by
 * `generateImage` (project + identity scope). Real cost — user-driven.
 */
export async function runBenchmark(
  userId: string,
  projectId: string,
  input: RunBenchmarkInput,
): Promise<RunBenchmarkResult> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is required.");
  if (input.modelIds.length === 0) throw new Error("Pick at least one model to compare.");
  if (input.sourceMediaIds.length === 0) throw new Error("Pin at least one source image.");

  const runId = randomUUID();
  const cells: BenchmarkCellOutcome[] = [];
  for (let i = 0; i < input.modelIds.length; i++) {
    cells.push(
      await runBenchmarkCell(userId, projectId, {
        runId,
        identityId: input.identityId,
        prompt,
        sourceMediaIds: input.sourceMediaIds,
        modelId: input.modelIds[i],
        cellIndex: i,
        maxReferences: input.maxReferences,
        sourceLabel: input.sourceLabel,
      }),
    );
  }
  return { runId, cells };
}

/** Reassemble one benchmark run for the side-by-side grid (owner-scoped, signed). `null` if unknown. */
export async function getBenchmarkRun(
  userId: string,
  projectId: string,
  runId: string,
): Promise<BenchmarkRunView | null> {
  const rows = await prisma.generation.findMany({
    where: { userId, projectId, params: { path: ["benchmark", "runId"], equals: runId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      prompt: true,
      identityId: true,
      model: true,
      status: true,
      params: true,
      createdAt: true,
      updatedAt: true,
      results: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (rows.length === 0) return null;

  const resultIds = rows
    .map((r) => r.results[0]?.id)
    .filter((id): id is string => Boolean(id));
  const assets = await getGeneratedMediaByIds(userId, resultIds);
  const assetById = new Map(assets.map((a) => [a.id, a]));

  // Persisted identity-evaluation scores (Milestone 26/27), joined by generation.
  const evals = await prisma.identityEvaluation.findMany({
    where: { userId, generationId: { in: rows.map((r) => r.id) } },
    select: { generationId: true, face: true, overallIdentityScore: true },
  });
  const faceByGeneration = new Map(evals.map((e) => [e.generationId, e.face]));
  const overallByGeneration = new Map(evals.map((e) => [e.generationId, e.overallIdentityScore]));

  const cells: BenchmarkCellView[] = rows
    .map((r) => {
      const tag = readBenchmarkTag(r.params);
      const modelId = tag?.modelId ?? r.model; // tag is reliable even when the cell failed
      const resultId = r.results[0]?.id;
      return {
        generationId: r.id,
        modelId,
        modelLabel: getModel(modelId)?.label ?? (modelId || "(unknown model)"),
        cellIndex: tag?.cellIndex ?? 0,
        status: r.status as GenerationStatusValue,
        media: resultId ? (assetById.get(resultId) ?? null) : null,
        faceScore: faceByGeneration.get(r.id) ?? null,
        overall: overallByGeneration.get(r.id) ?? null,
        genMs: r.updatedAt.getTime() - r.createdAt.getTime(),
      };
    })
    .sort((a, b) => a.cellIndex - b.cellIndex);

  const first = rows[0];
  const firstTag = readBenchmarkTag(first.params);
  return {
    runId,
    prompt: first.prompt,
    identityId: first.identityId,
    sourceLabel: firstTag?.sourceLabel ?? null,
    createdAt: first.createdAt,
    cells,
  };
}

/** Recent benchmark runs for a project (grouped from tagged generations), newest first — owner-scoped. */
export async function listBenchmarkRuns(
  userId: string,
  projectId: string,
): Promise<BenchmarkRunSummary[]> {
  // Scan recent generations and group in JS (robust across Prisma JSON-null semantics for a dev tool).
  const rows = await prisma.generation.findMany({
    where: { userId, projectId },
    orderBy: { createdAt: "desc" },
    take: LIST_SCAN_LIMIT,
    select: { prompt: true, status: true, params: true, createdAt: true },
  });

  const byRun = new Map<
    string,
    { prompt: string; createdAt: Date; modelCount: number; succeeded: number }
  >();
  for (const r of rows) {
    const tag = readBenchmarkTag(r.params);
    if (!tag) continue;
    const cur = byRun.get(tag.runId);
    if (!cur) {
      byRun.set(tag.runId, {
        prompt: r.prompt,
        createdAt: r.createdAt,
        modelCount: 1,
        succeeded: r.status === "SUCCEEDED" ? 1 : 0,
      });
    } else {
      cur.modelCount += 1;
      if (r.status === "SUCCEEDED") cur.succeeded += 1;
      if (r.createdAt > cur.createdAt) cur.createdAt = r.createdAt;
    }
  }

  return [...byRun.entries()]
    .map(([runId, v]) => ({
      runId,
      prompt: v.prompt,
      createdAt: v.createdAt,
      modelCount: v.modelCount,
      succeeded: v.succeeded,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
