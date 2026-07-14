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

> **🎉 Milestone achieved — AI Studio completed its first end-to-end identity-preserving
> generation** (Milestone 17): select an identity → the Creative Director reasons → the router picks
> **Fal Kontext** → the Identity Visual Package reaches the model → a **recognizable real person** in
> a new scene (not a generic person from text). The provider-agnostic architecture is validated end
> to end. See [LESSONS_LEARNED.md](./LESSONS_LEARNED.md).

**Completed foundation:** Creative Director v4 · Spatial Scene Graph · Provider Capability System ·
Fal Provider · Identity Visual Package · Fal Kontext integration · **Identity Preservation MVP**.

```
Gallery ✓ → Identity ✓ → AI Generation ✓ → Creative Director v4 ✓ → Capability Router ✓ →
Fal Kontext ✓ → Identity Preservation MVP ✓ → [Identity Intelligence · richer Scene Understanding · evaluation]
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
- [x] **Milestone 17 — Identity Preservation Foundation (Fal Kontext MVP)** — the Identity Visual
      Package now reaches the model. `docs/PROVIDER_RESEARCH.md` → **FLUX.1 Kontext**; the Fal adapter
      switches to Kontext (single/multi) when reference images are present, else text-to-image; router
      requires identityPreservation+referenceImages when refs exist. Decision 038.
- [x] **Creative Director — preserve user intent** (Decision 039) — the compiler no longer discards
      user words (bikini/Chihuahua/props); the user's prompt is the source of truth, enriched not
      replaced. First fix of the "Preserve User Intent" milestone; richer enrichment is future.
- [x] **Milestone 18A — Identity Intelligence Architecture** (architecture only) — provider-agnostic
      **Vision layer** (`src/lib/vision/`) on the principle *"Vision gives observations; AI Studio
      stores knowledge"*: `VisionProvider` + capabilities + router, `VisionObservation` →
      `normalizeToIdentityMetadata` → `IdentityMetadata`, plus `ImageQuality`/`ImageEmbedding`/
      `IdentityCoverage`. **No providers/APIs/DB/UI** (empty registry). Decision 040 ·
      `IDENTITY_INTELLIGENCE.md`.
- [ ] **Milestone 18B — first Vision provider** ← **next** — implement ONE provider (best per
      `RESEARCH_02_VISION.md`) behind `VisionProvider.analyzeImage` + a single `analyzeIdentity(image)`.
      Nothing else. Then more providers slot in like image providers.

### Future — documented, NOT scheduled (research first)

Product-vision milestones **M18–M25** and the research backlog are captured in
**[FUTURE_RESEARCH.md](./FUTURE_RESEARCH.md)** and **[research/](./research/)**. Nothing below is
scheduled — each is **researched before it is built** (research-driven, per the user's direction).

Suggested 8–12 week priority order:
1. **Preserve User Intent** (critical — first fix shipped; richer enrichment next)
2. **Identity Intelligence** — automatic best-reference selection ([research/IDENTITY_ANALYSIS.md](./research/IDENTITY_ANALYSIS.md))
3. **Image Understanding** — analyze every identity photo ([research/VISION_MODELS.md](./research/VISION_MODELS.md))
4. **Scene Understanding v2** — richer actions & relationships ([research/SCENE_GRAPHS.md](./research/SCENE_GRAPHS.md))
5. **Prompt & Identity Scoring** — evaluate before + after ([research/PROMPT_ENGINEERING.md](./research/PROMPT_ENGINEERING.md), [research/IMAGE_EVALUATION.md](./research/IMAGE_EVALUATION.md))
6. **Async Job Queue** — better UX for slow identity models (`asyncJobs` + `Job` table)
7. **Creative Memory & Style Profiles** ([research/CREATIVE_MEMORY.md](./research/CREATIVE_MEMORY.md))
8. **Provider Expansion** — OpenAI / Google / Ideogram / … behind the same router ([research/PROVIDERS.md](./research/PROVIDERS.md))

Also open: Templates (saved briefs); a parallel `VideoProvider`; multi-identity; global `/uploads` +
`/gallery` nav decision (NAVIGATION.md). Long-term vision: a **Creative Operating System**
([VISION.md](./VISION.md)).

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