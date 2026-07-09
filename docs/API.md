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
| _—_    | _—_  | _—_         | _—_     | _—_   |

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
