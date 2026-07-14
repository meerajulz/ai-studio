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
| 1.5 · Spatial Analysis | `stages/spatial.ts` | idea + `Scene` → `SceneGraph` (nodes with descriptor + frame position, and directed spatial **relationships** — "dog" —on→ "sofa", "window" —behind→ "sofa") |
| 2 · Intent Analysis | `stages/intent.ts` | `Scene` → `IntentAnalysis` (portrait / lifestyle / interior-design / automotive / food / product / landscape / wildlife / concept-art / …) |
| 3 · Composition Planning | `stages/composition.ts` | `Scene` + `SceneGraph` + `IntentAnalysis` (+ style/focus) → `CompositionPlan` (framing, camera distance/angle, composition, perspective, depth of field, lighting, realism, quality floor) |
| 4 · Prompt Compilation | `stages/compile.ts` | all of the above → the final prompt, assembled **Scene → Spatial → Intent → Composition → Quality** |

### Identity context (Stage 0)

When the user selects an identity, the generation layer loads a passive `IdentityContext` (name,
description, `hasHeroImage`, `trainingMediaCount`; provider artifacts reserved) and hands it to the
Director. `resolveIdentity` weaves a subject reference — *"Emma, a young woman with red hair"* —
into the idea so the *whole* downstream pipeline reasons about the identity as the subject (e.g.
"drinking coffee in Paris" becomes a lifestyle portrait of Emma rather than a coffee close-up).
**Identity is passive and provider-unaware**: it never reasons or emits prompts, no stage below
knows what an identity is, and the provider still receives only the final compiled prompt. This is
a *foundation* — name + description only; LoRA/embeddings/training are a later milestone.

### Spatial understanding (Stage 1.5)

The `SceneGraph` is a lightweight, **internal-only** representation (never persisted): entities
become nodes with an optional descriptor ("red" sofa, "wooden" desk, "large" window) and frame
`position` (center/left/right/…), and prepositions become directed **relationships**
(`on`, `under`, `behind`, `in front of`, `left/right of`, `next to`, `over`, `holding`, …). It is
built by scanning the idea for relation/position phrases and linking the nearest entities on
either side (longest-phrase-wins so "sitting on" beats "on", "in front of" beats "on").

Two ways it makes prompts smarter:
- **Composition** widens to show the whole arrangement when the scene actually has relationships
  (a room with subjects), but still *isolates* the subject for product/food/portrait intents — so
  an animal on a sofa is a lifestyle scene, not a portrait.
- **Compilation preserves relationships instead of flattening.** The user's own sentence leads the
  prompt verbatim (so "a dog sitting on a sofa" is kept as-is, never reduced to "dog, sofa"), and
  the graph only *adds* a spatial phrase when the idea doesn't already express it. Relationships
  therefore survive all the way into the compiled prompt.

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
analysis (scene graph)** · Intent analysis · Composition plan · Creative rules applied · Compiled
prompt · Provider · Model · Generation payload. The
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
