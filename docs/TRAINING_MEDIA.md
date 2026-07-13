# Training Media

> **Status: DESIGN ONLY (Milestone 9 — Identity System Design).** No code, schema, UI, or
> routes below are implemented. This is the design the Identity Manager will follow.
> Related: [IDENTITIES.md](./IDENTITIES.md), [MEDIA_PIPELINE.md](./MEDIA_PIPELINE.md),
> [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md), [DECISIONS.md](./DECISIONS.md) (#025).

---

## Why "Training Media", not "Reference Images"

We deliberately name this concept **Training Media** rather than "reference images":

- **Not only images.** From day one it supports **images *and* videos** — the whole studio is
  built toward AI *video* generation, and video is a first-class media kind through the entire
  pipeline (see [MEDIA_PIPELINE.md](./MEDIA_PIPELINE.md)). "Reference images" would bake in an
  images-only assumption we'd have to unlearn.
- **Not only "reference".** The same curated media serves multiple future purposes: passive
  *reference* (IP-adapter/conditioning), active *training* (LoRA/fine-tune), *pose/structure*
  conditioning (ControlNet), and *masking/segmentation*. "Training Media" is the umbrella; the
  specific *role* an asset plays is metadata on the link, not the name of the thing.
- **A link, not a new asset type.** Training Media is not a new place to store files. It is a
  **curated selection of existing `MediaAsset`s** (the same media the Gallery shows) attached
  to an Identity. Nothing is copied; the media layer stays the single source (Decision 024).

So: **Training Media = the set of media (images + videos) a user curates to represent and
(later) train an Identity.**

## Images and videos, from day one

Every part of this design treats video as first-class alongside images:

- Selection, removal, ordering, favoriting, tagging, and ranking all apply equally to images
  and videos.
- The existing `MediaAsset` already carries `type: "IMAGE" | "VIDEO"`, dimensions, and
  `durationSeconds`, so a video training asset needs no new media shape — only the link.
- The Training Media UI reuses the media layer's signed-URL rendering (`MediaCard`/
  `MediaViewer`), which already plays videos.

---

## How media is selected

Training Media is **curated from the project's existing media** — it reuses the Gallery, it
does not introduce a second uploader.

```
Uploads tab ──► media layer ──► Gallery (browse)
                                   │  select
                                   ▼
                         Identity's Training Media  (links)
```

Two selection paths (design):

1. **From the Gallery / a picker** — inside an Identity, "Add training media" opens a
   media picker (a selectable `MediaGrid` over `listProjectMedia`) and the user checks the
   assets to link. This is the primary path and the reason the Gallery/media components are
   reusable.
2. **On upload (convenience)** — from within an Identity, an "Upload" action can run the
   existing upload flow and auto-link the results to that Identity. This is sugar over
   (upload → link); it must not create a separate media store.

Selection creates **links**, never copies. Linking the same asset to two Identities is
allowed and expected.

## How media is removed

- **Remove from Identity** = delete the *link* (`IdentityMedia` row). The underlying
  `MediaAsset` is untouched and still lives in the Gallery / other Identities.
- **Delete the media entirely** = a Gallery/media-layer action (`deleteMedia`) that removes
  the blob + record; it must **cascade-remove all `IdentityMedia` links** and null any
  Identity `displayImageId` pointing at it (so no dangling references).
- Removing an Identity removes all its links (design in [IDENTITIES.md](./IDENTITIES.md)),
  never the media.

Two distinct verbs, two distinct scopes — never conflated in the UI.

## How media is organized

Within an Identity, training media is an **ordered, annotatable set**:

- **Order** — user-controlled `position` (drag to reorder). Determines display order and,
  later, which references a provider sees first.
- **Grouping by kind** — filter images vs videos (reusing `MediaFiltersBar`).
- **Display image** — one asset is promoted to the Identity's avatar/cover (`displayImageId`
  on the Identity — see IDENTITIES.md).
- **Count + coverage hints** — the UI can surface simple guidance ("add a few varied angles")
  without enforcing rules.

---

## Data model (design only — not implemented)

**Recommendation:** introduce a join table instead of the current direct FK
(`UploadedMedia.identityId`). A direct FK ties one media asset to at most one Identity and
has nowhere to store per-identity metadata (role, order, favorite, mask). A join table fixes
both and is the key structural recommendation of this milestone.

```prisma
// DESIGN SKETCH — do NOT create yet.
model IdentityMedia {
  id         String   @id @default(cuid())
  identityId String
  mediaId    String   // → UploadedMedia (a MediaAsset)

  // organization (near-term)
  position   Int      @default(0)
  isFavorite Boolean  @default(false)

  // roles + annotations (future — add when consumed)
  role       String?  // "reference" | "face" | "pose" | "style" | "mask" | "segmentation"
  tags       String[] // freeform, provider-agnostic
  rank       Int?     // quality/priority ordering distinct from display position
  meta       Json?    // future: mask/pose/segmentation payloads, bbox, keypoints, notes

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([identityId, mediaId]) // an asset links to an identity at most once
  @@index([identityId])
  @@index([mediaId])
  // onDelete: Cascade from BOTH Identity and UploadedMedia (links never orphan)
}
```

- Migrating from `UploadedMedia.identityId` → `IdentityMedia` is cheapest **before** any
  identity-media links exist, i.e. in the Identity Manager's first migration.
- The link, not the media, carries all identity-specific metadata. This keeps `MediaAsset`
  clean and shared.

---

## Future capabilities (design intent — none implemented)

Each of these is **metadata on the link or a satellite**, so it slots in without reshaping
media or the Identity:

| Capability | Where it lives (design) | Notes |
| ---------- | ----------------------- | ----- |
| **Metadata** | `IdentityMedia.meta Json?` | Freeform, provider-agnostic; never a provider payload verbatim. |
| **Tagging** | `IdentityMedia.tags String[]` (+ maybe a shared `Tag` model later) | For filtering/search within an Identity and across the library. |
| **Ranking** | `IdentityMedia.rank Int?` | Quality/priority, distinct from display `position`; lets "best" references lead. |
| **Favorite images** | `IdentityMedia.isFavorite Boolean` | Quick "use these first" set; also a Gallery filter (`Favorites` is already reserved in the media filter design). |
| **Masks** | `IdentityMedia.meta` (or a derived `MediaAsset`) | A mask may be a stored image asset linked with `role:"mask"`, or coordinates in `meta`. Decide when inpainting lands. |
| **Pose references** | `role:"pose"` + `meta` (keypoints) | ControlNet-style structure conditioning; the asset is normal media, the *role* makes it a pose ref. |
| **Segmentation** | `role:"segmentation"` + `meta` | Same pattern — media + role + payload. |

Design rules for all of the above:

- **Add a field only when a feature consumes it** (Decision 024). The sketch shows the shape;
  the migration ships incrementally.
- **Provider-agnostic always** — masks/poses/segmentation are stored as generic media +
  generic metadata, never as an OpenAI/Fal/Replicate/Runway/ControlNet-specific structure.
  Adapters translate at generation time.
- **Reuse the media layer** — any derived asset (a mask, a cropped face) is a `MediaAsset`
  through the same upload/sign/delete pipeline, linked with a `role`. No parallel store.

---

## Relationship to the media layer

Training Media is a thin, curated **view over the media layer** — it adds selection + order +
role, and reuses everything else:

```
MediaAsset (media layer, signed URLs)  ──linked by──►  IdentityMedia  ──belongs to──►  Identity
        ▲ reused for rendering (MediaCard/MediaViewer),
          selection (a selectable MediaGrid), and signed URLs
```

- No new storage, no new signed-URL logic, no new delete path — all inherited from the media
  layer (Decisions 021/022/024).
- The Identity Manager's Training Media UI (`TrainingMediaGrid`, `TrainingMediaSelector`,
  `TrainingMediaViewer` — see COMPONENT_GUIDELINES) **composes** the existing media components
  rather than reimplementing them.

## Deliverables status

Design only. No implementation, migration, UI, routes, or API in this milestone.
