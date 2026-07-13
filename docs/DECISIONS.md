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
