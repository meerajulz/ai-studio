# Generation Pipeline

> **Status: DESIGN (Milestone 10 — First Light).** The end-to-end flow that turns a prompt
> into a stored, Gallery-visible image, respecting every existing layer. Related:
> [AI_GENERATION.md](./AI_GENERATION.md), [PROVIDER_INTERFACE.md](./PROVIDER_INTERFACE.md),
> [MEDIA_PIPELINE.md](./MEDIA_PIPELINE.md), [DECISIONS.md](./DECISIONS.md).

## The flow

```
Project
  ↓ (optional) Identity            ← attached for provenance only; NOT identity-aware prompting yet
Simple prompt
  ↓ Generate (Server Action, owner-scoped)
Generation layer  (src/lib/generation/)
  ├─ 1. authorize (user owns project [+ identity]); create Generation (PENDING→RUNNING)
  ├─ 2. getImageProvider().generateImage({ prompt })   ← provider returns BYTES
  ├─ 3. media layer: createGeneratedMedia(bytes)        ← Blob upload + GeneratedMedia row
  └─ 4. mark Generation SUCCEEDED (or FAILED on error)
        ↓
Media layer  →  Blob (private)  +  DB (Generation + GeneratedMedia)
        ↓
Gallery  (listProjectMedia now unions uploaded + generated → source:"generated")
```

Every arrow crosses a layer boundary that already exists — **no new media pipeline**
(Decision 024). The provider is isolated behind `ImageProvider` (Decision 007).

## Layer responsibilities (who does what)

| Layer | Responsibility | Must NOT |
| ----- | -------------- | -------- |
| **UI** (`/projects/[id]/generate`) | prompt input + Generate button + loading/error; on success invalidate the media query | know about providers, Blob, or the DB |
| **Server Action** (`actions/generation.ts`) | `requireUserId` + delegate | contain logic |
| **Generation layer** (`src/lib/generation/`) | orchestrate: authorize → Generation record → call provider → persist via media layer → status | call Blob or a provider SDK directly |
| **Provider** (`src/lib/ai/providers/huggingface.ts`) | prompt → image **bytes** | touch Blob/DB/Gallery |
| **Media layer** (`src/lib/media/`) | `createGeneratedMedia` (Blob upload + `GeneratedMedia` row + signed `MediaAsset`); union generated into `listProjectMedia`/`getMedia`/`deleteMedia` | — |
| **Blob layer** (`src/lib/blob/`) | store/sign/delete bytes | — |

The generation layer is the only new orchestrator. It depends on the provider registry + the
media layer; it **never** imports Blob or an SDK.

## Request / response flow

1. **Client** → `generateImageAction(projectId, { prompt, identityId? })`.
2. **Action** resolves `userId`, calls `generateImage(userId, projectId, input)`.
3. **Generation layer**: assert project (+ identity) ownership → create `Generation`
   (`status: RUNNING`, `provider`, `model`, `type: IMAGE`, `prompt`, `projectId`, `identityId?`).
4. Call `getImageProvider().generateImage({ prompt })` → `{ data, contentType, model, provider }`.
5. **Media layer** `createGeneratedMedia(userId, { projectId, generationId, data, contentType, … })`:
   uploads bytes to Blob under `projects/<id>/generated/<file>` (private), writes a
   `GeneratedMedia` row, returns a signed `MediaAsset` (`source: "generated"`).
6. Update `Generation.status = SUCCEEDED`. Return the `MediaAsset` (+ generation id).
7. **Client** invalidates the media query → the image appears in the Gallery on next view.

On any failure after step 3: `Generation.status = FAILED`; the error surfaces to the UI.

## Job states (First Light = synchronous)

Hugging Face text-to-image is a **single synchronous call**, so First Light tracks state on
`Generation.status` only:

```
PENDING ─▶ RUNNING ─▶ SUCCEEDED
                   └─▶ FAILED
```

The `Job` table (queue/progress/attempts/providerJobId) already exists for **async** providers
(Fal/Replicate polling) and is **deferred** — not used in First Light. This is the intended
`Generation`↔`Job` split (DATABASE #3); we simply don't need `Job` for a synchronous provider
yet. (`CANCELED`/`QUEUED` also unused for now.)

## Metadata stored

- **`Generation`** (the request + outcome): `prompt`, `provider` (`"huggingface"`), `model`,
  `params` (Json — reserved), `status`, `type: IMAGE`, `userId`, `projectId`, `identityId?`,
  timestamps.
- **`GeneratedMedia`** (the output): `type`, `blobUrl`, **`pathname`** (new — to sign),
  **`projectId`** (new — to scope to the Gallery), `mimeType`, `width`/`height`, `sizeBytes`,
  `originalFilename` (new — a friendly name), `generationId`, `userId`, `createdAt`.

## Gallery / Media / Blob integration (the key point)

Generated images **reuse the media layer** and surface through the **same Gallery** — no
second browser, uploader, or pipeline:

- **Blob**: bytes are stored via the blob layer (private) under
  `projects/<id>/generated/<file>`; served through short-lived **signed URLs** (Decision 021),
  identical to uploads.
- **Media**: `listProjectMedia` (and `getMedia` / `getMediaSignedUrl` / `deleteMedia`) **union
  `UploadedMedia` + `GeneratedMedia`**, mapping each to a `MediaAsset` with `source`
  (`"uploaded"` | `"generated"`). This makes the Gallery's already-existing **"Generated"**
  filter real (it returned empty before — Decision 024).
- **Gallery**: unchanged UI. It already renders `MediaAsset`s and has the source filter, so a
  generated image simply shows up (newest-first) after a query invalidation.

## Error handling

- Provider failures → `ProviderError` (see PROVIDER_INTERFACE.md) → generation set `FAILED`
  → friendly toast (missing token, model cold-start/unavailable, timeout, generic).
- Ownership failures throw before any provider call (owner-scoped everywhere).
- Partial failure (image made but persistence fails) → generation `FAILED`; no orphaned
  Gallery entry. A best-effort blob cleanup is attempted if the row write fails after upload.

## Retry strategy (minimal)

- **HF cold start (503 "model loading")**: the provider retries a small, bounded number of
  times with a short backoff **inside `huggingface.ts`** (this is HF-specific behavior, so it
  stays in the provider). No app-level queue.
- **Everything else**: no automatic retry in First Light — the user simply presses Generate
  again. Durable retries/attempts belong to the `Job` table + async providers later.

## Explicitly out of scope (First Light)

Identity-aware prompting, negative prompts, size/seed/model controls, prompt history,
templates, batching, the `Job` queue, video, and any second provider. Architecture is kept
ready for them; none are built.
