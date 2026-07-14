# Vision

## The one-liner

A personal **AI Studio** — an intelligent **Creative Operating System** that orchestrates
multiple AI providers to create consistent images and videos around reusable **identities**
and creative **workflows**. Built provider-agnostic, so the AI models can change without the
product changing.

## The problem

Creating consistent AI-generated media around a specific identity (a face, a style, a
character) is fragmented and locked to individual tools. Providers come and go, each
with its own SDK, and switching means rewriting everything. There's no single, personal
workspace that keeps identities, prompts, uploads, and generations together.

## The vision

One studio where you:

1. Create and manage **identities** (with reference media).
2. Compose prompts in a real **prompt editor**.
3. Generate **images and videos** through whichever AI provider fits best.
4. Keep everything organized — projects, gallery, history, templates, favorites.

**The orchestration engine is the product.** Providers are interchangeable *execution
engines* behind `ImageProvider` / `VideoProvider` interfaces; the real value is AI Studio's
ability to **intelligently combine them** into the best creative workflow — adopting the best
model of the moment, or several at once, without disruption.

AI Studio is **not** an image generator, and it is **not** tied to one AI provider — it is an
intelligent **orchestration platform**. The user thinks *creatively*; AI Studio thinks
*technically*. You describe **what** you want; the application decides **how** to create it.
The value isn't any single model — it's intelligently combining providers, models, and
processing pipelines. See [PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md) and
[GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md) for how that abstraction already works today.

## The core workflow

The whole studio is organized around one long-term flow, with the **Identity** as the
central concept that generation revolves around:

```
User
  ↓
Project            organize work into workspaces
  ↓
Uploads            bring in images + videos (media layer)
  ↓
Gallery            browse all project media
  ↓
Identity  ◄──────  the central concept: a reusable subject (face / character / style)
  ↓                built from curated Training Media (images + videos)
Templates          reusable prompt/config presets, often targeting an Identity
  ↓
Prompt Builder     compose a generation from Identity + Template + inputs
  ↓
AI Generation      run through a provider adapter (provider-agnostic)
  ↓
History            every result flows back into the Gallery, tied to its Identity
```

**Identity is the hinge of the product.** Uploads and Gallery exist to *feed* identities;
Templates, the Prompt Builder, and AI Generation exist to *act on* them; History exists to
*organize results around* them. See [IDENTITIES.md](./IDENTITIES.md) and
[TRAINING_MEDIA.md](./TRAINING_MEDIA.md).

## AI Studio Philosophy

This is the heart of what AI Studio *is* — the lens for every product decision.

- **A Creative Operating System.** AI Studio isn't a feature bolted onto a model; it is the
  *operating system* for creative work — projects, identities, media, and workflows that
  outlive any single tool or provider.
- **Provider-agnostic, forever.** No feature ever depends on a specific AI SDK. Providers sit
  behind `ImageProvider` / `VideoProvider` and are swappable execution engines (Decisions 007 /
  029). This is a permanent commitment, not a phase.
- **AI orchestration, not AI generation.** The product's value is *combining* providers,
  models, and processing steps into the right pipeline — not calling one model. Any single
  model is a commodity; the orchestration is the moat.
- **Users describe goals, not models.** People express *what* they want ("a cinematic
  portrait", "maximum realism", "keep the hairstyle"); AI Studio decides *how* — which
  provider, model, and pipeline achieve it.
- **Technical complexity hidden behind simple UX.** However sophisticated the orchestration
  becomes underneath, the surface stays calm and minimal. Complexity is the app's job, not the
  user's.
- **AI Studio owns the workflow, not the provider.** The workflow, identities, recipes, and
  history belong to AI Studio and the user. Providers come and go; the creative system remains.

These reinforce — never replace — the engineering **Principles** below.

## Principles

- **Provider-agnostic.** No feature code depends on a specific AI SDK.
- **Backend-first.** A solid architecture and pipeline before polished UI.
- **Type-safe end to end.** TypeScript everywhere; validate at the boundaries (Zod).
- **Separation of concerns.** Business logic out of the UI; AI behind interfaces.
- **Personal-scale, production-quality.** Built for one user, engineered like a product.

## What success looks like

- Swap or add an AI provider by writing one adapter — nothing else changes.
- Go from uploaded reference → generated image/video → organized gallery in a few clicks.
- Identities, projects, and history make repeat work fast and consistent.

## Long-term goal

A complete AI Studio spanning **Dashboard, Projects, Identities, Images, Videos,
Templates, AI Models, Uploads, Jobs, Gallery, Settings, and Account** management.

## Explicitly not (for now)

- Multi-tenant / team product (see Future Ideas in [ROADMAP.md](./ROADMAP.md)).
- A public marketplace or plugin ecosystem.

---

## Future Direction — Intelligent AI Orchestration

> **Long-term vision only.** Nothing in this section affects today's roadmap or changes any
> current architectural decision — it describes where AI Studio is heading once the foundation
> (identities, media, providers) is proven. Execution still lives in [ROADMAP.md](./ROADMAP.md);
> decisions in [DECISIONS.md](./DECISIONS.md). Everything here *reinforces* the existing
> provider-agnostic architecture ([PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md),
> [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md), [AI_GENERATION.md](./AI_GENERATION.md)).

### Intent-driven generation

Instead of asking *"what model?"*, AI Studio asks *"what do you want to create?"* — a
**product advertisement**, a **realistic portrait**, an **anime illustration**, a **Pixar
character**, a **fashion campaign**, a **cinematic scene**. From that intent the app
automatically determines the **provider**, **model**, **enhancement pipeline**, and
**post-processing**. Intent is expressed through the provider abstraction, never coupled to a
specific SDK.

### Multiple providers

Hugging Face, Fal, OpenAI, Replicate, local models, and future providers each do **only what
they are best at**. AI Studio routes every task to the strongest engine for it. Adding a
provider stays a one-file change behind `ImageProvider` (Decision 029).

### Multi-provider workflows

A single generation may chain several providers, each stage from a different one:

```
Prompt → Prompt optimization → Generation → Face enhancement → Upscaling → Video generation → Gallery
```

AI Studio orchestrates the whole chain — an extension of today's
[GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md).

### Identity processing

Identity becomes an optional **processing pipeline**. The UI stays extremely simple: instead of
technical settings, users click **intentions** —

- Maximum realism · Face consistency · Preserve hairstyle · Preserve clothing · Improve eyes ·
  Improve hands · Cinematic quality

— and AI Studio decides which models achieve them. Builds directly on
[IDENTITIES.md](./IDENTITIES.md) and [TRAINING_MEDIA.md](./TRAINING_MEDIA.md).

### Multiple identities per generation

One generation may include several identities — **Emma + John**, **Mother + Child**, **Owner +
Dog**, **Brand Ambassador + Product**, a **Family**, a **Company Team** — for **both images and
videos**. The `GenerationIdentity` "appears-in" relationship is already reserved for this
(Decision 026).

### Identity relationships

Identities may relate to one another — *wife of · husband of · parent of · child of · friend of ·
pet of · owns · employee of · brand mascot · character partner* — and those relationships
eventually improve generation consistency. **Future architecture only.**

### Visual workflow builder

Long-term, AI Studio offers two modes:

- **Simple Mode** — the user writes what they want; AI Studio builds the workflow automatically.
- **Advanced Mode** — a visual workflow editor *inspired by* ComfyUI, but dramatically simpler
  and more accessible:

```
Prompt → Prompt Optimizer → Identity → Generator → Face Enhancement → Upscaler → Video → Gallery
```

Every block eventually becomes reusable.

### Generation recipes

Every generation permanently remembers its **prompt · provider(s) · model(s) · workflow ·
identities · relationships · processing steps · settings · seed · metadata** — enabling
**recreate · remix · compare · branch**. Nothing creative is ever lost.

### Creative pipelines

Eventually AI Studio composes entire **creative campaigns**:

```
Marketing Campaign → Hero Image → Product Images → Instagram → Stories → Video → Thumbnails → Gallery
```

Everything belongs to the **Project**.

---

## Guiding questions

Answer these when deciding what to build next. If a proposed feature can't point back
to these answers, it probably doesn't belong yet.

### What is the product trying to become?

A complete, personal AI Studio — a Creative Operating System for identity-based image and
video generation — a single workspace where identities, prompts, uploads, and generations live
together, powered by an interchangeable set of AI providers. The **orchestration** pipeline is
the product; each provider is a swappable execution engine.

### What kind of experience do we want users to have?

- **Fast and focused** — upload a reference, write a prompt, generate, see the result in
  the gallery without friction.
- **Consistent** — saved identities, projects, templates, and history make repeat work
  predictable and reusable.
- **Trustworthy** — generations don't get lost; jobs show clear progress; nothing feels
  fragile.
- **Calm, not cluttered** — a clean UI that stays out of the way of the creative loop.

### What principles should guide new features?

- **Provider-agnostic** — no feature depends on a specific AI SDK; it goes behind
  `ImageProvider` / `VideoProvider`.
- **Backend-first** — architecture and pipeline before UI polish.
- **Type-safe & validated** — TypeScript everywhere, Zod at the boundaries.
- **Separation of concerns** — business logic out of the UI; AI behind interfaces.
- **Earns its place** — a feature must serve the core loop or a committed roadmap sprint.

### What should we deliberately avoid?

- Coupling any feature to a single AI provider's API.
- Building UI ahead of the architecture that supports it.
- Scope creep beyond a personal-scale studio (no team/multi-tenant, marketplace, or
  plugin system for now).
- Business logic leaking into components; secrets leaking into client code.
- Premature optimization and over-engineering before the pipeline is proven.

---

_Vision guides direction; execution lives in [ROADMAP.md](./ROADMAP.md), decisions in
[DECISIONS.md](./DECISIONS.md), and the full spec in [PROJECT_SPEC.md](./PROJECT_SPEC.md)._
