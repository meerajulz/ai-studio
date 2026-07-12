# Media Pipeline

> The blueprint for everything involving images and videos. Every feature that touches
> media should fit this flow.

## The flow

```
Reference Media (a user's file)
      ↓
Validation            (MIME + size — src/lib/blob/validation.ts)
      ↓
Blob Storage          (Vercel Blob — src/lib/blob/server.ts / client.ts)
      ↓
UploadedMedia         (Prisma record — persisted in Milestone 7B)
      ↓
Project               (every asset belongs to a project + user)
      ↓
Identity              (identities built from uploaded assets)
      ↓
AI Generation         (uses uploads + identities + prompts)
      ↓
GeneratedMedia        (outputs stored back in Blob + Prisma)
      ↓
Gallery               (reads what's stored)
```

## Media is a first-class **asset**, not a "file"

Treat every uploaded image/video as an asset with rich metadata from the start, so later
features (identities, reuse across generations, search, prompt history) don't require a
redesign. An asset carries:

- **Blob location** — `url` + `pathname` (pathname is needed to delete)
- **Metadata** — `contentType`, `size`, `kind` (image/video), `width`/`height`,
  `durationSeconds` (video)
- **Original filename**
- **Project association** (`projectId`) + **owner** (`userId`)
- **Creation date**
- _(planned)_ **tags**, **AI usage history** (which generations used it)

The storage layer's `AssetMetadata` type (`src/lib/blob/types.ts`) already models this
shape; `UploadedMedia` will be extended to match when persistence lands (7B) — likely
adding `pathname`, `originalFilename`, and `durationSeconds`.

## Storage layer (`src/lib/blob/`) — implemented (7A)

| File | Responsibility |
| ---- | -------------- |
| `constants.ts` | Size limits, allowed MIME types, `BLOB_READ_WRITE_TOKEN` env name, path builder |
| `types.ts` | `MediaKind`, `StoredBlob`, `AssetMetadata`, validation result types |
| `validation.ts` | Pure MIME + size validation (`validateFile`, `assertValidFile`) |
| `errors.ts` | `StorageError` + codes (centralized error handling) |
| `server.ts` | `uploadAsset`, `deleteAsset` (Vercel Blob `put`/`del`), `isBlobConfigured()` |
| `client.ts` | `uploadAssetFromBrowser` (client upload flow — used in 7B) |
| `index.ts` | Barrel for the shared/isomorphic exports (not server/client) |

**Limits:** images ≤ 10 MB, videos ≤ 200 MB. **Types:** jpeg/png/webp/gif/avif,
mp4/webm/quicktime.

### Config — `BLOB_READ_WRITE_TOKEN` (required for real uploads)

`server.ts` reads `BLOB_READ_WRITE_TOKEN` and passes it to `@vercel/blob`; without it,
`uploadAsset`/`deleteAsset` throw `MISSING_TOKEN`. `isBlobConfigured()` reports its
presence so the UI can degrade gracefully. `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY`
(injected alongside a connected store) do **not** replace it — they only identify the
store and verify webhook signatures.

- **Vercel:** connecting a Blob store to the project normally injects
  `BLOB_READ_WRITE_TOKEN` automatically. If only `BLOB_STORE_ID` /
  `BLOB_WEBHOOK_PUBLIC_KEY` appear, add it manually: **Storage → the Blob store →
  `.env.local`/Connect tab → copy `BLOB_READ_WRITE_TOKEN`**, then paste it under
  **Settings → Environment Variables** and redeploy.
- **Local:** set it in `.env` (see `.env.example`).

Nothing calls upload/delete until the Uploads feature (7B), so the app builds and runs
without the token today; it's only needed once uploads are wired up.

## Path convention

Assets are stored under their project: `projects/<projectId>/uploads/<filename>` (with a
random suffix to avoid collisions). See `buildUploadPathname`.

## Not built yet

- **7B Upload System** — Uploads tab: drag & drop, queue, progress, retry/cancel, and
  persisting `UploadedMedia` records associated with the current project.
- **8 Gallery**, **9 Identities**, then AI generation.
