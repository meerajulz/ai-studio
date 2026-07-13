# Roadmap

> High-level direction. Day-to-day work lives in TODO.md.
> Completed work is recorded in CHANGELOG.md.

---

# 🚧 Current Sprint (MVP Foundation)

## Completed

- [x] Next.js project created
- [x] TypeScript configured
- [x] Tailwind CSS
- [x] shadcn/ui installed
- [x] Prisma installed
- [x] Folder structure
- [x] Documentation structure
- [x] Database architecture (Prisma + Neon Postgres, schema + `init` migration)
- [x] Environment variables (`DATABASE_URL`)

---

## Completed (cont.)

- [x] Authentication (Better Auth — email/password, verified end-to-end)
- [x] Minimal auth UI for verification — `/login`, `/register`, temp `/dashboard`
      (shadcn Form + RHF + Zod, server-side guards). Unstyled.

## Completed (cont.)

- [x] Protected Application Shell — AppShell root layout (`app/(protected)/`), Sidebar +
      Header (Logo/Breadcrumb/Search/UserNav) + shared components (PageContainer,
      SectionTitle, EmptyState, LoadingState); Projects is the primary authenticated
      landing; placeholder pages for Projects/Gallery/Uploads/Templates/Settings.
      Responsive; centralized auth guard.
- [x] Authentication Polish — Card-based login/register, `PasswordInput` toggle, spinner
      loading + `FormError` states, richer `UserNav`. Behavior unchanged.
- [x] Project Management — `/projects` CRUD (owner-scoped Server Actions + Zod +
      TanStack Query), ProjectCard grid, loading/empty states, delete confirmation;
      `/projects/[id]` renders the ProjectLayout workspace shell.
- [x] Project Workspace — tabbed `/projects/[id]` (Overview + Uploads/Gallery/Identities/
      Templates/Jobs/Settings placeholders), workspace context + breadcrumb name,
      responsive tabs, loading/empty states. Shell only.

- [x] Storage Foundation (7A) — `src/lib/blob/` package (client/server/validation/
      constants/errors/types), Vercel Blob upload/delete helpers + `isBlobConfigured()`,
      MIME + size validation, `MEDIA_PIPELINE.md`, `.env.example`. Deployed to Vercel
      (build fixes: prisma generate on build, dotenv declared, lazy Prisma client). No UI;
      real uploads await `BLOB_READ_WRITE_TOKEN` + 7B.

- [x] Upload System (7B) — Uploads tab: drag & drop, queue, progress, retry/cancel, persist
      `UploadedMedia` (images + videos) per project. New **media layer** (`src/lib/media/`)
      that feature code depends on; `/api/uploads` scoped-token route; owner-scoped
      throughout. Verified end-to-end against the live private store + DB
      (`scripts/verify-uploads.ts`).

## In Progress

- [ ] Gallery (8) ← **next** · Identity Manager (9) · AI generation

---

# Sprint 2 – Core Backend

- [x] Prisma schema
- [x] User model
- [x] Project model
- [x] Identity model
- [x] Generation model
- [x] Prisma client runtime (`src/lib/db/` + `@prisma/adapter-neon`) — verified vs Neon
- [x] Upload API (`/api/uploads` scoped-token route + media layer)
- [ ] Gallery API

---

# Sprint 3 – AI Integration

- [ ] AI Provider Interface
- [ ] Image Provider
- [ ] Video Provider
- [ ] Prompt Builder
- [ ] Generation Queue

---

# Sprint 4 – Frontend

- [ ] Dashboard
- [ ] Sidebar
- [ ] Upload page
- [ ] Prompt editor
- [ ] Gallery
- [ ] Project page

---

# Sprint 5 – Identity System

- [ ] Identity creation
- [ ] Identity management
- [ ] Multiple identities
- [ ] Face reference upload

---

# Sprint 6 – Video Generation

- [ ] Video workflow
- [ ] Job progress
- [ ] Video history
- [ ] Downloads

---

# Sprint 7 – Templates

- [ ] Templates
- [ ] Favorites
- [ ] Saved prompts
- [ ] Style presets

---

# Sprint 8 – Production

- [ ] Error handling
- [ ] Logging
- [ ] Monitoring
- [ ] Performance optimization
- [ ] Security review
- [ ] Production deployment

---

# Future Ideas

- Team workspaces
- Cloud/local AI providers
- Plugin system
- Mobile companion app
- AI prompt assistant

---

| Milestone | Goal | Status |
|------------|------|--------|
| Foundation | Architecture complete | 🟡 In Progress |
| MVP | Image generation | 🔴 Not Started |
| Beta | Video generation | 🔴 Not Started |
| v1.0 | Complete AI Studio | 🔴 Not Started |