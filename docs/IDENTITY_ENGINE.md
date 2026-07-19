# Identity Engine (Milestone 22)

> Status: **foundation shipped** (architecture only). Reference conditioning is the only working
> module; LoRA / PuLID / InstantID / evaluation / training are designed and stubbed, not implemented.
> No regression to the current reference flow (verified by parity checks).

## Why

Benchmarking FLUX Kontext, FLUX Pro Edit, GPT Image, Gemini, Nano Banana and Seedream showed hair,
tattoos and body preserve well but **facial identity still drifts** — a limit of reference-guided
editing. The answer is not "add LoRA support". It is to make **Identity its own subsystem** with
*pluggable* conditioning methods, so we can add LoRA, PuLID, InstantID, or anything future **without
reworking the core** — and so Generation becomes just one consumer.

## Core principle

**Identity is a subsystem. Generation is only one consumer.** Generation asks:

```
Identity Engine
      ↓
"How should I condition this identity for this request?"
      ↓
ConditioningPlan  →  reference · reference+lora · reference+pulid · reference+future
```

Generation applies the plan (reference images + anchor today; +LoRA weights / +adapter embeddings
later) and **never learns the implementation**. Reference is always the baseline; trainable/adapter
modules layer on top.

```
Identity Engine
├── Reference Engine      ✅ working (wraps Smart Reference Selection)
├── LoRA Engine           🔒 architecture only (trainable)
├── PuLID Engine          🔒 placeholder (adapter, non-trainable)
├── InstantID Engine      🔒 placeholder (adapter, non-trainable)
└── Future Identity Engines
```

## Responsibilities

The Identity Engine owns: **datasets, assets, conditioning, training, evaluation, versioning.**
Generation owns none of these — it calls `planConditioning` and applies the result.

## Folder structure (`src/lib/identity-engine/`)

| Path | Responsibility |
|---|---|
| `engine.ts` | `planConditioning(req)` facade — composes enabled modules into one `ConditioningPlan` |
| `registry.ts` | `IDENTITY_MODULES` — pluggable module list (mirrors `ai/model-registry.ts`) |
| `types.ts` | `ConditioningRequest/Plan/Context/Contribution`, `EngineId`, strategies |
| `modules/IdentityModule.ts` | the NEUTRAL plugin contract every engine implements |
| `engines/reference/` | **ReferenceEngine** — wraps `src/lib/selection` (exposure → package → anchor) |
| `engines/lora/` | LoRAEngine (disabled) + training types |
| `engines/pulid/`, `engines/instantid/` | adapter placeholders (disabled) |
| `training/` | `TrainingEngine` (orchestrator) → `Trainer` (backend) → `trainers/lora-trainer` |
| `dataset/` | `assembleDataset` = metrics (reuses coverage engine) + readiness + curation |
| `evaluation/` | `IdentityEvaluator` + `IdentityEvaluation` (all metric slots reserved) |
| `artifacts/`, `assets/` | owner-scoped read-models (generic artifacts vs. composed asset view) |

The pure surface is exported from `@/lib/identity-engine`; the Prisma read-models (`assets`,
`artifacts`) are imported directly by server code.

## The five interfaces

- **`IdentityModule`** — neutral pluggable contract: `availability(ctx)` + `contribute(ctx, req)`.
  Named "Module" (not "Conditioner") so future modules aren't constrained to conditioning semantics.
  ReferenceEngine / LoRAEngine / PuLIDEngine / InstantIDEngine all implement it.
- **`IdentityEngine`** (`planConditioning`) — the facade Generation consumes.
- **`Trainer`** — provider-agnostic training backend (`startTraining/pollStatus/fetchResult/cancel`).
  First backend will be **Fal**. `LoRATrainer` is the first shape (throws `NOT_IMPLEMENTED`).
- **`TrainingEngine`** — orchestrates jobs, selects a `Trainer`, persists versioned models. No
  trainers registered in this milestone.
- **`IdentityEvaluator`** — scores a generated image vs. the identity. All metrics reserved
  (`face/tattoos/hair/accessories/pose/expression/lighting/composition/overall`), return `null` today.

## Capabilities — `getCapabilities(ctx, { model })`

So the UI never hardcodes "if a LoRA exists…", the engine reports what an identity can do **now**:

```ts
// today
{ reference: true, lora: false, pulid: false, instantid: false,
  trainingAvailable: true, recommendedStrategy: "reference" }
// after training enables the LoRA module + a READY, model-compatible adapter exists
{ reference: true, lora: true, …, recommendedStrategy: "reference+lora" }
```

A capability is `true` only when its module is **enabled AND available** for this identity (+ target
`model`, checked against a trained adapter's `modelCompatibility`). `trainingAvailable` is true when a
trainable module is registered (later also gated on readiness + a registered `Trainer`).
`recommendedStrategy` = the reference baseline plus the highest-priority usable module. Surfaced through
`getIdentityEngineOverview` → the **Models** tab renders the flags directly, so enabling LoRA later
lights up the UI with **no component change**.

## Data flow (generation)

`runImageGeneration` used to inline exposure-filter → reference-package → anchor. It now calls
`planConditioning({ identityId, directive, candidates, visualPackage, manualReferenceMediaIds,
maxReferences })` and applies `plan.referenceImages` + `plan.identityAnchor` exactly as before. Because
only the Reference module is enabled, the plan is `reference` and **output is byte-for-byte the same**
(a parity check enforces this). Debug now also shows the conditioning strategy + engines.

## Identity Dataset

Each identity owns a **Training Dataset** — not just a list of images. It knows image count, coverage,
quality, diversity, curation, and a **readiness score** (which becomes part of the Identity, persisted
in `IdentityDataset`). Computed from persisted Vision knowledge (never re-analyzed at generation time):

- **Coverage** — reuses `analyzeIdentityCoverage` (front/profile/back/body/hair/tattoo/environment).
- **Diversity/quality** — frontal & profile coverage, expression diversity, hairstyle coverage, tattoo
  visibility, lighting diversity, body visibility, sharpness/blur incidence, overall quality.
- **Duplicates** — designed (`DuplicateReport`); perceptual-hash / embedding impl deferred.
- **Readiness** — 0–100 + ★ rating + verdict ("Excellent candidate for identity training.") + gaps.
- **Curation** — recommended vs. rejected images (+ reasons); the curated `datasetVersion` a future
  trainer consumes.

## Identity Assets & Artifacts

- **Identity Assets** (composed read-model): references + hero + dataset + trained models. Trained
  models are **versioned and never overwritten** (LoRA v1, v2, …).
- **`IdentityArtifact`** (generic store): LoRAs, embeddings, adapter files, ID vectors — home for
  **non-trainable** engines (PuLID/InstantID) so the architecture supports trainable *and*
  non-trainable identity engines.

## Database (additive migration `add_identity_engine`)

`IdentityDataset` (1:1), `IdentityTrainedModel` (`@@unique(identityId, engine, version)` → append-only
versioning), `IdentityTrainingJob`, `IdentityEvaluation` (reserved metric columns), `IdentityArtifact`,
+ enum `TrainedModelStatus`. All owner-scoped, cascade from `Identity`. See `DATABASE.md`.

## Extensibility — adding an engine later

1. Add `engines/<name>/<name>-engine.ts` implementing `IdentityModule`.
2. Register it in `registry.ts` (`enabled: false` until ready).
3. If trainable, add a `Trainer` under `training/trainers/` and register it with the `TrainingEngine`;
   persist outputs as versioned `IdentityTrainedModel`s. If it needs a precomputed artifact
   (PuLID/InstantID), store it in `IdentityArtifact` and read it in `availability`.
4. **Nothing in Generation changes** — `planConditioning` composes the new module automatically.

## Constraints (held)

- No LoRA/PuLID/InstantID/ML **implemented** — architecture only.
- No provider lock-in, no hardcoded LoRA assumptions anywhere in app/generation code.
- Current Reference flow works exactly as before — **no regression** (parity-checked).

## Roadmap

M22 foundation (this) → Dataset Readiness UX polish → **LoRA training via a Fal `Trainer`** (persist
versioned models) → Identity Evaluation (InsightFace face similarity + embeddings for the rest) →
PuLID / InstantID adapters. Each step plugs in behind the interfaces above.

## Verification

`npx tsx scripts/verify-identity-engine.ts` — parity with the old inline path, `reference` strategy,
registry (only reference enabled), and dataset readiness. `tsc` + `next build` green; migration applied.
