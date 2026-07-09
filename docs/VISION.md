# Vision

## The one-liner

A personal **AI Studio** for identity-based image and video generation — built on a
clean, provider-agnostic architecture so the AI models can change without the product
changing.

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

The generation engine is the product. Providers are interchangeable parts behind
`ImageProvider` / `VideoProvider` interfaces, so the studio can adopt the best model of
the moment (or combine several) without disruption.

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

## Guiding questions

Answer these when deciding what to build next. If a proposed feature can't point back
to these answers, it probably doesn't belong yet.

### What is the product trying to become?

A complete, personal AI Studio for identity-based image and video generation — a single
workspace where identities, prompts, uploads, and generations live together, powered by
an interchangeable set of AI providers. The generation pipeline is the product; the
provider is a swappable part.

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
