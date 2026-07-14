# Prompt Builder

> **Update (2026-07-14):** The **Creative Director MVP** shipped the *engine* half of this design —
> the intent→prompt transform now lives as **`directCreative(brief)` in `src/lib/creative/`** (not
> `buildPrompt` in `src/lib/prompt/`), deterministic and provider-agnostic, wired at the generation
> chokepoint with the brief stored in `params.creative`. See [CREATIVE_DIRECTOR.md](./CREATIVE_DIRECTOR.md)
> and Decision 031. This document remains the design target for the fuller **builder UI** (creative
> brief facets, Review, "Open in Builder"/remix) that will sit on top of that Director.
>
> **Status: DESIGN ONLY (Milestone 12).** No code, schema, routes, or components. This is the
> experience the Prompt Builder will implement. Companion: [CREATIVE_WORKFLOW.md](./CREATIVE_WORKFLOW.md).
> Related: [VISION.md](./VISION.md), [IDENTITIES.md](./IDENTITIES.md),
> [GENERATION_RECIPES.md](./GENERATION_RECIPES.md), [PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md),
> [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md), [IDENTITY_UX.md](./IDENTITY_UX.md).

## What the Prompt Builder is

The **Prompt Builder is the bridge between creative intent and AI generation.** The user
**describes what they want to create**; AI Studio **constructs the optimal prompt**. The user
should never feel they are writing a technical prompt — no prompt syntax, no "trigger words",
no model jargon.

It is the natural evolution of today's minimal Generate tab: a free-text box becomes a guided,
intent-driven experience that *compiles* to a prompt. (Raw prompt text remains available as an
Advanced escape hatch — the app never traps power users.)

This realizes the core of [VISION.md](./VISION.md): **the user thinks creatively; AI Studio
thinks technically. You describe *what*; the app decides *how*.**

## UX philosophy

- **Describe, don't engineer.** Inputs are *intentions* (chips, pickers, plain words), never
  prompt tokens or weights.
- **Simple by default, powerful on demand.** Progressive disclosure: a Subject + a few chips is
  enough to generate; everything else is optional (Advanced).
- **The prompt is an output, not an input.** The compiled prompt is hidden by default; it's
  viewable (read-only) in Advanced/Review for the curious, never required.
- **Guided, not blank.** Suggested starting points and sensible defaults; the user is never
  staring at an empty box wondering what to type.
- **Provider-agnostic.** The builder emits a neutral *creative brief* → a neutral compiled
  prompt + params. No provider-specific strings ever live in the builder (Decision 007).
- **Calm.** However rich the options, the surface stays uncluttered (progressive disclosure +
  good defaults).

## User journey

```
Open Create (Prompt Builder)
      ↓ (optional) pick an Identity
Describe the subject in plain words         ("Emma holding coffee, smiling")
      ↓ tap a few intent chips              (Style · Mood · Lighting …)
      ↓ set Aspect + Quality                (maps to params, not prompt text)
Review  ── AI Studio compiles the brief → an optimized, provider-agnostic prompt
      ↓
Generate → provider (behind ImageProvider) → Blob → Gallery
      ↓
See it in the Gallery → tweak an intent → Generate again   (the creative loop)
```

## The Creative Brief

The Builder collects a structured **brief** — creative intent, not technical settings. Facets
are optional except a minimal seed (a Subject *or* an Identity).

| Facet | Example inputs (chips / picker / words) | Becomes… |
| ----- | --------------------------------------- | -------- |
| **Identity** | pick a project identity (Emma) — optional | subject reference (future: identity-aware) |
| **Subject** | "holding coffee, smiling", "as an astronaut" | prompt text (the core content) |
| **Style** | Photoreal · Cinematic · Anime · Pixar · Oil painting | prompt text |
| **Mood** | Serene · Dramatic · Joyful · Moody | prompt text |
| **Lighting** | Soft · Golden hour · Studio · Neon · Backlit | prompt text |
| **Camera** | Close-up · Portrait · Wide · Macro · Aerial | prompt text |
| **Composition** | Rule of thirds · Centered · Minimal · Symmetrical | prompt text |
| **Location** | beach · studio · city street · forest | prompt text |
| **Time of day** | Sunrise · Noon · Dusk · Night | prompt text |
| **Aspect ratio** | 1:1 · 4:5 · 16:9 · 9:16 | **params** (dimensions) |
| **Output quality** | Standard · High | **params** (steps/model tier) |
| **Additional notes** | free text (small, optional) | appended prompt text |

Two kinds of facets: those that shape the **prompt text** (natural language) and those that
shape **params** (aspect ratio, quality) — the latter never appear as words in the prompt.

## Modes

- **Simple mode (default):** Identity (optional) + "What are you creating?" + a handful of
  intent chips (Style/Mood/Lighting) + Aspect + Quality. One primary action: **Review &
  Generate**.
- **Advanced mode:** the full brief (all facets) + a **read-only compiled-prompt preview** +
  Copy. Still no manual prompt engineering required — just more knobs.

Advanced is a superset of Simple; switching modes never loses the brief.

## Prompt compilation (provider-agnostic transform)

A pure function compiles the brief → a neutral result:

```
buildPrompt(brief) → {
  prompt: string;          // natural-language, provider-neutral
  params: { aspectRatio?, quality?, ... };  // structured (dimensions, tier)
  negativePrompt?: string; // optional, future
}
```

- **Deterministic + pure** — same brief → same output; no I/O, no provider SDKs. Lives in a
  new `src/lib/prompt/` (implementation milestone), consumed by the generation layer.
- **AI Studio owns the phrasing.** It composes facets using its own natural-language templates
  (e.g. Style + Mood + Lighting + Subject + Location + Time → one coherent sentence). This is
  the "translation of intent" — the product's value, not the model's.
- **Never provider-specific.** The compiled prompt is neutral text; if a provider needs
  specialization (weights, syntax, size params), that happens **only** in its
  `ImageProvider` adapter — never in the builder ([PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md)).
- **Params vs text.** Aspect ratio → `params` (dimensions); quality → `params` (steps/tier).
  The provider adapter maps `params` to whatever its API expects.
- **Future prompt optimization.** An optional AI pass could *rewrite* the compiled prompt
  before generation — but that's an orchestration step ([CREATIVE_WORKFLOW.md](./CREATIVE_WORKFLOW.md)),
  not part of the builder, and out of scope now.

The current pipeline already accepts a `prompt` string ([GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md)),
so the Builder plugs in with **no change to the provider or media layers** — it feeds
`generateImage({ prompt, identityId })` with the compiled prompt, and the **brief is stored in
the recipe** (see Recipe integration).

## Components (planned — responsibilities only, not built)

```
PromptBuilder        Container: mode toggle (Simple/Advanced) + brief state + Review/Generate.
CreativeBriefForm    The facet inputs (Simple subset / Advanced full).
IdentityPicker       Pick an optional project identity (reuses identity components/hooks).
IntentChips          Multi/single-select chips for Style / Mood / Lighting / Camera / …
FacetSelect          Select for Aspect ratio / Quality / Time of day / Composition.
PromptPreview        Read-only compiled-prompt preview (+ Copy) — Advanced/Review only.
ReviewSheet          Summarize the brief before generating (Edit / Generate).
GenerateButton       Reuses the generation hook + loading/error states (Milestone 11).
```
Reuse throughout: `SectionTitle`, `Button`, `Select`, `Textarea`, `Badge`, the identity
pickers, the generation hooks, and `MediaViewer` for the result. **No second generation or
media pipeline.**

## States

```
Empty ─▶ Editing ─▶ Ready ─▶ Review ─▶ Generating ─▶ Result
  │         │         (min: a Subject or Identity)      │
  │         └─ inline guidance / suggestions            └─ Error → back to Editing
  └─ starting points (Portrait / Product / Scene / …)
```

- **Empty:** guidance + starting points; nothing required yet.
- **Editing:** building the brief; live validity (min seed present?).
- **Ready:** enough to generate (Review enabled).
- **Review:** brief summary + optional compiled-prompt reveal.
- **Generating / Result / Error:** reuse the Milestone 11 generation loading/result/error UX.

## Wireframes (ASCII)

### Empty state

```
+-----------------------------------------------------------------------+
|  Create                                                               |
|-----------------------------------------------------------------------|
|                         (sparkles)                                    |
|                  What do you want to create?                          |
|      Describe your idea — AI Studio writes the prompt for you.        |
|                                                                       |
|      [ e.g. "Emma on a beach at sunrise" _______________________ ]    |
|                          [ Start creating ]                          |
|                                                                       |
|   Or start from:  [ Portrait ] [ Product ] [ Scene ] [ Character ]    |
+-----------------------------------------------------------------------+
```

### Builder — Simple

```
+-----------------------------------------------------------------------+
|  Create                                              [ Advanced ▸ ]    |
|-----------------------------------------------------------------------|
|  Identity   ( None ▾ )         ← optional; pick a project identity     |
|                                                                       |
|  What are you creating?                                               |
|  [ a portrait of Emma smiling, holding coffee ___________________ ]   |
|                                                                       |
|  Style     [ Photoreal ] [ Cinematic ] [ Anime ] [ Pixar ] [ +More ]  |
|  Mood      [ Serene ] [ Dramatic ] [ Joyful ] [ Moody ]               |
|  Lighting  [ Soft ] [ Golden hour ] [ Studio ] [ Neon ]               |
|                                                                       |
|  Aspect ( 1:1 ▾ )     Quality ( Standard ▾ )                          |
|                                                                       |
|                                         [ Review & Generate ]         |
+-----------------------------------------------------------------------+
```

### Advanced mode

```
+-----------------------------------------------------------------------+
|  Create                                               [ ◂ Simple ]     |
|-----------------------------------------------------------------------|
|  Identity ( Emma ▾ )     Subject [ holding coffee, smiling _______ ]  |
|  Style ( Photoreal ▾ )   Mood ( Serene ▾ )    Lighting ( Golden ▾ )   |
|  Camera ( Portrait ▾ )   Composition ( Rule of thirds ▾ )             |
|  Location [ beach ___ ]  Time of day ( Sunrise ▾ )                    |
|  Aspect ( 4:5 ▾ )        Quality ( High ▾ )                           |
|  Additional notes [ soft film grain, warm tones _______________ ]     |
|-----------------------------------------------------------------------|
|  Compiled prompt (read-only)                                          |
|  > "Portrait of Emma holding coffee, smiling — serene, golden-hour    |
|     light on a beach at sunrise, rule-of-thirds, warm tones, soft     |
|     film grain, photorealistic."                                      |
|                                     [ Copy ]     [ Review & Generate ] |
+-----------------------------------------------------------------------+
```

### Review before generation

```
+---------------------------------------------+
|  Review                                  ✕  |
|---------------------------------------------|
|  Identity   Emma                            |
|  Subject    holding coffee, smiling         |
|  Look       Photoreal · Serene · Golden     |
|  Scene      beach · sunrise                 |
|  Aspect     4:5        Quality   High       |
|                                             |
|  ▸ Show compiled prompt                     |
|                                             |
|            [ Edit ]          [ Generate ]   |
+---------------------------------------------+
```

### Mobile (Simple)

```
+---------------------------+
| Create          [Advanced]|
|---------------------------|
| Identity ( None ▾ )       |
| What are you creating?    |
| [ ______________________ ]|
|                           |
| Style    [Photoreal] [+]  |
| Mood     [Serene] [+]     |
| Lighting [Soft] [+]       |
|                           |
| Aspect (1:1▾)  Qual (Std▾)|
|                           |
| [    Review & Generate   ]|
+---------------------------+
```

## Integration

- **Identity.** Optional Identity picker (reuses the identity layer/components). Selecting an
  identity attaches it to the generation for provenance today; **identity-aware prompting**
  (using training media / consistency intents) is future and lives behind the same brief.
- **Recipe.** The **brief is the recipe's creative source**. A generation stores its brief
  (structured intent) alongside the compiled prompt, so any result can be **re-opened in the
  Builder** ("Open in Builder" / Remix) with every facet restored — building directly on
  [GENERATION_RECIPES.md](./GENERATION_RECIPES.md). The recipe already stores `params`; the
  brief fits there (open decision below).
- **Gallery.** From a generated image's viewer, actions extend the Milestone 11 set: **Open in
  Builder** (load its brief to remix), alongside Copy Prompt / Generate Again / Variation. No
  new media pipeline — the Gallery still just renders `MediaAsset`s.
- **Generation.** The Builder compiles → calls the existing generation action
  (`generateImage({ prompt, identityId })`). The provider, media, and Blob layers are
  **unchanged** — the Builder sits *above* the generation layer.

## Future integration (design intent — not built)

- **Templates** = **saved briefs.** A Template is a saved Prompt Builder configuration (a brief
  preset, optionally partial) the user can apply and tweak. This is the clean evolution:
  Templates are Prompt Builder presets, not a separate system. *(Templates come after the
  Prompt Builder for exactly this reason.)*
- **Generation Recipes.** The recipe becomes brief + compiled prompt + provider/model + params
  → enables Recreate / Remix (edit brief) / Compare / branch (Decision 030 lineage).
- **Multiple identities.** The brief supports several identities (Emma + John) → the future
  `GenerationIdentity` "appears-in" join (Decision 026). The builder gains an identity *list*,
  not a redesign.
- **Video.** The brief adds motion facets (camera move, duration, pacing) → a parallel
  `VideoProvider`; results flow through the same media layer/Gallery (`GeneratedMedia.type =
  VIDEO`).
- **Workflow Builder.** Long-term, the Prompt Builder becomes one **node** in a visual pipeline
  (Prompt → Optimize → Identity → Generate → Enhance → Upscale → Video → Gallery). The brief is
  the input to the "Generate" node; other nodes are separate providers AI Studio orchestrates
  ([CREATIVE_WORKFLOW.md](./CREATIVE_WORKFLOW.md) / VISION Future Direction).

## Open decisions to lock at implementation (not decided now)

- **Where the brief is stored.** Reuse `Generation.params` (Json — no schema change, mirrors
  the recipe foundation) vs a typed `brief` column/shape. Lean: start in `params`; formalize
  only if a feature needs typed queries.
- **Facet vocabularies.** The exact chip sets (styles/moods/…) and their natural-language
  phrasings — curated, versioned, and provider-neutral.
- **Where `buildPrompt` lives.** Proposed `src/lib/prompt/` (pure, provider-agnostic),
  consumed by the generation layer; never imported by a provider.
- **Does the current raw-prompt Generate tab stay** as the Advanced escape hatch, or fold
  entirely into the Builder's Advanced mode.

## Explicitly out of scope (this milestone AND the first implementation)

Design only now. And when built, the Prompt Builder will **not** include: automatic provider
routing, multi-provider orchestration, a visual workflow/ComfyUI editor, video, AI agents,
identity relationships, or a full template system — those are later milestones (see
[ROADMAP.md](./ROADMAP.md)).
