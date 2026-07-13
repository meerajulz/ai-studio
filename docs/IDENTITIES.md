# Identities

> **Status: DESIGN ONLY (Milestone 9 — Identity System Design).** No code, schema, routes,
> or UI exist yet for anything below beyond the current `Identity` model. This document is
> the contract the implementation will follow. Related: [TRAINING_MEDIA.md](./TRAINING_MEDIA.md),
> [MEDIA_PIPELINE.md](./MEDIA_PIPELINE.md), [VISION.md](./VISION.md), [DATABASE.md](./DATABASE.md),
> [DECISIONS.md](./DECISIONS.md) (#025).

---

## What an Identity is

An **Identity** is a reusable, named subject that generations are built around — a person's
face, a character, a mascot, a product, or a consistent visual style. It is the thing you
want to appear *consistently* across many generated images and videos.

An Identity bundles together, in one place:

- **Who/what it is** — a name, description, and a display image (avatar).
- **What it looks like** — its **training media** (images + videos) that teach a model, or
  condition a prompt, about the subject (see [TRAINING_MEDIA.md](./TRAINING_MEDIA.md)).
- **How it likes to be generated** — optional generation defaults (preferred prompt,
  negative prompt, preferred models, aspect ratio) that seed new generations. *(Deferred —
  see "Architecture review".)*
- **Its history** — every generation that used it.

An Identity is **not** a single image and **not** a model. It's a durable concept that
outlives any one upload, prompt, provider, or generated result.

## What problems it solves

1. **Consistency.** Getting the "same face/character" across many generations is the core
   hard problem of identity-based generation. An Identity centralizes the reference material
   and defaults so every generation starts from the same, curated source of truth.
2. **Reuse.** Curate a subject once; reuse it across many prompts, templates, projects, and
   providers without re-gathering references each time.
3. **Organization.** Uploads and generated results are otherwise a flat pile of media. The
   Identity gives them a subject to hang on: "these 12 photos are *Ana*; these 40 results are
   *Ana*."
4. **Portability across providers.** Because an Identity stores *intent and material*
   (media + preferences), not a provider artifact, the same Identity can drive OpenAI today,
   Fal/Replicate tomorrow, or a locally trained LoRA later — with no change to the Identity
   (see "Future AI").
5. **A stable anchor for the whole pipeline.** Templates, the Prompt Builder, jobs, and
   generated media all reference the Identity, so the studio can answer "show me everything
   about this subject" cheaply.

## Philosophy

- **Identity is the central concept for generation.** The long-term workflow is
  `Project → Uploads → Gallery → Identity → Templates → Prompt Builder → AI Generation →
  History` (see [VISION.md](./VISION.md)). Everything downstream of the Gallery revolves
  around an Identity.
- **Identity captures intent + material, never a provider artifact.** It must never store a
  provider-specific handle as its essence. Provider outputs (a trained LoRA, a fine-tune id,
  an embedding) attach *to* an Identity as swappable satellites, so the Identity survives any
  provider change (Decision 007, restated in #025).
- **Media is shared, not owned.** Training media is drawn from the existing media layer (the
  same `MediaAsset` the Gallery shows), linked to the Identity — not copied into a separate
  store. One asset can inform more than one Identity.
- **Curated, not automatic.** The user deliberately selects which media trains/represents an
  Identity. The system never silently assumes every project upload belongs to an Identity.
- **Earns its columns.** The model grows as consuming features land (Identity Manager first,
  then Prompt Builder/AI), not speculatively — consistent with the project's "earns its
  place" principle and Decision 024.

---

## Identity lifecycle

```
Create ──► Edit ──► (Archive ⇄ Restore) ──► Delete
                         │
                         └─ archived identities are hidden from pickers but keep their history
```

| Stage | What happens | Notes |
| ----- | ------------ | ----- |
| **Create** | User names an Identity inside a project; optionally adds a description and first training media. | Owner-scoped. Minimal required: `name`. |
| **Edit** | Rename, edit description/notes, change display image, add/remove training media, adjust defaults. | Training-media changes are add/remove *links*, never destructive to the underlying media (see below). |
| **Archive** | Soft-hide an Identity that's no longer active. It disappears from generation pickers and default Identity lists but is **not** deleted — its media links and generation history are intact. | Recommended new `status` (ACTIVE ⇄ ARCHIVED). Reversible. Preferred over deletion for anything that has history. |
| **Restore** | Un-archive back to ACTIVE. | Trivial inverse of Archive; included because generation history makes hard-delete costly. |
| **Delete** | Permanent removal of the Identity. | **Only removes the Identity and its media *links* + defaults — never the underlying media** (that belongs to the project/Gallery and may be shared). Generations that referenced it keep existing; their `identityId` goes null (`onDelete: SetNull`, as today). Guard with a confirm dialog; prefer Archive for anything with history. |

**Delete semantics (important):** deleting an Identity must **not** delete its training media
files. Training media are links into the shared media layer; deletion severs the links only.
This mirrors how deleting a project today doesn't delete media it never owned.

---

## Relationships

```
User
 └── Project
       └── Identity ────────────────┐
             ├── Training Media  ────┤  (links into the shared media layer — MediaAsset)
             │     (images + videos) │
             ├── Generation Defaults │  (optional; provider-agnostic — deferred)
             ├── Templates (uses)  ──┤  (a template may target an Identity)
             ├── Generation Jobs  ───┤  (each generation optionally references an Identity)
             │      └── Generated Media
             └── Provider artifacts ─┘  (future: LoRA / fine-tune / embedding — swappable)
```

- **Projects → Identities.** An Identity belongs to a user and (optionally) a project.
  Project scoping keeps a workspace's identities together; `onDelete: SetNull` today means an
  Identity can outlive a project. *(Open question below: should Identities be project-scoped
  or user-global with project tags? Current model already allows both.)*
- **Identities → Training Media.** The heart of an Identity. Curated images + videos, drawn
  from the media layer, that represent/teach the subject. Full design in
  [TRAINING_MEDIA.md](./TRAINING_MEDIA.md).
- **Identities ↔ Templates.** A Template (reusable prompt/config preset) may be written to
  target an Identity, and an Identity may declare a preferred/default Template. Neither owns
  the other — both are reusable building blocks composed at generation time.
- **Identities → Future AI Providers.** The Identity is the *input contract* to a provider
  adapter: "here is the subject, its training media, and its defaults — generate." Providers
  are chosen at generation time and never stored as part of the Identity's essence.
- **Identities → Generation Jobs → Generated Media.** Each generation optionally references
  an Identity (`Generation.identityId`, exists today). This is what powers "history for this
  Identity" and makes results filterable by subject in the Gallery (`source: "generated"`
  already reserved — Decision 024).
- **Future LoRAs / Training.** When local/hosted training lands, a trained artifact (LoRA,
  embedding, fine-tune id) is a **satellite record attached to an Identity** (e.g. an
  `IdentityModel { identityId, provider, kind, externalId, status, ... }`), one Identity → N
  artifacts across providers. The Identity chooses which artifact (if any) to use per
  generation. This keeps the Identity provider-agnostic while allowing provider-trained
  models to accelerate consistency. **Design-only; not modeled yet.**

### Ownership

- Everything is **owner-scoped** through `userId` (Decision 011). An Identity, its media
  links, its defaults, and its generations all resolve to one owner; every read/write
  re-checks ownership at the data boundary (as the media layer already does — Decision 024).
- **Identity owns its links and defaults, not the media bytes or the results.** Deleting an
  Identity severs links and removes defaults; media and generated results persist under their
  own ownership.

### Future scalability

- **Many identities per project, many media per identity, many generations per identity** —
  all N-relationships, indexed by `userId`/`projectId`/`identityId` as today.
- A **join table for training media** (design in TRAINING_MEDIA.md) lets one media asset
  serve multiple identities and carry per-identity metadata (role, order, favorite, mask) —
  which a direct FK cannot. This is the main scalability recommendation.
- Provider artifacts as satellites keep the hot `Identity` row small while allowing unbounded
  per-provider training history.

---

## Generation configuration resolution (design)

When a generation runs, its settings resolve in layers — **most specific wins**:

```
Provider/global defaults
      ↓ (overridden by)
Identity defaults        (preferred model, prompt, negative prompt, aspect ratio, …)
      ↓ (overridden by)
Template                 (a chosen preset)
      ↓ (overridden by)
Per-generation input     (what the user typed/changed this time)
```

The Identity provides a *baseline* so the same subject generates consistently by default,
while Templates and per-generation input stay free to override. This layering is the reason
Identity defaults are worth storing — but see the review: they're **deferred** until the
Prompt Builder/AI layer consumes them.

---

## Architecture review — is the current `Identity` model sufficient?

**Current model** (`prisma/schema.prisma`):

```prisma
model Identity {
  id, name, notes?, createdAt, updatedAt
  userId  (owner, cascade)
  projectId?  (SetNull)
  referenceMedia UploadedMedia[]   // via UploadedMedia.identityId
  generations    Generation[]
}
```

**Verdict:** sufficient for a *bare* first CRUD, but **two gaps** should be closed for the
Identity Manager to be worth building, and one cluster should be **deliberately deferred**.
No schema changes are made in this milestone — these are recommendations only.

### Recommended for the first Identity implementation (Milestone: Identity Manager)

| Field / change | Type | Why |
| -------------- | ---- | --- |
| `description` | `String?` | Short, human summary distinct from long private `notes`. Shown on the card. |
| `displayImageId` | FK → media (nullable) | The avatar/cover for `IdentityCard`/`IdentityAvatar`. Points at one of its training media; `SetNull` if that media is deleted. |
| `status` | `IdentityStatus` enum `ACTIVE \| ARCHIVED` (+ optional `archivedAt`) | Enables the Archive/Restore lifecycle above; keeps history without hard-deleting. |
| **Training-media join** | new `IdentityMedia` table (see TRAINING_MEDIA.md) | Replace the direct `UploadedMedia.identityId` FK so one asset can serve several identities and carry per-identity role/order/favorite. **The most important recommendation.** |

### Deferred until the Prompt Builder / AI layer consumes them (add then, not now)

`preferredPrompt`, `negativePrompt`, `preferredModels`/`preferredProviders`,
`aspectRatioDefault`, and a catch-all `generationDefaults Json?`. These are real and belong
on the Identity eventually (they power the resolution layering above), but **nothing consumes
them until the Prompt Builder and AI providers exist.** Adding them now would be speculative
columns with no reader — against the project's "earns its place" principle (Decision 024).
Recommendation: add them in one migration when the Prompt Builder lands, storing
provider/model as **strings + `Json`** (never enums or provider types — Decision 007).

### Explicitly not recommended yet

- A separate `Tag` model / tagging system — design it with TRAINING_MEDIA organization, not
  as Identity columns. A simple `String[]` on Identity is possible later if search needs it.
- Any provider-specific column on `Identity` (fine-tune ids, LoRA paths) — those are
  satellite records (`IdentityModel`), never fields on the Identity.

---

## Future AI — Identity as a provider-agnostic input

Providers (OpenAI, Fal, Replicate, Runway, local models, LoRA/ControlNet, video models) are
**plug-ins behind interfaces** (`ImageProvider`/`VideoProvider`, per VISION/Decision 007).
The Identity is the *input contract* they receive, never a consumer of their SDKs:

```
Identity (subject + training media + defaults)
        │
        ▼
Provider adapter  (OpenAI | Fal | Replicate | Runway | local | LoRA/ControlNet | video)
        │   picks how to use the Identity: reference images, IP-adapter, a trained LoRA, …
        ▼
Generation Job ──► Generated Media  (flows back into the Gallery as source:"generated")
```

Rules that keep this clean:

- **Identity never imports a provider SDK or stores a provider type as its essence.**
- Provider-trained artifacts (LoRA/embedding/fine-tune) attach as **satellite records**
  keyed by `identityId` + `provider` string, so adding a provider is one adapter + rows, not
  an Identity change.
- Per-generation the user (or a Template) picks the provider; the Identity supplies material
  and defaults only.

---

## Future architecture — multiple identities per generation (design note)

> **Status: future direction — accepted in principle, sub-questions open, NOT implemented and
> NOT migrated.** See [DECISIONS.md](./DECISIONS.md) #026.

Today `Generation.identityId` is a single optional FK — **one identity per generation**. But a
generated image or video can legitimately contain **several** subjects:

- Emma + John · Emma + John + Max (dog) · multiple characters · characters + products ·
  characters + mascots.

One generated asset should be able to appear in **multiple** identity histories. So the
*appears-in* relationship should evolve into **many-to-many**, kept deliberately **separate**
from training media — two independent concepts:

```
Identity ── IdentityMedia ───── MediaAsset      INPUT:  what TEACHES an identity (training)
Generation ── GenerationIdentity ── Identity    OUTPUT: which identities APPEAR IN a result
```

- **Training Media** = media that teaches/represents an identity (input side; see
  [TRAINING_MEDIA.md](./TRAINING_MEDIA.md)).
- **`GenerationIdentity` ("appears in")** = which identities are present in a generated output
  (output side). Recording this powers "history for an identity" and Gallery-by-identity.

**Design sketch — do NOT create yet:**

```prisma
// DESIGN ONLY. Not a migration.
model GenerationIdentity {
  id           String   @id @default(cuid())
  generationId String
  identityId   String
  // future: role/position (primary vs secondary subject),
  //         source ("requested" | "detected" | "confirmed")
  createdAt    DateTime @default(now())

  @@unique([generationId, identityId])
  @@index([identityId])
  // onDelete: Cascade from BOTH Generation and Identity (links never orphan)
}
```

**Open sub-questions to resolve when this lands (before the AI generation system ships):**

1. **Granularity — `Generation` vs `GeneratedMedia`.** Attach appears-in at the *request*
   level (`GenerationIdentity`) or per output asset (`GeneratedMediaIdentity`)? A batch can
   yield outputs with different subjects, and manual tagging is per-asset. *Recommendation:*
   model at the Generation level first (matches the request); allow per-`GeneratedMedia`
   appears-in later without a reshape.
2. **Requested vs. detected.** Identities *fed in* may differ from those that actually appear
   (or are later confirmed by detection/manual tagging). A `source` column
   (`requested | detected | confirmed`) keeps both without ambiguity.
3. **Role/position** for multi-subject generations (primary/secondary) — future metadata on
   the join.
4. **Migration timing.** Keep `Generation.identityId` for now; when M2M lands, backfill
   existing single links into `GenerationIdentity` and deprecate the scalar. Cheapest
   **before** the AI generation system creates many generations — the reason we record it now.

**Where it meets the Gallery.** Generated results are `MediaAsset { source: "generated" }`
(Decision 024). "Filter the Gallery by identity" then unifies the two independent concepts —
training links (uploaded media via `IdentityMedia`) **and** appears-in (generated media via
`GenerationIdentity`) — into one "everything about this identity" view. Join rows resolve to
the same owner; all queries stay owner-scoped.

## Open questions / possible future problems

1. **Project-scoped vs user-global identities.** Today `projectId` is optional (Identity can
   be global). Decide the default UX: are Identities primarily a project thing (create inside
   a project) or a user library reused across projects? *Recommendation:* create inside a
   project, but allow reuse across the user's projects later — the current nullable FK already
   supports both; don't over-constrain now.
2. **Direct FK → join migration.** Moving training media from `UploadedMedia.identityId` to an
   `IdentityMedia` join is a real migration once media are linked. Doing it **before** the
   Identity Manager ships (while no identity-media links exist) is cheapest. *Recommendation:*
   land the join in the Identity Manager's first migration.
3. **Display image lifecycle.** If the chosen `displayImageId` media is deleted, the avatar
   must degrade gracefully (`SetNull` + a fallback in `IdentityAvatar`).
4. **Cross-project media in an identity.** If Identities become user-global but media are
   project-scoped, a training-media link could cross projects. Decide whether that's allowed
   (probably yes for a personal studio) and ensure signed-URL + ownership checks still hold
   (they do — checks are per-user, not per-project, in the media layer).
5. **Deleting media that trains an identity.** Deleting a `MediaAsset` should cascade-remove
   its `IdentityMedia` links (and null any `displayImageId`), never orphan them.
6. **Generation history when an Identity is deleted.** Current `Generation.identityId`
   `SetNull` preserves results but loses the subject label. Archive (not delete) is the
   recommended path to preserve that link.
7. **Multiple identities per generation.** `Generation.identityId` is single today; a result
   can contain several subjects. See "Future architecture — multiple identities per
   generation" above (`GenerationIdentity` many-to-many) and DECISIONS #026.

---

## Deliverables status

Design only. No implementation, migration, UI, routes, or API in this milestone. The
Identity Manager will implement this contract in a later milestone, reusing the media layer
and Gallery components (Decision 024) rather than building a parallel media browser.
