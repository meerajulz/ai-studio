# TODO

> Working task list. Strategic direction lives in [ROADMAP.md](./ROADMAP.md).
> Use `[ ]` open, `[x]` done. Shipped items are recorded in [CHANGELOG.md](./CHANGELOG.md).

## High priority

### Storage Foundation (7A) — done
- [x] Configure Vercel Blob (`@vercel/blob`, `BLOB_READ_WRITE_TOKEN`)
- [x] Blob helper library (`src/lib/blob/` client/server/validation/constants/errors/types)
- [x] Upload validation (MIME + size)
- [x] Delete helper
- [x] Shared storage types + centralized error handling (`StorageError`)
- [x] Environment variables (`.env.example`)

### Upload System (7B) — done
- [x] `/api/uploads` handle-upload route (issues scoped client tokens; owner-checked)
- [x] Media layer (`src/lib/media/`) — feature code depends on this, not the blob layer
- [x] Drag & drop upload (Uploads tab) + click-to-browse, multiple
- [x] Upload queue · progress · retry · cancel (`use-upload-manager`, `p-limit`)
- [x] Persist `UploadedMedia` records associated with the current project
- [x] Extend `UploadedMedia` for the asset model (pathname, originalFilename, duration, updatedAt)
- [x] Verify end-to-end vs the live private store + DB (`scripts/verify-uploads.ts`)

### Gallery (8) — done
- [x] Refine media layer into the single public media API (Decision 024) + migrate Uploads onto it
- [x] Gallery page `/projects/[id]/gallery`: uploaded images + videos (generated plugs in later)
- [x] Reusable media components (`MediaCard`, `MediaGrid`, `MediaViewer`, `MediaFiltersBar`, `DeleteMediaDialog`)
- [x] Filters (type/source/sort/search) + infinite scroll + LoadingState/EmptyState/ErrorState
- [x] Verify end-to-end vs live store + DB (`scripts/verify-media.ts`)

### Identity System (9)
- [x] **Design** (design-only milestone): `IDENTITIES.md`, `TRAINING_MEDIA.md`, schema review,
      relationship/ownership design, provider-agnostic plug-in design, planned components (Decision 025)
- [x] **UX design** (design-only): `IDENTITY_UX.md` — journey, wireframes, navigation, empty
      states, actions, future expansion, real-world scenarios, UX review
- [x] **Design frozen** (Decision 027): project-scoped MVP, Overview tab, Hero Image naming,
      DRAFT/ACTIVE/ARCHIVED, standardized training-media roles, Gallery single source, AI stays out
- [x] **Milestone 9A — Identity Manager (implementation)** — schema migration (`description`,
      `displayImageId`, `status`, `projectId` required + Cascade, `IdentityMedia` join); identity
      layer + actions + hooks; CRUD; Overview/Training/Settings tabs; training media
      add/remove/reorder/favorite/role/Hero; derived status; archive/restore/delete; Gallery
      selection → create; verified (`scripts/verify-identity.ts`); build + tsc pass.

### Identity — known follow-ups (not blocking)
- [ ] Deleting a media asset from the Gallery cascades its `IdentityMedia` link + nulls the hero
      (DB level) but does not re-derive identity status — status catches up on the next
      training-media change. Consider recompute-on-read or a media-delete hook (Decision 028).
- [ ] Reorder is via a tile menu ("Move earlier/later"); drag-and-drop is a later polish.
- [ ] Breadcrumb still shows the identity id (not name) on the detail route — minor.

### Future — multiple identities per generation (before AI generation ships)
- [ ] Evolve `Generation.identityId` (single) → **`GenerationIdentity` many-to-many** ("appears-in"),
      kept separate from training media. Backfill single links + deprecate the scalar **before**
      many generations exist. Resolve open sub-questions (Generation vs GeneratedMedia granularity;
      requested vs detected `source`). Design only — see IDENTITIES.md "Future architecture" + Decision 026.

### Deferred navigation decision (revisit after Gallery)
- [ ] Top-level `/uploads` + `/gallery` are **temporary placeholders** (media belongs to a project).
      Decide whether to remove `/uploads` or merge both into one global **Media** browser. No routing changes yet. (NAVIGATION.md)

### Housekeeping
- [ ] Clean up stray `~/package-lock.json` confusing Next.js workspace-root detection

## Medium priority

- [ ] Per-project settings (preferred models, aspect ratio, templates) — DECISIONS #017
- [ ] First AI provider adapter (`src/lib/ai/`) + `ImageProvider` / `VideoProvider`
- [ ] Upload API + Gallery API (Sprint 2)
- [ ] Breadcrumb: show project name instead of id on `/projects/[id]`

## Low priority / nice-to-have

- [x] Add `.env.example` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BLOB_READ_WRITE_TOKEN`)
- [ ] Add `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` to Vercel env before deploy
- [ ] CI pipeline (typecheck, build) on Node ≥ 20.19
- [ ] Optional: nvm auto-switch on `cd` (deferred — user declined editing `~/.zshrc`)

## Done

- [x] Migrate to `src/` layout · scaffold folder structure · `docs/` set
- [x] Wire `TooltipProvider` into root layout
- [x] Add `.nvmrc` (Node 24) + `engines` (`node >=20.19.0`)
- [x] Fix Prisma generator output path → `src/generated/prisma`
- [x] Database schema (9 models + 3 enums) + Neon + `init` migration
- [x] Prisma runtime client (`src/lib/db/` singleton + `@prisma/adapter-neon`)
- [x] Authentication (Better Auth email/password) + `better_auth` migration
- [x] Minimal auth UI (`/login`, `/register`, temp `/dashboard`) — RHF + Zod + shadcn Form
- [x] Sync docs (TODO, DATABASE) with implemented schema + auth
- [x] Protected Application Shell + Authentication Polish
- [x] TanStack Query provider + Sonner Toaster in root layout
- [x] Project Management — `/projects` CRUD (Server Actions + Zod + TanStack Query),
      `/projects/[id]` workspace shell
