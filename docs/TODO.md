# TODO

> Working task list. Strategic direction lives in [ROADMAP.md](./ROADMAP.md).
> Use `[ ]` open, `[x]` done. Move shipped items to [CHANGELOG.md](./CHANGELOG.md).

## High priority

- [ ] Fix Prisma generator output path after `src/` move ([DATABASE.md](./DATABASE.md))
- [ ] Define initial database models
- [ ] Set up better-auth (`src/lib/auth/`)
- [ ] Clean up stray `~/package-lock.json` confusing Next.js workspace-root detection

## Medium priority

- [ ] Prisma client singleton in `src/lib/db/`
- [ ] Vercel Blob upload helpers (`src/lib/blob/`)
- [ ] First AI provider adapter (`src/lib/ai/`) + interface
- [ ] Query client / providers in `src/lib/providers/`

## Low priority / nice-to-have

- [ ] Add `.env.example`
- [ ] CI pipeline (typecheck, build) on Node ≥ 20.19
- [ ] Optional: nvm auto-switch on `cd` (deferred — user declined editing `~/.zshrc`)

## Done

- [x] Migrate to `src/` layout
- [x] Scaffold folder structure
- [x] Wire `TooltipProvider` into root layout
- [x] Add `.nvmrc` + `engines`
- [x] Create `docs/` set
