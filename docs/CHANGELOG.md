# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

> **▶ Resume (paused 2026-07-14, clean tree at `3a078fe`, build + tsc green):** Shipped through
> **Milestone 12 — Prompt Builder DESIGN** (docs only). **Next = Prompt Builder implementation**
> (before Templates): lock the open decisions in `PROMPT_BUILDER.md`, then build the creative-brief
> UI + a pure provider-agnostic `buildPrompt` in `src/lib/prompt/` → the existing `generateImage`,
> store the brief in the recipe, add "Open in Builder" (remix) from the Gallery. Templates come
> after (= saved briefs). First run: `nvm use` (Node 24); restart `npm run dev` only after a prisma
> migrate. Env for AI: `HF_TOKEN` / `HUGGINGFACE_API_KEY` (+ optional `HF_IMAGE_MODEL`).

### Design (no code)
- **Prompt Builder design** (Milestone 12 — design only): new **`PROMPT_BUILDER.md`** and
  **`CREATIVE_WORKFLOW.md`** — the intent-driven experience where the user *describes what they
  want* and AI Studio *writes the prompt*. Covers the user journey, UX philosophy (describe not
  engineer; simple-by-default; the prompt is an output not an input; provider-agnostic), the
  **creative brief** (Identity/Subject/Style/Mood/Lighting/Camera/Composition/Location/Time/
  Aspect/Quality/Notes), a **provider-agnostic `buildPrompt` transform** (brief → neutral prompt
  + params), planned components + states, ASCII **wireframes** (empty / builder / advanced /
  review / mobile), and integration with Identity, **Recipes** (brief stored in the recipe →
  Remix), Gallery ("Open in Builder"), and Generation (sits *above* the unchanged generation
  layer). Documents future Templates (= saved briefs), multiple identities, video, and the
  workflow builder. **No code, schema, routes, or components.** ROADMAP/TODO updated (Prompt
  Builder is the next milestone, before Templates).
- **Vision expanded — Creative Operating System** (docs only): evolved `VISION.md` (single
  source of truth; structure preserved) — new one-liner (an intelligent Creative Operating
  System that orchestrates multiple AI providers), "the **orchestration** engine is the
  product", a new **AI Studio Philosophy** section (provider-agnostic forever · orchestration
  not generation · users describe goals not models · complexity hidden behind simple UX · AI
  Studio owns the workflow, not the provider), and a **Future Direction — Intelligent AI
  Orchestration** section (long-term only: intent-driven generation, multi-provider workflows,
  identity processing/relationships, multiple identities per generation, a ComfyUI-inspired
  visual workflow builder, generation recipes, creative pipelines). Reinforces existing
  decisions; no architectural change, no new Decision.
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
- **AI Generation v2 — Creative Loop** (Milestone 11, Decision 030): strengthens
  `generate → gallery → improve → generate again`, no new storage. **Generation recipes** —
  the `Generation` record *is* the recipe (prompt/provider/model/`params`/identity/timestamps);
  the media layer now surfaces a read-only **`recipe`** on generated `MediaAsset`s. **Regenerate**
  (`regenerateGeneration`) and **Generate Variation** (`generateVariation`) re-run a recipe as a
  new generation, with lineage tagged in `params` (`source`, `fromGenerationId`) — via a shared
  `runImageGeneration` runner. **Generation history** (`listRecentGenerations`) reuses existing
  data (Generation + signed result). **Generate page** improved: larger prompt editor,
  character counter + validation, clearer loading/error, and a recent-generations list (open /
  copy prompt / use prompt). **Gallery viewer** exposes **Copy Prompt · View Recipe · Generate
  Again · Variation** for generated media (added optional `onRegenerate`/`onVariation`/`busy` to
  `MediaViewer`). New `docs/GENERATION_RECIPES.md`. Identity stays optional/provenance-only;
  provider stays isolated behind `ImageProvider`. **No migration.** Verified end-to-end with
  real HF generate + regenerate + variation (`scripts/verify-generation.ts`); build + tsc pass.
- **First Light — AI image generation** (Milestone 10): the first end-to-end generation,
  provider-agnostic. New **AI layer** (`src/lib/ai/`, Decision 029): `ImageProvider` interface +
  provider registry (`getImageProvider()`); **Hugging Face** is the only implementation
  (`providers/huggingface.ts`, `@huggingface/inference` `textToImage`, default model
  `black-forest-labs/FLUX.1-schnell`) — **no HF specifics leak outside the provider folder**.
  New **generation layer** (`src/lib/generation/`): owner-scoped, synchronous (authorize →
  `Generation` RUNNING → provider → persist via media layer → SUCCEEDED/FAILED); `Job` queue
  deferred. **Media layer now unions `UploadedMedia` + `GeneratedMedia`** so generated images
  appear in the **existing Gallery** as `source:"generated"` (making that filter real) — plus
  a new `createGeneratedMedia`; `getMedia`/`getMediaSignedUrl`/`deleteMedia` work across both
  tables (composite cursor pagination). **Schema** (migration `generation_first_light`):
  `GeneratedMedia` gained `pathname`/`projectId`/`originalFilename`. Minimal **UI**: a
  **Generate** workspace tab (`/projects/[id]/generate`) — one prompt, one button, loading/error,
  result shown inline + in the Gallery. Server action + hook (invalidates the media query).
  **Env:** `HF_TOKEN` or `HUGGINGFACE_API_KEY` (+ optional `HF_IMAGE_MODEL`). Blob only via the
  blob layer, media only via the media layer, provider isolated behind `ImageProvider`,
  owner-scoped throughout. Identity may be attached for provenance (no identity-aware prompting
  yet). **Verified end-to-end with a real Hugging Face generation** (`scripts/verify-generation.ts`);
  build + `tsc --noEmit` pass.
- **Identity Manager** (Milestone 9A) — implements the frozen Identity design. **Schema:**
  extended `Identity` (`description`, `status` `IdentityStatus` DRAFT|ACTIVE|ARCHIVED,
  `displayImageId` Hero Image, **`projectId` required + Cascade**) and a new **`IdentityMedia`**
  join table (`position`/`isFavorite`/`role` `TrainingMediaRole`) replacing the old
  `UploadedMedia.identityId` FK; migration `identity_manager`. **Identity layer**
  (`src/lib/identity/`, Decision 028) — owner-scoped CRUD + training-media add/remove/reorder/
  favorite/role + Hero Image + archive/restore, using the media layer exclusively (new
  `getMediaByIds` for signing; never touches Blob). **Status is derived** (new = DRAFT; first
  media → ACTIVE; last removed → DRAFT; ARCHIVED explicit) — no Activate button. Server actions
  (`actions/identities.ts`) + hooks (`hooks/use-identities.ts`). **UI** (`src/components/identity/`):
  `IdentitiesView` (list + filters), `IdentityCard`/`IdentityAvatar`/`IdentityStatusBadge`,
  `IdentityDetailView` with **Overview / Training Media / Settings** sub-tabs
  (Templates/History reserved, disabled), `IdentityOverview`, `IdentityTrainingMedia` +
  `TrainingMediaCard` + `TrainingMediaSelector`, `IdentitySettings`, form + delete dialogs.
  Routes `/projects/[id]/identities` and `/identities/[identityId]`. **Gallery integration:**
  selection mode + "Create identity from selection" (added `selectable`/`selected` props to the
  shared `MediaCard`/`MediaGrid` — no second uploader/browser). Provider-agnostic (no AI).
  Verified end-to-end via `scripts/verify-identity.ts`; build + `tsc --noEmit` pass.
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
