# Model Benchmark Harness (Milestone 24.8)

> **Purpose:** a *permanent, model-pluggable* way to compare edit models on **our** use case —
> character transformation with preserved identity, tattoos, and body — not generic image
> quality. Every future model (FLUX 3, GPT Image 3, Seedream 5, …) plugs into the same grid.
>
> Distinct from [IDENTITY_BENCHMARK.md](./IDENTITY_BENCHMARK.md), which varies *reference
> count* for one model. This varies the *model*, holding source + prompt constant.
>
> Part of the transform-first pivot — see [CHARACTER_TRANSFORMATION.md](./CHARACTER_TRANSFORMATION.md)
> (Decisions 060, 061).

## The idea

```
   same source image  +  same prompt
             │
   ┌─────────┼─────────┬─────────┬─────────┐
   ▼         ▼         ▼         ▼         ▼
Kontext    GPT     Nano Banana  Qwen      Wan     …every future model
   │         │         │         │         │
   └─────────┴────── side-by-side grid ────┴─────────┘
```

Human-judged today. When **M26 (Identity Evaluation)** lands, it auto-scores the *same
stored cells* (face / tattoos / body / hands / composition) and the harness becomes a real
internal eval suite — a compounding asset a competitor can't get by swapping in a new model.

## Why it's cheap: the plumbing already exists

- **Add a model = one registry line.** `fal.ts` is payload-kind driven (Milestone 21); any
  `{prompt, image_urls}` editor is a single `MODEL_REGISTRY` entry, no adapter change.
- **"Run this exact source + prompt on this exact model" already works:**
  `GenerateImageInput.modelOverride` (Decision 053) forces the model;
  `manualReferenceMediaIds` (Decision 051) pins the exact source images. The harness is a
  **loop + persistence + grid view**, not new generation code.

## Fairness rules (what makes it a benchmark, not a demo)

1. **Pin the source.** Every model in a run gets the byte-identical reference set via
   `manualReferenceMediaIds`. Otherwise the selector picks different refs per model and you're
   comparing *selections*, not *models*.
2. **Hold `maxReferences` constant** across the row, and **record how many refs each model
   actually consumed** (fal already echoes `sentImages`/`usedRefs` in debug) — single-ref
   models (`image_url`) aren't 1:1 comparable to multi-ref ones without noting it.
3. **Same prompt, verbatim**, for every cell in a run.
4. Same seed where the model supports it (future nicety).

## Data model — schema-free for M24.8

No new table. Each generated cell is a normal `Generation` tagged in `params`:

```jsonc
params.benchmark = { runId, sourceLabel, cellIndex }
```

The grid is a query: *all generations where `params.benchmark.runId = X`*. Outputs are
already persisted as generated media, so the grid is durable. When **M26** lands, its reserved
`IdentityEvaluation` table joins to these generations by id — auto-scoring with **no rework**.
If the suite proves valuable, promote to a dedicated `BenchmarkRun` / `BenchmarkCell` schema
*then*, not now.

## Components

| File | Role | Phase |
|---|---|---|
| `src/lib/ai/model-registry.ts` | Qwen + Wan entries (Nano Banana already registered) | **1 ✅** |
| `src/lib/benchmark/` | `runBenchmark({identityId, sourceMediaIds, prompt, modelIds[]})` loops `runImageGeneration` with `modelOverride` + pinned refs, tags each `Generation`; `getBenchmarkRun` / `listBenchmarkRuns` assemble the grid | 2 |
| `src/actions/benchmark.ts` | owner-scoped server actions | 2 |
| `src/app/(protected)/debug/benchmark/page.tsx` | launch form + side-by-side grid (matches `debug/vision`, `debug/selection`) | 3 |

## Registered edit models (M24.8)

| Model | Endpoint | Refs | Payload | Notes |
|---|---|---|---|---|
| Kontext Max Multi | `fal-ai/flux-pro/kontext/max/multi` | 4 | `image_urls` | Auto default (priority 95) |
| FLUX.2 Pro Edit | `fal-ai/flux-2-pro/edit` | 4 | `image_urls` | SOTA candidate |
| Nano Banana Pro | `fal-ai/nano-banana-pro/edit` | 6 | `image_urls` | Google |
| GPT Image 2 Edit | `openai/gpt-image-2/edit` | 4 | `image_urls` | may need OpenAI BYOK |
| Seedream 4 Edit | `fal-ai/bytedance/seedream/v4/edit` | 10 | `image_urls` | ByteDance |
| **Qwen Image Edit** | `fal-ai/qwen-image-edit-2509` | 4 | `image_urls` | 2509/2511 multi-image; strong text |
| **Wan v2.6 Edit** | `wan/v2.6/image-to-image` | 3 | `image_urls` | ⚠ verify id+param at first run |

Auto stays the proven Kontext Max Multi; the new models are **manual/benchmark picks** (modest
priority) so the default flow is unchanged.

## Open items
- **Wan verification** — confirm the exact endpoint id + image param on the first live run
  (fal.ai was rate-limiting at scoping; `image_urls` + `wan/v2.6/image-to-image` assumed).
- **Human judgment (Phase 3)** — store a per-cell star + note in `params` now (so early
  judgments aren't lost), vs purely visual until M26 auto-scores. Leaning: store it.
- **Source set** — one pinned source per run (cleanest) vs fan-out over several sources.
  Leaning: one per run for M24.8.

## Cost
The code is cheap; each *run* is real Fal spend (every model × every source×prompt cell).
Runs are user-driven and need `FAL_KEY` balance.
