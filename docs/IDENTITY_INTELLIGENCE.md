# Identity Intelligence

> How AI Studio turns identity images into **knowledge** so it can automatically select the best
> references, score quality, and (later) evaluate consistency — without coupling to any Vision
> vendor. Architecture: `src/lib/vision/`. Research: [research/RESEARCH_02_VISION.md](./research/RESEARCH_02_VISION.md).
> Milestones: **18A** (this — architecture only) → **18B** (first provider, `analyzeIdentity` only).

## The guiding principle

> ## **The Vision provider gives OBSERVATIONS. AI Studio stores KNOWLEDGE.**

This is one of the most important architectural principles in the project — it shapes every Vision
feature we build from here on.

A vision model might observe:

> *"woman with pink hair wearing a black bikini"*

AI Studio **must not store that sentence.** It normalizes the observation into structured knowledge:

```
Hair      { color: pink, length: long, visible: true }
Face      { orientation: front, confidence: 0.98, visible: true }
Body      { framing: full-body, visibility: full }
Tattoos   [ left arm, chest, left leg ]
Quality   { overall: 76, usable: true }
Lighting  { setting: outdoor }
Embedding [ … ]
```

Why it matters:
- **Provider-agnostic.** Swapping Gemini → Qwen → Florence never changes what AI Studio stores;
  observations differ, knowledge is stable. (Same lesson as `ImageProvider` → HF/Fal.)
- **Queryable & rankable.** Structured knowledge drives automatic Hero/reference selection,
  dedup, request-aware selection, and scoring. A free-text caption cannot.
- **Stable over time.** Knowledge is our schema; providers are interchangeable components.

## Architecture (`src/lib/vision/`)

Mirrors the image layer (Decision 007/036) — capabilities, a provider interface, and a router.

```
VisionProvider (observations)  →  normalizeToIdentityMetadata()  →  IdentityMetadata (knowledge)
                                                                        │
                                            computeIdentityCoverage() ← per-identity aggregate
```

| File | Responsibility |
| ---- | -------------- |
| `capabilities.ts` | `VisionCapability` (caption/attributes/detect/segment/pose/faceEmbed/embed/quality/sceneRecognition) |
| `VisionProvider.ts` | The provider contract — `analyzeImage(request) → VisionObservation`. Returns **observations**. |
| `types.ts` | **Observation** (`VisionObservation`, loose) vs **Knowledge** (`IdentityMetadata`, `ImageQuality`, `ImageEmbedding`, `IdentityCoverage`). |
| `normalize.ts` | `normalizeToIdentityMetadata(obs)` — **observations → knowledge**. Pure, deterministic, provider-neutral. |
| `coverage.ts` | `computeIdentityCoverage(metadatas)` — the per-identity rollup (front face? full body? tattoo locations? gaps). |
| `router.ts` / `index.ts` | Capability router + registry, mirroring the image router. |

## Knowledge model (summary)

- **`IdentityMetadata`** (per image): hair · face · body · tattoos (visible only) · accessories ·
  facial hair · age range · expression · clothing · lighting · environment · dominant colors ·
  detected objects · **quality** · **referenceSuitability** · **embedding** · **face embedding** ·
  caption · source (provider/model/analyzedAt).
- **`ImageQuality`**: sharpness · exposure · face visibility · occlusion · cropped · resolution ·
  aesthetic · **overall (0–100)** · **usable** (the reject-poor-references gate) · issues. *(19A:
  a null `aesthetic` no longer caps a good photo at 90 — the composite normalizes over present
  weights.)*
- **`IdentityCoverage`** (per identity): what the reference set covers + **gaps** — the basis for
  automatic Hero/reference selection.

### Enriched metadata (Milestone 19A)

The point of 19A is that **every future decision has richer information** — richer knowledge, no
routing yet. All fields are validated (and, where a provider omits them, deterministically **derived**)
in the provider-neutral normalizer, so swapping providers never changes what we store.

- **Tattoos → normalized taxonomy.** `TattooKnowledge` gains `region: TattooRegion` (~20 canonical
  regions: `left-shoulder … right-hand`, `chest-left/right`, `abdomen`, `hip`, `upper-back`,
  `lower-back`, `neck`, `left/right-thigh`, `left/right-calf`, `feet`, `other`). Raw `location` kept
  for provenance. `toTattooRegion(text)` maps free text → one canonical region.
- **Body → structured visibility.** `body.visibleRegions: BodyRegion[]` (`head … feet`) +
  `body.visiblePercent` (0–100).
- **Face → richer expression + gaze.** `face.expression: FaceExpression` (smiling, teethVisible,
  laughing, mouthOpen, eyesClosed, lookingAtCamera, lookingAway, squinting, serious).
- **Face → per-component quality.** `face.quality: FaceQuality | null` (sharpness, lighting,
  occlusion, symmetry, frontalness, eyeVisibility, resolution) with a **derived** `overall`;
  `image-score.ts` derives its face score from these components (one source of truth). **19C —
  unknown vs zero:** when the face isn't visible, `face.quality` is **`null` (unavailable)**, never a
  bag of zeros — a back view has *no* face quality, not a face quality of 0%. UIs show
  "Unavailable — face not visible"; for ranking, an absent face counts as the worst face reference.
- **Hair → richer style.** `texture`, `parting`, `updo`, `bangs`, `wet`, `windBlown`.
- **Reference suitability (metadata, NOT routing).** `referenceSuitability` rates this image (0–1)
  as `hero / faceReference / bodyReference / tattooReference / hairstyleReference /
  expressionReference` + a **multi-clause `reason`** synthesized from the scores + visibility
  (19C: *"Excellent tattoo reference. Not suitable as a face reference — face not visible. Supporting
  reference only — not a Hero."*). Provider-supplied scores win over derived fallbacks. **Smart
  Reference Selection (M20) will consume this — it is not selection itself.**

## Milestone 19C — Vision Intelligence Polish (and the frozen contract)

A final correctness/clarity pass on the knowledge the Vision layer produces — **no new providers, no
routing, no schema redesign, no generation changes.** After 19C we stop expanding the metadata (a
model with 300 unused fields is a trap) and move to actually *using* it in Smart Reference Selection.

- **Unknown vs zero (the important one).** Values are now either *measured* or *unavailable* — never a
  misleading zero. Face quality is `null` when the face isn't visible (see the face-quality bullet
  above); UIs render "—" / "Unavailable (face not visible)".
- **Explainable suitability.** `referenceSuitability.reason` is a synthesized, multi-clause sentence
  so debugging is obvious (why an image is/ isn't a good face/tattoo/hair/Hero reference).
- **Single-image observations may disagree — resolved by aggregation, later.** One photo may read
  "brown hair" while most read "pink" (lighting, filters, motion blur). This is **expected** and is
  **not** fixed per-image. Identity-level **aggregation** (e.g. confidence-weighted majority vote
  across an identity's images) will reconcile conflicts into a canonical value. Tracked as a
  `TODO(19C → aggregation)` in `coverage.ts`; do not solve it in the normalizer.
- **Tattoo-region taxonomy is intentionally coarse for now.** The current regions (`left-upper-arm`,
  `upper-back`, `abdomen`, `left-thigh`, …) are good enough for coverage + selection. **Future
  refinement (not now):** finer anatomy such as `shoulder` vs `elbow` vs `forearm` vs `hand`, and
  `calf` vs `ankle`. Left as documentation until a real need appears.

### Frozen v2 contract

`IDENTITY_METADATA_VERSION = "im-2"` is now the **stable, provider-neutral knowledge schema**. Future
Vision providers (OpenAI, Qwen, Florence, …) must **normalize their observations INTO this shape** —
they do **not** get to extend it arbitrarily. Adding fields "because a provider offers them" is how a
schema grows 300 columns nobody uses. Any genuine change is a **deliberate, versioned bump (`im-3`)**
with a migration story, not a drive-by addition. This is the contract that keeps the whole Vision
layer swappable.

## Identity Coverage Engine (Milestone 18B)

The first **consumer** of the knowledge — `analyzeIdentityCoverage(metadatas) → CoverageReport`
(`coverage-engine.ts`). It answers "how well does this identity's reference set cover each aspect of
the person, and what's missing?" — the basis for **Smart Reference Selection** and **Training
Quality Gates**. Pure, deterministic, provider-neutral; validated with **mocked** metadata
(`scripts/verify-coverage.ts`, fully offline) **before any Vision API exists**.

> **Coverage measures *representation*, not *image quality*.** A dimension's stars answer "how well
> is this identity aspect represented across the reference set?" — **not** "how good are the photos?"
> Technical quality (`ImageQuality`) and per-image ranking (`image-score.ts`) are separate signals;
> coverage only uses quality as a mild gate/ramp so a blurry frame can't fake strong representation.
> A 5★ "Front face" means *we have the front face well covered*, not *this is a 5★ photo*.

### Dimensions

Face (front · left profile · right profile · back) · body (upper · full) · hair · tattoos (chest ·
back · left arm · right arm · **abdomen/hip** · leg · **neck**) · environment (indoor · outdoor).
Each maps onto normalized knowledge via a small **matcher**. Tattoo dimensions match on the
**normalized `TattooRegion`** (19A), not raw text — e.g. the leg dimension covers
`left/right-thigh`, `left/right-calf`, `feet`; the abdomen dimension covers `abdomen`, `hip`. This
is what stopped thighs/abdomen "falling through" the old string matching.

### Scoring algorithm (deterministic — rescored in 19A, engine `cov-2`)

Only **usable** images (`quality.usable`) contribute. The previous formula
(`best × 0.6 + breadth × 0.4`) *penalized single strong images*: breadth capped a lone image at
`0.33`, so a perfect frontal portrait maxed at ~3★. 19A separates the three questions — *how
strongly?*, *how sure?*, *how clean?* — and makes breadth a **bonus**, not a penalty:

1. **presence** = `matchStrength × visibilityConfidence`.
   - `matchStrength` (0..1): how strongly the image depicts the aspect (front = 1; generic `profile`
     = 0.5 to each side).
   - `visibilityConfidence`: dimension-specific — `face.confidence` for face dims, the **matched
     tattoo's** `confidence` for tattoo dims, `attributeConfidence.hairColor|framing|lightingSetting`
     (with sensible defaults) elsewhere. *This is what lets a clearly-visible aspect read 5★.*
2. **qualityFactor** = `clamp(quality.overall / 70, 0, 1)` — a **ramp**, not a hard multiplier: any
   image at technical quality ≥ 70 gets full credit; below that it scales down. (Unusable images are
   already excluded.)
3. **best** = `max over images of (presence × qualityFactor)`.
4. **score (0..1)** = `best + (1 − best) × breadthBonus`, where `breadthBonus = min(extraImages,2)/2
   × 0.25`. One excellent image already ≈ full score; extra angles only lift a *weak* best toward 1.
5. **stars (0..5)** = `round(score × 5)`, clamped to `1..5` when ≥1 image contributes, else `0`.
6. **status** = `covered` (≥3★) · `weak` (1–2★) · `missing` (0★) · `not-applicable`.
7. **confidence** = the highest visibility confidence among contributing images.

**Result:** a clearly-visible, high-quality frontal portrait now reads **Front face ★★★★★, Hair
★★★★★, Chest tattoos ★★★★★** (verified in `scripts/verify-coverage.ts`).

**Overall (0..100)** = weight-averaged `score` over *applicable* dimensions. Weights: front face 3,
full body 3, upper body 2, hair 2, profiles/back 1, each tattoo area 1 (neck 0.5), indoor/outdoor 0.5.
**Suggestions** are the missing/weak applicable dimensions, ordered by weight then fewest stars.

### Assumptions

- **Tattoo dimensions are conditional.** They're only *applicable* if the identity is observed to
  have **any** tattoo — otherwise "missing back tattoo" would be a false gap for a person with no
  tattoos. Tattoo suggestions are phrased "*(if applicable)*" since we can't tell "no reference of
  the tattoo" from "no tattoo there".
- **Left/right profile** requires the specific orientation; a generic `profile` gives half credit
  to each side (the normalizer accepts `left-profile`/`right-profile` when a provider distinguishes).
- **Only usable images count** — this is where the quality gate feeds coverage.
- The engine reasons purely from **knowledge**, so it's identical no matter which Vision provider
  produced the observations.

## Coverage vs Image Scoring — two different questions

A key architectural distinction (both are needed for intelligent reference selection):

| | Question | Level | Module |
| --- | -------- | ----- | ------ |
| **Coverage** | *What is **missing** across the reference set?* (no full body, no right profile, no back tattoo) | identity | `coverage-engine.ts` |
| **Image Scoring** | *Which **individual image** is best?* (face quality, tattoo visibility, body coverage, lighting, sharpness, expression) | per-image | `image-score.ts` |

**Image scoring** makes the identity library *self-curating*: upload many, `rankIdentityImages`
ranks them best-first, and the router later keeps/selects the strongest. `scoreIdentityImage(m) →
IdentityImageScore` (faceQuality · tattooVisibility · bodyCoverage · hairVisibility · lighting ·
sharpness · expression · **overall** · usable · reasons). Pure, deterministic, provider-neutral —
verified offline (`scripts/verify-scoring.ts`): a front/full-body/smiling/tattooed shot outranks a
blurry back-view.

Together: **Coverage answers "what's missing", Image Scoring answers "which is best"** — the
foundation for request-aware selection (choose the best refs *for this scene*).

## The first Vision provider — Gemini (Milestone 19)

`analyzeIdentity(imageUrl)` routes to a configured `VisionProvider` (`needs: attributes + quality`),
gets **observations**, `normalize`s to `IdentityMetadata`, and `score`s the image. The first adapter
is **Gemini** (`providers/gemini.ts`, `fetch`-based, `GEMINI_API_KEY`, structured-JSON extraction of
pose/expression/framing/tattoos/hair/lighting/quality — *not identification*). It's isolated like an
image provider: swapping to OpenAI / Qwen / Florence changes only that file. **The Gemini API call
is not yet live-verified** (needs a key); the deterministic normalization, scoring and coverage are
verified offline.

Rich metadata now includes **facial pose** (`face.pose` = yaw/pitch/roll), `smiling`, `eyesVisible`
— so a provider that reports only a yaw angle still yields a usable orientation (derived).

## Boundaries — Milestone 18A

**Architecture only.** No APIs, no Gemini/OpenAI/Florence/Qwen, no DB, no UI, no services. The
provider **registry is empty**; `isVisionConfigured()` is `false`. `normalize` and `coverage` are
pure and already work on any observation shape.

## Not biometric identification

Vision analysis (including face embeddings) exists to build richer Identity Packages, rank
references, and check *consistency of a user's own subject* — **never to identify strangers**.
Attributes are "visible in this photo" observations. Consent + retention are gated at build time.

## Where this sits in the roadmap

- **18A** architecture · **18B** coverage engine · **19** first provider (Gemini) + image scoring ·
  **19A** enriched metadata + coverage rescoring · **19C** polish + **frozen `im-2` contract** —
  **no routing, no schema.**
- **Next — 19B: face embeddings.** Add an identity-embedding signal (InsightFace is the current
  recommendation — see [research/RESEARCH_03_FACE_EMBEDDINGS.md](./research/RESEARCH_03_FACE_EMBEDDINGS.md))
  alongside the Vision metadata: best-hero selection, duplicate detection, and later identity-drift
  scoring. Embeddings come **before** selection so the selector has both metadata *and* measurable
  facial similarity.
- **Then — 20: Smart Reference Selection** (the first consumer of `referenceSuitability` + coverage
  + embeddings), **21** identity-description synthesis, **22** face-embedding evaluation loop, … See
  [ROADMAP.md](./ROADMAP.md) and the full stack in [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

The **first SCHEMA CHANGE** (persisting `IdentityMetadata` + `IdentityImageScore` per training
image) is deliberately deferred until the metadata model has settled — which is what 19A is for.
