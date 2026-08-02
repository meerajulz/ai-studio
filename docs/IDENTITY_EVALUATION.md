# Identity Evaluation Engine (Milestone 26)

> **Status:** Phase 2 SHIPPED (Decision 068) — ONE real provider wired (AuraFace, embed path) behind the
> unchanged interface; the pipeline returns a live face-similarity score with confidence + per-anchor +
> timing + cache hit/miss. Next: provider benchmark (AuraFace vs Rekognition vs Azure) + `evaluatorRoleScorer`
> (Phase 2b) → M27 routing.

## Why — the feedback loop

Generation and evaluation are two halves of one system:

```
generation:  Character → Identity Package → Transformation → Provider → Image
evaluation:  Image → Identity Evaluation → {Face, Tattoo, Body, Hair} evaluators → Identity Score
```

The generation side BUILDS identity; the evaluation side MEASURES how well it was preserved. That measured
score is what lets M27 route by data and M28 auto-promote safely. M26 is where AI Studio gains its feedback
loop — not "the face-embedding milestone."

## Principles (locked with the user)

1. **Provider-neutral + capability-based.** The engine consumes only normalized `{score, confidence,
   details}` — never embeddings, never a provider name. A provider declares what it can do:
   ```ts
   interface FaceSimilarityProvider {
     embed?(image): Embedding      // cacheable path (self-hosted InsightFace/AuraFace)
     compare?(a, b): number        // score path (AWS Rekognition / Azure Face / Face++)
   }
   ```
   This models the real 2026 ecosystem instead of forcing everything into embeddings.
2. **Every evaluator is the same.** `FaceEvaluator` is just the first; `Tattoo/Body/Hair/Pose` follow the
   identical shape and register-disabled today. The engine only aggregates.
3. **Evaluate against the Identity Package's semantic anchors** (Face + Canonical), not arbitrary top-N —
   the anchors represent the character; the score is the aggregate of the strongest anchor matches.
4. **Cache aggressively, keyed by version** (embed path): each image embedded once (`MediaEmbedding`),
   invalidated by a provider `version` bump. `compare` providers skip the cache (they return a score).
5. **Validate before optimizing.** AuraFace/ArcFace is still SOTA in 2026 (99.86% LFW, not superseded), so
   it's the leading candidate — but no provider is committed until the abstraction is proven, and providers
   themselves will be benchmarked (see below).

## Architecture (`src/lib/identity-engine/evaluation/`)

```
providers/   FaceSimilarityProvider (embed? | compare?)  ── router ──▶ (registry EMPTY — provider TBD)
cache.ts     getOrComputeEmbedding → MediaEmbedding (versioned; embed path only)
evaluators/  faceEvaluator (enabled) · tattoo/body/hair/pose (registered, disabled) + registry
cosine.ts    pure cosine + toSimilarity
engine.ts    evaluateGeneration() → package anchors → run evaluators → composeEvaluation() → IdentityEvaluation
```

- **`faceEvaluator`** prefers the `embed` path (cache → cosine vs each anchor), falls back to `compare`
  (direct score per anchor), aggregates the top-3, and reports `confidence` = anchor coverage. `null` when
  no face / no provider.
- **`evaluateGeneration`** builds anchors from `getCharacterPackage` (Face + Canonical; falls back to the
  strongest analyzed faces), runs enabled evaluators, and persists `IdentityEvaluation` (scores) +
  `metrics` (per-dimension score/confidence/per-anchor breakdown). Degrades cleanly to `not-configured`.

## Choosing the provider (Phase 2)

Two shapes, both fit the interface — so we can A/B them like generation models (an **Evaluation Benchmark**:
AuraFace vs AWS Rekognition vs Azure Face over the same generated images):

| Path | Examples | Infra | Caching |
| --- | --- | --- | --- |
| `embed` | AuraFace (HF endpoint), self-hosted InsightFace | endpoint/service | ✅ (vectors cached) |
| `compare` | AWS Rekognition, Azure Face, Face++ | none | ❌ (re-sends both images) |

Leading candidate: **AuraFace on a hosted endpoint** (embed path — SOTA accuracy, commercial license, fits
caching). Not yet wired.

## Storage

`MediaEmbedding` (Neon, migration `add_media_embedding`): `mediaId` (plain id — uploaded OR generated),
`source`, `kind` ("face"), `provider`, `version`, `vector` (JSON float[]), `dim`, `userId`.
`@@unique(mediaId, kind, version)`. Cosine in JS; **pgvector deferred** until ANN/clustering is needed.

## The AuraFace provider (Phase 2 — host-neutral)

`providers/auraface.ts` is the first concrete `FaceSimilarityProvider` (embed path). It knows ONLY the
interface + a generic HTTP contract — **not Hugging Face**. The hosted endpoint is pure config, so if
AuraFace later moves to Fal / Replicate / AWS / self-hosted you change env (or, at most, this one file) and
nothing else. Deploy AuraFace/InsightFace behind this contract:

```
POST {FACE_EMBED_ENDPOINT_URL}
  Authorization: Bearer {FACE_EMBED_API_KEY}
  Content-Type: application/json
  { "image": "<signed image url>" }
→ 200 { "embedding": number[] }   // 512-d face vector
→ 200 { "embedding": null }       // no face (not an error)
```
(bare `[...]`, `{vector:[...]}`, `[{embedding:[...]}]` are also parsed defensively.)

## Config

- `FACE_EMBED_ENDPOINT_URL` + `FACE_EMBED_API_KEY` — the AuraFace endpoint (any host). `FACE_EMBED_VERSION`
  overrides the cache-key version (default `auraface-v1`).
- `FACE_SIMILARITY_PROVIDER` forces a specific provider once more than one is registered.
- Nothing configured → evaluation returns `not-configured`; a runtime endpoint failure → `provider-error`;
  both degrade gracefully and everything else keeps working.

## Verification

`scripts/verify-evaluation.ts` (offline, mock providers): cosine, face evaluator over BOTH capabilities
(embed + compare), uniform `{score, confidence, details}`, role-labeled anchors, engine composition,
disabled dims null, version-as-cache-key. Live scoring waits on a Phase-2 provider.
