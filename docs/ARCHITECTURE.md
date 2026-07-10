# Architecture

## High-level

```
Browser (React 19 Client Components)
   │  Server Actions / Route Handlers
   ▼
Next.js 16 App Router (RSC, Turbopack)
   ├── services/      business logic
   ├── lib/ai/        AI provider adapters
   ├── lib/auth/      better-auth
   ├── lib/blob/      Vercel Blob (uploads)
   └── lib/db/        Prisma client → PostgreSQL
```

## Layer responsibilities

| Directory          | Responsibility                                                        |
| ------------------ | --------------------------------------------------------------------- |
| `app/`             | Routing, layouts, pages. Server Components by default.                 |
| `actions/`         | Server Actions — mutations invoked from client components/forms.       |
| `services/`        | Orchestration & business rules. Called by actions/route handlers.      |
| `lib/ai/`          | Provider-agnostic AI adapters (see [AI_PROVIDERS.md](./AI_PROVIDERS.md)). |
| `lib/auth/`        | better-auth config, session helpers.                                  |
| `lib/blob/`        | Upload/download helpers for Vercel Blob.                              |
| `lib/db/`          | Prisma client singleton + query helpers.                              |
| `lib/validations/` | Zod schemas shared between forms, actions, and API.                   |
| `lib/providers/`   | React context providers: `QueryProvider` (TanStack Query), `WorkspaceProvider` (active project), Tooltip. |
| `store/`           | Client-side state.                                                     |
| `components/`      | Presentation. `ui/` (shadcn), plus `projects/ shared/ auth/ forms/ gallery/ upload/`. |

## Rendering model

- **Server Components** by default — data fetching happens on the server.
- **Client Components** (`"use client"`) only where interactivity/browser APIs are needed.
- The root layout wraps the app in client providers (`QueryProvider`, `TooltipProvider`,
  Sonner `Toaster`). The `AppShell` adds `WorkspaceProvider` so authenticated pages share
  the **active project** (the workspace context — powers the breadcrumb name, and later
  per-project defaults). See DECISIONS #018 and [WORKSPACE.md](./WORKSPACE.md).
- Nested route layouts scope data: `app/(protected)/layout.tsx` guards auth once, and
  `projects/[id]/layout.tsx` fetches the project once for all its tabs.

## Key data flows

### Project CRUD (implemented)
1. Client components (`components/projects/`) call **TanStack Query** hooks
   (`hooks/use-projects.ts`).
2. Query/mutation fns are **Server Actions** in `actions/projects.ts` — each resolves the
   Better Auth session and scopes every query by `userId` (owner-only).
3. Mutations invalidate the `["projects"]` query key, so the list refetches automatically.
4. Providers (`lib/providers/query-provider.tsx` + Sonner `Toaster`) are wired in the root
   layout; toasts give success/error feedback.

This is the reference pattern for future domain features (identities, uploads, generations).

### Upload → AI generation → gallery
1. Client uploads media via `components/upload/` → `lib/blob/` → Vercel Blob.
2. A Server Action in `actions/` records metadata via `lib/db/` (Prisma).
3. `services/` calls the relevant adapter in `lib/ai/` to generate/transform.
4. Results are persisted and surfaced through `components/gallery/`.

_Update this diagram as real flows land._

## Conventions

- Path alias `@/*` → `src/*`.
- Validation lives in `lib/validations/` (Zod) and is reused everywhere.
- No secrets in client components — keep provider keys server-side.

## Cross-references

- [DATABASE.md](./DATABASE.md) — schema & data model
- [API.md](./API.md) — server actions & route handlers
- [DECISIONS.md](./DECISIONS.md) — why things are the way they are
