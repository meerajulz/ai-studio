"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  getBenchmarkRun,
  listBenchmarkRuns,
  listBenchmarkableModels,
  runBenchmark,
} from "@/lib/benchmark/server";
import type {
  BenchmarkableModel,
  BenchmarkRunSummary,
  BenchmarkRunView,
  RunBenchmarkInput,
  RunBenchmarkResult,
} from "@/lib/benchmark/types";

/**
 * Owner-scoped Server Actions for the Model Benchmark harness (Milestone 24.8). Launching a run makes
 * real, paid provider calls (one per model) — user-driven. Reading reassembles the stored grid.
 */

export async function listBenchmarkableModelsAction(): Promise<BenchmarkableModel[]> {
  await requireUserId();
  return listBenchmarkableModels();
}

export async function runBenchmarkAction(
  projectId: string,
  input: RunBenchmarkInput,
): Promise<RunBenchmarkResult> {
  const userId = await requireUserId();
  return runBenchmark(userId, projectId, input);
}

export async function getBenchmarkRunAction(
  projectId: string,
  runId: string,
): Promise<BenchmarkRunView | null> {
  const userId = await requireUserId();
  return getBenchmarkRun(userId, projectId, runId);
}

export async function listBenchmarkRunsAction(
  projectId: string,
): Promise<BenchmarkRunSummary[]> {
  const userId = await requireUserId();
  return listBenchmarkRuns(userId, projectId);
}
