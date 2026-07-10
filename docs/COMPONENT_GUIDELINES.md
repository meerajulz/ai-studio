# Component Guidelines

> Reusable building blocks so every page is composed from the same parts. Follow
> [UI_DESIGN.md](./UI_DESIGN.md) for tokens and [NAVIGATION.md](./NAVIGATION.md) for the
> app shell. **Build a page by composing these — don't hand-roll layouts.**

## Where components live

| Folder | Contents |
| ------ | -------- |
| `src/components/ui/` | Primitives (shadcn/Base UI): `Button`, `Card`, `Input`, `PasswordInput` (show/hide toggle), `Form`, … |
| `src/components/shared/` | App-wide building blocks: `AppShell`, `ProjectLayout`, `Sidebar`, `Header`, `Breadcrumb`, `PageContainer`, `SectionTitle`, `EmptyState`, `LoadingState` |
| `src/components/gallery/` | `MediaCard` and gallery pieces |
| `src/components/upload/` | `UploadCard` and upload pieces |
| `src/components/forms/` | Form-specific composites |
| `src/components/auth/` | Auth forms + user menu (existing) |

**Rules**
- Server Components by default; add `"use client"` only for interactivity.
- Props are typed; no `any`. Accept `className` and forward it (merge with `cn`).
- Compose primitives from `ui/`; don't re-implement buttons/cards.

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
Provides project-scoped sub-navigation/tabs (overview, gallery, uploads, …) and the
project header. See [WORKSPACE.md](./WORKSPACE.md).
```
props: { projectId: string; children: React.ReactNode }
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

### `MediaCard`
A single image/video tile (uploaded or generated).
```
props: {
  media: { id; type: "IMAGE" | "VIDEO"; url; width?; height?; createdAt };
  onSelect?: (id: string) => void; className?
}
shows: thumbnail (fixed aspect ratio), type badge, hover actions
```

### `UploadCard`
Upload dropzone / in-progress upload tile.
```
props: {
  status: "idle" | "uploading" | "done" | "error";
  progress?: number; fileName?: string; onDrop?: (files: File[]) => void; className?
}
```

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
