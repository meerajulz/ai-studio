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
