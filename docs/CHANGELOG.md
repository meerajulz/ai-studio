# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

> **▶ Resume (2026-07-14, build + tsc green):** Shipped **Milestone 18A — Identity Intelligence
> Architecture** (Decision 040, architecture only): a provider-agnostic **Vision layer**
> (`src/lib/vision/`) on the principle **"the Vision provider gives OBSERVATIONS; AI Studio stores
> KNOWLEDGE"** — `VisionProvider` + capabilities, a `VisionObservation` → `normalizeToIdentityMetadata`
> → `IdentityMetadata` split, `ImageQuality`/`ImageEmbedding`/`IdentityCoverage`, a capability router,
> and an **empty provider registry** (NO Gemini/OpenAI/Florence/Qwen — no APIs/DB/UI). `normalize` +
> `coverage` are pure and already work. **Next = 18B:** add ONE provider implementing `analyzeImage`
> (+ `analyzeIdentity`). Before that: **Fixed a Creative Director regression (Decision 039):**
> the v4 compiler was discarding user intent (bikini/Chihuahua/props/clothing dropped) by rebuilding
> from graph nodes only — now the user's prompt is the **source of truth** (verbatim lead) and the
> Director only **enriches** (genre/camera/composition/lighting/realism/quality). Before that, shipped
> **Milestone 17 — Identity Preservation Foundation (Fal Kontext MVP)** (Decision 038): the Identity
> Visual Package now **reaches the model**.
> Researched Fal identity models (`docs/PROVIDER_RESEARCH.md`) → chose **FLUX.1 Kontext** (editing +
> multi-reference). The **Fal adapter** now picks the model itself: no references → `flux/schnell`
> (t2i, unchanged); with references → Kontext (`fal-ai/flux-pro/kontext` single, `.../kontext/max/multi`
> multiple). Generation flattens the visual package **best-first** (hero→portrait→full body→refs);
> router requires `identityPreservation`+`referenceImages` when refs exist (→ Fal), else normal t2i.
> Debug shows selected refs / why / provider response metadata. **No-identity generation is unchanged;
> no LoRA/embeddings/training; no schema change.** **NOT live-verified this session** — the 6 manual
> Julieta tests are for the user (needs `FAL_KEY` + an identity with training media). Env:
> `FAL_IDENTITY_MODEL`, `FAL_IDENTITY_MULTI_MODEL`. Below: **Milestone 16 — Creative Director v4
> (Scene Graph & Spatial Reasoning)** (Decision 037): a true scene graph with an **anchor** (central object),
> node **roles**, **confidence-scored** relationships (explicit → high/exact; co-mentioned → low/
> neutral, no fabricated directions), **intent v2** (architectural vs interior vs lifestyle; fantasy
> adjectives), and a **structured compiler** (`CompiledStructure` → rendered plain text, not
> concatenation) — pipeline `idea → identity → scene → spatial → intent → composition → compile`.
> Debug shows anchor + confidence + compiled structure. Deterministic; **no LLM, no provider change,
> no schema change.** Below: **Milestone 15 — Premium Provider Foundation (Fal + Capability System)**
> (Decision 036): providers now advertise **capabilities** and the app routes on those, **never on
> provider names**. Added **Fal.ai** (`providers/fal.ts`, `fetch`-based,
> `FAL_KEY`, default `fal-ai/flux/schnell`), a **Provider Router** (`ai/router.ts`, premium-first,
> capability-aware, `IMAGE_PROVIDER` override), and an **Identity Visual Package**
> (`getIdentityVisualPackage`) that flows *around* the Creative Director to the provider as neutral
> `referenceImages` (capable models use them; others ignore — no LoRA/embeddings/training). Debug
> shows capabilities / chosen provider+model / routing / visual package. HF still works; Creative
> Director / Identity / Gallery / recipes unchanged; no schema change. **Fal not live-verified this
> session** (user added `FAL_KEY` locally + on Vercel). **Next = return to the Creative Director and
> continue Spatial Analysis** (improve the Scene Graph / make it the primary compilation source /
> better intent classification) — deliberately *not* an LLM jump; see `docs/CREATIVE_DIRECTOR_FUTURE.md`.
> Env: `FAL_KEY` (+ optional `FAL_IMAGE_MODEL`, `IMAGE_PROVIDER`). Below: **Milestone 14 —
> Identity-aware Generation (foundation)** (Decision 035): `src/lib/creative/` is now a deterministic,
> provider-agnostic **reasoning pipeline** — `idea → analyzeScene → analyzeIntent →
> planComposition → compilePrompt → prompt`. It analyses the *whole scene* (primary/secondary
> subjects, objects, environment, setting, location, time, weather, actions, fantasy) and infers
> INTENT (portrait/lifestyle/interior/automotive/food/wildlife/concept-art/…) instead of letting
> the first keyword win — e.g. `red sofa with a dog and cat` → *lifestyle interior*, not an animal
> portrait. Same `directCreative(brief) → directive` contract; each stage is LLM-swappable later.
> Debug panel now shows every stage. Still deterministic, no LLM, HF unchanged. **Next candidates:**
> LLM-backed stages, richer Creative Questions, then Templates (= saved briefs). First run:
> `nvm use` (Node 24); restart `npm run dev` only after a prisma migrate (none here). Env for AI:
> `HF_TOKEN` / `HUGGINGFACE_API_KEY` (+ optional `HF_IMAGE_MODEL`).

### Design (no code)
- **Research 02 — Vision & Image Understanding** (research only): new
  **`docs/research/RESEARCH_02_VISION.md`** — the definitive, provider-neutral reference for how
  AI Studio will *understand* images before generation. Covers vision foundation models (Gemini/
  OpenAI vision, Qwen2.5-VL, Florence-2, InternVL, Pixtral, Molmo, LLaVA, CLIP), captioning,
  object detection (YOLO/Grounding DINO/OWLv2/Florence), segmentation (SAM2/Grounded SAM), pose
  (MediaPipe/ViTPose; avoid OpenPose licensing), identity attributes, image-quality analysis,
  similarity/embeddings (SigLIP/DINOv2/face embeddings), scene/landmark recognition, and automatic
  metadata extraction — with comparison tables, an AI-Studio applications matrix (why/complexity/
  dependencies/MVP-v2-LT), a **`VisionProvider`** capability-router architecture mirroring the image
  provider design, implementation priorities, and licensing/privacy gates. Recommends a hybrid,
  provider-neutral Vision layer (VLM structured extraction + embeddings + classical quality, growing
  to consistency scoring + SAM2 editing). No code, no schema, no providers integrated.
- **Knowledge capture after the first identity-preserving generations** (docs only): new
  **`LESSONS_LEARNED.md`** (what the first Fal Kontext tests proved — identity architecture works,
  Kontext ≫ Schnell for identity, quality now hinges on reference selection, and the preserve-intent
  fix), new **`FUTURE_RESEARCH.md`** (research backlog + product-vision milestones M18–M25 + an
  8–12 week priority order), and a new **`docs/research/`** folder (README + PROVIDERS ·
  IDENTITY_ANALYSIS · VISION_MODELS · SCENE_GRAPHS · PROMPT_ENGINEERING · IMAGE_EVALUATION ·
  CREATIVE_MEMORY) establishing a **research-before-build** workflow (so far only image providers had
  been researched). `ROADMAP.md` updated to record the first end-to-end identity-preserving
  generation + the future direction. No code, no schema.
- **Prompt Builder design** (Milestone 12 — design only): new **`PROMPT_BUILDER.md`** and
  **`CREATIVE_WORKFLOW.md`** — the intent-driven experience where the user *describes what they
  want* and AI Studio *writes the prompt*. Covers the user journey, UX philosophy (describe not
  engineer; simple-by-default; the prompt is an output not an input; provider-agnostic), the
  **creative brief** (Identity/Subject/Style/Mood/Lighting/Camera/Composition/Location/Time/
  Aspect/Quality/Notes), a **provider-agnostic `buildPrompt` transform** (brief → neutral prompt
  + params), planned components + states, ASCII **wireframes** (empty / builder / advanced /
  review / mobile), and integration with Identity, **Recipes** (brief stored in the recipe →
  Remix), Gallery ("Open in Builder"), and Generation (sits *above* the unchanged generation
  layer). Documents future Templates (= saved briefs), multiple identities, video, and the
  workflow builder. **No code, schema, routes, or components.** ROADMAP/TODO updated (Prompt
  Builder is the next milestone, before Templates).
- **Vision expanded — Creative Operating System** (docs only): evolved `VISION.md` (single
  source of truth; structure preserved) — new one-liner (an intelligent Creative Operating
  System that orchestrates multiple AI providers), "the **orchestration** engine is the
  product", a new **AI Studio Philosophy** section (provider-agnostic forever · orchestration
  not generation · users describe goals not models · complexity hidden behind simple UX · AI
  Studio owns the workflow, not the provider), and a **Future Direction — Intelligent AI
  Orchestration** section (long-term only: intent-driven generation, multi-provider workflows,
  identity processing/relationships, multiple identities per generation, a ComfyUI-inspired
  visual workflow builder, generation recipes, creative pipelines). Reinforces existing
  decisions; no architectural change, no new Decision.
- **Identity design frozen** (Decision 027, design only): final MVP refinements before
  implementation — **project-scoped identities** (`projectId` becomes required + Cascade;
  global library out of scope), a **dedicated Overview sub-tab** (default), **"Hero Image"**
  naming (maps `displayImageId`), **three statuses** `DRAFT | ACTIVE | ARCHIVED`, standardized
  planning-only training-media **roles** (`PRIMARY|SECONDARY|VIDEO|POSE|STYLE|OTHER`), Gallery +
  media layer reaffirmed as the single source (no second upload flow), and AI kept out
  (provider-agnostic). Updated `IDENTITIES.md`, `TRAINING_MEDIA.md`, `IDENTITY_UX.md`,
  `COMPONENT_GUIDELINES.md`, `ROADMAP.md`, `TODO.md`, `DECISIONS.md` (#027). No code/schema.
  Next: **Milestone 9A — Identity Manager implementation.**
- **Identity Manager UX & workflow design** (design only): new **`IDENTITY_UX.md`** — the
  complete Identity experience: user journey, ASCII wireframes for every screen (identities
  list, create dialog + create-from-Gallery-selection, identity overview/detail with sub-tabs,
  training-media grid + selector + viewer, settings, archived view), navigation/routes
  (`/projects/[id]/identities` + `/[identityId]`), every empty state, the full action list,
  reserved space for future Templates/History/Generate/LoRA/AI-settings, real-world workflow
  scenarios, and a UX review (clicks/duplicate-screens/get-lost risks + fixes). Reuses the
  `media/` components + workspace shell; no code, schema, components, or routes.
- **Future architecture note — multiple identities per generation** (Decision 026, design
  only): documented evolving `Generation.identityId` (single) into a `GenerationIdentity`
  many-to-many ("appears-in"), kept separate from training media (`IdentityMedia`). Added a
  "Future architecture" section + open question to `IDENTITIES.md`, a distinguishing note to
  `TRAINING_MEDIA.md`, a TODO, and Decision 026. Accepted as a future direction with open
  sub-questions; **no schema, migration, or code changed.**
- **Identity System Design** (Milestone 9 — design only, Decision 025): documentation-first
  spec of the Identity architecture before implementation. New **`IDENTITIES.md`** (what an
  Identity is, the problems it solves, philosophy, lifecycle create/edit/archive/restore/
  delete, relationships to Projects/Media/Templates/AI providers/jobs/future LoRAs, generation
  config resolution, provider-agnostic design) and **`TRAINING_MEDIA.md`** ("Training Media"
  not "reference images"; images + videos from day one; selection/removal/organization;
  future metadata/tagging/ranking/favorites/masks/pose/segmentation — all as link metadata,
  design only). Schema **review** (recommend `description`, `displayImageId`, `status`, and an
  `IdentityMedia` join table; defer generation-default columns until the Prompt Builder/AI
  consume them) — **no schema change**. Updated `VISION.md` (core workflow with Identity as
  the central concept), `ROADMAP.md` (milestone placement Gallery → Identity → Templates →
  Prompt Builder → AI), `COMPONENT_GUIDELINES.md` (planned Identity components — responsibilities
  only). No implementation, migration, UI, routes, or database changes.

### Added
- **Identity Intelligence Architecture — the Vision layer** (Milestone 18A, Decision 040;
  **architecture only**): a provider-agnostic `src/lib/vision/` built on the principle **"the Vision
  provider gives OBSERVATIONS; AI Studio stores KNOWLEDGE"** (`docs/IDENTITY_INTELLIGENCE.md`).
  Mirrors the image layer: **`VisionProvider`** interface + **capabilities** (caption/attributes/
  detect/segment/pose/faceEmbed/embed/quality/sceneRecognition), a capability **router**, and a
  registry. The core split: a provider returns a loose **`VisionObservation`** ("woman with pink
  hair wearing a black bikini"), which a **pure, deterministic `normalizeToIdentityMetadata`** turns
  into structured **`IdentityMetadata`** knowledge (hair/face-orientation+confidence/body/tattoos/
  clothing/lighting/embedding/…) — so swapping vision vendors never changes what AI Studio stores.
  Plus **`ImageQuality`** (a 0–100 composite + a "usable" reject-poor-references gate),
  **`ImageEmbedding`**, and **`IdentityCoverage`** (per-identity rollup: front face? full body?
  tattoo locations? **gaps** → the basis for automatic Hero/request-aware selection). **No providers,
  no APIs (empty registry, `isVisionConfigured()` = false), no DB/UI/services** — 18B adds the first
  provider (a VLM per research) behind the interface. Follows `RESEARCH_02_VISION.md` §1/§11/§13;
  `IdentityCoverage` + the explicit normalizer are documented additive extensions (Decision 040).
  Verified: observations normalize to correct knowledge + coverage finds gaps; `npm run build` +
  `tsc --noEmit` pass.
- **Identity Preservation Foundation — Fal Kontext MVP** (Milestone 17, Decision 038): the Identity
  Visual Package (M15) now actually reaches the model, so AI Studio can generate the **real person**,
  not a generic one described by text. New **`docs/PROVIDER_RESEARCH.md`** evaluates Fal identity
  models (Flux Kontext, PuLID, IP-Adapter FaceID, PhotoMaker, InstantID) across identity/editing/
  reference/multi-reference/quality/API/pricing/latency and recommends **FLUX.1 Kontext** (the only
  identity-preserving *editing* + multi-reference model — the right base for the AI-Photoshop/scene-
  replacement roadmap). The **Fal adapter** now chooses the model internally: no reference images →
  `fal-ai/flux/schnell` (text-to-image, unchanged); with reference images → **Kontext**
  (`fal-ai/flux-pro/kontext` for one, `fal-ai/flux-pro/kontext/max/multi` for several), consuming the
  package's `image_url`/`image_urls`. **All Fal specifics stay in the adapter.** The generation layer
  flattens the visual package into provider-neutral reference images **best-first** (hero → portrait →
  full body → curated refs, capped at 4) with a selection reason; the **router** now requires
  `identityPreservation` **+** `referenceImages` when references exist (routes to Fal), and falls back
  to normal text-to-image otherwise — so **no-identity generation behaves exactly as before**. The
  provider result gained optional `metadata` (seed/timings/safety). **Debug** (dev-only) extended:
  selected provider/model, capabilities, supports-reference-images, references offered vs sent (+
  roles), why they were selected, and provider response metadata. **Foundation only** — no LoRA/
  DreamBooth/embeddings/fine-tuning/video/multi-identity; **no schema change**. `npm run build` +
  `tsc --noEmit` pass; routing verified deterministically. **NOT live-verified this session** — the 6
  manual tests (Julieta) are for the user. New env: `FAL_IDENTITY_MODEL`, `FAL_IDENTITY_MULTI_MODEL`.
- **Creative Director v4 — Scene Graph & Spatial Reasoning** (Milestone 16, Decision 037): a true
  scene graph now drives compilation. Nodes carry a **`role`** (primary/secondary/object); the graph
  has an **`anchor`** — the central object others are positioned around (subject when present, else
  the room's characteristic furniture: living room→sofa, bedroom→bed, kitchen→island/table,
  office→desk). **Relationships carry confidence**: explicit prepositions → high (exact wording,
  richer set incl. between/near/around/against-the-wall/outside), co-mentioned objects with no
  preposition → low, **neutral** "near the anchor" ("with …") — **no fabricated directions**.
  **Intent v2** (`stages/intent.ts`) is anchor-aware and distinguishes **architectural** (a whole
  structure) from **interior-design** (a furnished room, no people) and **lifestyle** (a subject in
  a scene); fantasy *adjectives* now trigger concept-art. **Structured compiler** (`stages/compile.ts`)
  builds a **`CompiledStructure`** (subject + relationships + neutral objects + scene context +
  genre + composition + quality) and **renders** it to plain text instead of concatenating the raw
  sentence; the anchor's action + first explicit relationship fold into one clause ("a dog sitting
  on the sofa"), and the identity reference (M14) still leads the subject. **The provider interface
  is unchanged — providers still receive plain text.** Debug panel gained **anchor**, relationship
  **confidence**, and a **Compiled structure** section (dev-only). Traced the required prompts
  (luxury living room, bedroom, dog on sofa, coffee in Paris, product photography, fantasy castle)
  plus regressions — anchors/intents/relationships consistent, identity preserved. **Deterministic —
  no LLM, no provider change, no schema change.** `npm run build` + `tsc --noEmit` pass.
- **Premium Provider Foundation — Fal + Capability System** (Milestone 15, Decision 036): the
  production provider architecture. **Provider Capability System** (`ai/capabilities.ts`):
  providers advertise `capabilities` (imageGeneration, imageEditing, referenceImages,
  multipleReferenceImages, identityPreservation, inpainting, outpainting, video, lora, ipAdapter,
  controlNet, asyncJobs); **the rest of AI Studio depends only on capabilities, never on provider
  names**. The `ImageProvider` interface gained `capabilities`, `defaultModel`, `isConfigured()`,
  and an optional `referenceImages` on the request. **Fal.ai** (`providers/fal.ts`) is the first
  premium provider — `fetch`-based (no SDK dependency), auth `FAL_KEY`, default `fal-ai/flux/schnell`
  (`FAL_IMAGE_MODEL` override), all Fal specifics isolated in one file. **Provider Router**
  (`ai/router.ts` + registry in `ai/index.ts`) selects by **capability + configuration**,
  premium-first, with an `IMAGE_PROVIDER` override (to force e.g. Hugging Face) and a transparent
  `RoutingDecision`. **Identity Visual Package** (`identity/getIdentityVisualPackage`): the visual
  side of an identity (signed hero / best-portrait / best-full-body / reference URLs + metadata)
  that flows **around** the Creative Director straight to the provider request as neutral
  `referenceImages` — capable models use them, others **gracefully ignore** them (the Director
  stays text-only/provider-agnostic). Generation now routes by capability (prefers identity
  preservation when an identity is attached) and attaches the visual package. **Debug** extended:
  identity knowledge, identity visual package, provider capabilities, chosen provider, chosen model,
  routing decision. **No LoRA/embeddings/training** (architecture prep only); **no schema change**.
  Verified deterministically (router premium-first / capability match / graceful fallback /
  `IMAGE_PROVIDER` override / no-provider error); HF intact; Creative Director / Identity / Gallery /
  recipes unchanged. `npm run build` + `tsc --noEmit` pass; **Fal not live-verified this session**.
  New env: `FAL_KEY` (+ optional `FAL_IMAGE_MODEL`, `IMAGE_PROVIDER`). See `docs/PROVIDER_INTERFACE.md`.
- **Identity-aware Generation (foundation)** (Milestone 14, Decision 035): the Identity system now
  informs real generations for the first time — as **passive context**, never a provider feature.
  New Creative Director **Stage 0** `resolveIdentity` (`stages/identity.ts`): when an identity is
  selected it weaves a subject reference ("Emma, a young woman with red hair") into the idea so the
  *whole* downstream pipeline (scene → spatial → intent → composition → compile) reasons about the
  identity as the subject — e.g. "drinking coffee in Paris" flips from food-photography to a
  lifestyle portrait of Emma. The generation layer loads a lightweight, owner-scoped
  `IdentityContext` (name, description, `hasHeroImage`, `trainingMediaCount`; `providerArtifacts`
  reserved/unused) via the identity layer's new `getIdentityContext` and passes it in the brief —
  **the Director stays pure** (never fetches) and **the provider stays 100% identity-unaware**
  (still receives only the final compiled prompt; Decision 007 upheld). The **Generate page** gains
  an optional **Identity selector** (None + the project's identities); with none selected the
  prompt is **byte-identical to before**. `Generation.prompt` keeps the raw user idea;
  regenerate/variation reload the identity context so recipes stay identity-aware. Debug panel
  gained a **Stage 0 · Identity context** section. **Foundation only** — name + description; no
  LoRA/embeddings/training/provider-specific logic; **no schema change.** Verified: no-identity
  unchanged, with-identity reasoning changes and the description reaches the prompt, provider/media/
  recipes/owner-auth intact. `npm run build` + `tsc --noEmit` pass. See `docs/CREATIVE_DIRECTOR.md`.
  **Next: return to the Creative Director to continue Spatial Analysis** (deferred, not abandoned —
  see `docs/CREATIVE_DIRECTOR_FUTURE.md`).
- **Creative Director v2.5 — Spatial Understanding** (Milestone 13.5, Decision 034): a new
  **Spatial Analysis** stage (`stages/spatial.ts`) between Scene and Intent builds a lightweight,
  **internal-only `SceneGraph`** — entities become nodes with an optional descriptor ("red" sofa,
  "wooden" desk, "large" window) and frame `position`, and prepositions become directed
  **relationships** (`on`/`under`/`behind`/`in front of`/`left|right of`/`next to`/`over`/
  `holding`/…) linking the nearest entities (longest-phrase-wins, so "sitting on" beats "on").
  Pipeline is now `idea → scene → spatial → intent → composition → compile → prompt`. **Composition**
  uses the graph: scenes with real relationships (or ≥3 objects) are framed wide so the whole
  arrangement is visible, while product/food/portrait intents still isolate the subject — so an
  animal on a sofa is a lifestyle scene, not a portrait (also fixed: an animal *indoors* is
  lifestyle, never wildlife). **Compilation preserves relationships instead of flattening** — the
  user's sentence leads the prompt verbatim ("a dog sitting on a sofa" stays intact), and the graph
  only adds a spatial phrase when the idea doesn't already express it. Lexicon expanded (relation/
  position/descriptor vocabularies; objects like cup/umbrella/kitchen-island; landmarks like the
  Eiffel Tower) and the "living room" inference tightened to living-room-specific furniture. Debug
  panel extended with a **Spatial analysis (scene graph)** section (nodes + relationships), dev-only.
  Traced all required prompts (red sofa @center; dog —on→ sofa; cat —under→ table; cup —on→ wooden
  desk; Ferrari —in front of→ Eiffel Tower; dragon —over→ castle; woman —holding→ umbrella —next to→
  bicycle; kitchen island @center; bed —under→ large window) — relationships survive into the
  compiled prompt. Same `directCreative(brief) → directive` contract; `meta.graph` carries the
  graph. **Deterministic — no LLM, no provider change, no schema change** (the graph is never
  stored). `npm run build` + `tsc --noEmit` pass. See `docs/CREATIVE_DIRECTOR.md`.
- **Creative Director v2 — Scene Understanding** (Milestone 13, Decision 032): re-architected
  `src/lib/creative/` from keyword classification into a deterministic, provider-agnostic
  **multi-stage reasoning pipeline** — `idea → analyzeScene → analyzeIntent → planComposition →
  compilePrompt → prompt`. Each stage is a **pure, single-responsibility function** returning
  structured data, and no stage knows about a provider (only the final prompt leaves the layer).
  **Stage 1 (`stages/scene.ts`)** analyses the whole idea into a `Scene`: primary subject +
  secondary subjects + objects + living beings, environment (indoor/outdoor), setting, location,
  time of day, weather, actions, and fantasy elements (via a new `lexicon.ts`, the one place raw
  keyword knowledge lives). **Stage 2 (`stages/intent.ts`)** infers what the user is *creating* —
  portrait · lifestyle · interior-design · architecture · automotive · food · product · landscape ·
  wildlife · concept-art · fashion · still-life — from the scene, not the first entity. **Stage 3
  (`stages/composition.ts`)** plans framing, camera distance/angle, composition, perspective,
  depth of field, lighting, realism level, and quality floor. **Stage 4 (`stages/compile.ts`)**
  assembles the prompt in priority order **Scene → Intent → Composition → Quality**. Results:
  `red sofa with a dog and cat sitting on it` → *lifestyle interior, wide shot of the whole scene*
  (not an animal portrait); `woman drinking coffee in Paris` → *lifestyle*; `red Ferrari in Tokyo`
  → *automotive*; `modern living room` → *interior design*; `golden retriever running on the beach`
  → *wildlife/action*; `dragon flying over a castle` → *concept art* (fantasy genre wins, realism
  drops "photorealistic"); lone `sofa`/`chair`/`table` → *product photography*. Same
  `directCreative(brief) → directive` contract (callers unchanged); `meta` now carries the full
  reasoning trace (`scene`/`intent`/`composition`). **Debug Mode extended** to show every pipeline
  stage separately (dev-only). Still 100% deterministic — **no LLM, no new providers, Hugging Face
  untouched**; each stage is a clean seam for an LLM later. Traced all required prompts; `npm run
  build` + `tsc --noEmit` pass; recipes/regenerate/variation and the Gallery unchanged. No schema
  change. See `docs/CREATIVE_DIRECTOR.md`.
- **Creative Director MVP** (Milestone 12 implementation, Decision 031): the first step toward
  an *intelligent* AI Studio — a new provider-agnostic **`src/lib/creative/`** layer that turns a
  plain creative **idea** into a professional prompt (VISION: *"the user thinks creatively; AI
  Studio thinks technically"*). One public entry **`directCreative(brief) → directive`**
  (`CreativeBrief` = `idea` + optional `style`/`focus` + optional `identityId`;
  `CreativeDirective` = `prompt` + reserved `params` + transparency `meta`). **Deterministic**
  rules engine (style presets · subject detection · a "professional" **quality floor**) — same
  brief → same prompt, no I/O/AI — designed to be **swapped for an LLM later behind the same
  contract**. It is the **only** place the app enriches a prompt. Wired at the single generation
  chokepoint (`runImageGeneration`): the Director's compiled prompt goes to the provider, the
  user's **idea** stays in `Generation.prompt`, and the brief + compiled prompt are stored in
  `params.creative`, so **Recipes/Regenerate/Variation stay reproducible** (regenerate/variation
  reconstruct the brief and re-run it). **No schema change.** UI stays simple — one optional
  **Style** question (Realistic/Cinematic/Illustration/Fantasy); no CFG/steps/sampler/negative-
  prompt/LoRA/model/provider is ever exposed. The brief carries `identityId` so the Director
  *knows* an identity exists (identity-aware prompting deferred). Example: `"my dog"` now compiles
  to *"my dog, detailed fur, expressive eyes, portrait, close-up, photorealistic, natural soft
  lighting, highly detailed, sharp focus, professional photography, high resolution, shallow depth
  of field."* New `docs/CREATIVE_DIRECTOR.md`. `npm run build` + `tsc --noEmit` pass; existing
  generation/Gallery/Recipes unchanged; provider stays isolated behind `ImageProvider`.
- **AI Generation v2 — Creative Loop** (Milestone 11, Decision 030): strengthens
  `generate → gallery → improve → generate again`, no new storage. **Generation recipes** —
  the `Generation` record *is* the recipe (prompt/provider/model/`params`/identity/timestamps);
  the media layer now surfaces a read-only **`recipe`** on generated `MediaAsset`s. **Regenerate**
  (`regenerateGeneration`) and **Generate Variation** (`generateVariation`) re-run a recipe as a
  new generation, with lineage tagged in `params` (`source`, `fromGenerationId`) — via a shared
  `runImageGeneration` runner. **Generation history** (`listRecentGenerations`) reuses existing
  data (Generation + signed result). **Generate page** improved: larger prompt editor,
  character counter + validation, clearer loading/error, and a recent-generations list (open /
  copy prompt / use prompt). **Gallery viewer** exposes **Copy Prompt · View Recipe · Generate
  Again · Variation** for generated media (added optional `onRegenerate`/`onVariation`/`busy` to
  `MediaViewer`). New `docs/GENERATION_RECIPES.md`. Identity stays optional/provenance-only;
  provider stays isolated behind `ImageProvider`. **No migration.** Verified end-to-end with
  real HF generate + regenerate + variation (`scripts/verify-generation.ts`); build + tsc pass.
- **First Light — AI image generation** (Milestone 10): the first end-to-end generation,
  provider-agnostic. New **AI layer** (`src/lib/ai/`, Decision 029): `ImageProvider` interface +
  provider registry (`getImageProvider()`); **Hugging Face** is the only implementation
  (`providers/huggingface.ts`, `@huggingface/inference` `textToImage`, default model
  `black-forest-labs/FLUX.1-schnell`) — **no HF specifics leak outside the provider folder**.
  New **generation layer** (`src/lib/generation/`): owner-scoped, synchronous (authorize →
  `Generation` RUNNING → provider → persist via media layer → SUCCEEDED/FAILED); `Job` queue
  deferred. **Media layer now unions `UploadedMedia` + `GeneratedMedia`** so generated images
  appear in the **existing Gallery** as `source:"generated"` (making that filter real) — plus
  a new `createGeneratedMedia`; `getMedia`/`getMediaSignedUrl`/`deleteMedia` work across both
  tables (composite cursor pagination). **Schema** (migration `generation_first_light`):
  `GeneratedMedia` gained `pathname`/`projectId`/`originalFilename`. Minimal **UI**: a
  **Generate** workspace tab (`/projects/[id]/generate`) — one prompt, one button, loading/error,
  result shown inline + in the Gallery. Server action + hook (invalidates the media query).
  **Env:** `HF_TOKEN` or `HUGGINGFACE_API_KEY` (+ optional `HF_IMAGE_MODEL`). Blob only via the
  blob layer, media only via the media layer, provider isolated behind `ImageProvider`,
  owner-scoped throughout. Identity may be attached for provenance (no identity-aware prompting
  yet). **Verified end-to-end with a real Hugging Face generation** (`scripts/verify-generation.ts`);
  build + `tsc --noEmit` pass.
- **Identity Manager** (Milestone 9A) — implements the frozen Identity design. **Schema:**
  extended `Identity` (`description`, `status` `IdentityStatus` DRAFT|ACTIVE|ARCHIVED,
  `displayImageId` Hero Image, **`projectId` required + Cascade**) and a new **`IdentityMedia`**
  join table (`position`/`isFavorite`/`role` `TrainingMediaRole`) replacing the old
  `UploadedMedia.identityId` FK; migration `identity_manager`. **Identity layer**
  (`src/lib/identity/`, Decision 028) — owner-scoped CRUD + training-media add/remove/reorder/
  favorite/role + Hero Image + archive/restore, using the media layer exclusively (new
  `getMediaByIds` for signing; never touches Blob). **Status is derived** (new = DRAFT; first
  media → ACTIVE; last removed → DRAFT; ARCHIVED explicit) — no Activate button. Server actions
  (`actions/identities.ts`) + hooks (`hooks/use-identities.ts`). **UI** (`src/components/identity/`):
  `IdentitiesView` (list + filters), `IdentityCard`/`IdentityAvatar`/`IdentityStatusBadge`,
  `IdentityDetailView` with **Overview / Training Media / Settings** sub-tabs
  (Templates/History reserved, disabled), `IdentityOverview`, `IdentityTrainingMedia` +
  `TrainingMediaCard` + `TrainingMediaSelector`, `IdentitySettings`, form + delete dialogs.
  Routes `/projects/[id]/identities` and `/identities/[identityId]`. **Gallery integration:**
  selection mode + "Create identity from selection" (added `selectable`/`selected` props to the
  shared `MediaCard`/`MediaGrid` — no second uploader/browser). Provider-agnostic (no AI).
  Verified end-to-end via `scripts/verify-identity.ts`; build + `tsc --noEmit` pass.
- **Project Gallery** (Milestone 8) at `/projects/[id]/gallery` — the central, source-agnostic
  media browser for a project. Responsive grid of BOTH uploaded images **and** videos (image
  thumbnails lazy-load; video tiles show a poster frame + play affordance), a full-size
  **MediaViewer** modal (image / video player + metadata + delete), and **filters** (type:
  all/images/videos · source: all/uploaded/**generated** placeholder · sort: newest/oldest ·
  debounced filename search). **Infinite scroll** via `IntersectionObserver` +
  `useInfiniteQuery` (cursor pagination). Loading/empty/error states. Owner-scoped; never
  touches Blob directly. Generated AI media will drop into the same grid/filters/viewer with
  no UI change (Decision 024).
- **Media layer refined into the single public media API** (Phase 1 of Milestone 8,
  Decision 024). `src/lib/media/server.ts` now exposes owner-scoped `createMedia`,
  `listProjectMedia` (kind/source/sort/search + cursor pagination), `getMedia`,
  `getMediaSignedUrl`, `updateMediaMetadata`, `deleteMedia`, `handleProjectUpload`; client
  `uploadProjectMedia`. New source-tagged **`MediaAsset`** contract (`source: uploaded |
  generated`). Canonical Server Actions in `actions/media.ts` (replaces `actions/uploads.ts`);
  unified hooks in `hooks/use-media.ts` (`useProjectMedia` infinite query + `useDeleteMedia`,
  replaces `use-uploads.ts`). **Reusable components** in `src/components/media/`: `MediaCard`,
  `MediaGrid`, `MediaViewer`, `MediaFiltersBar`, `DeleteMediaDialog`. The **Uploads tab was
  migrated onto these** (its `UploadedMediaCard`/`DeleteUploadDialog` removed) so Uploads +
  Gallery share one code path. Verified end-to-end via `scripts/verify-media.ts` (persist →
  signed URLs → filter/sort/search/paginate → getMedia/rename/refresh → owner authorization
  → delete, against the live store + DB). Top-level `/uploads` + `/gallery` documented as
  temporary placeholders (NAVIGATION.md); **no routing changes**.
- **Upload System** (Milestone 7B): the Uploads tab of a project workspace now supports real
  image **and** video uploads to the private Blob store. **Media layer** (`src/lib/media/`,
  Decision 022) that all feature code depends on instead of the blob layer directly:
  `server.ts` (`persistUpload`/`listProjectUploads`/`deleteUpload` + project-ownership
  guard + client-token issuance), `client.ts` (`uploadProjectMedia` — browser upload +
  best-effort width/height/duration probing), `types.ts` (`UploadedAsset` contract),
  `index.ts` (shared-types barrel). **`/api/uploads`** route implements `@vercel/blob`
  `handleUpload` to authorize + mint a **scoped client token** (`onBeforeGenerateToken`
  verifies the user owns the target project and locks the token to that project's path +
  allowed MIME types + 200 MB ceiling); metadata is persisted by an explicit `createUpload`
  Server Action after the upload (not the localhost-unreachable `onUploadCompleted` webhook —
  Decision 023). Owner-scoped Server Actions in `actions/uploads.ts`; shared `requireUserId`
  helper (`lib/auth/session.ts`, also adopted by `actions/projects.ts`). **UI** under
  `src/components/upload/`: `UploadDropzone` (drag & drop + click-to-browse, multiple),
  `UploadQueueItem` (progress bar, cancel, retry, remove), `UploadedMediaCard`
  (image/video thumbnail via signed URL + delete), `DeleteUploadDialog`, and `UploadsView`
  (three-state grid: `LoadingState`/`EmptyState`/content + "storage not configured" notice).
  Client hooks: `use-uploads.ts` (TanStack Query list + delete, key `["uploads", projectId]`)
  and `use-upload-manager.ts` (transient queue with `p-limit` concurrency of 3, friendly
  validation errors via Sonner). **DB:** extended `UploadedMedia` (`pathname`,
  `originalFilename`, `durationSeconds`, `updatedAt`) via migration
  `add_upload_media_metadata`. **Verified end-to-end against the live private store + DB**
  via `scripts/verify-uploads.ts` (upload image + video → raw URL 403 / signed URL 200 →
  metadata persisted → owner authorization denied for another user → delete). Build +
  `tsc --noEmit` pass. No Gallery/Identity/AI work — uploads stay decoupled from AI.
- Project documentation set under `docs/` (PROJECT, ARCHITECTURE, ROADMAP, DATABASE,
  AI_PROVIDERS, API, PROMPTS, CHANGELOG, DECISIONS, TODO, VISION, PROJECT_SPEC,
  NEXT_SESSION_PLAN).
- UI foundation docs (before building more UI): **UI_DESIGN.md** (tokens, typography,
  spacing, radius, buttons, cards, animations), **NAVIGATION.md** (public/protected route
  map + app shell), **COMPONENT_GUIDELINES.md** (reusable components: PageContainer,
  Header, Sidebar, SectionTitle, EmptyState, LoadingState, ProjectCard, MediaCard,
  UploadCard).
- **WORKSPACE.md** (project workspace structure) and **UX_PRINCIPLES.md** (interaction
  principles).
- **Protected Application Shell**: `AppShell` root layout under `app/(protected)/` with a
  centralized session guard; `Sidebar` (active-route nav), `Header` (Logo, `Breadcrumb`
  derived from pathname, placeholder `Search`, `UserNav` avatar dropdown), and shared
  `PageContainer` / `SectionTitle` / `EmptyState` / `LoadingState`. Placeholder pages for
  Projects, Gallery, Uploads, Templates, Settings. Responsive (mobile menu via sheet).
  Root `/` now redirects by session.
- **Storage Foundation** (Milestone 7A): modular `src/lib/blob/` package for Vercel Blob —
  `constants.ts` (limits/allowed MIME/token/path builder), `types.ts` (`MediaKind`,
  `StoredBlob`, `AssetMetadata`), `validation.ts` (MIME + size), `errors.ts`
  (`StorageError` + codes), `server.ts` (`uploadAsset`/`deleteAsset` via `put`/`del`),
  `client.ts` (`uploadAssetFromBrowser`), `index.ts` (shared barrel), plus
  `isBlobConfigured()` so callers can detect a missing token and degrade gracefully. Env
  `BLOB_READ_WRITE_TOKEN` + `.env.example` (now committable via `.gitignore` exception).
  New `docs/MEDIA_PIPELINE.md` (documents the token requirement + how to add it on Vercel
  when a connected store only exposes `BLOB_STORE_ID`/`BLOB_WEBHOOK_PUBLIC_KEY`).
  Validation/error logic is pure and typechecked. Uploads use **private** access
  (`access: "private"`) to match the private `ai-studio-media` store; added
  `getSignedUrl()` (Vercel Blob `issueSignedToken` → `presignUrl`) to mint short-lived
  view URLs, and `SIGN_URL_FAILED` error code. **Verified end-to-end against the live
  store** via `scripts/verify-blob.ts` (upload → raw URL 403 → signed URL serves bytes →
  delete → 404). No UI yet.
- **Project Workspace** (Milestone 6): tabbed workspace under
  `app/(protected)/projects/[id]/` — a shared `layout.tsx` fetches the project once
  (owner-scoped, 404 otherwise) and renders `ProjectLayout` (project header + section
  tabs) around each tab. **Overview** (stats + quick-generate + recent-activity widgets,
  all empty) plus placeholder tabs: Uploads, Gallery, Identities, Templates, Jobs,
  Settings. Responsive tabs, `loading.tsx` skeleton, per-tab `EmptyState`. New
  **workspace context** (`lib/providers/workspace-provider.tsx`, wrapped in `AppShell`)
  publishes the active project so the `Breadcrumb` shows the project name instead of its
  id. New doc `WORKSPACE_API.md`. No uploads/blob/gallery/AI yet.
- **Project Management** (first domain feature): projects list at `/projects` with
  `ProjectCard` grid, `LoadingState`, `EmptyState`, and create/edit/delete via a form
  dialog + delete confirmation dialog. CRUD through owner-scoped **Server Actions**
  (`actions/projects.ts`) with **Zod** validation (`lib/validations/project.ts`), consumed
  via **TanStack Query** hooks (`hooks/use-projects.ts`, cache key `["projects"]`).
  Added `QueryProvider` + Sonner `Toaster` to the root layout. Clicking a project opens
  `/projects/[id]`, which renders the new `ProjectLayout` workspace shell (owner-checked;
  404 otherwise). No uploads/gallery/AI yet.
- **Authentication UI polish** (behavior unchanged): login/register on a `Card` with brand
  header; new `PasswordInput` (show/hide toggle); spinner loading state + disabled inputs
  while submitting; `FormError` banner for server errors; richer `UserNav` dropdown
  (avatar + name/email, Settings placeholder, Sign out).
- `src/`-based folder structure (`actions/`, `components/{ui,forms,gallery,upload,shared}`,
  `hooks/`, `lib/{ai,auth,blob,db,validations,providers}`, `services/`, `store/`,
  `types/`, `styles/`).
- `TooltipProvider` wired into the root layout.
- `.nvmrc` (Node 24) and `engines` field (`node >=20.19.0`).
- **Database:** Prisma 7 schema with 9 models (User, Project, Identity, UploadedMedia,
  Generation, GeneratedMedia, Job, Template, FavoritePrompt) + 3 enums; `init` migration
  applied to Neon PostgreSQL.
- **Prisma runtime client** (`src/lib/db/`): singleton `PrismaClient` using
  `@prisma/adapter-neon`, with `client.ts`, `index.ts` barrel, and a `README.md`.
  Verified end-to-end against Neon.
- **Authentication (Better Auth)**: email + password via the Prisma adapter over Neon.
  Added `Session`, `Account`, `Verification` models (+ `User` relations); `better_auth`
  migration. Server config in `src/lib/auth/` (`auth.ts` + `index.ts`), browser client
  (`client.ts`), and the catch-all route `src/app/api/auth/[...all]/route.ts`. Sign-up and
  sign-in verified end-to-end (rows persisted; cascade delete confirmed).
- **Auth UI (minimal, for verification):** `/login` and `/register` pages using the
  shadcn `Form` component with React Hook Form + Zod (`src/lib/validations/auth.ts`) and
  the Better Auth client — loading states, field + server error messages, redirect to
  `/dashboard` on success, and server-side guards that redirect authed users away from
  login/register. Temporary `/dashboard` with a `UserMenu` (name / email / sign out).
  Added `src/components/ui/form.tsx` (was missing). Full flow verified via server
  redirects + session gating. Unstyled — verification only.

### Changed
- Architecture (pre-shell): **Projects** is the primary authenticated landing page;
  temporary `/dashboard` kept only for auth verification (landing switches to `/projects`
  once Projects ships). Roadmap milestone renamed **Protected Dashboard → Protected
  Application Shell**. Introduced **`AppShell`** (authenticated root layout), **`Breadcrumb`**,
  and **`ProjectLayout`** in the component guidelines. All collections must implement both
  `LoadingState` and `EmptyState`.
- Authenticated landing switched from `/dashboard` to **`/projects`** (dashboard kept for
  auth verification). `/login`, `/register`, `/` redirect to `/projects` when authed.
- Removed `components/auth/user-menu.tsx` (superseded by the shared `UserNav`).
- Moved `app/`, `components/`, `lib/` into `src/`.
- Updated `@/*` path alias → `src/*`; `components.json` css path → `src/app/globals.css`.
- Prisma 7: removed `datasource.url` from `schema.prisma` (now in `prisma.config.ts`);
  runtime connects via a driver adapter.

### Fixed
- **Creative Director was discarding user intent** (Decision 039 — regression from Milestone 16's
  structured compiler). The v4 compiler rebuilt the prompt from *recognized scene-graph nodes only*,
  so any word the deterministic lexicon didn't know silently vanished: *"She wears a bikini on a
  boat holding a Chihuahua"* compiled to *"…the woman on the boat, portrait photography…"* — losing
  **bikini, Chihuahua, wears, holding** and weakening "on a boat" → "with boat" (the identity model
  then faithfully rendered the reduced scene). Fix: **the user's prompt is the source of truth** —
  the compiler now leads with the full idea **verbatim** (identity reference included) and only
  **appends** genre/camera/composition/perspective/DOF/lighting/realism/quality, de-duplicated, so
  clothing, props, actions, interactions and locations always survive. The scene graph still drives
  reasoning + Debug but never replaces the user's words. Lexicon expanded (actions incl. wearing/
  holding/carrying/…, clothing props, dog breeds) so the graph reasons richer. Also improves
  composition (the bikini/boat/dog scene is now lifestyle *wide shot*, not a tight portrait — which
  had over-emphasised facial detail). Verified the failing prompt + regressions; `npm run build` +
  `tsc --noEmit` pass. No schema change.
- **Generation history synchronization** (Milestone 13.1, Decision 033): the Generate page and the
  Gallery now stay in sync. Deleting a generated image previously left its `Generation` orphaned,
  so the Generate page showed an empty, result-less history card. Fix: a generated image and its
  `Generation` (the recipe) **share one lifecycle** — `deleteMedia` now removes the Blob(s) and
  deletes the owning `Generation` (its `GeneratedMedia` child cascades via `onDelete: Cascade`),
  and `useDeleteMedia` invalidates the **generation history** query as well as the media query, so
  the Generate page updates the instant a Gallery delete succeeds. Chosen over soft-delete (no
  restore/trash UI — YAGNI) and over keeping orphan recipes (invisible, unbounded); rationale in
  Decision 033 / `GENERATION_RECIPES.md`. Uploaded media unchanged. **No schema change.** `npm run
  build` + `tsc --noEmit` pass; not yet live-verified against DB/Blob.
- **Creative Director intent-classification bug** (Milestone 12 follow-up): generic object and
  interior ideas were rendered as people/animals — `sofa → cat`, `chair/table/kitchen/bathroom →
  woman`, and `"modern living room … no person on it" → portrait of a man`. **Root cause was ours**
  (prompt enrichment, not Hugging Face/FLUX): (1) `detectSubject` **defaulted unknown subjects to
  `focus: "face"`**, injecting *portrait, close-up, expressive eyes, professional photography* into
  every unrecognized noun — the model then rendered a portrait and ignored the real subject; and
  (2) keyword matching **ignored negation**, so the literal word "person" in *"no person on it"*
  fired the person rule. Reworked `detectSubject` into `detectCategory` — a subject-category system
  (`person · animal · interior · place · food · vehicle · product · object`) with a **neutral
  `object` fallback** (never adds portrait/eye/face tokens), new **interior/place** rules
  (kitchen/bathroom/living room), and a **people-negation guard** (`no person / without people /
  no one / nobody / unoccupied` suppresses the person rule). Traced end-to-end before/after; all
  reported prompts now classify correctly (`sofa → object`, `kitchen → interior`, living-room →
  interior). No provider or schema change. See `docs/CREATIVE_DIRECTOR.md`.
- **Developer Debug Mode** (development only): every generation now returns a `debug` trace
  (`GenerationResult.debug`) **populated solely when `NODE_ENV !== "production"`** — user idea,
  detected intent, style/focus, creative rules applied, compiled prompt, provider, model, and a
  **secret-free generation payload** (echoed by the provider adapter via
  `ImageGenerationResult.requestPayload`; the token is never included). The Generate page renders
  it as a "Creative Director — Debug" panel. Nothing debug-related ships to production. Makes the
  Director transparent as it grows more intelligent.
- **Vercel deploy** (3 issues): (1) the gitignored `src/generated/prisma` wasn't generated
  on Vercel → added `prisma generate` via `postinstall` and the `build` script; (2)
  `prisma.config.ts` imports `dotenv/config` but `dotenv` was only a transitive dep →
  declared it explicitly so `prisma generate` resolves under a clean `npm ci`; (3)
  `src/lib/db/client.ts` threw `DATABASE_URL is not set` at import time, failing
  `next build` page-data collection → the client is now instantiated lazily (a `Proxy`
  that connects + checks env on first query), so the build no longer needs `DATABASE_URL`.
- Prisma generator output path → `src/generated/prisma` (was `../app/generated/prisma`);
  `.gitignore` updated to match.
- `UserNav` dropdown crashed on open (`MenuGroupContext is missing`): Base UI's
  `DropdownMenuLabel` (= `Menu.GroupLabel`) requires a surrounding `Menu.Group`. The
  account header is display-only, so it's now a plain `div`.
