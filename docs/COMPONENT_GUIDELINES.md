# Component Guidelines

> Reusable building blocks so every page is composed from the same parts. Follow
> [UI_DESIGN.md](./UI_DESIGN.md) for tokens and [NAVIGATION.md](./NAVIGATION.md) for the
> app shell. **Build a page by composing these — don't hand-roll layouts.**

## Where components live

| Folder | Contents |
| ------ | -------- |
| `src/components/ui/` | Primitives (shadcn/Base UI): `Button`, `Card`, `Input`, `Form`, … |
| `src/components/shared/` | App-wide building blocks: `PageContainer`, `Header`, `Sidebar`, `SectionTitle`, `EmptyState`, `LoadingState` |
| `src/components/gallery/` | `MediaCard` and gallery pieces |
| `src/components/upload/` | `UploadCard` and upload pieces |
| `src/components/forms/` | Form-specific composites |
| `src/components/auth/` | Auth forms + user menu (existing) |

**Rules**
- Server Components by default; add `"use client"` only for interactivity.
- Props are typed; no `any`. Accept `className` and forward it (merge with `cn`).
- Compose primitives from `ui/`; don't re-implement buttons/cards.

## Layout / structural

### `PageContainer`
Wraps every page's content with consistent width + padding.
```
<PageContainer>  →  <main className="mx-auto flex w-full max-w-... flex-col gap-6 p-6">
props: { children, className?, size?: "sm" | "default" | "wide" }
```

### `Header`
Top bar: branding, current page title, user menu.
```
props: { title?: string; user?: { name: string; email: string } }
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
