# AI Providers

> Adapters live in `src/lib/ai/`. Keep them provider-agnostic behind a common
> interface so providers can be swapped or run side-by-side.

## Design

```
services/  ──►  lib/ai/index.ts  ──►  lib/ai/<provider>/
                (router/facade)        (concrete adapter)
```

- Callers depend on a **stable interface**, never a specific SDK.
- Secrets (API keys) stay server-side only. Never import provider SDKs into client
  components.
- Each provider reads its key from an env var (add to `.env` and document below).

## Suggested adapter interface

```ts
// src/lib/ai/types.ts
export interface GenerationRequest {
  prompt: string;
  input?: { blobUrl?: string };
  options?: Record<string, unknown>;
}

export interface GenerationResult {
  outputUrl: string;
  provider: string;
  raw?: unknown;
}

export interface AIProvider {
  readonly name: string;
  generate(req: GenerationRequest): Promise<GenerationResult>;
}
```

## Providers

| Provider | Status      | Env var(s) | Notes |
| -------- | ----------- | ---------- | ----- |
| _TBD_    | 🔴 planned  | _—_        | _—_   |

_Add a row + a subsection per provider as they're integrated._

### Anthropic (Claude) — _example, if used for prompt/text features_

- SDK: `@anthropic-ai/sdk`
- Env: `ANTHROPIC_API_KEY`
- Recommended model: latest Claude (see the API reference / `claude-api` skill).

## Related

- [PROMPTS.md](./PROMPTS.md) — prompt templates used by these providers.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — where `lib/ai/` sits in the system.
