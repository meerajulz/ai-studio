# AI Generation

> **Status: DESIGN (Milestone 10 — First Light).** Overview of AI generation in AI Studio.
> The goal of First Light is **not** the full AI system — it is to **prove the architecture
> with one successful image generation**, end to end. Details:
> [PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md) · [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md).
> See also [VISION.md](./VISION.md), [MEDIA_PIPELINE.md](./MEDIA_PIPELINE.md),
> [DECISIONS.md](./DECISIONS.md).

## What First Light proves

`Project → (optional Identity) → prompt → Generate → Hugging Face → Blob → DB → media layer →
Gallery`, with **one** provider, **one** page, **one** prompt input, **one** button, and the
result appearing automatically in the **existing Gallery**.

**In scope:** a single synchronous text-to-image generation via Hugging Face, stored as
`GeneratedMedia` through the media layer, visible in the Gallery (`source: "generated"`),
owner-scoped, provider isolated behind `ImageProvider`.

**Out of scope (do not build):** identity-aware prompting, prompt history, negative prompts,
model/size/seed controls, templates, batching, the async `Job` queue, video, chat, workflow
builder, and any second provider. The architecture stays *ready* for these; none are built.

## Generation lifecycle

```
User writes a prompt on /projects/[id]/generate  (optionally with an Identity selected)
      ↓
Generation created (RUNNING)  ──►  ImageProvider.generateImage(prompt)  → image BYTES
      ↓                                   (Hugging Face, isolated in src/lib/ai/providers)
Media layer stores bytes: Blob (private) + GeneratedMedia row → signed MediaAsset
      ↓
Generation SUCCEEDED   (or FAILED — friendly error, no orphan)
      ↓
Gallery shows the new image (source:"generated") after a query refresh
```

## Job states

Synchronous for First Light — tracked on `Generation.status`:
`PENDING → RUNNING → SUCCEEDED | FAILED`. The `Job` table (queue/progress/attempts) exists for
**async** providers later and is **not used** now (Generation↔Job split, DATABASE #3).

## Metadata stored

- **`Generation`** — the request + outcome: `prompt`, `provider`, `model`, `params` (reserved),
  `status`, `type: IMAGE`, owner, project, optional identity, timestamps.
- **`GeneratedMedia`** — the output: bytes' `pathname`/`blobUrl`, `projectId`, `mimeType`,
  dimensions, size, `originalFilename`, `generationId`, owner. Served via signed URLs, exactly
  like uploads.

## Integration (reuse, never duplicate)

- **Blob** only through the blob layer (private store + signed URLs, Decision 021).
- **Media** only through the media layer — a new `createGeneratedMedia`, and
  `listProjectMedia`/`getMedia`/`deleteMedia` **union uploaded + generated**. This is the one
  substantive architectural change and makes the Gallery's `source:"generated"` filter real
  (see GENERATION_PIPELINE.md + Decision to be recorded).
- **Identity** only through the identity layer (ownership check when an identity is attached).
- **Gallery** unchanged — generated media is just a `MediaAsset`.

## Error handling & retry

- Provider errors → provider-neutral `ProviderError` → generation `FAILED` + friendly toast.
- HF cold-start (503) → small bounded retry **inside the HF provider** only. No app-level
  queue in First Light; the user can press Generate again. Durable retries come with `Job` +
  async providers.

## Provider configuration

Hugging Face via the current official SDK (`@huggingface/inference`). Token env var:
**`HF_TOKEN`** (+ optional `HF_IMAGE_MODEL`). Exact `.env` / Vercel steps in
[PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md).

## Future expansion

- More providers (Fal, OpenAI, Replicate, local) = one file each under `src/lib/ai/providers/`
  + a registry entry; nothing else changes (Decision 007).
- Async providers → activate the `Job` table (queue, progress, attempts, providerJobId).
- Richer requests (identity-aware prompts, negative prompts, size/seed/model) extend the
  `ImageGenerationRequest`.
- Video via a parallel `VideoProvider`, flowing through the same media layer + Gallery
  (`GeneratedMedia.type = VIDEO`).
- Multi-identity outputs via the future `GenerationIdentity` join (Decision 026).
