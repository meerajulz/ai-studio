"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import { listProjects } from "@/actions/projects";
import { getIdentityAction, listIdentitiesAction } from "@/actions/identities";
import {
  getBenchmarkRunAction,
  listBenchmarkRunsAction,
  listBenchmarkableModelsAction,
  runBenchmarkCellAction,
} from "@/actions/benchmark";
import type { BenchmarkCellOutcome, BenchmarkRunView } from "@/lib/benchmark/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CellStatus = "pending" | "running" | "succeeded" | "failed";
type CellState = { status: CellStatus; error?: string };

/**
 * Model Benchmark grid (Milestone 24.8, Phase 3) — dev tool. Pin one source + one prompt and run it
 * across several edit models, side by side. The loop is CLIENT-DRIVEN (one `runBenchmarkCellAction` per
 * model) so it never hits a serverless timeout and the grid fills in progressively. Human-judged today;
 * M26 (Identity Evaluation) will auto-score the same stored cells. See docs/MODEL_BENCHMARK.md.
 */
export function BenchmarkView() {
  const [projectId, setProjectId] = useState("");
  const [identityId, setIdentityId] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [maxRefs, setMaxRefs] = useState("");
  const [running, setRunning] = useState(false);
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({});
  const [grid, setGrid] = useState<BenchmarkRunView | null>(null);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const models = useQuery({
    queryKey: ["benchmark-models"],
    queryFn: () => listBenchmarkableModelsAction(),
  });
  const identities = useQuery({
    queryKey: ["benchmark-identities", projectId],
    queryFn: () => listIdentitiesAction(projectId),
    enabled: Boolean(projectId),
  });
  const identity = useQuery({
    queryKey: ["benchmark-identity", identityId],
    queryFn: () => getIdentityAction(identityId),
    enabled: Boolean(identityId),
  });
  const runs = useQuery({
    queryKey: ["benchmark-runs", projectId],
    queryFn: () => listBenchmarkRunsAction(projectId),
    enabled: Boolean(projectId),
  });

  const trainingMedia = identity.data?.trainingMedia ?? [];
  const canRun =
    Boolean(projectId && identityId && prompt.trim()) &&
    pinned.length > 0 &&
    selectedModels.length > 0 &&
    !running;

  function togglePinned(id: string) {
    setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function toggleModel(id: string) {
    setSelectedModels((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function run() {
    if (!canRun) return;
    setRunning(true);
    setGrid(null);
    const runId = crypto.randomUUID();
    const maxReferences = maxRefs ? Number(maxRefs) : undefined;
    setCellStates(Object.fromEntries(selectedModels.map((m) => [m, { status: "pending" }])));

    for (let i = 0; i < selectedModels.length; i++) {
      const modelId = selectedModels[i];
      setCellStates((s) => ({ ...s, [modelId]: { status: "running" } }));
      let outcome: BenchmarkCellOutcome;
      try {
        outcome = await runBenchmarkCellAction(projectId, {
          runId,
          identityId,
          prompt: prompt.trim(),
          sourceMediaIds: pinned,
          modelId,
          cellIndex: i,
          maxReferences,
        });
      } catch (e) {
        outcome = {
          modelId,
          modelLabel: modelId,
          cellIndex: i,
          generationId: null,
          status: "FAILED",
          error: e instanceof Error ? e.message : "generation failed",
        };
      }
      setCellStates((s) => ({
        ...s,
        [modelId]: {
          status: outcome.status === "SUCCEEDED" ? "succeeded" : "failed",
          error: outcome.error,
        },
      }));
      // Progressive fill: re-read the (signed) grid after each cell.
      const view = await getBenchmarkRunAction(projectId, runId).catch(() => null);
      if (view) setGrid(view);
    }

    setRunning(false);
    runs.refetch();
  }

  async function loadRun(runId: string) {
    const view = await getBenchmarkRunAction(projectId, runId).catch(() => null);
    if (view) {
      setGrid(view);
      setCellStates({});
      setSelectedModels(view.cells.map((c) => c.modelId));
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">Model Benchmark</h1>
        <p className="text-muted-foreground text-sm">
          Same source + prompt across edit models, side by side (M24.8). Human-judged today; auto-scored
          once Identity Evaluation (M26) lands. Each run is real Fal spend.
        </p>
      </header>

      {/* Setup */}
      <section className="grid gap-4 rounded-lg border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Project</span>
            <select
              className="rounded-md border bg-transparent px-2 py-1.5"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setIdentityId("");
                setPinned([]);
                setGrid(null);
              }}
            >
              <option value="">Select a project…</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Identity</span>
            <select
              className="rounded-md border bg-transparent px-2 py-1.5"
              value={identityId}
              onChange={(e) => {
                setIdentityId(e.target.value);
                setPinned([]);
                setGrid(null);
              }}
              disabled={!projectId}
            >
              <option value="">Select an identity…</option>
              {identities.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Pin source images */}
        {identityId ? (
          <div className="grid gap-2">
            <span className="text-muted-foreground text-sm">
              Pinned source ({pinned.length}) — sent verbatim to every model
            </span>
            {trainingMedia.length ? (
              <div className="flex flex-wrap gap-2">
                {trainingMedia.map((item) => {
                  const on = pinned.includes(item.media.id);
                  return (
                    <button
                      key={item.media.id}
                      type="button"
                      onClick={() => togglePinned(item.media.id)}
                      className={`relative size-20 overflow-hidden rounded-md border-2 ${
                        on ? "border-primary" : "border-transparent opacity-70"
                      }`}
                      title={item.knowledge ? "analyzed" : "not analyzed"}
                    >
                      <Image
                        src={item.media.url}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                      {on ? (
                        <span className="bg-primary text-primary-foreground absolute left-0 top-0 px-1 text-[10px]">
                          {pinned.indexOf(item.media.id) + 1}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">This identity has no training media.</p>
            )}
          </div>
        ) : null}

        {/* Prompt */}
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Prompt (same for every model)</span>
          <Textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. on the beach at sunset, wearing a bikini, smiling"
          />
        </label>

        {/* Models */}
        <div className="grid gap-2">
          <span className="text-muted-foreground text-sm">Models ({selectedModels.length})</span>
          <div className="flex flex-wrap gap-2">
            {models.data?.map((m) => {
              const on = selectedModels.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModel(m.id)}
                  className={`rounded-md border px-2.5 py-1.5 text-sm ${
                    on ? "border-primary bg-primary/10" : "text-muted-foreground"
                  }`}
                  title={m.note ?? m.id}
                >
                  {m.label}
                  <span className="text-muted-foreground ml-1 text-xs">· {m.vendor}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
            Max refs
            <input
              type="number"
              min={1}
              max={10}
              value={maxRefs}
              onChange={(e) => setMaxRefs(e.target.value)}
              placeholder="auto"
              className="w-16 rounded-md border bg-transparent px-2 py-1"
            />
          </label>
          <Button onClick={run} disabled={!canRun}>
            {running ? <Loader2 className="size-4 animate-spin" /> : null}
            {running ? "Running…" : `Run benchmark (${selectedModels.length})`}
          </Button>
        </div>
      </section>

      {/* Grid */}
      {selectedModels.length ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium">
            {grid ? `Prompt: “${grid.prompt}”` : "Results"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectedModels.map((modelId) => {
              const cell = grid?.cells.find((c) => c.modelId === modelId);
              const state = cellStates[modelId];
              const label =
                cell?.modelLabel ?? models.data?.find((m) => m.id === modelId)?.label ?? modelId;
              return (
                <div key={modelId} className="grid gap-1.5 rounded-lg border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{label}</span>
                    {state ? (
                      <Badge
                        variant={
                          state.status === "succeeded"
                            ? "default"
                            : state.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {state.status}
                      </Badge>
                    ) : cell ? (
                      <Badge variant="outline">{cell.status}</Badge>
                    ) : null}
                  </div>
                  <div className="bg-muted relative aspect-square overflow-hidden rounded-md">
                    {cell?.media?.url ? (
                      <Image
                        src={cell.media.url}
                        alt={label}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="text-muted-foreground grid h-full place-items-center text-xs">
                        {state?.status === "running" ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : state?.status === "failed" ? (
                          <span className="px-2 text-center">{state.error ?? "failed"}</span>
                        ) : (
                          "—"
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* History */}
      {runs.data?.length ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium">Recent runs</h2>
          <ul className="grid gap-1.5">
            {runs.data.map((r) => (
              <li key={r.runId}>
                <button
                  type="button"
                  onClick={() => loadRun(r.runId)}
                  className="hover:bg-muted flex w-full items-center justify-between gap-3 rounded-md border p-2 text-left text-sm"
                >
                  <span className="truncate">{r.prompt}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {r.succeeded}/{r.modelCount} ok · {new Date(r.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
