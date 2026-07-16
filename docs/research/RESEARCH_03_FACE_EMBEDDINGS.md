# Research 03 — Face Embeddings for AI Studio

> **Status:** research (feeds Milestone **19B — Face Embeddings**). Provider-neutral, like
> [PROVIDER_RESEARCH.md](../PROVIDER_RESEARCH.md) (image gen) and
> [RESEARCH_02_VISION.md](./RESEARCH_02_VISION.md) (vision). This document does **not** commit code —
> it picks a direction so implementation is confident.
> **Date:** 2026-07-16.

## What a face embedding is (and is not)

A face-embedding model does **not** recognize "Julieta" by name. It converts a face into a numeric
vector (typically 128–1024 numbers) such that **the same person's faces land close together and
different people land far apart**.

```
Original image  → embedding [0.182, -0.338, … 512 values]
Generated image → embedding [0.179, -0.334, …]
                              cosine similarity = 0.97   → identity preserved
                              (drops to ~0.62            → the face has drifted)
```

**Not biometric identification.** In AI Studio this is a *similarity signal* over a user's own
subject — ranking references, deduping uploads, and measuring identity drift in generations —
never identifying strangers. Same boundary as the rest of the Vision layer
([IDENTITY_INTELLIGENCE.md](../IDENTITY_INTELLIGENCE.md) → "Not biometric identification").

## Why AI Studio wants embeddings

We are building an **identity-preservation engine**, not a face-recognition app. Embeddings become
one more *signal* alongside Vision metadata:

- ✅ Choose the best **Hero** image (most central / representative face)
- ✅ Detect **duplicate** uploads
- ✅ Measure **identity drift** after generation (input face vs generated face)
- ✅ **Cluster** identities / group images of the same subject
- ✅ **Reject** weak references
- ✅ Later, **evaluate LoRAs** and the generation feedback loop

## Candidate comparison

| Model | Face accuracy | Speed | Ecosystem | Commercial | AI Studio fit |
| ----- | ------------- | ----- | --------- | ---------- | ------------- |
| **InsightFace** | ★★★★★ | ★★★★★ | ★★★★★ | Code MIT; **verify model-weight license** before shipping | ★★★★★ |
| ArcFace | ★★★★★ | ★★★★ | ★★★★ | Depends on implementation | ★★★★ (via InsightFace) |
| AdaFace | ★★★★☆ | ★★★★ | ★★★ | Research-dependent | ★★★★ |
| MagFace | ★★★★ | ★★★ | ★★★ | Research-dependent | ★★★ |
| ElasticFace | ★★★★ | ★★★ | ★★ | Research-dependent | ★★★ |
| FaceNet | ★★★ | ★★★★ | ★★★★★ | Generally permissive | ★★ |
| OpenCLIP | ❌ (not faces) | ★★★★ | ★★★★★ | Varies by model | ★ |
| SigLIP | ❌ (not faces) | ★★★★ | ★★★★ | Check model | ★ |
| DINOv2 | ❌ (not faces) | ★★★ | ★★★★ | Permissive | ★ |

### Notes per candidate

- **InsightFace ⭐ (recommended).** State of the art, actively maintained, very fast, ONNX runtime,
  easy deployment, ~512-dim embeddings, ~10–30 ms/image on GPU (good on CPU too). Code is MIT, but
  **model-weight licensing must be verified for commercial deployment** before shipping.
- **ArcFace.** A loss function / model *family* behind many modern systems (incl. many InsightFace
  models). Don't integrate separately — consume it **through InsightFace**.
- **AdaFace.** Strong on blurry / low-quality / occluded faces — may beat ArcFace on real-world
  photos. Smaller ecosystem.
- **MagFace.** Bakes a **quality estimate** into the embedding ("this embedding is reliable / poor")
  — appealing for a reference-quality gate. Research-grade.
- **ElasticFace.** Excellent benchmarks, mostly academic, small ecosystem.
- **FaceNet.** Historically important, now behind SOTA; only if compatibility demands it.
- **OpenCLIP / SigLIP / DINOv2.** Powerful **semantic** embeddings (person, clothes, style, tattoos,
  hair, background, retrieval, clustering) — **but not identity.** Use them elsewhere (visual search,
  style clustering), never for facial similarity.

## Which should AI Studio actually use? (production, not "most accurate")

> **InsightFace** for identity embeddings + similarity.

Evaluated against what we actually need — identity consistency, duplicate detection, clustering,
reference ranking, generated-image similarity, licensing, and future maintenance — InsightFace is
the pragmatic best-in-class choice. Keep the door open to **MagFace/AdaFace** if real-world photos
expose weaknesses on blur/occlusion or if we want embedding-level quality estimates.

### The layered recommendation (each model does ONE job)

```
Gemini      → semantic understanding + structured metadata   (never measures identity)
InsightFace → identity embeddings + similarity               (never understands tattoos)
SigLIP      → semantic image retrieval / visual search       (future)
SAM 2       → segmentation + editing                          (future)
```

Gemini never measures identity; InsightFace never understands tattoos; coverage never understands
smiles. **One job per layer** — exactly the architecture the Vision layer already follows.

## The AI Studio embedding pipeline (target)

```
Upload → Gemini Vision → metadata → coverage → image score → reference suitability
       → Face Embedding (InsightFace) → similarity DB
       → Smart Reference Selection → generation
       → (generated image) Face Embedding again → identity-drift score → learning
```

## Recommendation for the roadmap

Embeddings should land **before** Smart Reference Selection, so the selector can use both metadata
*and* measurable facial similarity from day one (more robust than bolting embeddings on afterward):

- **19A** — rich metadata + coverage rescoring *(done)*
- **19B** — face embeddings (InsightFace, pending model-license review)
- **20** — Smart Reference Selection (consumes metadata + suitability + embeddings)

## Open questions for implementation (19B)

- **Where does inference run?** InsightFace/ONNX is Python-oriented; AI Studio is Next.js/TS. Options:
  a small Python microservice, an ONNX-in-Node runtime, or a hosted inference endpoint. Decide behind
  a provider-neutral `FaceEmbeddingProvider` (mirror `ImageProvider` / `VisionProvider`).
- **Storage.** Embeddings are vectors → a `pgvector` column vs a separate store. This is the natural
  companion to the first schema change (persisting `IdentityMetadata`).
- **Licensing.** Confirm the specific InsightFace model package license for commercial use.
- **Latency & batching.** Analyzing 20–50 images per identity → reuse the async Job queue plan.
