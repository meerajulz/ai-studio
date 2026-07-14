# Creative Director

> **Status: IMPLEMENTED — v2 Scene Understanding (Milestone 13, Decision 032).** Code:
> `src/lib/creative/`. Companion design: [PROMPT_BUILDER.md](./PROMPT_BUILDER.md) ·
> [CREATIVE_WORKFLOW.md](./CREATIVE_WORKFLOW.md).

## What it is

The **Creative Director** is the intelligent translation layer between a user's creative **idea**
and the AI provider. The user *thinks creatively*; the Director *thinks technically*.

```
Creative idea → Creative Director → Professional prompt → Image provider → Gallery
```

It is **the only place in the app that enriches a prompt.** Everything else passes the user's
words straight through to here.

## The reasoning pipeline (v2)

v1 was `idea → category → prompt` (one keyword decided everything). v2 is a **deterministic,
multi-stage reasoning pipeline** — it analyses the *whole scene* instead of stopping at the first
entity:

```
idea → analyzeScene → analyzeIntent → planComposition → compilePrompt → prompt
        (Stage 1)      (Stage 2)       (Stage 3)         (Stage 4)
```

Each stage is a **pure function with a single responsibility** that returns structured data and
knows nothing about a provider. Only the final compiled `prompt` leaves the layer.

| Stage | File | Input → Output |
| ----- | ---- | -------------- |
| 1 · Scene Analysis | `stages/scene.ts` | idea → `Scene` (primary/secondary subjects, objects, living beings, environment, setting, location, time, weather, actions, fantasy) |
| 2 · Intent Analysis | `stages/intent.ts` | `Scene` → `IntentAnalysis` (portrait / lifestyle / interior-design / automotive / food / product / landscape / wildlife / concept-art / …) |
| 3 · Composition Planning | `stages/composition.ts` | `Scene` + `IntentAnalysis` (+ style/focus) → `CompositionPlan` (framing, camera distance/angle, composition, perspective, depth of field, lighting, realism, quality floor) |
| 4 · Prompt Compilation | `stages/compile.ts` | all of the above → the final prompt, assembled **Scene → Intent → Composition → Quality** |

The vocabulary (entity/setting/location/time/weather/action lexicons + the entity finder) lives
in `lexicon.ts` — the one place raw keyword knowledge sits, and the seam an LLM would replace.

### Contract (unchanged for callers)

```ts
directCreative(brief: CreativeBrief): CreativeDirective
```

`CreativeBrief` = `idea` + optional `style`/`focus`/`identityId`. `CreativeDirective` = `prompt`
(professional, provider-neutral) + reserved `params` + `meta` carrying the **full reasoning
trace** (`scene`, `intent`, `composition`, `appliedModifiers`). **Pure + deterministic** — same
brief → same directive, no I/O, no provider SDKs, no AI. An LLM can later replace any single stage
(e.g. scene analysis) without touching callers.

## Why scene understanding matters

Intent is inferred from the whole scene, not the first matched word:

- `red sofa with a dog and cat sitting on it` → primary **sofa**, secondary **[dog, cat]**, setting
  **living room** → intent **lifestyle**, *"wide shot showing the full scene"* — **not** an animal
  portrait.
- `woman drinking coffee in Paris` → **lifestyle** (not just "person").
- `red Ferrari in Tokyo` → **automotive**. `pizza` → **food photography**. `modern living room` →
  **interior design**. `golden retriever running on the beach` → **wildlife / action**.
  `dragon flying over a castle` → **concept art** (fantasy genre wins, realism switches away from
  "photorealistic").
- `sofa` / `chair` / `table` (lone) → **product photography** (a neutral studio shot, never a
  person).

The Milestone 12 guards remain: an unrecognised subject never becomes a portrait, and a negated
people mention (*"no person on it"*) is not read as a person subject.

## Developer Debug Mode (development only)

Every generation returns a `debug` trace **only when `NODE_ENV !== "production"`**
(`GenerationResult.debug`, `undefined` in production). The Generate page renders it with **each
pipeline stage shown separately**: User prompt · Scene analysis · Intent analysis · Composition
plan · Creative rules applied · Compiled prompt · Provider · Model · Generation payload. The
payload is a **secret-free echo** the provider adapter builds (`ImageGenerationResult.requestPayload`
— never contains the token). Nothing debug-related ships to production.

## Integration

- Wired at the single generation chokepoint: `runImageGeneration` calls `directCreative`, sends
  the compiled prompt to the provider, stores the user's **idea** in `Generation.prompt` and the
  style/focus/intent + compiled prompt in `params.creative`.
- **Recipes stay reproducible** (Decision 030): regenerate/variation reconstruct the brief and
  re-run the deterministic pipeline. No schema change.
- **Provider-agnostic** (Decision 007): no stage imports a provider; provider-specific mapping
  stays in the `ImageProvider` adapter.
- **UI:** only one optional creative question — **Style**. No CFG/steps/sampler/negative-prompt/
  LoRA/model/provider is ever exposed.
- **Identity:** the brief carries `identityId` so the Director *knows* an identity exists;
  identity-aware prompting is deferred.

## Future (behind the same entry point / same stages)

Replace individual stages with LLM reasoning; richer brief facets + Creative Questions; prompt
optimization; identity-aware prompting; provider/model/pipeline selection; video prompting — all
added inside the pipeline without changing how callers invoke `directCreative`.
