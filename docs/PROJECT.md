# Project Overview

> **ai-studio** — an AI-powered video/media studio web application.

## What it is

_One-paragraph description of the product. Fill in: who it's for, what problem it
solves, and the core user flow (e.g. "upload media → generate/transform with AI →
preview in a gallery → export/share")._

## Goals

- [ ] _Primary goal_
- [ ] _Secondary goal_

## Non-goals

- _Things explicitly out of scope (keeps the roadmap honest)._

## Tech stack

| Layer          | Choice                                            |
| -------------- | ------------------------------------------------- |
| Framework      | Next.js 16 (App Router, Turbopack, RSC)           |
| UI runtime     | React 19                                          |
| Language       | TypeScript 5                                      |
| Styling        | Tailwind CSS v4, `tw-animate-css`                 |
| Components     | Base UI (`@base-ui/react`) + shadcn (`base-nova`) |
| Data / ORM     | Prisma 7 + PostgreSQL                             |
| Auth           | better-auth                                       |
| File storage   | Vercel Blob (`@vercel/blob`)                       |
| Data fetching  | TanStack Query                                    |
| Forms          | react-hook-form + Zod                             |
| Animation      | Framer Motion                                     |
| Notifications  | Sonner                                            |
| AI providers   | See [AI_PROVIDERS.md](./AI_PROVIDERS.md)          |
| Runtime        | Node.js ≥ 20.19 (dev on Node 24)                  |

## Repository layout

```
src/
├── app/          # Next.js App Router (routes, layouts, pages)
├── actions/      # Server Actions
├── components/   # ui/ forms/ gallery/ upload/ shared/
├── hooks/        # React hooks
├── lib/          # ai/ auth/ blob/ db/ validations/ providers/ + utils.ts
├── services/     # Business logic / external integrations
├── store/        # Client state
├── types/        # Shared TypeScript types
└── styles/       # Global styles
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how these fit together.

## Getting started

```bash
nvm use                 # Node 24 (via .nvmrc)
npm install
cp .env.example .env     # then fill in values (see below)
npx prisma generate
npm run dev
```

### Required environment variables

| Variable       | Purpose                     |
| -------------- | --------------------------- |
| `DATABASE_URL` | PostgreSQL connection string |

_Add auth, blob, and AI provider keys here as they're introduced._

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) · [DATABASE.md](./DATABASE.md) · [API.md](./API.md)
- [AI_PROVIDERS.md](./AI_PROVIDERS.md) · [PROMPTS.md](./PROMPTS.md)
- [ROADMAP.md](./ROADMAP.md) · [TODO.md](./TODO.md) · [DECISIONS.md](./DECISIONS.md)
- [CHANGELOG.md](./CHANGELOG.md)
