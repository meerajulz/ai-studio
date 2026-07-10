# Database Layer

This folder contains the application's database access layer.

## Current

- **Prisma 7** — ORM and schema (`prisma/schema.prisma`)
- **Neon** — serverless PostgreSQL host
- **Singleton client** — one shared `PrismaClient`, safe across Next.js hot-reload
- **Driver adapter** — `@prisma/adapter-neon` (Prisma 7 connects via an adapter, not a
  `datasource.url`)

## Files

| File        | Responsibility                                               |
| ----------- | ------------------------------------------------------------ |
| `client.ts` | Creates the Prisma client (Neon adapter) + dev singleton.    |
| `index.ts`  | Public barrel — import `prisma` and model/enum types here.   |
| `README.md` | This file.                                                   |

## Usage

Always import from the barrel, never from `@/generated/prisma` directly:

```ts
import { prisma } from "@/lib/db";
import type { User, Generation } from "@/lib/db";
import { Prisma } from "@/lib/db"; // enums, input types, GenerationStatus, ...

const count = await prisma.generation.count();
```

## Why a singleton?

In development, Next.js hot-reload re-imports modules on every change. Without a
singleton, each reload creates a new `PrismaClient` (and a new connection pool),
quickly exhausting the database's connection limit. We stash the instance on
`globalThis` in non-production so reloads reuse it.

## Why the driver adapter?

Prisma 7 removed `url = env(...)` from `schema.prisma`. The CLI/Migrate reads the URL
from `prisma.config.ts`; the **runtime** client must be given a driver adapter (or
Accelerate). We use `@prisma/adapter-neon`, which talks to Neon over its serverless
driver — a good fit for Vercel.

## Future

- **Repositories** — per-entity data-access modules (e.g. `repositories/generation.ts`)
  re-exported from `index.ts`. Keeps queries out of route handlers/actions.
- **Transactions** — helpers around `prisma.$transaction`.
- **Raw SQL** — typed raw queries for the few cases the ORM can't express well.
- **Query helpers** — shared pagination, soft-delete, and ownership (userId) filters.

> Add new pieces here and export them from `index.ts` so callers keep importing from
> `@/lib/db`.
