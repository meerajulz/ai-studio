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

- **`IdentityMetadata`** (per image): hair · face (orientation + confidence) · body (framing +
  visibility + pose) · tattoos (visible only) · accessories · facial hair · age range · expression
  · clothing · lighting · environment · dominant colors · detected objects · **quality** ·
  **embedding** · **face embedding** · caption · source (provider/model/analyzedAt).
- **`ImageQuality`**: sharpness · exposure · face visibility · occlusion · cropped · resolution ·
  aesthetic · **overall (0–100)** · **usable** (the reject-poor-references gate) · issues.
- **`IdentityCoverage`** (per identity): what the reference set covers + **gaps** — the basis for
  automatic Hero/reference selection.

## Identity Coverage Engine (Milestone 18B)

The first **consumer** of the knowledge — `analyzeIdentityCoverage(metadatas) → CoverageReport`
(`coverage-engine.ts`). It answers "how well does this identity's reference set cover each aspect of
the person, and what's missing?" — the basis for **Smart Reference Selection** and **Training
Quality Gates**. Pure, deterministic, provider-neutral; validated with **mocked** metadata
(`scripts/verify-coverage.ts`, fully offline) **before any Vision API exists**.

### Dimensions

Face (front · left profile · right profile · back) · body (upper · full) · hair · tattoos (chest ·
back · left arm · right arm · leg) · environment (indoor · outdoor). Each maps onto normalized
knowledge via a small **matcher** (e.g. front = `face.visible && orientation === "front"`; leg
tattoo = a tattoo whose `location` contains "leg").

### Scoring algorithm (deterministic)

Only **usable** images (`quality.usable`) contribute. For each dimension:

1. **Per-image contribution** = `matchWeight × (quality.overall/100) × faceConfidence?` — face
   dimensions are weighted by `face.confidence`; others use `1`. A generic `profile` (side unknown)
   contributes `0.5` to *both* left and right profile.
2. **score (0..1)** = `bestContribution × 0.6 + breadth × 0.4`, where `breadth = min(count, 3)/3`
   (more angles → higher). One excellent image scores well; several push toward 1.0.
3. **stars (0..5)** = `round(score × 5)`, clamped to `1..5` when ≥1 image contributes, else `0`.
4. **status** = `covered` (≥3★) · `weak` (1–2★) · `missing` (0★) · `not-applicable`.
5. **confidence** = quality of the best contributing image.

**Overall (0..100)** = weight-averaged `score` over *applicable* dimensions. Weights: front face 3,
full body 3, upper body 2, hair 2, profiles/back 1, each tattoo area 1, indoor/outdoor 0.5.
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

## Boundaries — Milestone 18A

**Architecture only.** No APIs, no Gemini/OpenAI/Florence/Qwen, no DB, no UI, no services. The
provider **registry is empty**; `isVisionConfigured()` is `false`. `normalize` and `coverage` are
pure and already work on any observation shape.

## Not biometric identification

Vision analysis (including face embeddings) exists to build richer Identity Packages, rank
references, and check *consistency of a user's own subject* — **never to identify strangers**.
Attributes are "visible in this photo" observations. Consent + retention are gated at build time.

## Next — Milestone 18B

Add **one** provider (the best per research) implementing `analyzeImage` behind this interface, and
a single `analyzeIdentity(image)` entry point. Nothing else. Then more providers slot in exactly
like image providers: `VisionProvider → Gemini → Qwen → Florence → …`.
