/**
 * Model Benchmark harness check (Milestone 24.8) — validates the `params.benchmark` contract + the grid
 * read path WITHOUT any Fal spend. Part A is pure (registry filter). Part B seeds throwaway
 * `Generation` rows tagged in `params.benchmark`, then exercises the REAL JSON-path query against the
 * database (proving `getBenchmarkRun` / `listBenchmarkRuns` reassemble the grid, that a FAILED cell with
 * an empty `model` column still resolves via the tag, and that it's owner-scoped). Everything is torn
 * down in a `finally`, so the database is left clean.
 *
 * Requires DATABASE_URL (loaded from .env / .env.local). Run:  npx tsx scripts/verify-benchmark.ts
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

import { GenerationStatus, MediaType, Prisma, prisma } from "../src/lib/db";
import { getModel } from "../src/lib/ai/model-registry";
import {
  getBenchmarkRun,
  listBenchmarkRuns,
  listBenchmarkableModels,
} from "../src/lib/benchmark/server";

let passed = 0;
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`✗ ${message}`);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

const QWEN = "fal-ai/qwen-image-edit-2509";
const WAN = "wan/v2.6/image-to-image";
const NANO = "fal-ai/nano-banana-pro/edit";
const SCHNELL = "fal-ai/flux/schnell"; // t2i — must NOT be benchmarkable
const KONTEXT_LORA = "fal-ai/flux-kontext-lora"; // autoOnly — must NOT be benchmarkable

async function main() {
  console.log("Part A — benchmarkable models (pure):");
  const models = listBenchmarkableModels();
  const ids = new Set(models.map((m) => m.id));
  assert(ids.has(QWEN), "Qwen Image Edit is benchmarkable");
  assert(ids.has(WAN), "Wan v2.6 Edit is benchmarkable");
  assert(!ids.has(SCHNELL), "text-to-image (Schnell) is NOT benchmarkable");
  assert(!ids.has(KONTEXT_LORA), "autoOnly Kontext+LoRA is NOT benchmarkable");
  assert(
    models.every((m) => m.label && m.vendor && m.maxReferences > 0),
    "every benchmarkable model carries label + vendor + maxReferences",
  );

  const stamp = Date.now();
  let ownerId: string | undefined;
  let otherId: string | undefined;
  let projectId: string | undefined;

  try {
    console.log("\nPart B — seed tagged generations + read the grid (real DB):");
    const owner = await prisma.user.create({
      data: { name: "Bench Owner", email: `bench-owner-${stamp}@example.test` },
    });
    ownerId = owner.id;
    const other = await prisma.user.create({
      data: { name: "Bench Other", email: `bench-other-${stamp}@example.test` },
    });
    otherId = other.id;
    const project = await prisma.project.create({
      data: { userId: owner.id, name: `Bench Project ${stamp}` },
    });
    projectId = project.id;
    const identity = await prisma.identity.create({
      data: { userId: owner.id, projectId: project.id, name: `Bench Identity ${stamp}` },
    });

    const runId = `bench-run-${stamp}`;
    const mk = (
      modelId: string,
      cellIndex: number,
      status: GenerationStatus,
      opts: { modelColumn?: string; sourceLabel?: string } = {},
    ) =>
      prisma.generation.create({
        data: {
          userId: owner.id,
          projectId: project.id,
          identityId: identity.id,
          type: MediaType.IMAGE,
          prompt: "on the beach at sunset",
          provider: "fal",
          model: opts.modelColumn ?? modelId,
          status,
          params: {
            benchmark: { runId, modelId, cellIndex, sourceLabel: opts.sourceLabel },
          } as Prisma.InputJsonValue,
        },
      });

    // Cell 1 (index 1) is FAILED with an EMPTY model column — proves the tag (not the column) resolves it.
    await mk(QWEN, 0, GenerationStatus.SUCCEEDED, { sourceLabel: "portrait_01" });
    await mk(WAN, 1, GenerationStatus.FAILED, { modelColumn: "" });
    await mk(NANO, 2, GenerationStatus.SUCCEEDED);
    // Noise: a non-benchmark generation in the same project must be ignored by the grouping.
    await prisma.generation.create({
      data: {
        userId: owner.id,
        projectId: project.id,
        type: MediaType.IMAGE,
        prompt: "unrelated",
        provider: "fal",
        model: NANO,
        status: GenerationStatus.SUCCEEDED,
        params: { creative: { version: "x" } } as Prisma.InputJsonValue,
      },
    });

    const view = await getBenchmarkRun(owner.id, project.id, runId);
    assert(view != null, "getBenchmarkRun finds the run via the params.benchmark JSON path");
    assert(view!.cells.length === 3, "run has exactly 3 cells (noise generation excluded)");
    assert(
      view!.cells.map((c) => c.cellIndex).join(",") === "0,1,2",
      "cells are ordered by cellIndex",
    );
    assert(view!.prompt === "on the beach at sunset", "run prompt is carried");
    assert(view!.sourceLabel === "portrait_01", "sourceLabel comes from the tag");

    const failedCell = view!.cells[1];
    assert(failedCell.modelId === WAN, "FAILED cell resolves its modelId from the tag (empty column)");
    assert(
      failedCell.modelLabel === (getModel(WAN)?.label ?? WAN),
      "FAILED cell resolves its model label from the registry",
    );
    assert(failedCell.status === "FAILED", "FAILED cell keeps its FAILED status");
    assert(view!.cells[0].status === "SUCCEEDED", "succeeded cell keeps SUCCEEDED");
    assert(view!.cells.every((c) => c.media === null), "no result media seeded → media is null (no blob)");

    const runs = await listBenchmarkRuns(owner.id, project.id);
    const summary = runs.find((r) => r.runId === runId);
    assert(summary != null, "listBenchmarkRuns groups the tagged generations into one run");
    assert(summary!.modelCount === 3, "run summary counts 3 cells");
    assert(summary!.succeeded === 2, "run summary counts 2 succeeded");

    // Owner scoping.
    assert(
      (await getBenchmarkRun(other.id, project.id, runId)) === null,
      "another user cannot read the run (owner-scoped)",
    );
    assert(
      (await getBenchmarkRun(owner.id, project.id, "does-not-exist")) === null,
      "an unknown runId returns null",
    );

    console.log(`\nAll ${passed} checks passed.`);
  } finally {
    if (projectId) {
      await prisma.generation.deleteMany({ where: { projectId } }).catch(() => {});
      await prisma.identity.deleteMany({ where: { projectId } }).catch(() => {});
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (otherId) await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
