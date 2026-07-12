# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Project documentation set under `docs/` (PROJECT, ARCHITECTURE, ROADMAP, DATABASE,
  AI_PROVIDERS, API, PROMPTS, CHANGELOG, DECISIONS, TODO, VISION, PROJECT_SPEC,
  NEXT_SESSION_PLAN).
- UI foundation docs (before building more UI): **UI_DESIGN.md** (tokens, typography,
  spacing, radius, buttons, cards, animations), **NAVIGATION.md** (public/protected route
  map + app shell), **COMPONENT_GUIDELINES.md** (reusable components: PageContainer,
  Header, Sidebar, SectionTitle, EmptyState, LoadingState, ProjectCard, MediaCard,
  UploadCard).
- **WORKSPACE.md** (project workspace structure) and **UX_PRINCIPLES.md** (interaction
  principles).
- **Protected Application Shell**: `AppShell` root layout under `app/(protected)/` with a
  centralized session guard; `Sidebar` (active-route nav), `Header` (Logo, `Breadcrumb`
  derived from pathname, placeholder `Search`, `UserNav` avatar dropdown), and shared
  `PageContainer` / `SectionTitle` / `EmptyState` / `LoadingState`. Placeholder pages for
  Projects, Gallery, Uploads, Templates, Settings. Responsive (mobile menu via sheet).
  Root `/` now redirects by session.
- **Storage Foundation** (Milestone 7A): modular `src/lib/blob/` package for Vercel Blob —
  `constants.ts` (limits/allowed MIME/token/path builder), `types.ts` (`MediaKind`,
  `StoredBlob`, `AssetMetadata`), `validation.ts` (MIME + size), `errors.ts`
  (`StorageError` + codes), `server.ts` (`uploadAsset`/`deleteAsset` via `put`/`del`),
  `client.ts` (`uploadAssetFromBrowser`), `index.ts` (shared barrel), plus
  `isBlobConfigured()` so callers can detect a missing token and degrade gracefully. Env
  `BLOB_READ_WRITE_TOKEN` + `.env.example` (now committable via `.gitignore` exception).
  New `docs/MEDIA_PIPELINE.md` (documents the token requirement + how to add it on Vercel
  when a connected store only exposes `BLOB_STORE_ID`/`BLOB_WEBHOOK_PUBLIC_KEY`).
  Validation/error logic is pure and typechecked; no UI yet and no upload/delete called
  until 7B, so the token isn't needed to build or run today.
- **Project Workspace** (Milestone 6): tabbed workspace under
  `app/(protected)/projects/[id]/` — a shared `layout.tsx` fetches the project once
  (owner-scoped, 404 otherwise) and renders `ProjectLayout` (project header + section
  tabs) around each tab. **Overview** (stats + quick-generate + recent-activity widgets,
  all empty) plus placeholder tabs: Uploads, Gallery, Identities, Templates, Jobs,
  Settings. Responsive tabs, `loading.tsx` skeleton, per-tab `EmptyState`. New
  **workspace context** (`lib/providers/workspace-provider.tsx`, wrapped in `AppShell`)
  publishes the active project so the `Breadcrumb` shows the project name instead of its
  id. New doc `WORKSPACE_API.md`. No uploads/blob/gallery/AI yet.
- **Project Management** (first domain feature): projects list at `/projects` with
  `ProjectCard` grid, `LoadingState`, `EmptyState`, and create/edit/delete via a form
  dialog + delete confirmation dialog. CRUD through owner-scoped **Server Actions**
  (`actions/projects.ts`) with **Zod** validation (`lib/validations/project.ts`), consumed
  via **TanStack Query** hooks (`hooks/use-projects.ts`, cache key `["projects"]`).
  Added `QueryProvider` + Sonner `Toaster` to the root layout. Clicking a project opens
  `/projects/[id]`, which renders the new `ProjectLayout` workspace shell (owner-checked;
  404 otherwise). No uploads/gallery/AI yet.
- **Authentication UI polish** (behavior unchanged): login/register on a `Card` with brand
  header; new `PasswordInput` (show/hide toggle); spinner loading state + disabled inputs
  while submitting; `FormError` banner for server errors; richer `UserNav` dropdown
  (avatar + name/email, Settings placeholder, Sign out).
- `src/`-based folder structure (`actions/`, `components/{ui,forms,gallery,upload,shared}`,
  `hooks/`, `lib/{ai,auth,blob,db,validations,providers}`, `services/`, `store/`,
  `types/`, `styles/`).
- `TooltipProvider` wired into the root layout.
- `.nvmrc` (Node 24) and `engines` field (`node >=20.19.0`).
- **Database:** Prisma 7 schema with 9 models (User, Project, Identity, UploadedMedia,
  Generation, GeneratedMedia, Job, Template, FavoritePrompt) + 3 enums; `init` migration
  applied to Neon PostgreSQL.
- **Prisma runtime client** (`src/lib/db/`): singleton `PrismaClient` using
  `@prisma/adapter-neon`, with `client.ts`, `index.ts` barrel, and a `README.md`.
  Verified end-to-end against Neon.
- **Authentication (Better Auth)**: email + password via the Prisma adapter over Neon.
  Added `Session`, `Account`, `Verification` models (+ `User` relations); `better_auth`
  migration. Server config in `src/lib/auth/` (`auth.ts` + `index.ts`), browser client
  (`client.ts`), and the catch-all route `src/app/api/auth/[...all]/route.ts`. Sign-up and
  sign-in verified end-to-end (rows persisted; cascade delete confirmed).
- **Auth UI (minimal, for verification):** `/login` and `/register` pages using the
  shadcn `Form` component with React Hook Form + Zod (`src/lib/validations/auth.ts`) and
  the Better Auth client — loading states, field + server error messages, redirect to
  `/dashboard` on success, and server-side guards that redirect authed users away from
  login/register. Temporary `/dashboard` with a `UserMenu` (name / email / sign out).
  Added `src/components/ui/form.tsx` (was missing). Full flow verified via server
  redirects + session gating. Unstyled — verification only.

### Changed
- Architecture (pre-shell): **Projects** is the primary authenticated landing page;
  temporary `/dashboard` kept only for auth verification (landing switches to `/projects`
  once Projects ships). Roadmap milestone renamed **Protected Dashboard → Protected
  Application Shell**. Introduced **`AppShell`** (authenticated root layout), **`Breadcrumb`**,
  and **`ProjectLayout`** in the component guidelines. All collections must implement both
  `LoadingState` and `EmptyState`.
- Authenticated landing switched from `/dashboard` to **`/projects`** (dashboard kept for
  auth verification). `/login`, `/register`, `/` redirect to `/projects` when authed.
- Removed `components/auth/user-menu.tsx` (superseded by the shared `UserNav`).
- Moved `app/`, `components/`, `lib/` into `src/`.
- Updated `@/*` path alias → `src/*`; `components.json` css path → `src/app/globals.css`.
- Prisma 7: removed `datasource.url` from `schema.prisma` (now in `prisma.config.ts`);
  runtime connects via a driver adapter.

### Fixed
- **Vercel deploy** (3 issues): (1) the gitignored `src/generated/prisma` wasn't generated
  on Vercel → added `prisma generate` via `postinstall` and the `build` script; (2)
  `prisma.config.ts` imports `dotenv/config` but `dotenv` was only a transitive dep →
  declared it explicitly so `prisma generate` resolves under a clean `npm ci`; (3)
  `src/lib/db/client.ts` threw `DATABASE_URL is not set` at import time, failing
  `next build` page-data collection → the client is now instantiated lazily (a `Proxy`
  that connects + checks env on first query), so the build no longer needs `DATABASE_URL`.
- Prisma generator output path → `src/generated/prisma` (was `../app/generated/prisma`);
  `.gitignore` updated to match.
- `UserNav` dropdown crashed on open (`MenuGroupContext is missing`): Base UI's
  `DropdownMenuLabel` (= `Menu.GroupLabel`) requires a surrounding `Menu.Group`. The
  account header is display-only, so it's now a plain `div`.
