# TODO

> Working task list. Strategic direction lives in [ROADMAP.md](./ROADMAP.md).
> Use `[ ]` open, `[x]` done. Shipped items are recorded in [CHANGELOG.md](./CHANGELOG.md).

## High priority

- [ ] **Vercel Blob storage** + upload helpers (`src/lib/blob/`) — next milestone
- [ ] Real **Protected Dashboard** (styled layout/sidebar, replace temp dashboard)
- [ ] Clean up stray `~/package-lock.json` confusing Next.js workspace-root detection

## Medium priority

- [ ] TanStack Query client / providers in `src/lib/providers/`
- [ ] First AI provider adapter (`src/lib/ai/`) + `ImageProvider` / `VideoProvider`
- [ ] Upload API + Gallery API (Sprint 2)

## Low priority / nice-to-have

- [ ] Add `.env.example` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
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
