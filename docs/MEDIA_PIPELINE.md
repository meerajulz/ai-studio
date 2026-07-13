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

The storage layer's `AssetMetadata` type (`src/lib/blob/types.ts`) models this shape;
`UploadedMedia` was extended to match when persistence landed (7B) — it now stores
`pathname` (to sign/delete), `originalFilename`, `width`/`height`, `durationSeconds`,
`sizeBytes`, and `updatedAt`.

## Storage layer (`src/lib/blob/`) — implemented (7A)

| File | Responsibility |
| ---- | -------------- |
| `constants.ts` | Size limits, allowed MIME types, `BLOB_READ_WRITE_TOKEN` env name, path builder |
| `types.ts` | `MediaKind`, `StoredBlob`, `AssetMetadata`, validation result types |
| `validation.ts` | Pure MIME + size validation (`validateFile`, `assertValidFile`) |
| `errors.ts` | `StorageError` + codes (centralized error handling) |
| `server.ts` | `uploadAsset`, `deleteAsset`, `getSignedUrl`, `isBlobConfigured()` |
| `client.ts` | `uploadAssetFromBrowser` (client upload flow — used in 7B) |
| `index.ts` | Barrel for the shared/isomorphic exports (not server/client) |

**Limits:** images ≤ 10 MB, videos ≤ 200 MB. **Types:** jpeg/png/webp/gif/avif,
mp4/webm/quicktime.

### Access model — **private** store + signed URLs

The `ai-studio-media` store is **private** (Decision 021): uploads use `access: "private"`,
so an asset's raw blob URL is **not** publicly reachable (returns `403`). To display media,
call `getSignedUrl(pathname)` — it mints a short-lived (default 1h) signed URL via Vercel
Blob's `issueSignedToken` → `presignUrl` flow. So the pipeline stores each asset's
`pathname` and signs a fresh URL when the Gallery/Identities render it, rather than caching
a permanent public URL. Verified end-to-end against the live store (upload → 403 on raw URL
→ signed URL serves → delete → 404).

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

## Media layer (`src/lib/media/`) — implemented (7B)

The application-level boundary for media. **Feature code (Server Actions, the upload route,
components, hooks) depends on this, not on `src/lib/blob/*` directly** (Decision 022). The
blob layer knows how to store/sign/delete bytes; the media layer knows what an *asset* is,
who owns it, how it's persisted, and how a stored asset becomes a signed, renderable URL.

| File | Responsibility |
| ---- | -------------- |
| `types.ts` | `UploadedAsset` (UI contract, signed `url`), `PersistUploadInput`, `MediaDimensions` |
| `server.ts` | `persistUpload`, `listProjectUploads`, `deleteUpload` (all owner-scoped) + `handleProjectUpload` (client-token issuance with ownership check) |
| `client.ts` | `uploadProjectMedia` — browser upload (wraps the blob client) + best-effort width/height/duration probing |
| `index.ts` | Barrel for shared types only (import `server`/`client` directly) |

### Upload flow (browser → private store → DB)

```
UploadDropzone → useUploadManager (queue, p-limit=3, progress/cancel/retry)
      ↓  uploadProjectMedia (probe dimensions, build project path)
@vercel/blob client upload ──► POST /api/uploads  (handleProjectUpload → onBeforeGenerateToken)
      │                              └─ auth + assertProjectOwnership + lock path/types/size → scoped token
      ↓  bytes go straight to Blob (private)
createUpload Server Action ──► persistUpload  (re-validate ownership + path + MIME + size → UploadedMedia row)
      ↓
useUploads (TanStack Query) ──► listProjectUploads → fresh signed URL per asset → UploadedMediaCard
```

Metadata is persisted by the explicit `createUpload` action **after** the upload, not by the
Blob `onUploadCompleted` webhook (which can't reach localhost) — Decision 023. Verified
end-to-end against the live private store + DB via `scripts/verify-uploads.ts`.

## Path convention

Assets are stored under their project: `projects/<projectId>/uploads/<filename>` (with a
random suffix to avoid collisions). See `buildUploadPathname`.

## Not built yet

- **8 Gallery** — a project-wide (and later app-wide) view of stored media; will promote the
  minimal upload tile into a reusable `MediaCard`.
- **9 Identities**, then AI generation (`GeneratedMedia` outputs flow back through this same
  pipeline). Uploads stay decoupled from AI — an upload is just media.
