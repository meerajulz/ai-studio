# Model Registry — capability-routed image orchestration (Milestone 21)

> AI Studio is **not a FLUX app** — it's an orchestration layer that already chooses prompt, identity,
> references, and provider, and now also chooses the **model**, by CAPABILITY. Adding a new
> state-of-the-art model is a **config entry**, not a pipeline rewrite.
> Code: `src/lib/ai/model-registry.ts` + `src/lib/ai/model-router.ts`.

## Two layers of routing

```
Generate request
   │
   ▼  routeImageProvider({ needs })      ── WHO executes  (Fal · HF)      src/lib/ai/router.ts
   ▼  chooseModel({ provider, needs })   ── WHICH model   (by capability) src/lib/ai/model-router.ts
   ▼  provider.generateImage({ model })  ── the adapter builds the request from the model's payloadKind
```

Nothing outside the registry/adapter knows a model id. The generation layer requests **capabilities**
(e.g. `imageEditing + referenceImages + identityPreservation + multipleReferenceImages`) and the router
returns the best compatible model.

## The registry (`model-registry.ts`)

Each `ModelSpec` declares:

| field | purpose |
| ----- | ------- |
| `id` | provider model id (`fal-ai/flux-pro/kontext/max/multi`) |
| `provider` | the `ImageProvider` that executes it (all Fal-hosted today) |
| `vendor` | UI grouping — FLUX · Google · OpenAI · ByteDance |
| `capabilities` | `imageEditing`, `referenceImages`, `multipleReferenceImages`, `identityPreservation`, `realism`, `typography`, … |
| `maxReferences` | 1 (single) … 10 (Seedream) |
| `payloadKind` | `t2i` · `image_url` · `image_urls` — how the adapter shapes the request |
| `priority` | Auto tiebreak (higher wins) — **tune after benchmarking** |
| `enabled` · `note` | selectable? + caveats (e.g. BYOK) |

**Key research finding (Fal docs, 2026-07):** every target editing model takes the same
`{ prompt, image_urls[] }` shape, so almost the whole registry is `payloadKind: "image_urls"` over ONE
adapter builder — the Fal adapter has **no FLUX-specific branching**.

### Registered models

| Model | Vendor | id | payload | priority | note |
| ----- | ------ | -- | ------- | -------- | ---- |
| Kontext Max Multi | FLUX | `fal-ai/flux-pro/kontext/max/multi` | image_urls | **95 (Auto default)** | proven |
| FLUX.2 Pro Edit | FLUX | `fal-ai/flux-2-pro/edit` | image_urls | 92 | SOTA candidate (unbenchmarked) |
| Nano Banana Pro | Google | `fal-ai/nano-banana-pro/edit` | image_urls | 88 | |
| Kontext Pro Multi | FLUX | `fal-ai/flux-pro/kontext/multi` | image_urls | 85 | |
| Seedream V5 Pro | ByteDance | `bytedance/seedream/v5/pro/edit` | image_urls | 82 | refs ≤ 10 |
| GPT Image 2 Edit | OpenAI | `openai/gpt-image-2/edit` | image_urls | 80 | may need OpenAI BYOK on Fal |
| Gemini Image | Google | `fal-ai/gemini-25-flash-image/edit` | image_urls | 74 | |
| Kontext (single) · FLUX Schnell (t2i) | FLUX | fallbacks | image_url · t2i | 60 · 50 | |

**Auto stays on the proven Kontext Max Multi** until a benchmark beats it — adding models doesn't
silently change your default.

## Routing (`model-router.ts`)

`chooseModel({ provider, needs, mode, manualModelId })`:
- **auto** — highest-`priority` enabled model (for the provider) satisfying every `need`; falls back to
  the highest-priority enabled model if nothing fully matches.
- **manual** — the explicit `manualModelId` (must be enabled); falls back to auto if invalid.

The generation layer routes a model **only when references exist** (identity/editing path); a
no-reference generation falls through to the adapter's text-to-image.

## Three modes (Generate page, dev-only)

- **Auto (Recommended)** — the router picks; the Debug panel shows the chosen model + reason + the
  ranked "models considered". End users only ever see Auto.
- **Manual** — pick a model, grouped by vendor, for benchmarking (identical prompt + references).
- **Developer** — Manual + full model metadata (capabilities · priority · max refs · notes) inline.

`Generation.model` records the exact model used per result, so runs are comparable
(see [IDENTITY_BENCHMARK.md](./IDENTITY_BENCHMARK.md)).

## Adding a model

1. Add one `ModelSpec` to `MODEL_REGISTRY` (verify its Fal input schema — reference-image param + max
   refs — and set `payloadKind`).
2. That's it — the router, adapter, and Manual/Developer UI pick it up. No business-logic change.
   (If a model needs a genuinely new request shape, add a `payloadKind` + one adapter builder.)

## Verification status

- **Payload**: verified from Fal docs — all target editing models accept `{ prompt, image_urls }`.
- **Quality / identity fidelity**: the live benchmark (Manual mode).
- **Availability**: `openai/gpt-image-2/edit` may require OpenAI BYOK on the Fal account (`note`); Auto
  never prefers it over the proven default.
- Offline: `scripts/verify-model-routing.ts` (Auto picks the best capable enabled model; Manual honored;
  disabled never auto-chosen; Auto default stays Kontext Max Multi).
