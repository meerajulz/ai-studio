# Architecture Decision Log

Every time we make a decision, we write it down here.
One entry per decision, numbered in order. Append new decisions at the bottom.

**Status** is one of: `Accepted` · `Proposed` · `Superseded by Decision NNN` · `Deprecated`

---

## Template

```
# Decision NNN

Date
YYYY-MM-DD

Decision
What we decided.

Reason
Why.

Alternatives
What else we considered.

Status
Accepted
```

---

# Decision 001

Date
2026-07-09

Decision
Use Next.js App Router.

Reason
Better Server Components support.

Alternatives
Pages Router

Status
Accepted

---

# Decision 002

Date
2026-07-09

Decision
Use a `src/` directory layout — all app code under `src/`, config at the repo root.

Reason
Separates application code from project configuration; cleaner root.

Alternatives
Keep `app/`, `components/`, `lib/` at the repo root.

Status
Accepted

---

# Decision 003

Date
2026-07-09

Decision
Require Node.js ≥ 20.19 (develop on Node 24). Pinned via `.nvmrc` and `engines`.

Reason
Prisma 7 crashes on Node 18 (`ERR_REQUIRE_ESM`); the toolchain needs a modern Node.

Alternatives
Stay on Node 18; downgrade Prisma.

Status
Accepted

---

# Decision 004

Date
2026-07-09

Decision
Use Prisma + PostgreSQL for the database layer.

Reason
Type-safe queries, migrations, and a single schema shared across the app.

Alternatives
Drizzle; raw SQL; a NoSQL store.

Status
Accepted

---

# Decision 005

Date
2026-07-09

Decision
Use Better Auth for authentication.

Reason
Modern, TypeScript-first auth that integrates cleanly with the Next.js App Router.

Alternatives
NextAuth/Auth.js; Clerk; roll-your-own sessions.

Status
Accepted

---

# Decision 006

Date
2026-07-09

Decision
Use Vercel Blob for media (image/video) storage.

Reason
First-class Next.js/Vercel integration for large file uploads and serving.

Alternatives
AWS S3; Cloudflare R2; Supabase Storage.

Status
Accepted

---

# Decision 007

Date
2026-07-09

Decision
Keep AI integrations provider-agnostic behind common `ImageProvider` and
`VideoProvider` interfaces in `src/lib/ai/`.

Reason
Providers can be swapped or combined without changing the rest of the codebase.

Alternatives
Call each provider SDK directly from feature code.

Status
Accepted

---

# Decision 008

Date
2026-07-09

Decision
Build backend and architecture first; UI last
(Architecture → Database → Auth → Storage → AI → Frontend).

Reason
The product's value is the generation pipeline; a solid backend de-risks the UI work.

Alternatives
UI-first / vertical slices per feature.

Status
Accepted

---

# Decision 009

Date
2026-07-09

Decision
Keep `src/lib/utils.ts` as a file rather than a `lib/utils/` folder.

Reason
Every shadcn component imports `@/lib/utils` (the `cn()` helper); a `utils/` folder
alongside would create an ambiguous import.

Alternatives
Convert to `src/lib/utils/index.ts` (folder). Revisit if `utils` grows.

Status
Accepted
