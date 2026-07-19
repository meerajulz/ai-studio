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
- [x] **Milestone 18B — Identity Coverage Engine** (still no Vision provider) — `analyzeIdentityCoverage`
      consumes `IdentityMetadata[]` → dimensioned `CoverageReport` (star scores, confidence, missing,
      prioritized suggestions) across face/body/hair/tattoo/environment dimensions. Deterministic;
      verified offline with mocked metadata (`scripts/verify-coverage.ts`). Proves the architecture
      drives Smart Reference Selection + Quality Gates. Decision 041 · `IDENTITY_INTELLIGENCE.md`.
- [x] **Milestone 19 — first Vision provider (Gemini) + Identity Image Scoring** — `analyzeIdentity`
      → Gemini `analyzeImage` (structured JSON) → normalize → score. New per-image scoring
      (`image-score.ts`) distinct from identity-level coverage (self-curating libraries via
      `rankIdentityImages`); rich metadata (facial pose/smiling). Gemini isolated + swappable;
      deterministic scoring verified offline; **Gemini API not yet live-verified**. Decision 043.
- [x] **Milestone 19A — Enrich Identity Intelligence Metadata** (no routing, no schema) — richer
      **knowledge** so every future decision has more to work with. **Coverage rescored** (engine
      `cov-2`): presence × visibility-confidence × quality-ramp + breadth-as-**bonus** — a clearly
      visible frontal portrait now reads ★★★★★ (was ★★★☆☆). New metadata: normalized **tattoo-region
      taxonomy** (`TattooRegion`), structured **body visibility** (`visibleRegions`/`visiblePercent`),
      richer **face expression** + per-component **face quality**, richer **hair** (texture/parting/
      updo/bangs/wet/wind-blown), and **reference suitability** (per-facet, metadata only). Verified
      offline (`verify-coverage`/`verify-scoring`). Decision 045 · `IDENTITY_INTELLIGENCE.md` ·
      new `AI_ARCHITECTURE.md`.
- [x] **Milestone 19C — Vision Intelligence Polish** (docs + correctness, no new providers/routing/
      schema) — final pass before Smart Reference Selection. **Unknown vs zero:** `face.quality` is
      now `null` (*unavailable*) when the face isn't visible, never a bag of zeros (UI shows "—").
      **Explainable suitability:** `referenceSuitability.reason` is a synthesized multi-clause
      sentence. Documented that single-image observations may disagree (→ identity-level aggregation
      resolves them; `TODO` in `coverage.ts`), that coverage measures *representation* not *image
      quality*, and future finer tattoo regions. **`im-2` FROZEN** as the provider-neutral contract.
      Decision 046.
- [x] **Milestone 20 — Smart Reference Selection** — Identity Intelligence in action. **First schema
      change:** `MediaVisionKnowledge` persists per-image `im-2` knowledge + score (analyzed once via
      an **"Analyze library"** action; generation NEVER re-analyzes). New provider-neutral
      **`src/lib/selection/`**: prompt requirements (from the Director) → per-image match → **package
      optimization** (greedy marginal-gain / diversity, not top-N) → reasons + coverage warnings.
      **Replaces** the static Identity Visual Package in `runImageGeneration` (graceful fallback when
      unanalyzed); providers unchanged. `/debug/selection` + `verify-selection.ts`. `signals` hook
      future-proofs for embeddings/favorites/LoRA. Decision 047 ·
      [SMART_REFERENCE_SELECTION.md](./SMART_REFERENCE_SELECTION.md). Addresses Kontext identity bugs
      (#2–#6).
- [x] **Milestone 20 hardening + Milestone 21 (Identity Description Synthesis)** — from real drift
      testing (Decision 048): (1) **scene-aware selection** — body/clothing prompts boost body-family
      references above the face (a bikini beach shot now leads with full-body/leg-tattoo, not a bare
      face); (2) **synthesized identity description** — `synthesizeIdentityAppearance` builds a
      majority-voted, region-based appearance paragraph (hair/piercings/tattoo layout) from analyzed
      images, appended verbatim to every prompt (replaces the sparse static description); (3)
      **visible knowledge** — training-media cards show a compact analysis summary + a full side-panel
      (reads persisted knowledge, Re-analyze, no Gemini). The identity page is now the canonical
      inspector; `/debug/vision` stays a dev playground.
- [x] **Milestone 20 completion** (Decision 049) — from generation testing: (1) **Identity Anchor**
      invariant — every identity generation always includes the strongest frontal face as a distinct
      "who is this person?" reference (`selection/anchor.ts`), prepended by the Fal adapter (deduped),
      separate from the selector's "what describes this request?"; (2) **NSFW/black-image** detection
      (`CONTENT_MODERATED` — fail cleanly, never save a black square); (3) synthesis polish (no age,
      deduped, richer region tattoos). Verified selector→Fal order/format integrity. **M20 complete.**
- [x] **Milestone 21 — Model Registry (capability-routed orchestration)** (Decision 054) — AI Studio
      is no longer "a FLUX app": a **`src/lib/ai/model-registry.ts`** + **`model-router.ts`** choose the
      best MODEL by capability (Auto), a manual pick (benchmark), or Developer (metadata). Registered
      FLUX Kontext Max/Pro Multi + FLUX.2 Pro Edit + Nano Banana Pro + Gemini Image + GPT Image 2 +
      Seedream V5 Pro (all verified `{prompt,image_urls}` from Fal docs; adding a model = one config
      entry). Fal adapter is now payload-kind driven (no FLUX branching). Auto stays on the proven
      Kontext Max Multi. `verify-model-routing.ts`. [MODEL_REGISTRY.md](./MODEL_REGISTRY.md).
- [x] **Milestone 22 — Identity Engine Architecture (foundation)** (Decision 055) — Identity is now its
      own subsystem in **`src/lib/identity-engine/`**: Generation calls `planConditioning` and never
      learns HOW an identity is implemented. Pluggable `IdentityModule` registry (only **Reference**
      enabled; **LoRA / PuLID / InstantID** registered, disabled), provider-agnostic training arch
      (`TrainingEngine → Trainer → LoRATrainer`), **Identity Dataset** (readiness + metrics + curation,
      reusing the coverage engine), `IdentityEvaluator` (reserved metrics). Additive migration
      `add_identity_engine` (versioned, never-overwritten trained models). Read-only Dataset/Models UI.
      Reference flow byte-for-byte unchanged (`verify-identity-engine.ts`). **Architecture only — no
      LoRA/PuLID/ML.** [IDENTITY_ENGINE.md](./IDENTITY_ENGINE.md).
**Confirmed identity sequence (do not reorder):** M22 ✅ → M23 ✅ → M24 → M25 → M26 → M27 → M28 → future modules.

- [x] **Milestone 23 — Fal Training Infrastructure** (Decision 056) — taught the Identity Engine *how to
      train* (not how to evaluate). **Training Registry** (`identity-engine/training/registry.ts`) — the
      third registry, symmetric with the Model + Identity Module registries: `FalTrainer` enabled;
      `ReplicateTrainer`/`OpenAITrainer`/`GoogleTrainer`/`FutureTrainer` registered but disabled (shared
      `stubTrainer`). **`getCapabilities` gained a `training` block** (`{available, providers, recommendedProvider}`)
      derived from the registry. **`TrainingState`** (`NOT_READY → READY_TO_TRAIN → TRAINING → TRAINED →
      OUTDATED → ARCHIVED`, pure `deriveTrainingState`) — user lifecycle distinct from job status; needs
      `IdentityTrainedModel.datasetVersion` (migration `add_trained_model_dataset_version`). Lifecycle
      persistence seams in `identity/training.ts`. Read-only Models tab shows state + providers; no working
      Train button. `verify-training-infrastructure.ts`. **NOT M23:** retries/eval/real Fal training.
- [ ] **Milestone 24 — LoRA Trainer** ← **next** — the first concrete `Trainer` (Fal LoRA): assemble the curated
      dataset, train, persist a versioned model, enable the LoRA module (`reference+lora`). getCapabilities
      lights up `lora: true` with no UI change.
- [ ] **Milestone 25 — Identity Evaluation Engine** — implement `IdentityEvaluator` (InsightFace face
      similarity + embeddings for tattoos/hair/etc.); fill the reserved `IdentityEvaluation` metrics.
- [ ] **Milestone 26 — Automatic Retry & Best-Candidate Selection** — use evaluation to retry/rank
      generations and pick the best.
- [ ] **Milestone 27 — PuLID** — first adapter (non-trainable) identity module.
- [ ] **Milestone 28 — InstantID** — second adapter module. Future identity modules become plug-ins.
- [ ] **Milestone 19B — Face Embeddings** — folds into M25 (InsightFace behind a provider-neutral
      `FaceEmbeddingProvider`, fed to the selector/anchor via `SelectionCandidate.signals` and the
      `IdentityEvaluator`). See [research/RESEARCH_03_FACE_EMBEDDINGS.md](./research/RESEARCH_03_FACE_EMBEDDINGS.md).

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