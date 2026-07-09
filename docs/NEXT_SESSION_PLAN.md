# NEXT_SESSION_PLAN.md

# AI Studio -- Next Development Session

> **Related:** [DATABASE.md](./DATABASE.md) (schema target) ·
> [PROJECT_SPEC.md](./PROJECT_SPEC.md) · [DECISIONS.md](./DECISIONS.md) ·
> [ROADMAP.md](./ROADMAP.md) (Sprint 2 – Core Backend)
>
> **Planned for:** 2026-07-10 · Tomorrow's focus is **Step 1 — Database Design**.
> Decisions to lock and the target schema live in the linked
> ["Database design — decisions to lock"](#database-design----decisions-to-lock-first) section below and in DATABASE.md.

## Current Status

The project foundation is complete.

### Completed

-   ✅ Next.js (App Router)
-   ✅ TypeScript
-   ✅ Tailwind CSS
-   ✅ shadcn/ui
-   ✅ Prisma installed
-   ✅ Zod
-   ✅ React Hook Form
-   ✅ TanStack Query
-   ✅ Framer Motion
-   ✅ Project folder structure
-   ✅ Documentation structure

The application is now ready to move into backend architecture.

------------------------------------------------------------------------

# Development Priorities

The next goal is **not** building UI.

Instead, focus on designing the application's architecture.

Priority order:

1.  Database Design
2.  Authentication
3.  Storage
4.  Gallery
5.  AI Integration
6.  Frontend

------------------------------------------------------------------------

# Step 1 -- Database Design

Before writing any Prisma models, design the data model.

Core entities:

-   User
-   Project
-   Identity
-   ReferenceMedia
-   Generation
-   GeneratedMedia
-   Job
-   Template
-   FavoritePrompt

Relationship overview:

Project → Identities → Reference Media → Generations → Generated Results

Example:

Project "Instagram Summer"

↓

Identity

↓

Uploaded Photos

↓

Prompts

↓

Generated Images

↓

Generated Videos

Do not write migrations until the model has been reviewed.

## Database design -- decisions to lock first

Resolve these at the start of the session; they shape the schema. Record the outcome in
[DECISIONS.md](./DECISIONS.md). _(Proposed defaults in brackets.)_

1. **Entity name:** this plan says `ReferenceMedia`; the spec/DATABASE.md say
   `UploadedMedia`. **Pick one name.** _[default: `UploadedMedia`]_
2. **User ownership:** let Better Auth own `User`/`Session`/`Account`/`Verification`;
   domain models reference `userId`. _[default: yes]_
3. **Provider/model as strings + `params Json`**, not Postgres enums (stay
   provider-agnostic, Decision 007). _[default: yes]_
4. **Generation ↔ Job split:** `Generation` = request + result; `Job` = execution/queue
   state (status, progress, attempts, provider job id, error), 1:1. _[default: split]_
5. **Media split:** keep uploaded (inputs/references) and generated (outputs) as
   separate tables. _[default: separate]_

**Target relationships**

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

**First tasks:** fix the Prisma generator output path (see DATABASE.md "Known issue") →
write `schema.prisma` → `migrate dev --name init` → `prisma generate` → client singleton
in `src/lib/db/`.

------------------------------------------------------------------------

# Step 2 -- Authentication

Implement Better Auth.

Every resource in the application should belong to a user.

User

↓

Projects

↓

Identities

↓

Media

↓

Generations

------------------------------------------------------------------------

# Step 3 -- File Storage

Integrate Vercel Blob.

Upload Flow:

User uploads image

↓

Upload API

↓

Vercel Blob

↓

Receive file URL

↓

Store metadata in database

------------------------------------------------------------------------

# Step 4 -- Gallery

Once uploads work, create a gallery page that displays uploaded and
generated media.

------------------------------------------------------------------------

# Step 5 -- AI Layer

Create provider interfaces instead of tying the application to a single
AI model.

Example:

ImageProvider

-   generate()

VideoProvider

-   generate()

Future providers may include:

Images

-   OpenAI Images
-   Flux
-   Imagen
-   Ideogram

Videos

-   Veo
-   Kling
-   Runway
-   Luma
-   Pika

The rest of the application should communicate only with these
interfaces.

------------------------------------------------------------------------

# Step 6 -- Prompt Builder

Create a prompt builder that can assemble prompts from reusable options
such as:

-   Identity
-   Style
-   Camera
-   Lighting
-   Pose
-   Background
-   Quality

This keeps prompts consistent and reusable.

------------------------------------------------------------------------

# Step 7 -- Dashboard

Build the frontend after the backend is functional.

Initial dashboard modules:

-   Projects
-   Uploads
-   Gallery
-   Generations
-   Jobs
-   Settings

------------------------------------------------------------------------

# Architecture Principle

Treat the application as an AI Studio, not a simple AI generator.

Everything should belong to a Project.

Project

↓

Identities

↓

Uploads

↓

Generations

↓

Results

This makes the application scalable and keeps work organized.

Possible project examples:

-   Summer Campaign
-   YouTube Thumbnails
-   Travel Photos
-   Character Concepts
-   Experiments

------------------------------------------------------------------------

# Goals for the Next Session

1.  Design DATABASE.md
2.  Create the initial Prisma schema
3.  Configure Better Auth
4.  Create the first protected dashboard
5.  Integrate Vercel Blob
6.  Build the first gallery
7.  Prepare AI provider interfaces

These tasks will establish the complete backend foundation before
implementing AI generation features.
