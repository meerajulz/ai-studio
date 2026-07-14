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
Gallery ✓ → Identity ✓ → AI Generation ✓ → Creative Director ✓ → [richer builder] → Templates → more providers/video
            (each revolves around the Identity; the Creative Director is the new intelligent layer)
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
- [x] **Milestone 12 — Creative Director MVP** — the first *intelligent* layer: a provider-agnostic
      **`src/lib/creative/`** (`directCreative(brief) → directive`) that turns a plain idea into a
      professional prompt (deterministic now, LLM-swappable later behind the same contract). Wired
      at the generation chokepoint; user's idea stays in `Generation.prompt`, brief + compiled
      prompt in `params.creative` (recipes/regenerate/variation intact). One optional **Style**
      question in the UI; no technical settings exposed. Decision 031 · `CREATIVE_DIRECTOR.md`.
- [x] **Milestone 13 — Creative Director v2 (Scene Understanding)** — re-architected the Director
      into a deterministic reasoning pipeline (`idea → scene → intent → composition → prompt`);
      analyses the whole scene and infers intent instead of letting the first keyword win. Same
      `directCreative` contract; each stage is an LLM-swappable seam. Debug panel shows every stage.
      No LLM, no new providers, HF unchanged. Decision 032 · `CREATIVE_DIRECTOR.md`.
- [x] **Milestone 13.1 — Generation History Synchronization** — Gallery ↔ Generate stay in sync:
      deleting a generated image deletes its owning `Generation` (Blob + cascade) and refreshes the
      generation-history query, so the Generate page never shows empty result-less cards. Decision
      033 · `GENERATION_RECIPES.md`.
- [x] **Milestone 13.5 — Creative Director v2.5 (Spatial Understanding)** — new Spatial Analysis
      stage builds an internal `SceneGraph` (nodes w/ descriptor+position, directed relationships);
      composition frames whole scenes, compiler preserves relationships (no flattening). Debug shows
      the graph. Deterministic; no LLM/provider/schema change. Decision 034 · `CREATIVE_DIRECTOR.md`.
- [x] **Milestone 14 — Identity-aware Generation (foundation)** — optional Identity selector on
      Generate → a passive **Identity Context** stage (Stage 0) in the Creative Director that weaves
      the identity (name + description) into the reasoning as the subject. Provider stays 100%
      identity-unaware; no LoRA/embeddings/training. Decision 035 · `CREATIVE_DIRECTOR.md`.
- [x] **Milestone 15 — Premium Provider Foundation (Fal + Capability System)** — providers advertise
      **capabilities** and the app routes on those (never names); added **Fal.ai** behind
      `ImageProvider`, a **Provider Router** (premium-first, capability-aware, `IMAGE_PROVIDER`
      override), and an **Identity Visual Package** (reference images flowing around the Director to
      capable providers; gracefully ignored otherwise). No LoRA/embeddings/training; no schema
      change. Decision 036 · `PROVIDER_INTERFACE.md`.
- [x] **Milestone 16 — Creative Director v4 (Scene Graph & Spatial Reasoning)** — true scene graph
      with an **anchor** + node roles + **confidence-scored** relationships (no fabricated
      directions), **intent v2** (architectural vs interior vs lifestyle; fantasy adjectives), and a
      **structured compiler** (`CompiledStructure` → rendered plain text, not concatenation). Debug
      shows anchor/confidence/compiled structure. Deterministic; no LLM/provider/schema change.
      Decision 037 · `CREATIVE_DIRECTOR.md`.
- [ ] **Creative Director — next** (per `CREATIVE_DIRECTOR_FUTURE.md`): confidence-driven ambiguity
      (one clarification question when low), Creative Goals, prompt-specificity scoring; still
      deterministic, LLM optional later behind the same stages.
- [x] **Milestone 17 — Identity Preservation Foundation (Fal Kontext MVP)** — the Identity Visual
      Package now reaches the model. `docs/PROVIDER_RESEARCH.md` → **FLUX.1 Kontext**; the Fal adapter
      switches to Kontext (single/multi) when reference images are present, else text-to-image; router
      requires identityPreservation+referenceImages when refs exist. No LoRA/embeddings/training; no
      schema change. Decision 038 · `docs/PROVIDER_RESEARCH.md`.
- [ ] _Future (enabled by M17):_ async **Job** queue for Kontext latency (behind `asyncJobs` +
      the `Job` table); AI photo editing / scene replacement / outfit changes on existing media;
      identity-consistent **video**; multi-identity; capability-driven auto-routing; more providers.
- [ ] **Long-term CD order** (documented, not scheduled): Better Scene Graph → Better Spatial →
      Creative Goals → Prompt Builder → Templates → Multi-provider optimization → Video reasoning →
      Multi-identity generation → Creative Critic → optional LLM reasoning (same architecture).
- [ ] Templates — **saved briefs** (Creative Director presets); comes *after* the richer Director.
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
- [x] Creative Director (idea → professional prompt, `src/lib/creative/`) — MVP; deterministic,
      LLM-swappable. Future home for prompt optimization + provider/model/pipeline selection.
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