# PROJECT_SPEC.md

# AI Studio -- Project Specification

## Vision

Build a modern AI Studio for personal use that manages identity-based AI
image and video generation through a clean, scalable architecture.

The application should be provider-agnostic so AI models can be replaced
or combined without changing the rest of the codebase.

## Current Foundation

Completed: - Next.js (App Router) - TypeScript - Tailwind CSS -
shadcn/ui - Prisma - Zod - React Hook Form - TanStack Query - Framer
Motion - Folder structure - docs/ directory - Database (Prisma 7 +
Neon PostgreSQL: schema, `init` migration) - Prisma runtime client
(`src/lib/db/`, singleton, `@prisma/adapter-neon`, verified vs Neon) -
Authentication (Better Auth email/password via Prisma adapter, verified) -
Auth flow UI (login/register/temp dashboard: shadcn Form + RHF + Zod,
server-side route guards; unstyled, verification-only) - Protected
Application Shell (AppShell + Sidebar/Header/Breadcrumb, shared UI
components) - Project Management (`/projects` CRUD via owner-scoped Server
Actions + TanStack Query; `/projects/[id]` workspace shell)

## Development Philosophy

Build the backend and architecture before focusing on UI.

Priority: 1. Architecture 2. Database 3. Authentication 4. Storage 5. AI
integrations 6. Frontend

## Roadmap

### Version 0.1

-   Authentication ✅
-   Upload images
-   Gallery
-   Prompt editor
-   Image generation
-   Generation history

### Version 0.2

-   Video generation
-   Multiple AI providers
-   Identity profiles
-   Background jobs
-   Notifications

### Version 0.3

-   Projects
-   Templates
-   Batch generation
-   Favorites
-   Advanced prompt controls
-   Settings

## Database Planning

Primary entities: - User - Project - Identity - UploadedMedia -
Generation - GeneratedMedia - Template - Job - FavoritePrompt

## AI Provider Strategy

Image providers: - OpenAI Images - Flux - Imagen - Ideogram

Video providers: - Veo - Kling - Runway - Luma - Pika

Implement every provider behind common interfaces: - ImageProvider -
VideoProvider

## Architecture Flow

User → Upload media → Cloud storage → Validation → Generation queue → AI
provider → Save metadata → Store generated media → Gallery

## Planned API

-   POST /api/auth/\*
-   POST /api/upload
-   POST /api/generate/image
-   POST /api/generate/video
-   GET /api/gallery
-   GET/POST /api/projects
-   GET/POST/PATCH /api/identities
-   GET /api/jobs

## Folder Structure

src/ - app/ - actions/ - components/ - hooks/ - lib/ - services/ -
store/ - styles/ - types/

lib/ - ai/ - auth/ - blob/ - db/ - providers/ - utils/ - validations/

## Coding Standards

-   Use TypeScript everywhere.
-   Avoid any.
-   Validate APIs with Zod.
-   Use Prisma.
-   Use environment variables.
-   Separate business logic from UI.
-   Keep AI integrations behind provider interfaces.

## Build Order

1.  Foundation ✅
2.  Finalize architecture ✅
3.  Database design ✅
4.  Authentication ✅
5.  File uploads ← next
6.  Blob storage
7.  Gallery
8.  Job queue
9.  AI providers
10. Image generation
11. Video generation
12. Polish UI/UX

## Long-Term Goal

Build a complete AI Studio with Dashboard, Projects, Identities, Images,
Videos, Templates, AI Models, Uploads, Jobs, Gallery, Settings, and
Account management.
