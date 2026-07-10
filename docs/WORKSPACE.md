# Project Workspace

> How a single **Project** (`/projects/[id]`) is organized. A project is the primary
> unit of work in ai-studio — everything (identities, uploads, generations, results)
> belongs to a project. See [VISION.md](./VISION.md) and [DATABASE.md](./DATABASE.md).

## Concept

A **Project** is a workspace (e.g. "Summer Campaign", "YouTube Thumbnails"). Within it a
user manages the full creative loop:

```
Project
  ├── Identities        (faces/styles used for generation)
  ├── Uploads           (reference media, Vercel Blob)
  ├── Generations       (image/video requests + status)
  │     └── Results     (GeneratedMedia)
  └── Templates         (reusable prompt/config presets)
```

## A Project is a creative workspace, not just a folder

A Project should be **self-contained**: switching from an "Instagram campaign" to a
"YouTube" project should change the creative defaults automatically, with no manual
reconfiguration. Planned per-project settings (future — not implemented yet):

- Preferred **image model** (e.g. Flux, GPT Image, Imagen, …)
- Preferred **video model** (e.g. Veo, Kling, Runway, …)
- Default **aspect ratio** / output settings
- Project-scoped **prompt templates**
- Generation **history**, **identities**, **uploads**, and **output gallery** (already
  modelled as project relations)

These will likely live as columns/JSON on `Project` (or a `ProjectSettings` relation) with
sensible defaults, applied automatically when generating inside that project. Tracked as a
direction in [DECISIONS.md](./DECISIONS.md) — no schema change yet.

## Layout

The workspace renders inside `AppShell` → `ProjectLayout` (see
[COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md) and
[NAVIGATION.md](./NAVIGATION.md)):

```
AppShell
└── ProjectLayout  (project header + tabbed nav; publishes active project to
    │               the workspace context so the breadcrumb shows: Projects / <name>)
    └── section tabs:
        • Overview     – project home: stats, quick generate, recent activity
        • Uploads      – reference media (input)
        • Gallery      – this project's generated media
        • Identities   – reusable identities/styles
        • Templates    – project prompt/config presets
        • Jobs         – background generation jobs + progress
        • Settings     – project preferences/defaults
```

> Section tabs are **scoped to the project** — distinct from the global Sidebar (which
> navigates between top-level areas). See [WORKSPACE_API.md](./WORKSPACE_API.md) for each
> tab's responsibilities.

## Routing (implemented — shell only)

| Route | View |
| ----- | ---- |
| `/projects/[id]` | Overview |
| `/projects/[id]/uploads` | Uploads |
| `/projects/[id]/gallery` | Gallery |
| `/projects/[id]/identities` | Identities |
| `/projects/[id]/templates` | Templates |
| `/projects/[id]/jobs` | Jobs |
| `/projects/[id]/settings` | Settings |

The `[id]/layout.tsx` fetches the project once (owner-scoped, 404 otherwise) and renders
`ProjectLayout` around each tab page.

## Data ownership

- Everything is scoped by `projectId` **and** `userId` — always filter by the current
  user (never trust a `projectId` alone).
- Deleting a project cascades to its owned records per the schema
  ([DATABASE.md](./DATABASE.md)).

## State rules

Every collection view here (identities, uploads, generations, gallery, templates) must
implement both `LoadingState` and `EmptyState`
(see [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md)).

## Status

**Workspace shell implemented** — the tabbed structure, project header, breadcrumb
integration (via the workspace context), Overview widgets, and per-tab loading/empty
states are live. The tabs themselves are **placeholders**: uploads, storage (Vercel Blob),
gallery, identities, jobs, and AI generation are not built yet.
