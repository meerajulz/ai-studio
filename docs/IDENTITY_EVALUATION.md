# Identity Evaluation Engine (Milestone 26)

> **Status:** Phase 1 SHIPPED (Decision 067) — face drift + backbone. Phase 2 (`evaluatorRoleScorer` feeds
> selection) and Phase 3 (routing/auto-promote inputs) follow.

## Why

M25.2 lets us SELECT and TRANSMIT identity well. M26 MEASURES how well a generation preserved it, so routing
(M27) and auto-promote (M28) can be driven by **measured data**, not assertion. "Did the face drift?" becomes a
number.

## Principles (locked with the user)

1. **Provider-neutral.** The engine knows nothing about InsightFace/ArcFace/Replicate/Fal — only embedding
   vectors + similarity. Swap the backend (Fal / self-hosted / a future model) with zero engine change, exactly
   like `ImageProvider` / `VisionProvider`.
2. **Cache aggressively, keyed by version.** Every image's embedding is computed ONCE and cached in Neon
   (`MediaEmbedding`), keyed by an evaluator **version** (`arcface-v1`). A version bump = cache miss =
   automatic recompute; scores from different models never mix. Reference faces are embedded once and reused
   across every generation + benchmark — only NEW generated images cost a call.
3. **An Identity Evaluation ENGINE, not a face evaluator.** `face` is the first pluggable module; `tattoo` /
   `body` / `hair` / `pose` are registered-but-disabled and light up with no redesign.
4. **Hosted now.** Optimize for dev speed + clean architecture; a Python microservice only makes sense at
   very high volume.

## Architecture (`src/lib/identity-engine/evaluation/`)

```
providers/   EmbeddingProvider (neutral)  ── router ──▶ replicate-arcface (concrete, env-gated)
cache.ts     getOrComputeEmbedding → MediaEmbedding (versioned JSON vector; cosine in JS, no pgvector yet)
evaluators/  faceEvaluator (enabled) · tattoo/body/hair/pose (registered, disabled)  + registry
cosine.ts    pure cosine + toSimilarity
engine.ts    evaluateGeneration() → runs enabled evaluators → composeEvaluation() → IdentityEvaluation
```

- **`EmbeddingProvider`** = `{ id, model, version, isConfigured(), embedFace(url): FaceEmbedding | null }`
  (`null` = no face). `replicate-arcface` isolates all Replicate specifics (predictions create+poll). Exact
  model version is env-driven (`REPLICATE_FACE_EMBED_MODEL`) and **verified at first live run**.
- **`faceEvaluator`** embeds the generated face, compares against the identity's strongest reference faces
  (top-5 by anchor score, cached), and reports the mean of the top-3 matches (0..1). `null` on no-face.
- **`evaluateGeneration(userId, generationId)`** persists `IdentityEvaluation` (`face`,
  `overallIdentityScore`, `method` = provider version). Degrades cleanly: no identity / no key / no face → a
  reserved-metrics row with an explanatory `method`, never a user-facing throw.

## Triggers (non-blocking)

- **Generate:** `evaluateGenerationAction` is called client-side AFTER the image is shown → the "Identity
  Evaluation" panel shows a face-match %. Never adds latency to generation.
- **Benchmark:** each cell auto-scores (`runBenchmarkCell` → `evaluateGeneration`); the grid shows a per-model
  `👤 identity NN%` so models are ranked by MEASURED identity preservation.

## Storage

`MediaEmbedding` (Neon): `mediaId` (plain id — uploaded OR generated), `source`, `kind` ("face"), `provider`,
`model`, `version`, `vector` (JSON float[]), `dim`, `userId`. `@@unique(mediaId, kind, version)`. Vectors are
JSON + cosine in JS over the small per-identity set — **pgvector is deferred** until ANN/clustering over many
vectors is needed (Phase 2+). Requires migration `add_media_embedding`.

## Config

- `REPLICATE_API_TOKEN` + `REPLICATE_FACE_EMBED_MODEL` (version hash). `EMBEDDING_PROVIDER` forces a provider.
- No key → evaluation returns `method: "not-configured"` and the UI says so; everything else keeps working.

## Verification

`scripts/verify-evaluation.ts` (offline, mock provider): cosine, face evaluator (preserved vs drifted, no-face),
engine composition, disabled dims stay null, version-as-cache-key. Live face scoring is user-driven (needs the
token + per-call cost).
