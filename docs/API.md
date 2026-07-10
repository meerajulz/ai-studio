# API

> This app uses **Server Actions** for mutations and **Route Handlers** for HTTP
> endpoints (webhooks, uploads, streaming). Document both here.

## Conventions

- **Server Actions** (`src/actions/`) — preferred for form submissions & mutations
  invoked from React. Validate input with Zod (`src/lib/validations/`).
- **Route Handlers** (`src/app/**/route.ts`) — for webhooks, file uploads, third-party
  callbacks, and streaming responses.
- Return typed results; surface errors consistently.
- Auth: gate protected actions/handlers via better-auth session checks.

## Server Actions

| Action | File | Input (Zod) | Returns | Notes |
| ------ | ---- | ----------- | ------- | ----- |
| `listProjects` | `actions/projects.ts` | — | `Project[]` | Current user's projects, newest first |
| `createProject` | `actions/projects.ts` | `projectInputSchema` | `Project` | Scoped to `userId` |
| `updateProject` | `actions/projects.ts` | `id` + `projectInputSchema` | `Project` | Owner-only (`updateMany` where `userId`) |
| `deleteProject` | `actions/projects.ts` | `id` | `{ id }` | Owner-only (`deleteMany` where `userId`) |

> All project actions call `requireUserId()` (from the Better Auth session) and scope every
> query by `userId` — a user can only read/modify their own projects. The client consumes
> them through TanStack Query hooks in `src/hooks/use-projects.ts` (list query +
> create/update/delete mutations that invalidate `["projects"]`).

```ts
// Example — src/actions/example.ts
"use server";

import { z } from "zod";

const schema = z.object({ /* ... */ });

export async function exampleAction(input: z.infer<typeof schema>) {
  const data = schema.parse(input);
  // ...
}
```

## Route Handlers

| Method & path | File | Purpose | Auth |
| ------------- | ---- | ------- | ---- |
| _—_           | _—_  | _—_     | _—_  |

```ts
// Example — src/app/api/example/route.ts
export async function GET(request: Request) {
  return Response.json({ ok: true });
}
```

## Error handling

- _Document the standard error shape and status codes here._

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) · [DATABASE.md](./DATABASE.md) · [AI_PROVIDERS.md](./AI_PROVIDERS.md)
