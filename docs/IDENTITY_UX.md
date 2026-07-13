# Identity Manager — UX & Workflow

> **Status: UX DESIGN ONLY.** No code, schema, migration, components, or routes. This is the
> experience the Identity Manager will implement. Companion to the architecture docs:
> [IDENTITIES.md](./IDENTITIES.md), [TRAINING_MEDIA.md](./TRAINING_MEDIA.md),
> [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md), [NAVIGATION.md](./NAVIGATION.md),
> [VISION.md](./VISION.md).

## Principles for this UX

- **Identity lives inside a Project workspace** — it's a tab alongside Uploads/Gallery, not a
  separate app area. **Identities are PROJECT-SCOPED for the MVP** (Decision 027): every
  identity belongs to a User **and** a Project. A user-global Identity Library is out of MVP
  scope. Media belongs to a User + a Project too (Decision 021/024).
- **Hero Image** is the identity's primary visual (one of its training assets), used in
  cards, lists, breadcrumbs, and pickers. (Maps to `displayImageId`; always called "Hero
  Image" in the UI.)
- **Three statuses:** DRAFT (being set up) · ACTIVE (in use) · ARCHIVED (soft-hidden).
- **Reuse, don't reinvent.** Training-media browsing/selection reuses the `media/` components
  (`MediaGrid`/`MediaCard`/`MediaViewer`) and the media layer's signed URLs — never a second
  media browser (Decision 024).
- **Curate, don't automate.** Users deliberately choose which media represents an identity.
- **Add-then-enrich.** Creating an identity is cheap (a name); everything else is added later.
  Keep the create step tiny; put richness on the overview.
- **Three states always.** Every list/grid shows Loading / Empty / Content (design-system
  rule from COMPONENT_GUIDELINES).

---

## 1. User journey

```
Login
  ↓
Projects                     the user's workspaces
  ↓
Open Project                 project workspace (tabbed)
  ↓
Gallery  ───────────────┐    browse project media (images + videos)
  ↓                     │
Select Media            │    (optional shortcut) multi-select assets…
  ↓                     │
Create Identity  ◄──────┘    …then "Create Identity from selection" (media pre-attached)
  ↓                          — OR — create from the Identities tab with just a name
Identity Overview            avatar, description, status + sub-tabs
  ↓
Training Media               curate the images/videos that represent the identity
  ↓
Templates (future)           presets that target this identity
  ↓
Generate (future)            run generations; results return to Gallery, tied to the identity
  ↓
History (future)             every generation this identity appears in
```

**Step by step**

| Step | What the user does | Why it exists |
| ---- | ------------------ | ------------- |
| **Login → Projects** | Lands on `/projects` (existing). | Everything is owner-scoped and project-organized. |
| **Open Project** | Opens `/projects/[id]` → workspace tabs. | The Identity lives in a project context. |
| **Gallery (optional)** | Browses `/projects/[id]/gallery`, may multi-select media. | Lets the user gather references first, then turn them into an identity in one move. |
| **Create Identity** | Names the identity (+ optional description). Two entry points: the Identities tab, or "Create from selection" in the Gallery. | Cheap creation; the subject now exists to hang media/history on. |
| **Identity Overview** | Sees the identity header + sub-tabs. | The home base for a subject. |
| **Training Media** | Adds/removes/reorders/favorites media; sets the display image. | The core job — teach/represent the identity (see TRAINING_MEDIA.md). |
| **Templates / Generate / History (future)** | Reserved tabs. | Where the generation loop plugs in later, with the identity as its center. |

---

## 2. Navigation & routes

```
Sidebar: Projects ─► /projects
                       └─ /projects/[id]                 (workspace: Overview tab)
                            ├─ /projects/[id]/uploads     (add media)          [done]
                            ├─ /projects/[id]/gallery      (browse media)       [done]
                            ├─ /projects/[id]/identities   (Identity LIST)      ◄ new
                            │     └─ /projects/[id]/identities/[identityId]      ◄ new
                            │           ├─ Overview         (default sub-tab)
                            │           ├─ Training Media
                            │           ├─ Templates        (future — disabled)
                            │           ├─ History          (future — disabled)
                            │           └─ Settings
                            ├─ /projects/[id]/templates     (future)
                            ├─ /projects/[id]/jobs          (future)
                            └─ /projects/[id]/settings
```

**Breadcrumb** (Header): `Projects / Fashion Shoot / Identities / Emma`
The workspace context already maps project id → name; extend it so the identity id → name too.

**Two nav levels for identities:**
1. **List** — the `Identities` workspace tab (grid of identities).
2. **Detail** — one identity, with its own sub-tabs (**Overview** / Training Media /
   Templates / History / Settings). **Overview is the default** landing sub-tab. Sub-tabs
   mirror the workspace-tab pattern so the app feels consistent.

Back navigation: identity detail → "Identities" breadcrumb/tab returns to the list. Sidebar
and workspace tabs remain visible throughout (no dead ends).

---

## 3. Screen wireframes

> All screens render inside the existing **AppShell** (Sidebar + Header + Breadcrumb) and
> **ProjectLayout** (workspace tabs). Wireframes below show the **content area** only.

### 3.1 Workspace tabs (context)

```
+-----------------------------------------------------------------------+
|  Fashion Shoot                                                        |
|  Overview | Uploads | Gallery | [ Identities ] | Templates | Jobs | ⚙ |
+-----------------------------------------------------------------------+
|  …active tab content…                                                 |
+-----------------------------------------------------------------------+
```

### 3.2 Identities list — populated

```
+-----------------------------------------------------------------------+
|  Identities                                    [ Search… ]  [+ New]    |
|  Status: (All ▾)   Sort: (Newest ▾)                                    |
|-----------------------------------------------------------------------|
|  +-------------+   +-------------+   +-------------+                    |
|  |   (avatar)  |   |   (avatar)  |   |   (avatar)  |                    |
|  |    Emma     |   |    John     |   |    Max 🐶   |                    |
|  | Lead model  |   | Photographer|   | Studio dog  |                    |
|  | 18 media •  |   | 24 media •  |   | 12 media •  |                    |
|  | ACTIVE      |   | DRAFT       |   | ARCHIVED    |                    |
|  +-------------+   +-------------+   +-------------+                    |
+-----------------------------------------------------------------------+
```
*(IdentityGrid of IdentityCard; each card = IdentityAvatar + name + description + media count
+ status badge; click → detail. Hover reveals a ⋯ menu: Edit, Archive/Restore, Delete.)*

### 3.3 Identities list — empty

```
+-----------------------------------------------------------------------+
|  Identities                                                 [+ New]    |
|-----------------------------------------------------------------------|
|                         (identity icon)                               |
|                     No identities yet                                 |
|     Create an identity to reuse a face, character, or style           |
|     across generations. Add training media from your Gallery.         |
|                                                                       |
|                 [ + New Identity ]   [ Go to Gallery ]                |
+-----------------------------------------------------------------------+
```

### 3.4 Create Identity — dialog (from the Identities tab)

```
+---------------------------------------------+
|  Create Identity                         ✕  |
|---------------------------------------------|
|  Name          [__________________________] |
|  Description    [__________________________] |   (optional)
|                                             |
|  You can add training media after creating. |
|                                             |
|                        [ Cancel ]  [ Create ]|
+---------------------------------------------+
```
*(Minimal, mirrors ProjectFormDialog. On Create → land on the identity's Training Media tab,
empty, ready to add.)*

### 3.5 Create Identity — from a Gallery selection (shortcut path)

```
Gallery (selection mode)
+-----------------------------------------------------------------------+
|  Gallery            3 selected   [ Create Identity ]  [ Clear ]        |
|  [✓IMG] [✓IMG] [ IMG] [✓VID] [ IMG] [ IMG] …                          |
+-----------------------------------------------------------------------+
            ↓ "Create Identity"
+---------------------------------------------+
|  Create Identity                         ✕  |
|---------------------------------------------|
|  Name          [__________________________] |
|  Description    [__________________________] |
|                                             |
|  Training media (3 selected)                |
|   [IMG] [IMG] [VID]                          |
|                                             |
|                        [ Cancel ]  [ Create ]|
+---------------------------------------------+
```
*(The 3 selected assets are pre-linked on Create. This is the journey's primary path:
Gallery → select → Create Identity.)*

### 3.6 Identity detail — Overview (default sub-tab)

```
+-----------------------------------------------------------------------+
|  ‹ Identities                                                         |
|  +--------+  Emma                                     [ Add media ]    |
|  | HERO   |  Lead model · ACTIVE                       [ ⋯ Actions ]   |
|  | IMAGE  |                                                            |
|  +--------+                                                            |
|-----------------------------------------------------------------------|
|  [ Overview ] | Training Media | Templates (soon) | History (soon) | ⚙|
|-----------------------------------------------------------------------|
|  Hero image        ( large hero preview )                             |
|  Name              Emma                                               |
|  Description       Lead model                                         |
|  Status            ACTIVE                                             |
|  Training media    18                                                 |
|  Created           Jul 13, 2026                                       |
|  Updated           Jul 13, 2026                                       |
|                                                                       |
|  (future here: Templates · Generation history · Provider artifacts ·  |
|   AI defaults — see §6)                                                |
+-----------------------------------------------------------------------+
```
*(Header = IdentityAvatar (Hero Image) + name + description + status badge + IdentityToolbar.
**Overview is deliberately minimal today but is the permanent home** for future stats /
templates / history / provider artifacts / AI defaults — §6. Sub-tabs mirror the workspace
tabs; Templates/History disabled with a "soon" hint.)*

### 3.6b Training Media sub-tab

```
+-----------------------------------------------------------------------+
|  Overview | [ Training Media ] | Templates (soon) | History (soon) |⚙ |
|-----------------------------------------------------------------------|
|  Type: (All ▾)  Sort: (Order ▾)  [ Search… ]        [ + Add media ]   |
|                                                                       |
|  +------+ +------+ +------+ +------+                                   |
|  | IMG⭐| | IMG  | | VID ▶| | IMG  |   …                              |
|  |  ⋮⋮  | |  ⋮⋮  | |  ⋮⋮  | |  ⋮⋮  |   (drag handle to reorder)       |
|  +------+ +------+ +------+ +------+                                   |
+-----------------------------------------------------------------------+
```
*(TrainingMediaGrid composes MediaGrid + per-link affordances: ⭐ favorite, drag to reorder,
⋯ per-tile menu [**Set as Hero Image**, Remove from identity, Open].)*

### 3.7 Add / select training media (picker over the Gallery)

```
+-----------------------------------------------------------------------+
|  Add training media to Emma                                       ✕   |
|-----------------------------------------------------------------------|
|  Type: (All ▾)   [ Search… ]                        4 selected        |
|                                                                       |
|  [✓IMG] [ IMG] [✓IMG] [ VID] [✓VID] [ IMG] [✓IMG] [ IMG] …            |
|  (already-linked assets appear checked + "Added" and are disabled)    |
|                                                                       |
|                                   [ Cancel ]  [ Add 4 to identity ]   |
+-----------------------------------------------------------------------+
```
*(TrainingMediaSelector = a selectable MediaGrid over `listProjectMedia`. It also offers
"Upload new" which runs the existing upload flow and auto-links results. Never a new store.)*

### 3.8 Training media viewer (reuses MediaViewer)

```
+---------------------------------------------------+
|  beach-03.jpg                                  ✕  |
|---------------------------------------------------|
|            (full image / video player)            |
|                                                   |
|  Image · 3024×4032 · 2.1 MB · Jul 13              |
|  ⭐ Favorite   ☆ Set as Hero Image                |
|                          [ Remove from identity ] |
+---------------------------------------------------+
```

### 3.9 Identity Settings sub-tab

```
+-----------------------------------------------------------------------+
|  Emma › Settings                                                      |
|-----------------------------------------------------------------------|
|  Name          [ Emma______________________ ]                         |
|  Description    [ Lead model________________ ]                        |
|  Hero Image     ( preview )  [ Change ]                                |
|  Status         ( DRAFT / ACTIVE / ARCHIVED ▾ )                        |
|                                                    [ Save changes ]   |
|-----------------------------------------------------------------------|
|  Danger zone                                                          |
|  Delete identity — removes the identity + its media links (not the    |
|  media itself or generated results).            [ Delete identity ]   |
+-----------------------------------------------------------------------+
```

### 3.10 Archived identities (via the list filter)

```
+-----------------------------------------------------------------------+
|  Identities                                    [ Search… ]  [+ New]    |
|  Status: ( Archived ▾ )                                                |
|-----------------------------------------------------------------------|
|  +-------------+   +-------------+                                     |
|  |  (avatar)   |   |  (avatar)   |     …dimmed cards…                  |
|  |  Old Mascot |   |  Test Char  |                                     |
|  |  ARCHIVED   |   |  ARCHIVED   |     ⋯ → Restore / Delete            |
|  +-------------+   +-------------+                                     |
+-----------------------------------------------------------------------+
```
*(Default list shows ACTIVE only; the Status filter reveals Archived. Archived cards are
visually muted and excluded from generation pickers.)*

---

## 4. Empty states

| Where | Title | Body | Actions |
| ----- | ----- | ---- | ------- |
| **No identities** | "No identities yet" | Create an identity to reuse a face/character/style; add training media from your Gallery. | `+ New Identity`, `Go to Gallery` |
| **No training media** (on an identity) | "No training media yet" | Add images or videos that represent **Emma**. Pick from the Gallery or upload new. | `+ Add media`, `Upload` |
| **No search results** (identities) | "No identities match" | Try a different name or clear the search. | `Clear search` |
| **No search/filter results** (training media) | "No media matches" | Clear the filters or add media. | `Clear filters`, `+ Add media` |
| **Only archived exist / filtered to Archived, none** | "No archived identities" | Archived identities appear here. | `Show active` |
| **Storage not configured** (upload path) | reuse the Uploads notice | Set `BLOB_READ_WRITE_TOKEN`. | — |

*(All reuse the shared `EmptyState`; media grids reuse `LoadingState variant="grid"`.)*

---

## 5. User actions (complete list)

| Action | Where | Interaction | Confirm? |
| ------ | ----- | ----------- | -------- |
| **Create** | Identities tab `+ New`, or Gallery selection → Create | Dialog (name + optional description); new identity starts as **DRAFT** | — |
| **Activate** | Identity › Settings status, or on first training media | DRAFT → ACTIVE | — |
| **Rename** | Identity › Settings (or card ⋯ → Edit) | Inline field → Save | — |
| **Edit description** | Identity › Settings | Inline field → Save | — |
| **Set Hero Image** | Training tile ⋯ → "Set as Hero Image", or Settings → Change | Pick one linked asset as the identity's Hero Image | — |
| **Archive** | Card ⋯ or Settings → Status | Toggle → muted, hidden from pickers | Soft (reversible), no modal needed |
| **Restore** | Archived card ⋯ or Settings → Status | Toggle back to ACTIVE | — |
| **Delete** | Settings › Danger zone (or card ⋯) | Confirm dialog: "removes identity + links, not media/results" | **Yes** (destructive) |
| **Add media** | Overview/Training `+ Add media` | TrainingMediaSelector (pick from Gallery) or Upload | — |
| **Remove media** | Training tile ⋯ → Remove, or viewer → Remove from identity | Unlinks (keeps the asset) | Light confirm/undo toast |
| **Favorite media** | Training tile ⭐ toggle | Instant | — |
| **Reorder media** | Training grid drag handle | Drag to new position | — |
| **Filter media** | Training tab filters | Type / sort / search (reuses MediaFiltersBar) | — |
| **Search identities** | Identities tab search | Debounced name search | — |
| **Filter identities** | Identities tab | Status (Draft/Active/Archived/All), sort | — |

Undo pattern: destructive-but-cheap actions (remove link) use a Sonner toast with **Undo**;
truly destructive (Delete identity) uses a confirm dialog.

---

## 6. Future expansion — where things will live (not built)

Reserved, visible-but-disabled placeholders so the layout doesn't shift later:

| Future feature | Home in this UX | Note |
| -------------- | --------------- | ---- |
| **Templates** | Identity detail → **Templates** sub-tab (disabled "soon") + project `Templates` tab | Presets that target the identity. |
| **Prompt Builder** | A `Generate` action on the identity → prompt editor; identity pre-selected | Identity is the center of the compose screen. |
| **Generation History** | Identity detail → **History** sub-tab | Every generation the identity **appears in** (`GenerationIdentity` M2M, Decision 026) — supports multi-identity results. |
| **LoRA / Provider artifacts** | Identity detail → **Settings** → "Trained models" section | Satellite records keyed by identity + provider (Decision 025); swappable per generation. |
| **AI Settings / generation defaults** | Identity › Settings → "Generation defaults" section | Preferred prompt/negative/model/aspect ratio — deferred columns (Decision 025). |
| **Multi-identity generation** | Project → `Generate` → pick several identities (Emma + John + Max) | Output tied to each via `GenerationIdentity` (Decision 026). |

```
Identity detail sub-tabs (future-complete):
[ Overview ] [ Training Media ] [ Templates ] [ History ] [ Settings ]
   stats,                            soon         soon      (+ Generation defaults, Trained models)
   hero, dates
```

---

## 7. 📱 Example real-world workflows

**Scenario 1 — Creating a new character**
```
Create Project "Fashion Shoot"
  ↓  Uploads → drag in 12 photos of Emma
  ↓  Gallery → review, multi-select 8 best photos
  ↓  "Create Identity" → name "Emma", description "Lead model" → Create
  ↓  Lands on Emma › Training Media (8 linked) → set a display image, ⭐ 2 favorites
  ↓  Done — Emma is reusable across the project
```

**Scenario 2 — Adding more training media later**
```
Open Project → Identities → Emma
  ↓  Training Media → "+ Add media"
  ↓  Selector opens over the Gallery → filter Videos → select 3 clips
  ↓  "Add 3 to identity" → they appear in the grid → reorder
  ↓  Save/auto-saved — Emma now has 11 training assets
```

**Scenario 3 — Multi-character generation (future)**
```
Project → Generate
  ↓  Pick identities: Emma + John + Max (dog)
  ↓  Choose a Template
  ↓  Prompt Builder composes from identities + template + input
  ↓  Generate → result returns to Gallery (source: generated)
  ↓  The result appears in Emma's, John's, and Max's History (GenerationIdentity, #026)
```

---

## 8. UX review

**Strengths**
- Identity sits naturally in the workspace tabs; navigation mirrors the existing
  Uploads/Gallery pattern, so there's nothing new to learn.
- The Gallery-selection → Create path turns "gather refs, then define subject" into ~2 clicks.
- Reusing the media components keeps training-media browsing identical to the Gallery.

**Risks & frictions found → fixes**
1. **Two create entry points could feel like duplicate screens.** *Fix:* same dialog for both;
   the Gallery path just pre-fills the "selected media" block. One component, two entries — not
   two screens.
2. **"Remove from identity" vs "Delete media" confusion** (the classic trap). *Fix:* different
   verbs, different scopes, different UI: "Remove from identity" (unlink, light + Undo toast)
   lives on the training tile/viewer; "Delete media" lives only in the Gallery/viewer and
   warns it removes the file. Never put both on the same menu.
3. **Getting lost between list and detail.** *Fix:* always-visible workspace tabs + breadcrumb
   (`… / Identities / Emma`) + a `‹ Identities` back affordance on detail. No modal-only detail.
4. **Reordering vs favoriting overload on a tile.** *Fix:* drag handle for order, a single ⭐
   for favorite, and everything else under a ⋯ menu — avoid a cluttered tile.
5. **Archived items cluttering pickers.** *Fix:* default list = ACTIVE only; archived shown via
   the Status filter and excluded from generation/identity pickers.
6. **Empty first-run** (no media yet → can't make a meaningful identity). *Fix:* the "No
   identities" empty state offers **both** `+ New Identity` and `Go to Gallery`, and Create
   clearly says media can be added later — so the user is never blocked.
7. **Too many clicks to first identity.** Minimal-create (name only) → 1 dialog. Gallery path
   → select + Create. Both are short; we deliberately *don't* force description/media at create
   time.

**Deliberately deferred (not this milestone):** Templates/History/Generate tabs are visible but
disabled so the layout is stable when they arrive; generation defaults and trained-models live
under Settings later.

**Resolved (design frozen — Decision 027)**
- **Scope:** Identities are **project-scoped** for the MVP; a user-global Identity Library is
  out of scope (revisit later). `Identity.projectId` becomes required.
- **Overview:** keep a **dedicated Overview sub-tab** (the default landing) — minimal today
  (hero, name, description, status, media count, created/updated) but the permanent home for
  future stats/templates/history/artifacts/AI defaults (§6).
- **Hero Image:** the primary visual is called **Hero Image** throughout the UI (maps to
  `displayImageId`).
- **Status:** three statuses — **DRAFT → ACTIVE → ARCHIVED** (new identities start DRAFT).
- **Training-media roles:** a standardized future set —
  `PRIMARY | SECONDARY | VIDEO | POSE | STYLE | OTHER` — planned only, no behavior built yet.
- **Single source of truth:** Identity Manager reuses the Gallery + media layer; **no second
  upload workflow, ever.** AI stays out (provider-agnostic) until later milestones.

## Deliverables status

Design only. No implementation, schema, migration, components, routes, or API. The Identity
Manager will implement this UX reusing the `media/` components and the existing workspace shell.
