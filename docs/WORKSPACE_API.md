# Workspace API

> **Responsibilities**, not implementation. Describes what each area of the Project
> Workspace owns. Pairs with [WORKSPACE.md](./WORKSPACE.md) (structure) and
> [NAVIGATION.md](./NAVIGATION.md) (routes). Everything belongs to a project and is scoped
> by `projectId` + `userId`.

## Workspace

A project workspace is the home of a body of work — everything needed to create it lives
inside: uploads, generated media, identities, prompt templates, jobs, and (later)
per-project defaults. Rendered by `ProjectLayout` (header + tabs) inside `AppShell`. The
active project is published to the **workspace context**
(`lib/providers/workspace-provider.tsx`) so components (e.g. the breadcrumb) can read the
current project without prop-drilling.

## Sections (tabs)

| Tab | Responsibility | Status |
| --- | -------------- | ------ |
| **Overview** | Project home: stats, quick generate, and recent uploads/images/videos/jobs/templates. The dashboard for this project. | Shell (empty widgets) |
| **Uploads** | Reference media uploaded as generation input. Owns upload + list/manage of `UploadedMedia`. | Placeholder |
| **Gallery** | Generated images and videos for this project (`GeneratedMedia`). | Placeholder |
| **Identities** | Reusable identities/styles used to keep faces/looks consistent. | Placeholder |
| **Templates** | Reusable prompt/config presets scoped to the project. | Placeholder |
| **Jobs** | Background generation jobs and their status/progress (`Job`). | Placeholder |
| **Settings** | Project preferences and defaults — name/description today; later preferred image/video model, aspect ratio, templates (DECISIONS #017). | Placeholder |

## Rules

- Every section is **scoped to the project and the user** — never trust a `projectId`
  without also filtering by `userId`.
- Every collection section renders both `LoadingState` and `EmptyState`
  (see [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md)).
- New creator features default to living **inside the workspace** — if you're unsure where
  a feature belongs, it usually belongs in a project tab.

## Not yet built

Uploads, storage (Vercel Blob), gallery logic, identities, generation, and jobs are
**placeholders** today — this milestone delivers the workspace structure only.
