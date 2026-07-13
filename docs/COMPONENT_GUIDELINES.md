# Component Guidelines

> Reusable building blocks so every page is composed from the same parts. Follow
> [UI_DESIGN.md](./UI_DESIGN.md) for tokens and [NAVIGATION.md](./NAVIGATION.md) for the
> app shell. **Build a page by composing these — don't hand-roll layouts.**

## Where components live

| Folder | Contents |
| ------ | -------- |
| `src/components/ui/` | Primitives (shadcn/Base UI): `Button`, `Card`, `Input`, `PasswordInput` (show/hide toggle), `Form`, … |
| `src/components/shared/` | App-wide building blocks: `AppShell`, `ProjectLayout`, `Sidebar`, `Header`, `Breadcrumb`, `PageContainer`, `SectionTitle`, `EmptyState`, `LoadingState` |
| `src/components/projects/` | `ProjectCard`, project form/delete dialogs, `ProjectsView` |
| `src/components/media/` | **Reusable media browser primitives** (source-agnostic): `MediaCard`, `MediaGrid`, `MediaViewer`, `MediaFiltersBar`, `DeleteMediaDialog` |
| `src/components/gallery/` | `GalleryView` (project media browser; composes `media/`) |
| `src/components/upload/` | `UploadsView`, `UploadDropzone`, `UploadQueueItem` (the "add media" surface; reuses `media/` for display) |
| `src/components/forms/` | Form-specific composites |
| `src/components/auth/` | Auth forms + user menu (existing) |

**Rules**
- Server Components by default; add `"use client"` only for interactivity.
- Props are typed; no `any`. Accept `className` and forward it (merge with `cn`).
- Compose primitives from `ui/`; don't re-implement buttons/cards.

**Base UI notes** (these primitives are Base UI, not Radix — APIs differ):
- Composition uses the `render` prop, not Radix `asChild`.
- `DropdownMenuLabel` = `Menu.GroupLabel` and **must** be inside a `DropdownMenuGroup`.
  For a display-only header (e.g. account info), use a plain `div`, not the label.

## Layout / structural

### `AppShell`
The **root layout for all authenticated pages** (`app/(protected)/layout.tsx`). Runs the
session guard once, then renders the Sidebar + Header + Breadcrumb around the page.
```
props: { children: React.ReactNode }
renders: <Sidebar/> + <Header/> (with <Breadcrumb/>) + <main>{children}</main>
```
Pages inside the shell should NOT re-declare Sidebar/Header — just their content
(wrapped in `PageContainer`).

### `ProjectLayout`
Layout for a single project workspace (`/projects/[id]`), nested **inside** `AppShell`.
Renders the project header + tabbed section nav (Overview, Uploads, Gallery, Identities,
Templates, Jobs, Settings) and publishes the active project to the workspace context
(`lib/providers/workspace-provider.tsx`) so the breadcrumb shows the project name. The
`[id]/layout.tsx` server layout fetches the project (owner-scoped) and passes it in.
See [WORKSPACE.md](./WORKSPACE.md) / [WORKSPACE_API.md](./WORKSPACE_API.md).
```
props: { project: { id: string; name: string; description: string | null }; children: React.ReactNode }
```

### `Breadcrumb`
Shows the current location in the Header, e.g. `Projects / Summer Campaign / Gallery`.
Derives crumbs from the pathname by default; pass `items` to override (e.g. to show a
project name instead of its id).
```
props: { items?: { label: string; href?: string }[]; className?: string }
```

### `PageContainer`
Wraps every page's content with consistent width + padding.
```
<PageContainer>  →  <main className="mx-auto flex w-full max-w-... flex-col gap-6 p-6">
props: { children, className?, size?: "sm" | "default" | "wide" }
```

### `Header`
Full-width top bar: `Logo`, `Breadcrumb`, placeholder `Search`, and `UserNav`
(avatar dropdown → name/email/sign out). Holds the mobile menu button that opens the
Sidebar in a sheet.
```
props: { user: { name: string; email: string } }
```

### `Sidebar`
Primary nav for protected routes (Projects, Gallery, Uploads, Templates, Settings).
Highlights the active route.
```
props: { }  // reads the current pathname; "use client"
```

### `SectionTitle`
Consistent section heading (H2).
```
props: { title: string; description?: string; action?: React.ReactNode }
render: text-sm font-medium (+ optional muted description + right-aligned action)
```

## State components

> **Rule — every collection must implement BOTH `LoadingState` and `EmptyState`.**
> Any list/grid of data (projects, media, uploads, templates, …) renders three explicit
> branches: **loading → `LoadingState`**, **empty → `EmptyState`**, **content**. Never
> show a blank screen or a bare spinner. (See the composition example + page checklist.)

### `EmptyState`
Shown when a list/collection has no items.
```
props: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }
```

### `LoadingState`
Shown while data loads — uses `Skeleton` primitives (no spinners for layout).
```
props: { rows?: number; variant?: "list" | "grid" | "card" }
```

## Domain cards

All cards use `Card` surface (`bg-card border rounded-lg p-4`), consistent aspect ratios
for media, and expose `className`.

### `ProjectCard`
```
props: { project: { id; name; description?; createdAt; _count? }; className? }
shows: name, description, item counts; links to /projects/[id]
```

### Media components (`src/components/media/`) — implemented (8)
**The reusable, source-agnostic media browser.** Every media feature (Gallery today;
Identities/Templates/AI later) composes these instead of building its own browser. All are
driven by the `MediaAsset` contract (signed `url`, `source: "uploaded" | "generated"`) from
the media layer — they never call Blob directly.
```
MediaCard        props: { media: MediaAsset; onOpen?(m); onDelete?(m); className? }
  — one image/video tile: lazy image / video poster + play, type Badge, hover delete.
MediaGrid        props: { items: MediaAsset[]; onOpen?; onDelete?; hasNextPage?;
                          isFetchingNextPage?; onLoadMore? }
  — responsive grid + infinite-scroll sentinel (IntersectionObserver).
MediaViewer      props: { media: MediaAsset | null; open; onOpenChange; onDelete? }
  — full-size modal: image / video player + metadata (dims, duration, size, date).
MediaFiltersBar  props: { filters: MediaFilters; onChange(patch) }
  — type / source / sort selects + debounced filename search. Source includes "generated"
    (returns empty until AI media lands — future-proofed).
DeleteMediaDialog props: { projectId; open; onOpenChange; media; onDeleted? }
```
State comes from `hooks/use-media.ts`: `useProjectMedia(projectId, filters)` (infinite query)
and `useDeleteMedia(projectId)`. `GalleryView` (`components/gallery/`) wires them together for
`/projects/[id]/gallery`; the Uploads tab reuses `MediaGrid`/`MediaViewer`/`DeleteMediaDialog`
for its uploaded-media display.

### Upload components (`src/components/upload/`) — implemented (7B, refined in 8)
The Uploads tab (the "add media" surface). Its own pieces cover **adding**; **displaying**
uploaded media reuses the shared `media/` components (`MediaGrid`/`MediaViewer`/
`DeleteMediaDialog`). State: `useUploadManager` (transient in-flight queue) + `useProjectMedia`
(the persisted grid, shared with Gallery).
```
UploadsView     props: { projectId: string; blobReady: boolean }
  — orchestrates dropzone + queue + the shared media grid/viewer/delete-dialog.
UploadDropzone  props: { onFiles: (files: File[]) => void; disabled?; className? }
  — drag & drop + click-to-browse; `accept` from ALLOWED_MIME_TYPES; multiple.
UploadQueueItem props: { item: UploadItem; onCancel; onRetry; onRemove }
  — one in-flight upload: Progress bar while active; retry/remove on error/cancel.
```
> The old `UploadedMediaCard`/`DeleteUploadDialog` were removed in Milestone 8 — Uploads and
> Gallery now share one set of media components. Don't reintroduce upload-only display tiles.

### Identity components (`src/components/identity/`) — PLANNED (design only, Milestone 9)
Responsibilities only — **not implemented**. See [IDENTITIES.md](./IDENTITIES.md) +
[TRAINING_MEDIA.md](./TRAINING_MEDIA.md). **Rule: Training-media components must *compose* the
existing `media/` components (`MediaGrid`/`MediaCard`/`MediaViewer`), never reimplement a
media browser** (Decision 024).
```
IdentityCard          One identity tile: IdentityAvatar + name + description + media count +
                      status; links into the identity. (mirrors ProjectCard/MediaCard.)
IdentityGrid          Responsive grid of IdentityCards with Loading/Empty/Error states.
IdentityAvatar        The identity's display image (signed URL) with initials/icon fallback
                      when no display image is set. Small, reusable (cards, headers, pickers).
TrainingMediaGrid     An identity's curated training media — composes MediaGrid; adds
                      per-link affordances (reorder, favorite, set-as-display, remove-link).
TrainingMediaSelector A media picker (selectable MediaGrid over listProjectMedia) to link
                      existing Gallery media to the identity. Selection, not upload.
TrainingMediaViewer   Full-size training-media preview — composes MediaViewer; adds link
                      metadata (role/rank/favorite) and remove-from-identity.
IdentityToolbar       Actions for an identity: add training media, edit, archive/restore,
                      set display image, delete. (mirrors a page-level SectionTitle action.)
IdentityFilters       Filter/sort identities (e.g. status active/archived, search by name).
```
> These are a plan, not an API. Props get defined when the Identity Manager is implemented.
> Reuse `EmptyState`/`LoadingState`/`SectionTitle`/`Badge` and the `media/` set throughout.

## Composition example

```tsx
<PageContainer>
  <SectionTitle title="Projects" action={<Button>New project</Button>} />
  {isLoading ? (
    <LoadingState variant="grid" />
  ) : projects.length === 0 ? (
    <EmptyState title="No projects yet" description="Create your first project." />
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
    </div>
  )}
</PageContainer>
```

## Checklist for a new page

1. Wrap in `PageContainer`.
2. Lead with a `SectionTitle` (+ primary action).
3. Handle all three states: `LoadingState`, `EmptyState`, content.
4. Use domain cards (`ProjectCard` / `MediaCard` / `UploadCard`) for collections.
5. Tokens only (UI_DESIGN.md); forward `className`.
