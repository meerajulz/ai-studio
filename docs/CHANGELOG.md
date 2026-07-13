# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Design (no code)
- **Identity design frozen** (Decision 027, design only): final MVP refinements before
  implementation — **project-scoped identities** (`projectId` becomes required + Cascade;
  global library out of scope), a **dedicated Overview sub-tab** (default), **"Hero Image"**
  naming (maps `displayImageId`), **three statuses** `DRAFT | ACTIVE | ARCHIVED`, standardized
  planning-only training-media **roles** (`PRIMARY|SECONDARY|VIDEO|POSE|STYLE|OTHER`), Gallery +
  media layer reaffirmed as the single source (no second upload flow), and AI kept out
  (provider-agnostic). Updated `IDENTITIES.md`, `TRAINING_MEDIA.md`, `IDENTITY_UX.md`,
  `COMPONENT_GUIDELINES.md`, `ROADMAP.md`, `TODO.md`, `DECISIONS.md` (#027). No code/schema.
  Next: **Milestone 9A — Identity Manager implementation.**
- **Identity Manager UX & workflow design** (design only): new **`IDENTITY_UX.md`** — the
  complete Identity experience: user journey, ASCII wireframes for every screen (identities
  list, create dialog + create-from-Gallery-selection, identity overview/detail with sub-tabs,
  training-media grid + selector + viewer, settings, archived view), navigation/routes
  (`/projects/[id]/identities` + `/[identityId]`), every empty state, the full action list,
  reserved space for future Templates/History/Generate/LoRA/AI-settings, real-world workflow
  scenarios, and a UX review (clicks/duplicate-screens/get-lost risks + fixes). Reuses the
  `media/` components + workspace shell; no code, schema, components, or routes.
- **Future architecture note — multiple identities per generation** (Decision 026, design
  only): documented evolving `Generation.identityId` (single) into a `GenerationIdentity`
  many-to-many ("appears-in"), kept separate from training media (`IdentityMedia`). Added a
  "Future architecture" section + open question to `IDENTITIES.md`, a distinguishing note to
  `TRAINING_MEDIA.md`, a TODO, and Decision 026. Accepted as a future direction with open
  sub-questions; **no schema, migration, or code changed.**
- **Identity System Design** (Milestone 9 — design only, Decision 025): documentation-first
  spec of the Identity architecture before implementation. New **`IDENTITIES.md`** (what an
  Identity is, the problems it solves, philosophy, lifecycle create/edit/archive/restore/
  delete, relationships to Projects/Media/Templates/AI providers/jobs/future LoRAs, generation
  config resolution, provider-agnostic design) and **`TRAINING_MEDIA.md`** ("Training Media"
  not "reference images"; images + videos from day one; selection/removal/organization;
  future metadata/tagging/ranking/favorites/masks/pose/segmentation — all as link metadata,
  design only). Schema **review** (recommend `description`, `displayImageId`, `status`, and an
  `IdentityMedia` join table; defer generation-default columns until the Prompt Builder/AI
  consume them) — **no schema change**. Updated `VISION.md` (core workflow with Identity as
  the central concept), `ROADMAP.md` (milestone placement Gallery → Identity → Templates →
  Prompt Builder → AI), `COMPONENT_GUIDELINES.md` (planned Identity components — responsibilities
  only). No implementation, migration, UI, routes, or database changes.

### Added
- **Project Gallery** (Milestone 8) at `/projects/[id]/gallery` — the central, source-agnostic
  media browser for a project. Responsive grid of BOTH uploaded images **and** videos (image
  thumbnails lazy-load; video tiles show a poster frame + play affordance), a full-size
  **MediaViewer** modal (image / video player + metadata + delete), and **filters** (type:
  all/images/videos · source: all/uploaded/**generated** placeholder · sort: newest/oldest ·
  debounced filename search). **Infinite scroll** via `IntersectionObserver` +
  `useInfiniteQuery` (cursor pagination). Loading/empty/error states. Owner-scoped; never
  touches Blob directly. Generated AI media will drop into the same grid/filters/viewer with
  no UI change (Decision 024).
- **Media layer refined into the single public media API** (Phase 1 of Milestone 8,
  Decision 024). `src/lib/media/server.ts` now exposes owner-scoped `createMedia`,
  `listProjectMedia` (kind/source/sort/search + cursor pagination), `getMedia`,
  `getMediaSignedUrl`, `updateMediaMetadata`, `deleteMedia`, `handleProjectUpload`; client
  `uploadProjectMedia`. New source-tagged **`MediaAsset`** contract (`source: uploaded |
  generated`). Canonical Server Actions in `actions/media.ts` (replaces `actions/uploads.ts`);
  unified hooks in `hooks/use-media.ts` (`useProjectMedia` infinite query + `useDeleteMedia`,
  replaces `use-uploads.ts`). **Reusable components** in `src/components/media/`: `MediaCard`,
  `MediaGrid`, `MediaViewer`, `MediaFiltersBar`, `DeleteMediaDialog`. The **Uploads tab was
  migrated onto these** (its `UploadedMediaCard`/`DeleteUploadDialog` removed) so Uploads +
  Gallery share one code path. Verified end-to-end via `scripts/verify-media.ts` (persist →
  signed URLs → filter/sort/search/paginate → getMedia/rename/refresh → owner authorization
  → delete, against the live store + DB). Top-level `/uploads` + `/gallery` documented as
  temporary placeholders (NAVIGATION.md); **no routing changes**.
- **Upload System** (Milestone 7B): the Uploads tab of a project workspace now supports real
  image **and** video uploads to the private Blob store. **Media layer** (`src/lib/media/`,
  Decision 022) that all feature code depends on instead of the blob layer directly:
  `server.ts` (`persistUpload`/`listProjectUploads`/`deleteUpload` + project-ownership
  guard + client-token issuance), `client.ts` (`uploadProjectMedia` — browser upload +
  best-effort width/height/duration probing), `types.ts` (`UploadedAsset` contract),
  `index.ts` (shared-types barrel). **`/api/uploads`** route implements `@vercel/blob`
  `handleUpload` to authorize + mint a **scoped client token** (`onBeforeGenerateToken`
  verifies the user owns the target project and locks the token to that project's path +
  allowed MIME types + 200 MB ceiling); metadata is persisted by an explicit `createUpload`
  Server Action after the upload (not the localhost-unreachable `onUploadCompleted` webhook —
  Decision 023). Owner-scoped Server Actions in `actions/uploads.ts`; shared `requireUserId`
  helper (`lib/auth/session.ts`, also adopted by `actions/projects.ts`). **UI** under
  `src/components/upload/`: `UploadDropzone` (drag & drop + click-to-browse, multiple),
  `UploadQueueItem` (progress bar, cancel, retry, remove), `UploadedMediaCard`
  (image/video thumbnail via signed URL + delete), `DeleteUploadDialog`, and `UploadsView`
  (three-state grid: `LoadingState`/`EmptyState`/content + "storage not configured" notice).
  Client hooks: `use-uploads.ts` (TanStack Query list + delete, key `["uploads", projectId]`)
  and `use-upload-manager.ts` (transient queue with `p-limit` concurrency of 3, friendly
  validation errors via Sonner). **DB:** extended `UploadedMedia` (`pathname`,
  `originalFilename`, `durationSeconds`, `updatedAt`) via migration
  `add_upload_media_metadata`. **Verified end-to-end against the live private store + DB**
  via `scripts/verify-uploads.ts` (upload image + video → raw URL 403 / signed URL 200 →
  metadata persisted → owner authorization denied for another user → delete). Build +
  `tsc --noEmit` pass. No Gallery/Identity/AI work — uploads stay decoupled from AI.
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
  Validation/error logic is pure and typechecked. Uploads use **private** access
  (`access: "private"`) to match the private `ai-studio-media` store; added
  `getSignedUrl()` (Vercel Blob `issueSignedToken` → `presignUrl`) to mint short-lived
  view URLs, and `SIGN_URL_FAILED` error code. **Verified end-to-end against the live
  store** via `scripts/verify-blob.ts` (upload → raw URL 403 → signed URL serves bytes →
  delete → 404). No UI yet.
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
