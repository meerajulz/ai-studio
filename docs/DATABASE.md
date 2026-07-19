# Database

## Overview

- **Engine:** PostgreSQL — hosted on [Neon](https://neon.tech) (serverless)
- **ORM:** Prisma 7
- **Runtime:** driver adapter `@prisma/adapter-neon`, singleton in `src/lib/db/`
- **Deploy target:** Vercel
- **Schema:** [`prisma/schema.prisma`](../prisma/schema.prisma)
- **Config:** [`prisma.config.ts`](../prisma.config.ts) (loads `DATABASE_URL` via dotenv)
- **Generated client:** `src/generated/prisma` (gitignored)
- **Migrations:** `prisma/migrations/` — `init`, `better_auth`

## Connection

Set in `.env` (Neon connection string, `?sslmode=require`):

```
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/DBNAME?sslmode=require"
```

> **Prisma 7 note:** the URL is **not** in `schema.prisma` — the CLI/Migrate read it from
> `prisma.config.ts`, and the runtime client connects via the Neon driver adapter.
> Run `nvm use` (Node ≥ 20.19) before any Prisma command.

## Data model — implemented ✅

> **Status: implemented and migrated to Neon.** 13 models + 5 enums.
> Decisions recorded in [DECISIONS.md](./DECISIONS.md) (#011 schema, #012 client, #013 auth,
> #025–028 identities). Latest migration: `identity_manager`.

### Auth models (Better Auth core)

| Model | Purpose | Key relations |
| ----- | ------- | ------------- |
| `User` | Account owner of all resources | 1—N everything below |
| `Session` | Active login sessions | User (cascade) |
| `Account` | Credentials / provider links (password lives here) | User (cascade) |
| `Verification` | Email/token verification records | — |

### Domain models

| Model | Purpose | Key relations |
| ----- | ------- | ------------- |
| `Project` | Workspace grouping (e.g. "Summer Campaign") | User; has Identities/Uploads/Generations |
| `Identity` | A reusable, project-scoped subject (person/character/pet/product/…) | User + Project (required); `IdentityMedia`; Hero Image → `UploadedMedia`; Generations |
| `IdentityMedia` | Join: training media for an identity (position/favorite/role) | Identity + UploadedMedia (both cascade) |
| `UploadedMedia` | User-uploaded inputs / references (Vercel Blob) | User; Project (optional); training links; Vision knowledge |
| `MediaVisionKnowledge` | Persisted, provider-neutral Vision knowledge for one image (Milestone 20) — frozen `im-2` `metadata` + `score` + provider/model/version; NEVER raw provider JSON. Analyzed once; Smart Reference Selection consumes it | UploadedMedia (1:1, cascade) |
| `Generation` | A generation request (image or video) | User; Project/Identity/Template (optional) |
| `GeneratedMedia` | Output files from a Generation (Vercel Blob) | Generation (cascade) |
| `Job` | Async execution / queue state for a Generation | Generation (1:1) |
| `Template` | Reusable prompt/config preset | User; used by Generations |
| `FavoritePrompt` | Saved prompt strings | User |

### Relationships

```
User ──┬── Session, Account          (Better Auth)
       ├── Project ───────┐
       ├── Identity ──┐    │
       ├── Template   │    │
       ├── FavoritePrompt  │
       └── Generation ◄────┘   (User; optional Project / Identity / Template)
             │  │
             │  ├── Job                (1:1)
             │  └── GeneratedMedia     (1:N)
       Identity ── UploadedMedia       (reference media, Vercel Blob)
```

### Enums

- `MediaType` — `IMAGE | VIDEO`
- `GenerationStatus` / `JobStatus` — `PENDING | QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED`
- `IdentityStatus` — `DRAFT | ACTIVE | ARCHIVED` (derived from training-media completeness; ARCHIVED explicit)
- `TrainingMediaRole` — `PRIMARY | SECONDARY | VIDEO | POSE | STYLE | OTHER` (stored; no AI behavior yet)

### Design decisions (accepted)

1. Better Auth owns `User`/`Session`/`Account`/`Verification`; domain models FK `userId`.
2. `provider` / `model` stored as **strings** + `params Json` (provider-agnostic).
3. `Generation` ↔ `Job` split 1:1 (request+result vs execution/queue state).
4. `UploadedMedia` and `GeneratedMedia` kept as separate tables.
5. `cuid()` ids; per-user `onDelete: Cascade`. (Entity named `UploadedMedia`, not
   `ReferenceMedia`.)

## Runtime client

Import the shared client from the barrel — never from `@/generated/prisma` directly:

```ts
import { prisma } from "@/lib/db";
import type { User, Generation } from "@/lib/db";
```

See [`src/lib/db/README.md`](../src/lib/db/README.md) for the singleton + adapter details.

## Common commands

```bash
npx prisma generate           # regenerate client → src/generated/prisma
npx prisma migrate dev        # create + apply a migration (dev)
npx prisma migrate deploy     # apply migrations (prod)
npx prisma studio             # browse data
```

## Identity Engine (Milestone 22, migration `add_identity_engine`)

Additive, owner-scoped, cascade from `Identity`. See [IDENTITY_ENGINE.md](./IDENTITY_ENGINE.md).

- **`IdentityDataset`** (1:1 `Identity`) — persisted readiness (`readinessScore`, `rating`,
  `metrics` JSON) + curation (`datasetVersion`, `recommendedImageIds`, `rejectedImageIds`,
  `rejectionReasons`). Recomputed when the library is analyzed; never at generation time.
- **`IdentityTrainedModel`** — versioned trained models. `@@unique([identityId, engine, version])`
  → **append-only, never overwritten** (LoRA v1, v2, …). `status: TrainedModelStatus`. `datasetVersion`
  (M23, migration `add_trained_model_dataset_version`) records which curated dataset revision the model
  was trained on → drives the `OUTDATED` training state.
- **`IdentityTrainingJob`** — a training run (provider-agnostic; Fal is the eventual first backend).
- **`IdentityEvaluation`** — identity score of a generated image; all metric columns reserved
  (`face/tattoos/hair/accessories/pose/expression/lighting/composition/overallIdentityScore`), null today.
- **`IdentityArtifact`** — generic versioned identity resources (LoRAs, embeddings, adapters, vectors)
  — home for non-trainable engines (PuLID/InstantID).
- New enum **`TrainedModelStatus { DRAFT, READY, FAILED, ARCHIVED }`**.

## Conventions

- Access the client through the single instance in `src/lib/db/` (global singleton —
  avoids connection exhaustion during dev hot-reload).
- Keep Zod validation in `src/lib/validations/` aligned with the schema.
