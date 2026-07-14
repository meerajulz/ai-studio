# Generation Recipes

> **Status: implemented foundation (Milestone 11 — AI Generation v2).** Related:
> [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md), [AI_GENERATION.md](./AI_GENERATION.md),
> [PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md), [DECISIONS.md](./DECISIONS.md) (#030).

## What a recipe is

A **recipe** is the complete, permanent record of *how* a generated image was made. In this
codebase, **the `Generation` row IS the recipe** — no separate table (Decision 030). It
already captures everything needed:

| Recipe field | Stored on `Generation` |
| ------------ | ---------------------- |
| prompt | `prompt` |
| provider | `provider` (e.g. `"huggingface"`) |
| model | `model` (e.g. `black-forest-labs/FLUX.1-schnell`) |
| identity used | `identityId` (nullable; multi-identity is future — Decision 026) |
| settings / workflow metadata | `params` (Json — e.g. regenerate/variation lineage) |
| timestamps | `createdAt` / `updatedAt` |
| status | `status` |
| result(s) | `GeneratedMedia[]` (the output, via the media layer) |

The media layer exposes a **read-only** slice of this to the UI as `MediaAsset.recipe`
(prompt/provider/model/identity/generationId/date) for generated media — so the Gallery can
show it without any feature touching the DB directly.

## Why recipes exist

**Nothing creative should ever be lost.** A recipe means every image can be traced back to
exactly how it was made, and re-run. It's the foundation for the creative loop
(`generate → improve → generate again`) and for everything below.

## What recipes enable

- **Recreate / Regenerate** — re-run a recipe unchanged (a *new* `Generation`, same prompt +
  provider + model). Implemented now: `regenerateGeneration` → tags `params.source =
  "regenerate"`, `params.fromGenerationId`.
- **Variations** — re-run with the same prompt today; future versions inject variation
  parameters. Implemented now: `generateVariation` → `params.source = "variation"`.
- **Remix** *(future)* — edit a recipe (prompt/model/settings) before running. The recipe
  shape already supports it; the UI is a later milestone (Prompt Builder).
- **Compare** *(future)* — recipes make two results directly comparable (same fields, side by
  side).
- **Version history / branching** *(future)* — because regenerate/variation store
  `fromGenerationId` in `params`, generations form a lineage. A future view can render the
  tree (branch, compare across versions). No schema change needed to start — `params` carries
  lineage today; a dedicated column/edge can be added when a feature consumes it.

## Design notes (don't over-design)

- **No new table, no new columns** this milestone — the `Generation` model already holds the
  recipe. Lineage lives in the existing `params` Json (Decision 030).
- **Read-only in the media layer.** `MediaAsset.recipe` is derived from the `Generation` when
  listing/getting generated media; it is never written through the media layer.
- **Provider-agnostic.** A recipe records *what* was asked and *which* provider/model ran —
  never provider SDK internals. Swapping providers later doesn't change the recipe concept.
- **Owner-scoped.** Recipes are read/re-run only by their owner (like all generation actions).

## Deletion & lifecycle (Decision 033)

A generated image and its `Generation` (recipe) **share one lifecycle** in this MVP. Deleting a
generated asset from the Gallery deletes the owning `Generation` too: `deleteMedia` removes the
Blob object(s), then deletes the `Generation` (its `GeneratedMedia` child cascades via
`onDelete: Cascade`), and `useDeleteMedia` invalidates the generation-history query so the Generate
page reflects the change immediately — no empty, result-less cards, no orphan recipes.

Why couple them: today the image is a generation's *only* surface (no recipe library / Templates
yet), so a recipe with no image is invisible clutter and deleting the image is an unambiguous
"remove this". This is forward-compatible — when Templates arrive, "save as template" will *copy*
the recipe deliberately, so nothing a user chose to keep is lost by deleting an image. Soft-delete
and keep-orphan-recipe were rejected (see Decision 033).
