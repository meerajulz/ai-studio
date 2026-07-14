# Architecture Decision Log

Every time we make a decision, we write it down here.
One entry per decision, numbered in order. Append new decisions at the bottom.

**Status** is one of: `Accepted` · `Proposed` · `Superseded by Decision NNN` · `Deprecated`

---

## Template

```
# Decision NNN

Date
YYYY-MM-DD

Decision
What we decided.

Reason
Why.

Alternatives
What else we considered.

Status
Accepted
```

---

# Decision 001

Date
2026-07-09

Decision
Use Next.js App Router.

Reason
Better Server Components support.

Alternatives
Pages Router

Status
Accepted

---

# Decision 002

Date
2026-07-09

Decision
Use a `src/` directory layout — all app code under `src/`, config at the repo root.

Reason
Separates application code from project configuration; cleaner root.

Alternatives
Keep `app/`, `components/`, `lib/` at the repo root.

Status
Accepted

---

# Decision 003

Date
2026-07-09

Decision
Require Node.js ≥ 20.19 (develop on Node 24). Pinned via `.nvmrc` and `engines`.

Reason
Prisma 7 crashes on Node 18 (`ERR_REQUIRE_ESM`); the toolchain needs a modern Node.

Alternatives
Stay on Node 18; downgrade Prisma.

Status
Accepted

---

# Decision 004

Date
2026-07-09

Decision
Use Prisma + PostgreSQL for the database layer.

Reason
Type-safe queries, migrations, and a single schema shared across the app.

Alternatives
Drizzle; raw SQL; a NoSQL store.

Status
Accepted

---

# Decision 005

Date
2026-07-09

Decision
Use Better Auth for authentication.

Reason
Modern, TypeScript-first auth that integrates cleanly with the Next.js App Router.

Alternatives
NextAuth/Auth.js; Clerk; roll-your-own sessions.

Status
Accepted

---

# Decision 006

Date
2026-07-09

Decision
Use Vercel Blob for media (image/video) storage.

Reason
First-class Next.js/Vercel integration for large file uploads and serving.

Alternatives
AWS S3; Cloudflare R2; Supabase Storage.

Status
Accepted

---

# Decision 007

Date
2026-07-09

Decision
Keep AI integrations provider-agnostic behind common `ImageProvider` and
`VideoProvider` interfaces in `src/lib/ai/`.

Reason
Providers can be swapped or combined without changing the rest of the codebase.

Alternatives
Call each provider SDK directly from feature code.

Status
Accepted

---

# Decision 008

Date
2026-07-09

Decision
Build backend and architecture first; UI last
(Architecture → Database → Auth → Storage → AI → Frontend).

Reason
The product's value is the generation pipeline; a solid backend de-risks the UI work.

Alternatives
UI-first / vertical slices per feature.

Status
Accepted

---

# Decision 009

Date
2026-07-09

Decision
Keep `src/lib/utils.ts` as a file rather than a `lib/utils/` folder.

Reason
Every shadcn component imports `@/lib/utils` (the `cn()` helper); a `utils/` folder
alongside would create an ambiguous import.

Alternatives
Convert to `src/lib/utils/index.ts` (folder). Revisit if `utils` grows.

Status
Accepted

---

# Decision 010

Date
2026-07-10

Decision
Host PostgreSQL on Neon (serverless), deploy on Vercel.

Reason
Free tier, excellent Postgres, automatic backups, database branching, a web UI, and
first-class Prisma + Vercel integration.

Alternatives
Supabase; Railway; local Postgres; PlanetScale.

Status
Accepted

---

# Decision 011

Date
2026-07-10

Decision
Initial Prisma schema: 9 models (User, Project, Identity, UploadedMedia, Generation,
GeneratedMedia, Job, Template, FavoritePrompt). `provider`/`model` stored as strings +
`params Json`; `Generation`↔`Job` 1:1; uploaded vs generated media kept as separate
tables; per-user cascade deletes; `cuid()` ids.

Reason
Matches the spec, stays provider-agnostic (Decision 007), and separates request/result
from execution/queue state.

Alternatives
Unified `Media` table with a `kind` discriminator; Postgres enums for providers; folding
job fields into `Generation`.

Status
Accepted

---

# Decision 012

Date
2026-07-10

Decision
Prisma 7 config: connection URL lives in `prisma.config.ts` (not `schema.prisma`); the
runtime `PrismaClient` uses the `@prisma/adapter-neon` driver adapter, wrapped in a
`globalThis` singleton under `src/lib/db/`. **Implemented and verified against Neon.**

Reason
Required by Prisma 7 — `datasource.url` in the schema is no longer allowed; the client
needs an adapter or Accelerate. Neon's serverless driver suits the Vercel target, and
the singleton avoids connection exhaustion during dev hot-reload.

Alternatives
`@prisma/adapter-pg` (node-postgres); Prisma Accelerate.

Status
Accepted — implemented

---

# Decision 013

Date
2026-07-10

Decision
Use Better Auth for authentication, starting with email + password, via the Prisma
adapter over the Neon `prisma` client. Auth models (`User`, `Session`, `Account`,
`Verification`) live in `schema.prisma` (hand-written to match Better Auth's core
schema, kept consistent with the domain models — no `@@map`). Server config in
`src/lib/auth/`, browser client in `src/lib/auth/client.ts`, catch-all route at
`src/app/api/auth/[...all]/route.ts`.

Reason
Modern, TypeScript-first, integrates cleanly with the App Router and Prisma. Confirms
Decision 005. Hand-writing the models avoided the CLI failing to resolve the `@/` path
alias and kept table naming consistent with the domain schema.

Alternatives
Better Auth CLI `generate` (path-alias resolution risk); NextAuth/Auth.js; Clerk.

Status
Accepted — implemented, sign-up/sign-in verified end-to-end

---

# Decision 014

Date
2026-07-10

Decision
Auth flow UI: `/login` and `/register` use the shadcn `Form` component with React Hook
Form + Zod (`src/lib/validations/auth.ts`) and the Better Auth browser client. Route
protection is enforced **server-side** in each page via
`auth.api.getSession({ headers: await headers() })` + `redirect()` — authed users are
redirected away from auth pages, unauth users away from protected pages. A temporary
`/dashboard` renders a `UserMenu` (name/email/sign out) purely to verify the flow.

Reason
Server-side guards avoid the auth-state flash of client-only checks and are harder to
bypass. RHF + Zod gives typed validation reused from `lib/validations`. Keeping the
verification UI unstyled matches "backend-first" (Decision 008).

Alternatives
Client-side guards with `useSession`; middleware-based redirects; a shared route-group
layout guard (may adopt the layout-guard pattern for the real dashboard later).

Status
Accepted — implemented, full flow verified (redirects + session gating)

---

# Decision 015

Date
2026-07-10

Decision
Build a **Protected Application Shell** (renamed from "Protected Dashboard") as the next
milestone. **Projects** (`/projects`) becomes the primary authenticated landing page; the
temporary `/dashboard` is kept only for auth verification and the landing redirect stays
`/dashboard` until Projects ships, then flips to `/projects`. Introduce **`AppShell`** as
the authenticated root layout (`app/(protected)/layout.tsx`) housing Sidebar + Header +
**`Breadcrumb`**, plus **`ProjectLayout`** for project workspaces. All collections must
implement both `LoadingState` and `EmptyState`. New docs: WORKSPACE.md, UX_PRINCIPLES.md.

Reason
"Everything belongs to a Project" (VISION) → Projects is the natural home, not a generic
dashboard. Keeping `/dashboard` during the transition avoids breaking the already-verified
auth flow (a smooth evolution: Login→Dashboard→Projects, later Login→Projects→Workspace).
A single `AppShell` centralizes the session guard and layout so pages stay consistent.

Alternatives
Make `/dashboard` the permanent home; per-page layout instead of a shared shell; remove
`/dashboard` immediately (rejected — would disrupt the tested auth redirect).

Status
Accepted — **implemented**. `AppShell` + Sidebar/Header + shared components built;
`app/(protected)/` centralizes the guard; landing flipped to `/projects` (dashboard kept
temporarily). Verified via build + live guard/nav test.

---

# Decision 016

Date
2026-07-10

Decision
Domain data pattern (first used for Projects): **Server Actions** in `src/actions/` for
all reads/mutations, each resolving the Better Auth session and scoping queries by
`userId` (owner-only via `updateMany`/`deleteMany` where `userId`); **Zod** validation
shared from `src/lib/validations/`; **TanStack Query** on the client
(`src/hooks/use-<entity>.ts`) for loading state + cache invalidation. Providers
(`QueryProvider` + Sonner `Toaster`) live in the root layout.

Reason
Server Actions keep data logic on the server (no separate API layer), ownership scoping
enforces multi-user isolation, and TanStack Query gives loading/empty/error states +
automatic refetch on mutation. This is the reference pattern for identities, uploads,
generations, etc.

Alternatives
Route handlers + fetch; server-component data fetching only (no client cache); RSC
mutations without TanStack Query.

Status
Accepted — implemented for Projects (list/create/update/delete), verified via build +
ownership tests.

---

# Decision 017

Date
2026-07-10

Decision
Treat a **Project as a self-contained creative workspace**, not just a folder. Each
project will (later) carry its own creative defaults — preferred image/video model,
default aspect ratio, prompt templates — plus its identities, uploads, generations, and
gallery, so switching projects switches all AI defaults automatically.

Reason
Smoother UX: users move between contexts (e.g. Instagram campaign vs YouTube) without
reconfiguring models/settings each time. Strong long-term product foundation.

Alternatives
Global user-level settings only; per-generation configuration with no project memory.

Status
Accepted as **direction** — documented in [WORKSPACE.md]; **not implemented yet** (no
schema change). Revisit when building generation settings.

---

# Decision 018

Date
2026-07-10

Decision
Build the Project Workspace as a **tabbed, Notion/Linear-style layout** using nested
routes under `app/(protected)/projects/[id]/` — a shared `layout.tsx` fetches the project
once (owner-scoped) and renders `ProjectLayout` (header + tab links) around each tab page
(`page.tsx`, `uploads/`, `gallery/`, `identities/`, `templates/`, `jobs/`, `settings/`).
Introduce a **workspace context** (`lib/providers/workspace-provider.tsx`, wrapped in
`AppShell`) that holds the active project so components can read it without
prop-drilling — used now by the breadcrumb to show the project name instead of its id.

Reason
Nested routing gives real, linkable tabs with per-tab loading (`loading.tsx`) and keeps
the owner check in one place. The workspace context is the practical mechanism for the
"current project" concept (DECISIONS #017) and cleanly powers the breadcrumb; later it can
expose per-project defaults (models, aspect ratio, templates).

Alternatives
Client-only tab switching (no routes, not linkable); passing the project through props
everywhere; a global state library (Zustand) instead of context.

Status
Accepted — implemented (shell only). Overview + 6 placeholder tabs, breadcrumb name,
loading/empty states; verified via build + owner-scoped route tests. No uploads/blob/
gallery/AI yet.

---

# Decision 019

Date
2026-07-10

Decision
Build the storage layer **before** any upload UI (like Prisma before features): a modular
`src/lib/blob/` package on Vercel Blob, split into `constants` / `types` / `validation` /
`errors` / `server` / `client` / `index`. Server (`put`/`del`) and browser (`upload`)
helpers live in separate entry points; the barrel exports only the shared/isomorphic
pieces. Validation (MIME + size) and error handling (`StorageError`) are pure and
provider-agnostic. Treat uploaded media as first-class **assets** (blob location +
metadata + project/owner + filename + future tags/AI-usage), captured in
`AssetMetadata` / MEDIA_PIPELINE.md.

Reason
Separating infrastructure from the feature that uses it keeps upload/gallery/identity
work simple and testable. The asset model avoids a redesign when reuse/search/history
features arrive. Keeping validation provider-agnostic means the storage backend could be
swapped later.

Alternatives
Build upload UI + storage together; a single blob module; store media as plain "files"
without an asset model; another storage backend (S3/R2) — Vercel Blob chosen for
first-class Vercel integration (DECISIONS #010 stack).

Status
Accepted — implemented (7A), deployed to Vercel, and **verified end-to-end against the
live Blob store** (`scripts/verify-blob.ts`: upload → signed-URL read → delete). Added
`isBlobConfigured()` for graceful degradation. Access model finalized as private — see
Decision 021. `UploadedMedia` persistence + Uploads UI come in 7B.

---

# Decision 020

Date
2026-07-12

Decision
Make the app build reliably on Vercel: (1) generate the Prisma client at build via a
`postinstall` + a `prisma generate` prefix on the `build` script, since the generated
client (`src/generated/prisma`) is gitignored; (2) declare `dotenv` as an explicit
devDependency because `prisma.config.ts` imports `dotenv/config`; (3) instantiate the
`PrismaClient` singleton **lazily** behind a `Proxy` in `src/lib/db/client.ts` so
importing the db layer during `next build` page-data collection does not require
`DATABASE_URL` — the connection and env check happen on first query.

Reason
The gitignored generated client and an import-time `DATABASE_URL` check both broke the
Vercel build (module-not-found, then `DATABASE_URL is not set`). Generating on build and
deferring instantiation keeps runtime behavior identical while decoupling the build from
runtime secrets and generated artifacts.

Alternatives
Commit the generated client (rejected — build output in git); use a Prisma Vercel
integration/Accelerate; keep the eager singleton and require `DATABASE_URL` at build time
(rejected — couples build to runtime secrets).

Status
Accepted — implemented; local clean build verified with `src/generated/prisma` removed
and with `DATABASE_URL` unset.

---

# Decision 021

Date
2026-07-12

Decision
Store media in a **private** Vercel Blob store (`ai-studio-media`). Uploads use
`access: "private"`, so raw blob URLs are not publicly reachable; media is served via
**short-lived signed URLs** minted server-side by `getSignedUrl(pathname)` (Vercel Blob
`issueSignedToken` → `presignUrl`, default 1h TTL). Persistence stores each asset's
`pathname`; Gallery/Identities request a fresh signed URL per render rather than caching a
permanent URL.

Reason
The media is personal and identity-based (faces, reference photos), so public-by-URL
access is inappropriate even with unguessable suffixes. A private store keeps assets
authenticated; signing on demand scopes access and lets URLs expire. The store was already
created as private, and this was validated end-to-end before building the Upload API to
avoid discovering an access mismatch mid-feature.

Alternatives
Public store with unguessable random-suffix URLs (simpler, direct `<img src>`, rejected
for privacy); making the store public to match the original `access: "public"` code;
proxying every asset through a Next route that streams `get()` (more server load than
signed URLs).

Status
Accepted — implemented and **verified end-to-end against the live private store**
(`scripts/verify-blob.ts`: upload → raw URL 403 → signed URL serves → delete → 404).

# Decision 022

Date
2026-07-13

Decision
Introduce a dedicated **media layer** (`src/lib/media/`) that sits between feature code and
the blob layer. Feature code (Server Actions, the upload route, components, hooks) depends
**only** on the media layer — never on `src/lib/blob/*` directly. The split of
responsibilities is: blob layer = how to store/sign/delete bytes; media layer = what an
"asset" is, who owns it, how it's persisted (`UploadedMedia`), and how stored assets become
signed, renderable URLs. `media/server.ts` (persist/list/delete/ownership + client-token
issuance), `media/client.ts` (browser upload + dimension probing), `media/types.ts`
(the `UploadedAsset` contract), `media/index.ts` (shared-types barrel).

Reason
Keeps the layers clean as the roadmap grows (Gallery, Identities, then AI outputs) — every
media consumer builds on one owner-scoped boundary instead of re-deriving storage + auth +
persistence rules. Ownership is enforced in exactly one place (the media layer), and the
blob layer stays a thin, provider-shaped storage primitive we could swap. Explicitly avoids
coupling uploads to AI: uploads are just media.

Alternatives
Call blob helpers straight from Server Actions/components (rejected — scatters ownership and
persistence logic, couples features to the SDK); a generic "storage service" that also owned
AI outputs (premature — GeneratedMedia has a different lifecycle; revisit when AI lands).

Status
Accepted — implemented; **refined in Milestone 8** (Decision 024) into the sole media API.
Verified via `scripts/verify-media.ts` (persist → sign → list/filter/paginate →
owner-authorization → delete against the live store + DB).

# Decision 023

Date
2026-07-13

Decision
For the browser upload flow, persist the `UploadedMedia` record with an **explicit Server
Action** (`createUpload`) that the client calls after `@vercel/blob` finishes storing the
bytes — **not** via the Blob `onUploadCompleted` webhook. The `/api/uploads` route still
implements `handleUpload`, but only to authorize + mint a scoped client token
(`onBeforeGenerateToken`: verify the user owns the project, lock the token to that project's
path + allowed MIME types + max size). Width/height/duration are probed client-side and sent
to the persist action, which re-validates ownership, path prefix, MIME, and size.

Reason
The `onUploadCompleted` webhook cannot reach `localhost`, so relying on it would make local
verification impossible and split persistence across environments. An explicit action makes
the persist step deterministic, lets us attach client-probed dimensions, and re-checks
authorization at the data boundary so a crafted request can't attach a blob to another
user's project. Token issuance stays the single choke point for upload authorization.

Alternatives
Persist in `onUploadCompleted` (rejected — no localhost delivery, no client-probed
dimensions); server-side multipart upload proxying bytes through the app (rejected — defeats
the point of direct-to-Blob client uploads and adds server load).

Status
Accepted — implemented and verified (image + video upload, signed URLs, metadata, delete,
owner authorization). The persist action was renamed `createUpload` → `createMediaAction`
in Milestone 8 (Decision 024).

# Decision 024

Date
2026-07-13

Decision
The **media layer (`src/lib/media/`) is the single public API for all media** — Uploads,
Gallery, and later Identities, Templates, Jobs, and AI generation depend on it, and nothing
outside `src/lib/media` calls the blob layer directly. Server API (all owner-scoped):
`createMedia`, `listProjectMedia` (kind/source/sort/search filters + cursor pagination),
`getMedia`, `getMediaSignedUrl`, `updateMediaMetadata`, `deleteMedia`, `handleProjectUpload`;
client: `uploadProjectMedia`. The UI contract is a **source-tagged `MediaAsset`**
(`source: "uploaded" | "generated"`) so one browser handles everything: `listProjectMedia`
already accepts a `generated` filter (returns empty until AI outputs land). The **Project
Gallery** (`/projects/[id]/gallery`) and its reusable components (`MediaCard`, `MediaGrid`,
`MediaViewer`, `MediaFiltersBar`, `DeleteMediaDialog`) are **source-agnostic** — generated
media plugs into the same grid/filters/viewer with no UI change. Future media features must
reuse the Gallery + these components rather than build their own browser. Planned-but-unbuilt
media methods (no consumer yet): `move()`, `duplicate()`, `generateThumbnail()`,
`refreshSignedUrls()` (bulk).

Reason
Keeps layers clean as the roadmap grows and prevents N feature-specific media browsers.
Ownership + persistence + signing live in exactly one place; a single unified asset shape
means "treat everything as Media, don't special-case uploads." Refined now, while Uploads was
still the only consumer, so Gallery could be built directly on the final API (Uploads was
migrated onto it in the same milestone). Explicitly avoids coupling media to AI — an upload
is just media; generated media is another source of the same `MediaAsset`.

Alternatives
Separate upload/gallery data paths (rejected — duplicate ownership/signing logic, diverging
UIs); one global media browser now (deferred — see NAVIGATION.md; decide after the project
Gallery settles); building `updateMetadata`/`move`/`duplicate` speculatively (rejected —
implemented only `updateMediaMetadata`, which is verified; the rest wait for a real consumer).

Status
Accepted — implemented and **verified end-to-end** against the live private store + DB
(`scripts/verify-media.ts`). `npm run build` + `tsc --noEmit` pass.

# Decision 025

Date
2026-07-13

Decision
Lock the **Identity system architecture** up front (design only — no code/schema this
milestone). Full spec in [IDENTITIES.md](./IDENTITIES.md) + [TRAINING_MEDIA.md](./TRAINING_MEDIA.md).
Key choices:
1. **Identity is the central, provider-agnostic generation concept.** It stores *intent +
   material* (name, description, curated media, defaults), never a provider artifact. The
   workflow is `Project → Uploads → Gallery → Identity → Templates → Prompt Builder → AI →
   History` (VISION.md).
2. **"Training Media", not "Reference Images"** — images **and** videos from day one, and a
   curated **selection of existing `MediaAsset`s** (links), not a new store. It reuses the
   media layer + Gallery components (Decision 024); the Training Media UI composes them.
3. **A join table (`IdentityMedia`) is recommended** to replace the current direct
   `UploadedMedia.identityId` FK, so one asset can serve several identities and carry
   per-identity metadata (role/order/favorite/rank/mask). Land it in the Identity Manager's
   first migration, before any links exist. **Not migrated in this milestone.**
4. **Generation defaults resolve in layers** (provider/global → Identity → Template →
   per-generation, most-specific wins). Identity generation-default columns (`preferredPrompt`,
   `negativePrompt`, preferred models/providers as strings+`Json`, aspect ratio,
   `generationDefaults Json`) are **deferred** until the Prompt Builder/AI layer consumes
   them — no speculative columns (Decision 024 principle).
5. **Soft lifecycle:** add `status ACTIVE|ARCHIVED` for archive/restore; **delete severs
   media *links* and defaults only — never the underlying media or generated results**
   (`Generation.identityId` stays `SetNull`).
6. **Providers are plug-ins; the Identity is their input contract.** Provider-trained
   artifacts (LoRA/embedding/fine-tune) attach as **satellite records** keyed by
   `identityId` + provider string, so adding OpenAI/Fal/Replicate/Runway/local/ControlNet is
   one adapter + rows, never an Identity change (restates Decision 007 for identities).

Reason
Documentation-first: stabilize the architecture before code depends on it, so Identities,
Templates, Prompt Builder, and the AI layer all build on one settled contract. Reusing the
media layer avoids a second media system; the join table + satellites keep the Identity small,
shared, and provider-agnostic while leaving room for training/LoRA/masks/poses without a
reshape.

Alternatives
Keep the direct `UploadedMedia.identityId` FK (rejected — one-identity-per-asset, nowhere for
per-identity metadata); copy media into an identity-owned store (rejected — duplicates the
media layer, breaks single-source signing/deletion); add all generation-default + provider
columns now (rejected — speculative, no consumer yet); provider-specific fields on Identity
(rejected — couples the central concept to an SDK).

Status
Accepted (design) — implementation deferred to the Identity Manager milestone; **no schema,
migration, UI, routes, or API changed** in this milestone.

# Decision 026

Date
2026-07-13

Decision
The *appears-in* relationship between a generation and identities should evolve from the
current single `Generation.identityId` FK into a **many-to-many join, `GenerationIdentity`
(`generationId` × `identityId`)** — kept **separate** from training media. Two independent
concepts: `Identity → IdentityMedia → MediaAsset` (INPUT — what teaches an identity) vs
`Generation → GenerationIdentity → Identity` (OUTPUT — which identities appear in a result).
This lets one generated asset appear in multiple identity histories and supports multi-subject
generations (Emma + John + Max, characters + products/mascots, etc.). **Accepted as a future
direction only — sub-questions remain open; NOT implemented and NOT migrated.** Full note +
design sketch in [IDENTITIES.md](./IDENTITIES.md) ("Future architecture — multiple identities
per generation").

Open sub-questions (resolve before the AI generation system ships):
1. Granularity — attach at `Generation` (request) level vs per `GeneratedMedia` (recommend
   Generation level first; add per-asset later without reshape).
2. Requested vs detected — a `source` column (`requested | detected | confirmed`).
3. Role/position for multi-subject outputs.
4. Migration timing — keep `Generation.identityId` now; backfill into the join and deprecate
   the scalar before many generations exist.

Reason
A single generated image/video can legitimately contain several subjects, so a scalar
`identityId` is structurally insufficient. Recording the direction now (before AI generation
exists) means the migration is cheap and no code is built against the soon-to-be-wrong shape.
Keeping "teaches" and "appears in" independent avoids overloading one link table with two
unrelated lifecycles.

Alternatives
Keep the single `Generation.identityId` (rejected — can't express multi-subject outputs);
reuse `IdentityMedia` for both input and output (rejected — conflates training with
appears-in, two different concepts/lifecycles); attach identities only per `GeneratedMedia`
now (deferred — a valid future refinement, but request-level is the simpler default).

Status
Accepted (future direction) — **deferred; sub-questions open; NOT implemented, NO schema or
migration changed.** Revisit when building the AI generation / jobs system.

# Decision 027

Date
2026-07-13

Decision
**Freeze the Identity design for the MVP** ahead of the Identity Manager implementation
(Milestone 9A). Refinements locked (design only — no code/schema this milestone):
1. **Project-scoped identities (MVP).** Every Identity belongs to a user **and** a project,
   matching the rest of the app. The Identity Manager migration makes `Identity.projectId`
   **required** (non-null) and `onDelete: Cascade`. A user-global **Identity Library** is
   **explicitly out of MVP scope** (revisit later if valuable).
2. **Dedicated Overview sub-tab.** Identity detail keeps an **Overview** tab as the default
   landing (hero, name, description, status, media count, created/updated dates) — minimal
   today, the permanent home for future stats/templates/history/artifacts/AI defaults.
3. **"Hero Image".** The identity's primary visual is called **Hero Image** throughout the UI
   (cards, lists, breadcrumbs, pickers). It maps to the `displayImageId` column; the UX
   language is consistently "Hero Image".
4. **Three statuses:** `IdentityStatus` = **DRAFT | ACTIVE | ARCHIVED** (new identities start
   DRAFT; DRAFT is hidden from generation pickers).
5. **Standardized training-media roles (planning-only):** `IdentityMedia.role` ∈
   `PRIMARY | SECONDARY | VIDEO | POSE | STYLE | OTHER`. Standardized now for consistency; **no
   behavior is built around roles yet.**
6. **Gallery + media layer stay the single source of truth** — the Identity Manager reuses
   them; **no second upload workflow, ever** (reaffirms Decision 024). Creating an identity is
   always `Gallery → select → Create Identity → Training Media`.
7. **AI stays separate** — no Prompt Builder / providers / generation settings / LoRA in the
   Identity Manager; Identity remains provider-agnostic (reaffirms Decisions 007/025).

Full UX in [IDENTITY_UX.md](./IDENTITY_UX.md); architecture in [IDENTITIES.md](./IDENTITIES.md)
+ [TRAINING_MEDIA.md](./TRAINING_MEDIA.md).

Reason
Locking scope + naming + statuses + roles before implementation keeps the build unambiguous
and the architecture consistent. Project-scoping matches the existing mental model and keeps
ownership/cascade simple; three statuses (adding DRAFT) fit how users actually create an
identity before curating media; standardizing roles up front avoids churn when
pose/style/video conditioning lands. All refinements are additive to the already-accepted
design (Decisions 025/026) — none reverse a prior decision.

Alternatives
User-global identities from day one (rejected — added scope/ambiguity for no MVP benefit;
deferred); two statuses without DRAFT (rejected — no state for "created but not yet
organized"); keep "Display Image" naming (rejected — "Hero Image" reads better and scales to
dashboards); leave roles unspecified (rejected — inconsistent metadata later).

Status
Accepted — **design frozen.** Implementation begins in Milestone 9A (Identity Manager). **No
code, schema, migration, UI, or routes changed in this milestone.**

# Decision 028

Date
2026-07-13

Decision
Identities get their own **domain layer `src/lib/identity/`** (server + types), mirroring the
media layer — the single owner-scoped API for identity CRUD + training-media links. It
**depends on the media layer, never on the blob layer**: to render hero/training media it
calls a new media-layer function **`getMediaByIds(userId, ids)`** (owner-scoped batch fetch +
signing), so signing stays in exactly one place. Identity **status is derived, not manual**
(implements Decision 027): `createIdentity` starts DRAFT; adding the first training media →
ACTIVE; removing the last → DRAFT; ARCHIVED is explicit and "sticks" (restore recomputes to
ACTIVE/DRAFT by media count). There is no "Activate" action. The **Hero Image auto-sets** to
the first training media and falls back to the next when the current one is unlinked. Media
selection reuses the Gallery via **selection props added to `MediaCard`/`MediaGrid`**
(`selectable`/`selected`/`onToggleSelect`/`disabled`) — no second media browser or uploader.

Reason
Keeps the clean-layer architecture (Decision 024) consistent as domains grow: one owner-scoped
API per domain, signing centralized, feature code never touching Blob. Deriving status from
completeness matches how users actually build an identity and removes a redundant button.

Alternatives
Put identity logic in Server Actions/components (rejected — scatters ownership); let the
identity layer call the blob layer to sign (rejected — duplicates signing, breaks the single
boundary); a manual Activate button (rejected per Decision 027 — status should reflect
completeness). **Known follow-up:** deleting a media asset from the Gallery cascades its
`IdentityMedia` link + nulls the hero at the DB level, but does not re-derive identity status
(no identity-layer hook fires on a media-layer delete) — integrity holds (no orphans/dangling);
status simply catches up on the next training-media change. Revisit if it matters.

Status
Accepted — implemented and **verified end-to-end** against the live store + DB
(`scripts/verify-identity.ts`). `npm run build` + `tsc --noEmit` pass.

# Decision 029

Date
2026-07-14

Decision
**First Light** — the first end-to-end AI image generation, proving the architecture with one
provider. Key choices:
1. **Provider-agnostic via `ImageProvider`** (`src/lib/ai/`): feature code calls
   `getImageProvider()` and depends only on the interface; **all Hugging Face specifics live
   only in `src/lib/ai/providers/huggingface.ts`** (Decision 007). Future providers
   (Fal/OpenAI/Replicate/local) = one file + a registry case, nothing else changes. Providers
   return **bytes**, never URLs — storage is the app's job.
2. **Generated media surfaces through the MEDIA layer** as `MediaAsset { source: "generated" }`.
   The media layer now **unions `UploadedMedia` + `GeneratedMedia`** in
   `listProjectMedia`/`getMedia`/`getMediaSignedUrl`/`deleteMedia` (composite `createdAt,id`
   cursor across both tables), so a generated image appears in the **existing Gallery** with no
   second browser/uploader/pipeline — finally making the reserved `source:"generated"` filter
   real (Decision 024).
3. **`GeneratedMedia` schema additions** (migration `generation_first_light`): `pathname` (to
   mint signed URLs), `projectId` (to scope to the project Gallery), `originalFilename`. Served
   via signed URLs exactly like uploads (Decision 021).
4. **Synchronous generation** for First Light: the generation layer (`src/lib/generation/`)
   authorizes → creates `Generation` → calls the provider → persists via the media layer →
   sets `Generation.status` (`RUNNING → SUCCEEDED/FAILED`). The `Job` table (queue/progress/
   attempts) stays **unused/deferred** for async providers (Fal/Replicate) later — the intended
   Generation↔Job split (DATABASE #3).
5. **Env:** `HF_TOKEN` (preferred) or `HUGGINGFACE_API_KEY`; optional `HF_IMAGE_MODEL`
   (default `black-forest-labs/FLUX.1-schnell`). SDK: `@huggingface/inference`
   (`InferenceClient.textToImage(..., { outputType: "blob" })`, `provider: "auto"`). HF
   cold-start (503) is retried a bounded number of times **inside the provider** only.

Identity may be attached to a `Generation` (provenance) but **identity-aware prompting is NOT
built** — architecture kept ready. UI is intentionally minimal (one prompt, one button).

Reason
Proves the whole pipeline while honoring every layer boundary: Blob only via the blob layer,
media only via the media layer, provider isolated behind `ImageProvider`, owner-scoped
throughout. The media-layer union is the one substantive change and is the natural realization
of Decision 024. Synchronous + no `Job` avoids over-engineering a queue a single sync provider
doesn't need.

Alternatives
Store generated images as `UploadedMedia` (rejected — conflates sources, loses provenance);
a separate "generated" gallery/pipeline (rejected — violates single-source media, Decision
024); call the HF SDK from the generation layer or a component (rejected — provider must be
isolated); use the `Job` queue now (deferred — no async provider yet); hardcode `HF_TOKEN`
only (relaxed to also accept `HUGGINGFACE_API_KEY`, the name already in use).

Status
Accepted — implemented and **verified end-to-end** with a real Hugging Face generation
(`scripts/verify-generation.ts`: prompt → image → Blob → Neon → Gallery; media union; owner
authorization). `npm run build` + `tsc --noEmit` pass.

# Decision 030

Date
2026-07-14

Decision
**AI Generation v2 (Creative Loop).** Strengthen the `generate → gallery → improve → generate
again` loop without new storage:
1. **The `Generation` record IS the recipe** — no separate recipes table. It already stores
   prompt, provider, model, `params` (Json), `identityId`, status, and timestamps, and owns
   its `GeneratedMedia` result(s). **No schema change** was needed (see GENERATION_RECIPES.md).
2. **The media layer surfaces a read-only `recipe` on `MediaAsset`** for generated media
   (prompt/provider/model/identity/generationId/date), joined from the `Generation`. Uploaded
   media has `recipe: null`. This lets the Gallery show Copy Prompt / View Recipe / Generate
   Again without any feature touching the DB — media still flows only through the media layer.
3. **Regenerate + Variation are new generations** that reuse a recipe (same prompt/provider/
   model) via a shared `runImageGeneration` runner; lineage is tagged in the existing `params`
   Json (`source: "regenerate" | "variation"`, `fromGenerationId`) — the foundation for future
   Recreate/Compare/branching, again with no new columns.
4. **Generation history reuses existing data** — `listRecentGenerations` reads `Generation` +
   its result (signed via the media layer); nothing is duplicated.

UI stays intentionally minimal (larger prompt editor + counter + validation + clear loading/
error, a history list, Gallery viewer actions). Identity remains optional/provenance-only (no
identity-aware prompting). Provider stays isolated behind `ImageProvider` (Decision 029).

Reason
The recipe data already exists on `Generation`, so inventing a recipes table would duplicate
it. Surfacing a read-only recipe on `MediaAsset` keeps the Gallery decoupled from the DB and
respects the layer boundaries. Tagging lineage in `params` unlocks recreate/variation/branching
foundations without premature schema work ("earns its columns").

Alternatives
A dedicated `Recipe` table (rejected — duplicates `Generation`); storing recipe JSON on
`GeneratedMedia` (rejected — the `Generation` is the source of truth); a `parentGenerationId`
column now (deferred — `params` carries lineage until a feature needs a typed edge); building
Remix/Compare/branch UI now (out of scope — later milestones).

Status
Accepted — implemented and **verified end-to-end** (`scripts/verify-generation.ts`: recipe on
asset, history, real regenerate + variation with lineage, owner authorization). `npm run build`
+ `tsc --noEmit` pass. No migration.

---

# Decision 031

Date
2026-07-14

Decision
**Creative Director layer (`src/lib/creative/`).** Introduce a dedicated, provider-agnostic
layer that turns a user's plain creative **idea** into a professional prompt — the first step in
making AI Studio *intelligent* rather than a pass-through to a provider (VISION: "the user thinks
creatively; AI Studio thinks technically").
1. **One public entry: `directCreative(brief) → directive`.** Input is a `CreativeBrief`
   (`idea` + optional `style`/`focus` + optional `identityId`); output is a `CreativeDirective`
   (`prompt`, reserved `params`, and `meta` for transparency/recipe). The whole layer is **pure
   and deterministic** for the MVP — same brief → same prompt, no I/O, no provider SDKs, no AI.
2. **It is the ONLY place prompts are enriched.** The rest of the app passes the user's words
   straight through; nothing else manually decorates a prompt. This keeps enrichment auditable
   and swappable.
3. **Deterministic rules now, LLM later — same contract.** A small rules engine (style presets +
   subject detection + a "professional" quality floor) produces the enrichment today. Because the
   contract is `CreativeBrief → CreativeDirective`, an LLM implementation can replace the rules
   engine WITHOUT touching callers.
4. **Wired at the single generation chokepoint.** `runImageGeneration` calls the Director, sends
   the compiled prompt to the provider, and stores the user's **idea** in `Generation.prompt`
   with the brief + compiled prompt in `params.creative`. Regenerate/variation reconstruct the
   brief and re-run it, so recipes (Decision 030) stay reproducible/remixable. **No schema change.**
5. **UI stays simple.** Only one optional creative question is exposed — **Style**
   (Realistic/Cinematic/Illustration/Fantasy). No CFG/steps/sampler/negative-prompt/LoRA/model/
   provider ever surfaces.
6. **Identity-aware, not yet.** The brief carries `identityId` so the Director *knows* an
   identity is present (recorded in `meta.identityAware`); identity-aware prompting is deferred.

Reason
Enrichment scattered across the UI or the provider would leak prompt-engineering into places
that must stay simple/provider-neutral, and would be impossible to evolve into an LLM cleanly.
A single deterministic layer with a stable contract gives an immediate quality lift (a bare
"my dog" becomes a rich professional prompt) and becomes the future home for prompt
optimization, provider/model/pipeline selection, and video prompting — added later behind the
same entry point.

Alternatives
Enrich inside the provider adapter (rejected — couples enrichment to Hugging Face, violates
Decision 007); enrich in the Generate UI (rejected — leaks prompt engineering into the client
and can't be reused by regenerate/variation); store the compiled prompt in `Generation.prompt`
(rejected — would double-enrich on regenerate and expose engineered text as the "recipe"); use an
LLM now (deferred — deterministic rules are enough for the MVP and keep recipes reproducible);
a full Prompt Builder UI with the whole creative brief (deferred — this MVP is the intelligent
*layer*; the richer builder UI comes later on top of it).

Status
Accepted — implemented. `directCreative` verified deterministic + subject/style-aware ("my dog"
→ rich prompt); `npm run build` + `tsc --noEmit` pass; existing generation/Gallery/Recipes
unchanged. No migration.

**Follow-up (2026-07-14, same milestone):** fixed an intent-classification bug found in manual
testing — generic objects/interiors were rendered as people because `detectSubject` defaulted
unknown subjects to `focus: "face"` (forcing portrait/eye tokens) and matched people keywords
without negation awareness. Reworked into `detectCategory` (8 subject categories) with a **neutral
`object` fallback**, **interior/place** rules, and a **people-negation guard**; added `category`
to the directive `meta` (and to stored `params.creative`). Also added a **development-only
Generation Debug Mode** (`GenerationResult.debug`, gated on `NODE_ENV !== "production"`; provider
echoes a secret-free `requestPayload`) so the Director is transparent and debuggable. This
reinforces Decision 007 (no provider workaround — the compiled prompt, not FLUX, was the cause).
Build + tsc pass. No schema change.

---

# Decision 032

Date
2026-07-14

Decision
**Creative Director v2 — a deterministic multi-stage reasoning pipeline (Scene Understanding).**
Replace the single-pass keyword classifier (Decision 031) with a pipeline that analyses the whole
scene before writing the prompt:

  `idea → analyzeScene → analyzeIntent → planComposition → compilePrompt → prompt`

1. **One responsibility per stage, structured hand-offs.** Stage 1 → `Scene` (primary/secondary
   subjects, objects, living beings, environment, setting, location, time, weather, actions,
   fantasy). Stage 2 → `IntentAnalysis` (portrait/lifestyle/interior/automotive/food/product/
   landscape/wildlife/concept-art/…). Stage 3 → `CompositionPlan` (framing, camera distance/angle,
   composition, perspective, depth of field, lighting, realism, quality floor). Stage 4 assembles
   the prompt **Scene → Intent → Composition → Quality**.
2. **Intent ≠ first entity.** The scene as a whole picks the intent, so an animal in a room is a
   lifestyle interior, not a portrait; a lone sofa is a product shot; a person "in Paris drinking
   coffee" is lifestyle, not a portrait.
3. **Same public contract.** `directCreative(brief) → directive` is unchanged for callers; `meta`
   now carries the full reasoning trace. Each stage is a clean seam an **LLM can replace one at a
   time** later — still no LLM/provider calls now (all pure + deterministic).
4. **Provider isolation preserved** (Decision 007): no stage imports a provider; only the compiled
   prompt leaves the layer. Hugging Face/FLUX untouched.
5. **Debug Mode extended** to show every stage separately (dev-only, gated on `NODE_ENV`).
   Recipes (Decision 030) still reproducible — regenerate/variation re-run the deterministic
   pipeline. **No schema change.**

Reason
Keyword classification stopped at the first matched entity and could not represent multi-subject
scenes ("sofa with a dog and a cat"), leading to wrong intents (portraits of furniture/rooms).
Modeling the scene explicitly, then inferring intent, then planning composition mirrors how a
creative director actually reasons and produces markedly better prompts — while staying
deterministic and giving us named, isolated seams to upgrade to LLM reasoning incrementally.

Alternatives
Keep patching the flat classifier (rejected — can't express whole scenes / multiple subjects);
introduce an LLM now (rejected for this milestone — explicitly deterministic-only; the pipeline is
built so an LLM can drop into a single stage later); collapse scene+intent into one step (rejected
— separating them is what lets composition treat "animal in a room" differently from "animal
portrait"); a full Prompt Builder UI (deferred — this milestone is the reasoning engine, not the UI).

Status
Accepted — implemented. Traced all required prompts (sofa/chair/table → product; modern living
room [+sofa/windows] → interior; red sofa with dog+cat → lifestyle; woman…Paris → lifestyle;
Ferrari…Tokyo → automotive; pizza → food; golden retriever…beach → wildlife; dragon…castle →
concept-art) — scene understanding is richer and no longer dominated by the first entity.
Deterministic + build + `tsc --noEmit` pass. No migration.

---

# Decision 033

Date
2026-07-14

Decision
**A generated image and its `Generation` (recipe) share one lifecycle — deleting the image
deletes the `Generation` too (Milestone 13.1).** When a *generated* `MediaAsset` is deleted from
the Gallery, `deleteMedia` removes the Blob object(s) and then deletes the owning `Generation`;
its `GeneratedMedia` child row(s) go via the existing `onDelete: Cascade`. The Generate page's
history query is invalidated alongside the media query so both surfaces update immediately.
Uploaded media is unchanged. **No schema change** (the cascade already exists).

Reason
The bug: deleting a generated image left its `Generation` orphaned, and the Generate page
(`listRecentGenerations`) then rendered it as an empty, result-less card — the page no longer
reflected reality. Three options were weighed *on architecture, not convenience*:
1. **Delete the `Generation` with the media (chosen).** In this synchronous, single-result MVP a
   `Generation` and its one result are effectively 1:1, and the image is the recipe's *only*
   surface — there is no recipe library or Templates yet. So a result-less recipe is invisible
   clutter, and deleting the image is an unambiguous "remove this." This keeps history == reality
   with zero orphans and matches user intent. It is also forward-compatible: when Templates land,
   "save as template" will *copy* the recipe deliberately, so nothing a user chose to keep is lost
   by deleting an image.
2. **Soft-delete the `Generation`** (rejected) — a `deletedAt` column plus filtering everywhere,
   for a recipe with no restore/trash UI and no audit need. Pure overhead (YAGNI).
3. **Keep the `Generation`, mark/skip it as result-less** (rejected) — preserves unbounded,
   invisible orphan recipes the user can neither see nor act on, and muddies the meaning of
   "delete". If we ever want a recipe without its image, that should be an explicit "keep recipe"
   action, not a side effect of deleting an image.

The synchronization also has a **client half**: `useDeleteMedia` now invalidates the generations
query as well as the media query, so the Generate page refreshes the instant a Gallery delete
succeeds. And a **Blob half**: the DB cascade cannot reach Blob storage, so the delete path
explicitly removes each result's Blob first (best-effort per file).

Alternatives
See options 2–3 above (rejected). Also considered: leaving the DB as-is and only filtering
result-less generations out of history (rejected — hides orphans instead of removing them, and
they accumulate). Revisit when a recipe/Templates library exists — at that point deletion may
preserve a recipe the user explicitly saved (via copy-to-Template), which is compatible with this
decision.

Status
Accepted — implemented (`deleteMedia` deletes the owning `Generation` + Blobs; `useDeleteMedia`
invalidates media **and** generation queries). `npm run build` + `tsc --noEmit` pass. **Not
live-verified against the DB/Blob this session** (needs `DATABASE_URL` + Blob token) — verify a
real Gallery delete reflects on the Generate page during review. No migration.

---

# Decision 034

Date
2026-07-14

Decision
**Creative Director v2.5 — Spatial Understanding: a new Spatial Analysis stage + internal scene
graph (Milestone 13.5).** Insert a stage between Scene and Intent that turns the flat entity list
into a lightweight `SceneGraph`:

  `idea → analyzeScene → analyzeSpatial → analyzeIntent → planComposition → compilePrompt → prompt`

1. **Scene graph (internal only, never persisted).** Entities become nodes with an optional
   descriptor ("red" sofa, "wooden" desk) and frame `position`; prepositions become directed
   **relationships** (`on`/`under`/`behind`/`in front of`/`left|right of`/`next to`/`over`/
   `holding`/…) linking the nearest entities on each side (longest-phrase-wins). Deterministic;
   exists only during generation.
2. **Composition uses the graph.** A scene with real relationships (or ≥3 objects) is framed wide
   so the whole arrangement is visible — but product/food/portrait intents still isolate the
   subject. An animal on a sofa is a lifestyle scene, not a portrait (also fixed: an animal indoors
   is lifestyle, never wildlife).
3. **Compilation preserves relationships, never flattens.** The user's sentence leads the prompt
   verbatim, so "a dog sitting on a sofa" is kept intact; the graph only *adds* a spatial phrase
   when the idea doesn't already express it. Relationships survive into the compiled prompt.
4. **Same contract, still deterministic, provider unaware.** `directCreative(brief) → directive`
   unchanged; `meta.graph` carries the scene graph; Debug shows the spatial stage. No LLM, no
   provider change, **no schema change** (the graph is never stored).

Reason
v2 understood *what* is in a scene but not *how it's arranged*, so multi-object prompts ("red sofa
with a dog and a cat, window behind, plants on each side") lost their spatial structure and could
be framed as a portrait of whichever entity came first. Modeling positions + relationships lets
composition frame the whole scene and lets the compiler keep the user's spatial intent — a
meaningful step up in fidelity while staying deterministic and giving a clean seam for a future
scene-graph/LLM upgrade.

Alternatives
Regenerate an English description from the graph and replace the user's wording (rejected — risks
diverging from user intent and awkward prose; preserving the verbatim sentence is safer and already
carries the relationships); store the graph in the DB (rejected — it's a transient reasoning
artifact, adds schema for no consumer); fold spatial detection into scene analysis (rejected —
separating it keeps each stage single-responsibility and makes the graph an explicit, debuggable
artifact and a clean future seam).

Status
Accepted — implemented. Traced all required prompts (red sofa @center; dog —on→ sofa; cat —under→
table; cup —on→ wooden desk; Ferrari —in front of→ Eiffel Tower; dragon —over→ castle; woman
—holding→ umbrella —next to→ bicycle; kitchen island @center; bed —under→ large window) — the scene
graph is built correctly and relationships are preserved into the compiled prompt. Also tightened
the "living room" inference to living-room-specific furniture. Deterministic + `npm run build` +
`tsc --noEmit` pass. No migration.

---

# Decision 035

Date
2026-07-14

Decision
**Identity-aware Generation, foundation — Identity is a passive context, consumed by a new
Creative Director stage (Milestone 14).** Connect the Identity system to generation for the first
time without giving Identity any reasoning or provider knowledge:

  `idea → resolveIdentity (Stage 0) → scene → spatial → intent → composition → compile → prompt`

1. **Identity is passive context, loaded upstream.** The generation layer (which does I/O) loads a
   lightweight, owner-scoped `IdentityContext` (name, description, `hasHeroImage`,
   `trainingMediaCount`; `providerArtifacts` reserved/unused) via the identity layer's new
   `getIdentityContext`, and hands it to the Director in the brief. The Director stays PURE — it
   never fetches identity data.
2. **A new first stage, `resolveIdentity` (`stages/identity.ts`).** When an identity is present it
   weaves a subject reference ("Emma, a young woman with red hair") into the idea, producing an
   `effectiveIdea` the rest of the pipeline reasons over — so scene/intent/composition treat the
   identity as the subject (e.g. "drinking coffee in Paris" flips from food-photography to
   lifestyle once Emma is the subject). No downstream stage knows what an "identity" is.
3. **Provider contract unchanged.** The provider still receives only the final compiled prompt.
   Identity never generates prompts, never contains provider logic, and never knows about Hugging
   Face or any future provider (Decision 007 upheld).
4. **User's idea preserved.** `Generation.prompt` still stores the raw user idea; only the
   Director's internal `effectiveIdea` carries the identity weave. Recipes/regenerate/variation
   reload the identity context so they stay identity-aware. **No schema change.**
5. **UI: an optional Identity selector** on the Generate page (None + the project's identities). No
   identity selected → generation behaves exactly as before (verified byte-identical prompt). Debug
   panel gained a Stage 0 "Identity context" section.

This is a **foundation** — it deliberately uses only name + description; **no LoRA, embeddings,
training, or provider-specific logic.** The goal is to prove the architecture + UX and surface
real-world requirements for the next Creative Director evolution.

Reason
Doing identity-aware generation as a Director stage (not a provider feature, not inside the
Identity layer) keeps every boundary intact: Identity stays a passive data domain, the Director
remains the sole reasoning layer, and providers remain swappable and identity-unaware. Loading the
context upstream preserves the Director's determinism/purity. Weaving a subject reference into the
idea is the simplest deterministic mechanism that makes the whole existing pipeline identity-aware
with zero changes to scene/spatial/intent/composition.

Alternatives
Pass identity into every stage's signature (rejected — churns every stage and leaks the concept
across the pipeline; the subject-reference weave needs none of it); build identity-aware prompting
inside the Identity layer (rejected — Identity must stay passive/provider-agnostic; reasoning is
the Director's job); inject identity strings in the provider adapter (rejected — providers must
never know about identities, Decision 007); implement LoRA/embeddings now (deferred — this is a
foundation to prove architecture + UX, not maximize quality).

Status
Accepted — implemented. Verified: no-identity prompt is byte-identical to baseline; with-identity
reasoning changes (food-photography → lifestyle as the identity becomes the subject) and the
description reaches the compiled prompt; provider/media/blob layers untouched; recipes/regenerate/
variation reload context; owner-scoped throughout (`getIdentityContext` + `assertIdentityInProject`).
`npm run build` + `tsc --noEmit` pass. Not live-verified against DB/Blob this session. No migration.

---

# Decision 036

Date
2026-07-14

Decision
**Premium Provider Foundation — a capability system, the Fal.ai provider, a provider router, and an
Identity Visual Package (Milestone 15).** M14 confirmed text alone can't preserve a person's
appearance — a *provider capability* limit, not a Creative Director limit. So we evolve the
provider architecture:

1. **Provider Capability System.** Providers advertise `capabilities` (imageGeneration, imageEditing,
   referenceImages, multipleReferenceImages, identityPreservation, inpainting, outpainting, video,
   lora, ipAdapter, controlNet, asyncJobs). The rest of AI Studio depends **only on capabilities,
   never on provider names**. The `ImageProvider` interface gains `capabilities`, `defaultModel`,
   and `isConfigured()`.
2. **Fal.ai** as the first premium provider (`providers/fal.ts`) behind the same `ImageProvider`
   interface — `fetch`-based (no SDK dependency), auth via `FAL_KEY`, default `fal-ai/flux/schnell`
   (`FAL_IMAGE_MODEL` override). All Fal specifics are isolated in that one file (Decision 007).
3. **Provider Router** (`ai/router.ts`, bound to a registry in `ai/index.ts`). Picks a provider by
   **capability + configuration**, premium-first; an `IMAGE_PROVIDER` env var can force one
   (handy to verify Hugging Face still works). Returns a `RoutingDecision` (chosen/model/reason/
   considered) for transparency. Ready for richer automatic routing later.
4. **Identity Visual Package** (`identity/getIdentityVisualPackage`) — the VISUAL side of an
   identity: signed hero / best-portrait / best-full-body / reference-image URLs + metadata. It
   flows **around** the Creative Director (which stays text-only/provider-agnostic) straight to the
   provider request as **provider-neutral `referenceImages`**. Capable adapters/models use them;
   others **gracefully ignore** them (the default Fal t2i model ignores; a reference-capable model
   would use them). **No LoRA/embeddings/training — architecture prep only.**
5. **Debug** (dev-only) extended: identity knowledge (semantic), identity visual package, provider
   capabilities, chosen provider, chosen model, and the routing decision.

Reason
Identity preservation is a provider capability, so AI Studio must reason about *capabilities*, not
providers. A capability system + router keeps the Creative Director, Identity, and Gallery
provider-agnostic while letting us add premium providers and (later) auto-route by what a
generation needs. Splitting identity into a **semantic context** (text → Creative Director, M14)
and a **visual package** (reference images → provider, M15) is the clean separation that will make
true identity preservation possible without any layer learning about a specific provider.

Alternatives
Check provider names in feature code (rejected — the exact coupling we're removing); put reference
images through the Creative Director (rejected — the Director must stay text-only/provider-agnostic;
visual data is a provider-capability input, not creative reasoning); add the Fal SDK dependency
(rejected for now — `fetch` against Fal's HTTP API keeps the adapter dependency-free and fully
isolated); implement LoRA/embeddings/training now (explicitly out of scope — this milestone only
prepares the architecture).

Status
Accepted — implemented. Verified deterministically: router selects premium-first, satisfies
`identityPreservation` when configured, falls back gracefully, honors `IMAGE_PROVIDER`, and errors
when nothing is configured; HF adapter intact (imageGeneration only); Fal adapter isolated; visual
package flows as neutral reference images and is ignored by non-capable models; Creative Director /
Identity / Gallery / recipes unchanged. `npm run build` + `tsc --noEmit` pass. **Fal not
live-verified in this session** (needs `FAL_KEY` + network — the user has added it locally + on
Vercel). No schema change.

---

# Decision 037

Date
2026-07-14

Decision
**Creative Director v4 — true scene graph, anchor, confidence, and a structured compiler
(Milestone 16).** Improve the deterministic reasoning (no LLM, no provider changes):

1. **True scene graph.** Nodes now carry a `role` (primary/secondary/object); the graph has an
   **`anchor`** (the central object) instead of a plain `root`. **Anchor detection**: a subject
   (person/animal/vehicle) anchors when present; otherwise the room's characteristic furniture
   (living room→sofa, bedroom→bed, kitchen→island/table, office→desk); else the primary. Surrounding
   objects are positioned relative to the anchor.
2. **Confidence + no hallucinated relationships.** Every relationship has a `confidence`. Explicit
   prepositions → high (0.9) with exact wording; co-mentioned objects with **no** preposition →
   a low (0.4) **neutral** "near-the-anchor" association rendered as "with …" — never a fabricated
   direction. Supported relations expanded (between, near, around, against the wall, outside, …);
   unsupported ones are not invented.
3. **Intent v2.** Anchor-aware; distinguishes **architectural** (a whole structure — skyscraper/
   castle/bridge — not inside a room) from **interior-design** (a furnished room, no people) and
   **lifestyle** (a person/animal subject in a scene). Fantasy *adjectives* ("fantasy", "magical",
   …) now trigger concept-art even without a fantasy creature. Intent drives composition.
4. **Structured Prompt Compiler.** Compiles from a `CompiledStructure` (subject + explicit
   relationships + neutral objects + setting/environment/location/time/weather + genre +
   composition + quality) and **renders** it to plain text — instead of concatenating the raw
   sentence. The anchor's action + first explicit relationship fold into one clause
   ("a dog sitting on the sofa"); the identity reference (Stage 0) still leads the subject so the
   name/description survive. **The provider interface is unchanged — providers still receive plain
   text.**
5. **Debug** extended: scene graph with **anchor** + relationship **confidence**, and the
   **compiled structure** shown before the final prompt.

Reason
v2.5 understood entities and simple relationships but led compilation with the flattened original
sentence and had no notion of a scene's center or of confidence. Anchoring + roles + confidence +
a structured compiler is how a real scene is reasoned about: pick the subject, position the rest
around it, state only what's supported, and assemble deliberately. It measurably improves multi-
object prompts while staying deterministic and keeping the provider contract (plain text) intact.

Alternatives
Keep leading with the verbatim sentence (rejected — the user asked for the scene graph to be the
primary compilation source); invent directional relationships for co-mentioned objects (rejected —
explicitly forbidden; low-confidence neutral wording instead); an LLM for scene understanding
(rejected — out of scope; the deterministic pipeline remains, and stays the clean seam for a
future optional LLM); store the graph/structure (rejected — transient reasoning artifacts, no
consumer, no schema).

Status
Accepted — implemented. Traced the required prompts (luxury living room → anchor sofa, objects
neutral; bedroom → "bed under the window"; dog on sofa → "dog sitting on the sofa" lifestyle;
coffee in Paris → food; product → product; fantasy castle → concept-art) plus regressions (Ferrari
→ automotive, retriever on beach → wildlife, dragon → concept-art) — anchors, intents, and
relationships are consistent, and identity reasoning (M14) is preserved. Deterministic + `npm run
build` + `tsc --noEmit` pass. No provider change, no schema change.

---

# Decision 038

Date
2026-07-14

Decision
**Identity Preservation Foundation — FLUX.1 Kontext via Fal (Milestone 17).** Make the Identity
Visual Package (M15) actually reach the model, so AI Studio generates the *real person*, not a
generic one described by text.

1. **Model — FLUX.1 Kontext** (research in `docs/PROVIDER_RESEARCH.md`). Chosen over the face-ID
   models (PuLID / InstantID / IP-Adapter / PhotoMaker) because it is the only candidate that is
   identity-preserving **and** an editing / in-context model **and** multi-reference capable —
   which matches AI Studio's long-term vision (AI photo editing, scene replacement, outfit changes,
   travel photos). Face-ID models only inject a face into a fresh generation and are a roadmap dead
   end.
2. **Fal adapter picks the model (all Fal specifics stay inside the adapter).** No reference images
   → fast text-to-image (`FAL_IMAGE_MODEL`, default `fal-ai/flux/schnell`). With reference images →
   Kontext: `FAL_IDENTITY_MODEL` (`fal-ai/flux-pro/kontext`) for one reference, `FAL_IDENTITY_MULTI_MODEL`
   (`fal-ai/flux-pro/kontext/max/multi`) for several. The router/Creative Director/identity layer
   never learn any of this — they speak **capabilities** and provider-neutral reference images
   (Decision 007 upheld).
3. **The provider finally consumes the Identity Visual Package.** The generation layer flattens it
   into provider-neutral reference images **best-first** (hero → portrait → full body → curated
   references); the adapter uses the best one (single-ref model) or the set (multi-ref model,
   capped at 4). Selection order is decided **provider-neutrally**; the adapter only maps it to
   Kontext's `image_url` / `image_urls`.
4. **Capability routing (expanded).** When reference images exist, the router requires
   `identityPreservation` **+** `referenceImages`; Fal wins. With no references (or Fal not
   configured) it falls back to normal text-to-image — so **no-identity generation is unchanged**.
5. **Debug (expanded, dev-only):** selected provider/model, capabilities, supports-reference-images,
   #references offered vs sent (+ roles), why they were selected, and provider response metadata
   (seed / timings / safety).

This is a **foundation**: no LoRA / DreamBooth / embeddings / fine-tuning / video / multi-identity.
Kontext needs none — it preserves identity directly from reference images.

Reason
The architecture (capability system + router + Identity Visual Package, M15) was already correct;
the only missing piece was a model that accepts reference images. Kontext plugs into the existing
`ImageProvider` contract with zero changes to the Creative Director, Identity, Gallery, or router
*interfaces* — proving the provider-agnostic design. Choosing an editing model (not face-ID)
aligns the foundation with the editing/Photoshop roadmap.

Alternatives
Face-ID models (rejected — face-only, single-reference, generation-not-editing; roadmap dead end);
put model selection in the router (rejected — model choice is provider-specific and must stay in
the adapter; the router routes on capabilities); pass reference images through the Creative Director
(rejected — the Director is text-only/provider-agnostic; visual references are a provider input);
implement a Job queue for Kontext latency now (deferred — the sync `fal.run` endpoint is used for
the MVP; queue via the `asyncJobs` capability + `Job` table is future work).

Status
Accepted — implemented. Verified deterministically: routing requires identityPreservation +
referenceImages when references exist (→ Fal) and falls back gracefully; the Fal adapter selects
Kontext single/multi by reference count and echoes secret-free selection metadata; no-identity path
is unchanged (t2i schnell). `npm run build` + `tsc --noEmit` pass. **NOT live-verified this session**
(needs `FAL_KEY` + network + a real identity with training media) — the six manual tests
(Julieta: coffee in Paris / Tokyo night / business suit / luxury apartment / cyberpunk; + no-identity)
are for the user to run. No schema change.

---

# Decision 039

Date
2026-07-14

Decision
**Creative Director — preserve user intent (regression fix; supersedes the "compile from the graph"
part of Decision 037).** The v4 structured compiler rebuilt the prompt from *recognized scene-graph
nodes only*, silently discarding any word the deterministic lexicon didn't know. Real example:
*"She wears a bikini on a boat holding a Chihuahua"* compiled to *"…the woman on the boat, portrait
photography…"* — losing **bikini, Chihuahua, wears, holding** (and weakening "on a boat" → "with
boat"). Kontext then faithfully rendered the reduced prompt (identity ✓, scene ✗).

**Fix: the user's prompt is the SOURCE OF TRUTH.** The compiler now leads with the full idea
VERBATIM (with the identity reference woven in by Stage 0) and only **APPENDS** what the user didn't
specify — genre, camera, composition, perspective, depth of field, lighting, realism, quality —
de-duplicated so nothing already stated is repeated or weakened. The scene graph still drives
reasoning (anchor, intent, composition) and the Debug panel, but **may never replace the user's
words**. Lexicon also expanded (actions incl. wearing/holding/carrying/…; clothing props;
dog breeds) so the graph reasons richer — though intent now survives regardless of lexicon coverage
because the base text is preserved.

Reason
Decision 037 goal ("Scene Graph as the primary compilation source, not the flattened sentence") was
implemented too literally: compiling *only* from structured data means anything unrecognized is
dropped — exactly the clothing/props/interactions that make each scene unique. The correct reading,
which the user confirmed, is **enrich, don't replace**: keep every semantic action/clothing/prop/
interaction/location, and layer photographic direction on top. This also improved composition (the
bikini/boat/dog scene is now lifestyle "wide shot", not a tight portrait — which reduces the
over-emphasised facial detail that made the identity look older).

Alternatives
Keep compiling from the graph and expand the lexicon to cover everything (rejected — an
open-vocabulary problem a deterministic lexicon can never fully cover; the verbatim base is the
only robust guarantee); drop the scene graph (rejected — it's valuable for composition/intent/debug,
just not as a replacement for the user's words); an LLM to rewrite prompts (out of scope — still
deterministic).

Status
Accepted — implemented. Verified: *"She wears a bikini on a boat holding a Chihuahua"* now preserves
bikini/Chihuahua/holding/boat/wears + identity + lifestyle wide composition; regressions (luxury
living room, dog on sofa, coffee in Paris, fantasy castle, "woman in a red dress walking through
Tokyo at night") keep the full user text and enrich correctly. `npm run build` + `tsc --noEmit`
pass. No schema change. (Part of the "Creative Director needs another pass" track — see
`CREATIVE_DIRECTOR_FUTURE.md`.)

---

# Decision 040

Date
2026-07-14

Decision
**Vision layer architecture — "observations → knowledge" (Milestone 18A, architecture only).**
Establish a provider-agnostic Vision layer (`src/lib/vision/`) mirroring the image layer, built on a
single guiding principle:

> **The Vision provider gives OBSERVATIONS. AI Studio stores KNOWLEDGE.**

1. **`VisionProvider` + capabilities**, mirroring `ImageProvider` (Decision 007/036): providers
   advertise capabilities (caption/attributes/detect/segment/pose/faceEmbed/embed/quality/
   sceneRecognition); feature code + a router depend on capabilities, never a vendor name.
2. **Observation vs Knowledge split.** A provider returns a loose `VisionObservation` (e.g. a
   caption "woman with pink hair wearing a black bikini"). AI Studio **never stores that** — a pure,
   deterministic `normalizeToIdentityMetadata` turns it into structured **`IdentityMetadata`**
   knowledge (hair/face/body/tattoos/quality/lighting/embedding/…). Swapping providers never changes
   what AI Studio stores.
3. **Knowledge model** = `IdentityMetadata` (per image, RESEARCH_02 §11) + `ImageQuality` (the
   reject-poor-references gate) + `ImageEmbedding` + **`IdentityCoverage`** (per-identity aggregate —
   an addition beyond §11's per-image record, needed for automatic Hero/request-aware selection).
4. **Split of Milestone 18** (user decision): **18A = architecture only** — no APIs, no Gemini/
   OpenAI/Florence/Qwen, no DB/UI/services; the provider **registry is empty**, `isVisionConfigured()`
   is `false`, and `normalize`/`coverage` are pure and already functional. **18B** adds ONE provider
   implementing `analyzeImage` behind the interface (+ a single `analyzeIdentity(image)`).
5. **Not biometric identification** — attributes + face embeddings serve richer Identity Packages,
   reference ranking, and consistency of the user's own subject; never identification.

Reason
We already learned this lesson with image generation: if a vendor (Gemini) is used everywhere,
replacing it later means rewriting the project. The observation→knowledge normalizer + a capability
router make the Vision vendor an interchangeable component from day one. Building the architecture
first (18A) — with pure, testable normalization/coverage and zero providers — de-risks the provider
choice in 18B and guarantees nothing else in AI Studio depends on a specific vision vendor.

Alternatives
Store the provider's caption/raw output directly (rejected — couples storage to a vendor, isn't
queryable/rankable, and breaks on provider swap); wire a provider now (rejected — the user
explicitly split 18A/18B to avoid vendor lock-in and premature choice); fixed attribute schema per
provider (rejected — the normalizer gives one stable schema across all providers).

Validation against research
Follows `RESEARCH_02_VISION.md` §1 (`VisionProvider` + capabilities), §11 (`IdentityMetadata`
record), §13 (provider-neutral, results as metadata). Two documented deltas: **`IdentityCoverage`**
(per-identity aggregate the research implied via §12 automatic selection but didn't name) and an
**explicit normalizer module** (the research said "never store a provider's shape"; this makes that
concrete). No conflicts.

Status
Accepted — implemented (architecture only). Verified: an example observation normalizes to correct
knowledge (hair/face/body/tattoos/quality/embedding) and `computeIdentityCoverage` aggregates + finds
gaps; `isVisionConfigured()` is `false` (no providers). `npm run build` + `tsc --noEmit` pass. No
schema change. Docs: `IDENTITY_INTELLIGENCE.md`.

---

# Decision 041

Date
2026-07-14

Decision
**Identity Coverage Engine — the first consumer of Identity Intelligence (Milestone 18B, still no
Vision provider).** `analyzeIdentityCoverage(metadatas) → CoverageReport` (`vision/coverage-engine.ts`)
consumes normalized `IdentityMetadata[]` and produces a **dimensioned coverage report** (star scores,
confidence, status, missing areas, prioritized suggestions) across 14 dimensions: face front / left
profile / right profile / back, upper / full body, hair, chest / back / left-arm / right-arm / leg
tattoos, and indoor / outdoor. Pure, deterministic, provider-neutral; validated with **mocked**
metadata (`scripts/verify-coverage.ts`, fully offline). **No Vision provider, no DB, no UI.**

Scoring (documented in `IDENTITY_INTELLIGENCE.md`): only **usable** images contribute;
`score = bestContribution·0.6 + breadth·0.4`; `stars = round(score·5)`; status covered/weak/missing;
overall = weight-averaged score. **Assumption:** tattoo dimensions are only *applicable* when the
identity has any observed tattoo (else "missing back tattoo" is a false gap). Also extended
`FaceOrientation` with `left-profile`/`right-profile` (generic `profile` gives half credit to each
side).

Reason
Before spending on a Vision API, prove the Identity Intelligence architecture can **drive real
value** — Smart Reference Selection and Training Quality Gates — purely from knowledge. Building the
consumer first de-risks 18B's provider choice and confirms the observation→knowledge contract
(Decision 040) is sufficient. Mocked metadata makes verification deterministic and offline.

Alternatives
Wait for a provider before building consumers (rejected — couples architecture validation to a
vendor, the opposite of the milestone's intent); return only booleans like `computeIdentityCoverage`
(kept as the lightweight aggregate; the engine adds per-dimension stars + suggestions the UI/selection
need); infer whether an unshown tattoo exists (rejected — undecidable; tattoo dimensions are
conditional + suggestions say "if applicable").

Status
Accepted — implemented. Verified (`scripts/verify-coverage.ts`): a mocked identity yields Front face
★★★★☆, Left profile ★★☆☆☆, Right profile/Back/Back-tattoo ☆ (missing), Full body/Hair covered, with
prioritized suggestions; 8/8 deterministic checks pass. `npm run build` + `tsc --noEmit` pass. No
schema change. Docs: `IDENTITY_INTELLIGENCE.md`.

---

# Decision 042

Date
2026-07-14

Decision
**Scene Understanding fix — an incidental noun must not hijack the subject/genre (bug fix).**
Two deterministic fixes to the Creative Director:
1. **"camera" is no longer an entity.** "look at/to/into the camera" is a photographic *gaze* cue,
   not a subject. Detecting `camera` as a product made it the primary subject → genre
   `product-photography`, which poisoned the whole prompt.
2. **When an identity is selected, intent is person-centric.** An identity IS the subject (a
   person/character), so intent is forced to **lifestyle** (with any scene context) or **portrait**
   — never product/food/interior/etc. just because an incidental noun ("bikini", "camera") was
   detected as the primary entity. `analyzeIntent` gained a `hasIdentity` flag (from Stage 0).

Reason
Real bug: *"add Julieta at the beach look left to the camera in bikini and smiling"* (with the
Julieta identity) parsed **primary = camera (product)** → **product photography**, so Kontext was
asked for a product shot instead of a lifestyle portrait of Julieta. The subject was already correct
in the compiled prompt (identity reference leads — Decision 039), but the *genre/composition* were
wrong. Forcing person-centric intent when an identity is present, plus removing the photography-
context noun, fixes it; the prompt now reads lifestyle and preserves the full scene (bikini, beach,
"look left to the camera", smiling).

Alternatives
Keep "camera" but suppress it only in gaze phrases (rejected — more fragile than just removing a
rarely-a-subject noun; verbatim preservation keeps the user's "camera" words anyway); demote all
clothing/props so they never anchor (deferred — a broader scene-understanding refinement; the
identity-forcing fix covers the reported case); infer subject via an LLM (out of scope — stays
deterministic).

Status
Accepted — implemented. Verified: the failing prompt now → **lifestyle** with full intent preserved;
regressions (real "camera on a desk"/"perfume bottle" → product; living room → interior; dog → lifestyle;
fantasy castle → concept-art; identity with no scene → portrait) hold. `npm run build` + `tsc --noEmit`
pass. No schema change. (Bugs #2–#6 — coverage-aware/request-aware reference selection, Vision
metadata, richer identity description — are tracked for the Vision-provider milestone; see
`FUTURE_RESEARCH.md` / `IDENTITY_INTELLIGENCE.md`.)

---

# Decision 043

Date
2026-07-14

Decision
**First Vision provider (Gemini) + Identity Image Scoring (Milestone 19).** Give the Vision layer
its data, and add the per-image scoring axis:

1. **First `VisionProvider` — Gemini** (`vision/providers/gemini.ts`): `fetch`-based, `GEMINI_API_KEY`,
   structured-JSON extraction (pose yaw/pitch/roll, expression, framing, tattoo regions, hair,
   lighting, environment, body visibility, occlusion, normalized quality) → `VisionObservation`. All
   Gemini specifics isolated in that one file; the registry routes on capabilities. `analyzeIdentity(imageUrl)`
   = route → `analyzeImage` → `normalize` → `score`. Swapping to OpenAI/Qwen/Florence later changes
   only the adapter.
2. **Richer knowledge:** `FaceKnowledge` gained `pose` (`FacePose` yaw/pitch/roll), `smiling`,
   `eyesVisible`; the normalizer derives orientation from yaw when a provider gives only pose.
3. **Identity Image Scoring** (`vision/image-score.ts`) — the architectural distinction the project
   locks in **now**: **Coverage (identity-level) answers "what is missing?"; Image Scoring
   (per-image) answers "which image is best?"**. `scoreIdentityImage(m) → IdentityImageScore`
   (faceQuality, tattooVisibility, bodyCoverage, hairVisibility, lighting, sharpness, expression,
   overall, usable, reasons); `rankIdentityImages` sorts best-first → a **self-curating** library.
   Pure/deterministic/provider-neutral.

Reason
Coverage + router + normalizer were "a Ferrari with no fuel" — they need real metadata. Gemini
supplies it via one structured-extraction call (cheapest strong hosted VLM with native JSON output,
per RESEARCH_02). Separating **per-image scoring** from **identity-level coverage** is the key
foundation before routing logic: selection needs both "which images are strong" (scoring) and "what
angles/tattoos are missing" (coverage). Deterministic scoring means the ranking is explainable and
verifiable offline.

Alternatives
Wire coverage into routing first without a provider (rejected — nothing to reason over; no real
change); one combined "coverage+score" number (rejected — conflates two questions; the router needs
both separately); an image-embedding model for scoring now (deferred — embeddings help
dedup/similarity/consistency later; deterministic attribute-based scoring is enough and explainable);
persist metadata to the DB now (deferred — needs schema; this milestone builds analysis + scoring;
storing per-image metadata + wiring into upload/selection is the next milestone).

Status
Accepted — implemented. **Deterministic parts verified offline:** `scripts/verify-scoring.ts`
(front/full-body/smiling/tattooed image outranks a blurry back-view; 6/6 checks), coverage still
passes. `npm run build` + `tsc --noEmit` pass. **The Gemini API call is NOT live-verified this
session** (needs `GEMINI_API_KEY` + network) — the user must verify; if the response shape needs a
tweak, only `providers/gemini.ts` changes. Not yet wired to upload/persistence (next milestone). No
schema change.

---

# Decision 044

Date
2026-07-15

Decision
**Vision live-verification tool + per-attribute confidence (Milestone 19 follow-up).** Before wiring
Vision into identities, add a way to validate one image end-to-end, and make extraction confidence a
first-class signal.

1. **`/debug/vision` page** (temporary, dev tool, auth-gated under `(protected)`). Upload ONE image
   → it's downscaled client-side to a small JPEG **data URL** (no Blob) → server action
   `analyzeVisionDebug` runs the full pipeline (provider → raw JSON → normalize → `IdentityMetadata`
   → `ImageScore` → single-image coverage) and returns everything: the image, raw provider response,
   normalized knowledge, score breakdown, coverage contribution, duration, **token usage** (from
   Gemini `usageMetadata`), and **warnings** (face not detected, unusable, low-confidence attributes).
   **No persistence, no Prisma, no Blob, no identity package, no generation.**
2. **Per-attribute confidence.** Gemini now returns a `confidence` per tattoo and a top-level
   `confidence` map for scalar attributes; `TattooKnowledge.confidence` and
   `IdentityMetadata.attributeConfidence` carry them through normalization. Routing can later ignore
   low-confidence signals ("don't use this image for chest tattoos — the model was only 42% sure").

Reason
A single-image debug tool is the safest first live test — it exercises the real Gemini call and the
whole deterministic pipeline with zero side effects, so the response shape can be validated before
any integration. Data URL + client downscale avoids Blob and keeps the server-action payload small.
Per-attribute confidence is cheap to add now (one prompt + type change) and becomes very valuable for
reliable reference selection later; adding it after data is stored would mean reprocessing.

Alternatives
Wire Vision straight into upload (rejected — validate the provider first; integrating an unverified
API call into the identity pipeline is risky); upload to Blob for the debug tool (rejected —
unnecessary persistence for a throwaway test; data URL suffices); make every attribute `{value,
confidence}` (rejected — bloats every consumer; a separate `attributeConfidence` map + per-tattoo
confidence keeps values flat and is additive).

Status
Accepted — implemented. `npm run build` + `tsc --noEmit` pass; offline scoring/coverage verifiers
still pass. **The `/debug/vision` page + the live Gemini call are for the user to exercise** (needs
`GEMINI_API_KEY`) — this is the intended first live test. No persistence, no schema change.
