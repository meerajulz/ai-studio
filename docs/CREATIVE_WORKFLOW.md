# Creative Workflow

> **Status: DESIGN ONLY (Milestone 12).** The end-to-end creative loop and screen flow that the
> Prompt Builder plugs into. Companion: [PROMPT_BUILDER.md](./PROMPT_BUILDER.md). Related:
> [VISION.md](./VISION.md), [IDENTITIES.md](./IDENTITIES.md),
> [GENERATION_RECIPES.md](./GENERATION_RECIPES.md), [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md).

## The creative loop

AI Studio is organized around one loop. The user always **describes what they want**; AI
Studio handles **how** to make it (see [VISION.md](./VISION.md)).

```
Project
  ↓ (optional) Identity        reuse a subject (face / character / product)
  ↓
Describe intent                the Prompt Builder — plain words + intent chips
  ↓  (AI Studio compiles the brief → an optimal, provider-agnostic prompt)
Generate                       provider behind ImageProvider → Blob → media layer
  ↓
Gallery                        the result appears (source: "generated")
  ↓
Improve                        tweak one intent, Regenerate, or make a Variation
  ↓
Generate again ────────────────┘   (recipes keep every step; nothing is lost)
```

Every screen in the app exists to serve a stage of this loop. The Prompt Builder is the
**Describe intent** stage — the bridge from creativity to generation.

## Where the Prompt Builder sits

Today (Milestone 11) the "Describe intent" stage is a single free-text box on the **Generate**
tab. The Prompt Builder replaces that box with a guided, intent-driven experience that
*compiles* to a prompt — **without changing anything downstream**:

```
[ Prompt Builder ]  ← evolves the Generate tab
        │  compiles brief → prompt (+ params)
        ▼
generateImage({ prompt, identityId })   ← unchanged generation layer
        ▼
ImageProvider → Blob → Media layer → Gallery   ← all unchanged
```

The Builder sits **above** the generation layer. Provider, media, and Blob layers are
untouched (Decisions 007 / 029 / 030). This is why the Prompt Builder is a safe next step: it's
additive on top of a proven pipeline.

## Screen flow

```
Projects
   └─ Project workspace (tabs)
        ├─ Uploads    → bring in reference media
        ├─ Identities → curate reusable subjects
        ├─ Create     → THE PROMPT BUILDER  (describe → review → generate)
        │      │
        │      ▼  result
        └─ Gallery    → browse results; open one → Recipe actions:
                          Copy Prompt · Generate Again · Variation · Open in Builder
                                                                        │
                                                                        ▼ (remix)
                                                              back into the Prompt Builder
```

- **Create → Gallery:** a generation's result lands in the Gallery automatically (query
  invalidation, Milestone 11).
- **Gallery → Create:** "Open in Builder" loads a result's **brief** (from its recipe) back
  into the Prompt Builder to remix — closing the loop.

## Intent → generation → gallery → remix

```
Creative brief          (Identity? · Subject · Style · Mood · Lighting · Aspect · Quality · …)
      ↓ buildPrompt()   pure, provider-agnostic transform  (src/lib/prompt/, future)
Compiled prompt + params
      ↓ generateImage()
Generation (recipe: brief + prompt + provider + model + params)   ← stored, owner-scoped
      ↓
GeneratedMedia → Gallery (MediaAsset, source:"generated", recipe attached)
      ↓ "Open in Builder"
Creative brief (restored)  → tweak one facet → generate again
```

The **recipe** (the `Generation` record — [GENERATION_RECIPES.md](./GENERATION_RECIPES.md))
carries the brief, so the loop is lossless: any result can be reopened, tweaked, regenerated,
varied, or (future) branched.

## Two modes (workflow level)

- **Simple Mode.** The user writes what they want + taps a few intents; AI Studio builds the
  workflow (compile → generate) automatically. This is the default and covers most needs.
- **Advanced Mode.** More facets + a read-only compiled-prompt preview. Still intent-driven —
  just more control. (Full wireframes in [PROMPT_BUILDER.md](./PROMPT_BUILDER.md).)

## UX principles for the workflow

- **One primary action per screen** — "Review & Generate", then "Generate".
- **Never a blank page** — starting points, defaults, and the current Identity guide the user.
- **The loop stays tight** — from result back to a new generation is one or two taps
  (Regenerate / Variation / Open in Builder).
- **Nothing creative is lost** — recipes make every generation reproducible and remixable.
- **Provider-agnostic end to end** — no screen exposes provider/model choices as the primary
  path; AI Studio decides *how* (VISION).

## Future direction (design intent — not built, no roadmap impact here)

These extend the loop without reshaping it — see [VISION.md](./VISION.md) "Future Direction":

- **Templates** = saved briefs (Prompt Builder presets) — apply, then tweak.
- **Multi-provider workflows.** The single "Generate" stage becomes a chain — Prompt →
  Optimize → Identity → Generate → Enhance → Upscale → Video → Gallery — each stage a different
  provider AI Studio orchestrates.
- **Visual Workflow Builder.** Advanced users arrange the loop as reusable blocks (a simpler,
  friendlier ComfyUI). The Prompt Builder is the "Describe" / "Generate" block.
- **Video.** The same loop with motion facets in the brief and a `VideoProvider`; results flow
  through the same media layer + Gallery.
- **Creative pipelines / campaigns.** The loop composes into multi-asset campaigns (hero image
  → product shots → stories → video → thumbnails), all owned by the Project.

## Deliverables status

Design only. No implementation, schema, routes, or components in this milestone. The Prompt
Builder implementation (a later milestone) will build the "Describe intent" stage on top of the
existing generation layer, reusing the media/Gallery/identity components.
