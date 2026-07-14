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

v1 was `idea → category → prompt` (one keyword decided everything). v2+ is a **deterministic,
multi-stage reasoning pipeline** — it analyses the *whole scene*, then its *spatial structure*,
instead of stopping at the first entity:

```
idea → resolveIdentity → analyzeScene → analyzeSpatial → analyzeIntent → planComposition → compilePrompt → prompt
        (Stage 0)         (Stage 1)      (Stage 1.5)      (Stage 2)       (Stage 3)         (Stage 4)
```

Each stage is a **pure function with a single responsibility** that returns structured data and
knows nothing about a provider. Only the final compiled `prompt` leaves the layer.

| Stage | File | Input → Output |
| ----- | ---- | -------------- |
| 0 · Identity Context | `stages/identity.ts` | idea + optional `IdentityContext` → an `effectiveIdea` (identity woven in as the subject) + `IdentityReasoning`. Passive: the context is loaded upstream by the generation layer; the Director never fetches it. |
| 1 · Scene Analysis | `stages/scene.ts` | (effective) idea → `Scene` (primary/secondary subjects, objects, living beings, environment, setting, location, time, weather, actions, fantasy) |
| 1.5 · Spatial Analysis | `stages/spatial.ts` | idea + `Scene` → `SceneGraph` (nodes with `role` + descriptor + position, an **`anchor`**, and confidence-scored **relationships** — "dog" —on(0.9)→ "sofa") |
| 2 · Intent Analysis | `stages/intent.ts` | `Scene` + `SceneGraph` → `IntentAnalysis` (portrait / lifestyle / interior-design / architectural / automotive / food / product / landscape / wildlife / concept-art / …) |
| 3 · Composition Planning | `stages/composition.ts` | `Scene` + `SceneGraph` + `IntentAnalysis` (+ style/focus) → `CompositionPlan` (framing, camera distance/angle, composition, perspective, depth of field, lighting, realism, quality floor) |
| 4 · Prompt Compilation | `stages/compile.ts` | all of the above → a `CompiledStructure`, **rendered** to the final plain-text prompt (structured, not concatenated) |

### Identity context (Stage 0)

When the user selects an identity, the generation layer loads a passive `IdentityContext` (name,
description, `hasHeroImage`, `trainingMediaCount`; provider artifacts reserved) and hands it to the
Director. `resolveIdentity` weaves a subject reference — *"Emma, a young woman with red hair"* —
into the idea so the *whole* downstream pipeline reasons about the identity as the subject (e.g.
"drinking coffee in Paris" becomes a lifestyle portrait of Emma rather than a coffee close-up).
**Identity is passive and provider-unaware**: it never reasons or emits prompts, no stage below
knows what an identity is, and the provider still receives only the final compiled prompt. This is
a *foundation* — name + description only; LoRA/embeddings/training are a later milestone.

### Spatial understanding & the anchor (Stage 1.5, v4)

The `SceneGraph` is a lightweight, **internal-only** representation (never persisted). Each entity
is a node with a `role` (primary/secondary/object), an optional descriptor ("red" sofa) and frame
`position`. The graph has an **`anchor`** — the central object everything else is positioned
around: a subject (person/animal/vehicle) when present, otherwise the room's characteristic
furniture (living room→sofa, bedroom→bed, kitchen→island/table, office→desk).

**Relationships carry confidence.** Explicit prepositions (`on`, `under`, `behind`, `in front of`,
`left/right of`, `next to`, `between`, `near`, `around`, `against the wall`, `over`, `holding`, …)
become **high-confidence** edges with exact wording. Co-mentioned objects with **no** preposition
become a **low-confidence, neutral** "near the anchor" association ("with two plants and a window")
— the Director never invents a specific direction it wasn't given.

### Compilation — enrich, never replace (Stage 4, v4.1)

**The user's prompt is the source of truth.** The compiler leads with the full idea **verbatim**
(with the identity reference woven in by Stage 0), so every clothing item, prop, action,
interaction and location the user wrote **survives into the compiled prompt**. It then **appends**
only what the user didn't specify — genre, camera, composition, perspective, depth of field,
lighting, realism, quality — de-duplicated so nothing already stated is repeated or weakened.

The scene graph still drives *reasoning* (anchor, intent, composition) and powers the Debug panel's
`CompiledStructure`, but it **never replaces the user's words** (Decision 039 — the earlier
"compile from the graph" approach silently dropped unrecognized words like "bikini"/"Chihuahua").
Intent still drives composition (interiors go wide; product/food/portrait isolate the subject).
**The provider still receives only plain text.**

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
pipeline stage shown separately**: User prompt · **Identity context** · Scene analysis · **Spatial
analysis (scene graph — anchor + relationship confidence)** · Intent analysis · Composition plan ·
**Compiled structure** · Creative rules applied · Compiled prompt · Provider · Model · Generation
payload. The
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
