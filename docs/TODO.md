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

### Upload System (7B) — next
- [ ] `/api/uploads` handle-upload route (issues client tokens)
- [ ] Drag & drop upload (Uploads tab)
- [ ] Upload queue · progress · retry · cancel
- [ ] Persist `UploadedMedia` records associated with the current project
- [ ] Extend `UploadedMedia` for the asset model (pathname, originalFilename, duration)

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
