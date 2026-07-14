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

- [x] Project Gallery (8) — `/projects/[id]/gallery`: source-agnostic media browser (grid,
      filters, viewer, infinite scroll) over the refined **media layer** (now the single
      public media API — Decision 024). Uploads migrated onto the shared media components.

- [x] Identity System **Design** (9 — design only) — documentation-first spec of the Identity
      architecture before any code: `IDENTITIES.md`, `TRAINING_MEDIA.md`, schema review +
      relationship/ownership design, provider-agnostic plug-in design, planned components
      (Decision 025). No schema/UI/API changes.
- [x] Identity Manager **UX design** (design only) — `IDENTITY_UX.md`: user journey,
      wireframes, navigation/routes, empty states, action list, future expansion, real-world
      scenarios, UX review. No code.
- [x] Identity design **frozen** (Decision 027) — project-scoped MVP, dedicated Overview tab,
      "Hero Image" naming, DRAFT/ACTIVE/ARCHIVED statuses, standardized training-media roles,
      Gallery/media as single source, AI stays separate. No code.

## In Progress / Next

Near-term sequence (each revolves around the **Identity** — see [VISION.md](./VISION.md)):

```
Gallery (done) → Identity System → Templates → Prompt Builder → AI Providers → Generation
                 ▲ design done (9); Identity Manager implements it next
```

- [x] **Milestone 9A — Identity Manager** — Identity CRUD + Training Media (`IdentityMedia`
      join) inside a project; Overview/Training/Settings tabs; DRAFT/ACTIVE/ARCHIVED (derived);
      Hero Image; Gallery selection → "Create identity". New identity layer (`src/lib/identity/`,
      Decision 028) reusing the media/Gallery components. Verified end-to-end
      (`scripts/verify-identity.ts`).
- [x] **Milestone 10 — First Light (AI generation)** — provider-agnostic `ImageProvider` +
      Hugging Face plug-in (`src/lib/ai/`), generation layer (`src/lib/generation/`), media
      layer unions uploaded + generated so results land in the Gallery; minimal Generate tab.
      Verified with a real HF generation (`scripts/verify-generation.ts`). Decision 029.
- [x] **Milestone 11 — AI Generation v2 (Creative Loop)** — generation recipes (the
      `Generation` *is* the recipe; read-only `recipe` on generated `MediaAsset`s), Regenerate +
      Variation, generation history, improved Generate page, Gallery recipe actions. No schema
      change. Verified (`scripts/verify-generation.ts`). Decision 030 · `GENERATION_RECIPES.md`.
- [x] **Milestone 12 — Prompt Builder DESIGN** (design only) — the intent-driven "describe
      what you want, AI Studio writes the prompt" experience: `PROMPT_BUILDER.md` +
      `CREATIVE_WORKFLOW.md` (journey, UX philosophy, creative brief, compilation transform,
      components/states, wireframes, identity/recipe/gallery/generation integration). No code.
- [ ] **Prompt Builder — implementation** ← **next** — build the "Describe intent" stage on the
      generation layer: creative brief → provider-agnostic `buildPrompt` (`src/lib/prompt/`) →
      existing `generateImage`; brief stored in the recipe. Reuses media/identity components.
- [ ] Templates — **saved briefs** (Prompt Builder presets); comes *after* the Prompt Builder.
- [ ] AI Provider expansion — more providers behind `ImageProvider` (Fal/OpenAI/Replicate/
      local); async via the `Job` queue; a parallel `VideoProvider`.
- [ ] _Deferred:_ global `/uploads` + `/gallery` — decide whether to remove or merge into one
      global **Media** browser (see NAVIGATION.md).

---

# Sprint 2 – Core Backend

- [x] Prisma schema
- [x] User model
- [x] Project model
- [x] Identity model
- [x] Generation model
- [x] Prisma client runtime (`src/lib/db/` + `@prisma/adapter-neon`) — verified vs Neon
- [x] Upload API (`/api/uploads` scoped-token route + media layer)
- [x] Gallery API (`listProjectMedia` — filters/sort/search + cursor pagination, via media layer)

---

# Sprint 3 – AI Integration

- [x] AI Provider Interface (`ImageProvider` + registry, `src/lib/ai/`)
- [x] Image Provider (Hugging Face — first + only, First Light)
- [ ] Video Provider
- [ ] Prompt Builder
- [ ] Generation Queue (`Job` table — for async providers)
- [ ] More image providers (Fal / OpenAI / Replicate / local)

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