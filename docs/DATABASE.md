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

## Conventions

- Access the client through the single instance in `src/lib/db/` (global singleton —
  avoids connection exhaustion during dev hot-reload).
- Keep Zod validation in `src/lib/validations/` aligned with the schema.
