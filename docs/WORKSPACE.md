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

## Layout

The workspace renders inside `AppShell` → `ProjectLayout` (see
[COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md) and
[NAVIGATION.md](./NAVIGATION.md)):

```
AppShell
└── ProjectLayout  (project header + Breadcrumb: Projects / <name>)
    └── project sub-navigation (tabs/sections):
        • Overview     – summary, recent activity
        • Identities   – manage identities + reference media
        • Uploads      – upload/manage reference media
        • Generate     – prompt editor → image/video generation
        • Gallery      – this project's generated media
        • Templates    – project prompt/config presets
        • Settings     – rename/delete project
```

> Sub-navigation sections are **scoped to the project** — distinct from the global
> Sidebar (which navigates between top-level areas).

## Routing (planned)

| Route | View |
| ----- | ---- |
| `/projects/[id]` | Overview |
| `/projects/[id]/identities` | Identities |
| `/projects/[id]/uploads` | Uploads |
| `/projects/[id]/generate` | Prompt editor / generation |
| `/projects/[id]/gallery` | Project gallery |
| `/projects/[id]/templates` | Templates |
| `/projects/[id]/settings` | Project settings |

_(Exact sub-routes finalized when the workspace is built — backend-first for now.)_

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

Design only — **not implemented yet**. The current authenticated landing is `/projects`
(temporary `/dashboard` kept for auth verification, see [NAVIGATION.md](./NAVIGATION.md)).
Backend-first: uploads, gallery, and AI generation pages come later.
