/**
 * Model Benchmark (Milestone 24.8) — types for the permanent, model-pluggable comparison harness.
 * A RUN pins one source + one prompt and generates a CELL per model; the grid is reassembled from
 * `Generation.params.benchmark` (schema-free). See docs/MODEL_BENCHMARK.md.
 */
import type { GenerationStatusValue } from "@/lib/generation/types";
import type { MediaAsset } from "@/lib/media/types";

/** A model that can be entered into a benchmark (enabled, hand-pickable, edit-capable). */
export type BenchmarkableModel = {
  id: string;
  label: string;
  vendor: string;
  maxReferences: number;
  note?: string;
};

/** Launch a benchmark run: same source + prompt across several models. */
export type RunBenchmarkInput = {
  identityId: string;
  prompt: string;
  /** Pinned source — sent verbatim to EVERY model (bypasses selector/anchor) so cells are comparable. */
  sourceMediaIds: string[];
  /** The models to compare (registry ids). */
  modelIds: string[];
  /** Cap references sent (fairness: hold constant across the row). Anchor-free — these ARE the refs. */
  maxReferences?: number;
  /** Display label for the pinned source. */
  sourceLabel?: string;
};

/** Immediate outcome of one cell from `runBenchmark` (the grid read-model is the source of truth). */
export type BenchmarkCellOutcome = {
  modelId: string;
  modelLabel: string;
  cellIndex: number;
  generationId: string | null;
  status: "SUCCEEDED" | "FAILED";
  error?: string;
};

export type RunBenchmarkResult = { runId: string; cells: BenchmarkCellOutcome[] };

/** One cell in the reassembled grid (owner-scoped, signed). */
export type BenchmarkCellView = {
  generationId: string;
  modelId: string;
  modelLabel: string;
  cellIndex: number;
  status: GenerationStatusValue;
  media: MediaAsset | null; // the signed output; null if the cell failed or has no result yet
};

/** A full benchmark run reassembled for the side-by-side grid. */
export type BenchmarkRunView = {
  runId: string;
  prompt: string;
  identityId: string | null;
  sourceLabel: string | null;
  createdAt: Date;
  cells: BenchmarkCellView[];
};

/** A benchmark run in the history list. */
export type BenchmarkRunSummary = {
  runId: string;
  prompt: string;
  createdAt: Date;
  modelCount: number;
  succeeded: number;
};
