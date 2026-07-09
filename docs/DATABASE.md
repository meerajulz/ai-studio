# Database

## Overview

- **Engine:** PostgreSQL
- **ORM:** Prisma 7
- **Schema:** [`prisma/schema.prisma`](../prisma/schema.prisma)
- **Config:** [`prisma.config.ts`](../prisma.config.ts) (loads `DATABASE_URL` via dotenv)
- **Migrations:** `prisma/migrations/`

## Connection

Set in `.env`:

```
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

> Need a database fast? `npx create-db` provisions a free hosted Postgres.

## ⚠️ Known issue — generator output path

`schema.prisma` currently generates the client to `../app/generated/prisma`, but the
`app/` directory was moved to `src/app/` during the `src/` migration. Update the
generator block so the path resolves correctly (recommended: generate outside the
route tree, e.g. `../src/lib/db/generated` or `../src/generated/prisma`):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/lib/db/generated"   // was: ../app/generated/prisma
}
```

Then regenerate and update imports accordingly:

```bash
npx prisma generate
```

## Data model

> **Status: design in progress.** To be finalized in the next session —
> see [NEXT_SESSION_PLAN.md](./NEXT_SESSION_PLAN.md) (Step 1 — Database Design) for the
> decisions to lock and the task checklist. No migrations until the model is reviewed.

### Planned entities (from [PROJECT_SPEC.md](./PROJECT_SPEC.md))

| Model | Purpose | Key relations |
| ----- | ------- | ------------- |
| `User` | Owner of all resources (managed by Better Auth) | 1—N everything below |
| `Project` | Workspace grouping (e.g. "Summer Campaign") | User; has Generations |
| `Identity` | A reusable identity/face/style | User; has UploadedMedia; used by Generations |
| `UploadedMedia` | User-uploaded inputs / references (Vercel Blob) | User; Identity/Project (optional) |
| `Generation` | A generation request (image or video) | User; Project/Identity/Template (optional) |
| `GeneratedMedia` | Output files from a Generation (Vercel Blob) | Generation |
| `Job` | Async execution / queue state for a Generation | Generation (1:1) |
| `Template` | Reusable prompt/config preset | User; used by Generations |
| `FavoritePrompt` | Saved prompt strings | User |

> ⚠️ Naming: the spec/here use `UploadedMedia`; NEXT_SESSION_PLAN.md uses
> `ReferenceMedia`. **Pick one** before writing the schema.

### Target relationships

```
User ──┬── Project ───────┐
       ├── Identity ──┐    │
       ├── Template   │    │
       ├── FavoritePrompt  │
       └── Generation ◄────┘   (User; optional Project / Identity / Template)
             │  │
             │  ├── Job                (1:1)
             │  └── GeneratedMedia     (1:N)
       Identity ── UploadedMedia       (reference media, Vercel Blob)
```

**Likely enums:** `MediaType` (IMAGE | VIDEO); `GenerationStatus` / `JobStatus`
(PENDING | QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED).

### Design decisions to lock (defaults proposed)

1. Better Auth owns `User`/`Session`/`Account`/`Verification`; domain models FK `userId`.
2. `provider` / `model` stored as **strings** + `params Json` (provider-agnostic).
3. `Generation` ↔ `Job` split 1:1 (request+result vs execution/queue state).
4. `UploadedMedia` and `GeneratedMedia` kept as separate tables.

_Document each model in detail here as it's implemented:_

```prisma
// model Example {
//   id        String   @id @default(cuid())
//   createdAt DateTime @default(now())
// }
```

## Common commands

```bash
npx prisma generate           # regenerate client
npx prisma migrate dev        # create + apply a migration (dev)
npx prisma migrate deploy     # apply migrations (prod)
npx prisma studio             # browse data
```

## Conventions

- Access the client through a single instance in `src/lib/db/` (avoid multiple
  Prisma clients in dev — use a global singleton).
- Keep Zod validation in `src/lib/validations/` aligned with the schema.
