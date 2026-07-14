# Provider Interface

> **Status: DESIGN (Milestone 10 — First Light).** The `ImageProvider` abstraction that keeps
> the app provider-agnostic. Hugging Face is the **only** implemented provider; others are
> documented placeholders. Related: [AI_GENERATION.md](./AI_GENERATION.md),
> [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md), [VISION.md](./VISION.md),
> [DECISIONS.md](./DECISIONS.md) (#007 provider-agnostic).

## The rule

**No code outside `src/lib/ai/providers/` may know about Hugging Face (or any provider).**
Everything else depends only on the `ImageProvider` interface. Swapping in Fal/OpenAI/
Replicate/local later = adding one file under `providers/` + a registry entry, with **zero**
changes elsewhere (Decision 007).

```
src/lib/ai/
  ImageProvider.ts        ← interface + request/result types (no SDKs)
  index.ts                ← provider registry: getImageProvider() → the active provider
  providers/
    huggingface.ts        ← IMPLEMENTED (first + only)
    fal.ts                ← placeholder (docs only, not created yet)
    openai.ts             ← placeholder
    replicate.ts          ← placeholder
    local.ts              ← placeholder
```

## The interface (design)

Intentionally tiny for First Light — just enough to generate one image. Provider-agnostic:
no HF/SDK types leak out.

```ts
// src/lib/ai/ImageProvider.ts  (design sketch)
export type ImageGenerationRequest = {
  prompt: string;
  // First Light stops here. Reserved for later (NOT implemented now):
  // width?, height?, seed?, negativePrompt?, model? — added when the UI/pipeline needs them.
};

export type ImageGenerationResult = {
  data: Buffer;         // raw image bytes (provider-neutral)
  contentType: string;  // e.g. "image/png"
  model: string;        // the model actually used (for metadata)
  provider: string;     // e.g. "huggingface"
};

export interface ImageProvider {
  readonly id: string;  // stable provider id, e.g. "huggingface"
  generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
```

- The provider returns **bytes**, never a URL. Storage is the app's job (Blob via the media
  layer) — the provider knows nothing about Blob, the DB, or the Gallery.
- Errors are thrown as a provider-neutral `ProviderError` (see below); the caller maps them
  to a failed generation + a friendly message.

## Provider registry

`getImageProvider()` returns the active `ImageProvider`. For First Light it always returns the
Hugging Face provider; later it can select by config/env. The rest of the app calls
`getImageProvider()` — never a specific provider.

## Hugging Face provider (the only implementation)

- **SDK:** `@huggingface/inference` (the current official JS SDK). Uses `InferenceClient` +
  `textToImage`. Returns image bytes; the provider converts to a `Buffer`.
- **Auth / env — `HF_TOKEN`** (Hugging Face's standard token env var; recognized by the SDK):
  - **Local:** add to `.env` / `.env.local`: `HF_TOKEN=hf_xxx`
  - **Vercel:** Settings → Environment Variables → add `HF_TOKEN` (Production + Preview) → redeploy.
  - Optional override: `HF_IMAGE_MODEL` (defaults to a fast text-to-image model, e.g.
    `black-forest-labs/FLUX.1-schnell`). If unset, the provider uses its built-in default.
- **`isProviderConfigured()`** reports whether `HF_TOKEN` is present, so the UI degrades
  gracefully (mirrors `isBlobConfigured()`).
- All HF specifics — client, model id, routing/`provider: "auto"`, response shape — live
  **only** in `huggingface.ts`.

## Errors

```ts
export class ProviderError extends Error {
  code: "MISSING_TOKEN" | "PROVIDER_UNAVAILABLE" | "GENERATION_FAILED" | "TIMEOUT";
}
```

The HF provider maps SDK failures (missing token, 503 model-loading/cold-start, network,
bad response) to these codes. The generation layer maps `ProviderError` → a `FAILED`
generation + a user-facing toast. See retry strategy in
[GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md).

## Future providers (placeholders — not implemented)

Each future provider is a single new file implementing `ImageProvider`, plus a registry
entry. Nothing else changes.

| File | Provider | Notes |
| ---- | -------- | ----- |
| `providers/fal.ts` | Fal | Fast hosted models; likely async job polling → uses the `Job` table (see pipeline). |
| `providers/openai.ts` | OpenAI Images | `gpt-image-1` / DALL·E; API key env. |
| `providers/replicate.ts` | Replicate | Prediction polling (async). |
| `providers/local.ts` | Local | ComfyUI / a local server; base URL env. |

Later capabilities (negative prompts, size, seed, model choice, **identity-aware prompting**,
video via a parallel `VideoProvider`) extend the request type; they are **out of First Light
scope** and must not be built yet.
