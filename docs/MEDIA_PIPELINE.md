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

## Media layer (`src/lib/media/`) — the single public media API (7B, refined in 8)

The application-level boundary for media. **All feature code (Server Actions, the upload
route, components, hooks) depends on this, never on `src/lib/blob/*` directly** (Decisions
022 + 024). The blob layer knows how to store/sign/delete bytes; the media layer knows what
an *asset* is, who owns it, how it's persisted + queried, and how a stored asset becomes a
signed, renderable URL. The UI contract is a **source-tagged `MediaAsset`**
(`source: "uploaded" | "generated"`) so one browser handles everything.

| File | Responsibility |
| ---- | -------------- |
| `types.ts` | `MediaAsset` (UI contract, signed `url`, `source`), list/filter/pagination types, `PersistUploadInput`, `MediaDimensions` |
| `server.ts` | Owner-scoped API: `createMedia`, `listProjectMedia` (kind/source/sort/search + cursor pagination), `getMedia`, `getMediaSignedUrl`, `updateMediaMetadata`, `deleteMedia`, `handleProjectUpload` |
| `client.ts` | `uploadProjectMedia` — browser upload (wraps the blob client) + best-effort width/height/duration probing |
| `index.ts` | Barrel for shared types only (import `server`/`client` directly) |

Planned but not built (no consumer yet): `move()`, `duplicate()`, `generateThumbnail()`,
`refreshSignedUrls()` (bulk). Add when a feature needs them — don't over-engineer.

### Upload flow (browser → private store → DB)

```
UploadDropzone → useUploadManager (queue, p-limit=3, progress/cancel/retry)
      ↓  uploadProjectMedia (probe dimensions, build project path)
@vercel/blob client upload ──► POST /api/uploads  (handleProjectUpload → onBeforeGenerateToken)
      │                              └─ auth + assertProjectOwnership + lock path/types/size → scoped token
      ↓  bytes go straight to Blob (private)
createMediaAction ──► createMedia  (re-validate ownership + path + MIME + size → UploadedMedia row)
      ↓
useProjectMedia (TanStack Query) ──► listProjectMedia → fresh signed URL per asset → MediaCard
```

Metadata is persisted by the explicit `createMediaAction` **after** the upload, not by the
Blob `onUploadCompleted` webhook (which can't reach localhost) — Decision 023.

### Browse flow (Gallery / Uploads grid)

```
GalleryView / UploadsView
      ↓ filters (kind/source/sort/search)
useProjectMedia (useInfiniteQuery, cursor pagination)
      ↓ listMediaAction → listProjectMedia (owner-scoped) → fresh signed URLs
MediaFiltersBar · MediaGrid (infinite scroll) · MediaCard · MediaViewer · DeleteMediaDialog
```

The **Project Gallery** (`/projects/[id]/gallery`) is source-agnostic: `source: "generated"`
is a real filter today (returns empty), so AI outputs will appear in the same grid/filters/
viewer with no UI change. Verified end-to-end against the live private store + DB via
`scripts/verify-media.ts` (persist → sign → filter/sort/search/paginate → get/rename/refresh
→ owner authorization → delete).

## Path convention

Assets are stored under their project: `projects/<projectId>/uploads/<filename>` (with a
random suffix to avoid collisions). See `buildUploadPathname`.

## Not built yet

- **9 Identities** — reference media per identity; must reuse the media layer + Gallery
  components (`MediaCard`/`MediaGrid`), not a new browser.
- Then AI generation: `GeneratedMedia` outputs flow back through this same pipeline and
  surface as `MediaAsset { source: "generated" }` in the existing Gallery. Uploads/media stay
  decoupled from AI — an upload is just one source of media.
- **Deferred:** a global (cross-project) media browser — see NAVIGATION.md (`/uploads` +
  `/gallery` are temporary placeholders).
