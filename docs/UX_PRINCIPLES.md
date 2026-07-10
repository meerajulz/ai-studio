# UX Principles

> How the app should *feel* and behave. Pairs with [UI_DESIGN.md](./UI_DESIGN.md) (visual
> tokens) and [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md) (building blocks).
> These are interaction rules — apply them to every page.

## 1. Always show state

Every view has explicit **loading**, **empty**, **error**, and **content** states.

- Collections **must** render both `LoadingState` and `EmptyState` — never a blank screen
  or a bare spinner.
- Use skeletons (that mirror the final layout) over spinners for page/section loads.
- Errors are shown inline, in plain language, with a way to retry or recover.

## 2. Fast and responsive feedback

- Every action gives immediate feedback: disable + label change on submit
  ("Generating…"), progress for uploads/jobs.
- Prefer **optimistic UI** where safe; reconcile with the server result.
- Keep interactions snappy (~150–200ms transitions, see UI_DESIGN.md).

## 3. Calm, focused, uncluttered

- One primary action per screen; secondary actions are visually quieter.
- Reduce choices on the path through the core loop (upload → generate → gallery).
- Whitespace and consistent rhythm over dense layouts.

## 4. Consistency & reuse

- Compose pages from shared components — the same card, header, and empty state
  everywhere. No bespoke one-off layouts.
- Same interaction patterns across areas (selection, hover actions, destructive confirm).

## 5. Everything belongs to a Project

- Navigation and data are organized around Projects (see [WORKSPACE.md](./WORKSPACE.md)).
- Context is always visible via the `Breadcrumb` (where am I?).

## 6. Safe by default

- Destructive actions require confirmation and use the `destructive` styling.
- Never lose user work: preserve form state on error; confirm before discarding.
- Long-running work (generation, upload) is tracked via Jobs with visible progress.

## 7. Accessible

- Keyboard navigable; visible focus rings (`ring` token).
- Respect `prefers-reduced-motion`.
- Meaningful labels/alt text; sufficient contrast (tokens are tuned for light + dark).

## 8. Trustworthy persistence

- Generations and uploads never silently disappear; history is browsable.
- Clear success confirmation after important actions.

---

_Backend-first: these principles guide UI once we build it. No uploads/gallery/AI pages
yet — the immediate work is the Protected Application Shell._
