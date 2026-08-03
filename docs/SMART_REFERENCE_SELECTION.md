# Smart Reference Selection (Milestone 20)

> Identity Intelligence **in action.** Milestones 18–19 produced knowledge (metadata, coverage,
> scores, suitability) and froze the `im-2` contract. M20 **persists** that knowledge and **uses** it:
> for every generation it assembles the best *package* of reference images FOR THIS request — diverse
> and complementary, not four near-identical Heroes — and hands the ordered list to the provider.
> This is the transition **from an AI analysis pipeline to an AI knowledge system.**
>
> Layer: `src/lib/selection/` (the "Reference Selector" of [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md)).
> Pure, deterministic, provider-neutral.

## The shift

**Before:** `getIdentityVisualPackage` picked references statically — hero + a role-tagged portrait +
first N training images, ignoring all the analyzed knowledge. Every prompt got the same photos.

**After:** the selector reasons about *this* prompt and *this* identity's knowledge:

> Instead of "which images are best?", ask **"which combination of images is best for THIS request?"**

Example — *"Julieta smiling on a yacht in a bikini"* wants: front face · smiling · full body ·
outdoor · swimwear · (legs visible → her leg tattoos). A package of **[best face] + [best smile] +
[best full body] + [leg-tattoo image]** beats four Hero headshots.

## Pipeline

```
User prompt → Creative Director (directive.meta) → Prompt Requirements (deterministic)
                                                          │
Identity's persisted Vision knowledge ── candidates ──────┤
                                                          ▼
                                    match each image × each requirement (0..100)
                                                          ▼
                            package optimization (greedy marginal-gain / diversity)
                                                          ▼
                       ordered references + per-pick reasons + coverage warnings
                                                          ▼
                              provider receives orderedReferenceUrls (Fal, …)
```

### 1. Prompt Requirements (`requirements.ts`) — deterministic, no LLM

`extractPromptRequirements(directive)` reads the Creative Director's trace (`meta.scene`,
`meta.intent`, `meta.composition`) + a keyword scan of the idea → `PromptRequirements` (the boolean
interface: needsFace/Smile/FullBody/…/Tattoos/Indoor/Swimwear/…). **HARD vs SOFT:** an explicit
request ("back view showing tattoos") is hard (warns if unmet); an *exposure-implied* interest
(bikini → legs visible → prefer leg-tattoo refs) is **soft** — it steers ranking but never warns when
the identity has no tattoo there.

### 2. Image matching (`match.ts`)

`matchImage(candidate, requirements)` scores each image 0..100 per requirement, reading ONLY the
persisted, provider-neutral knowledge (`face.orientation`, `face.expression`, tattoo `region`s,
`body.visibleRegions`, `lighting`, `referenceSuitability`, …).

### 3. Package optimization (`select.ts`) — the heart

`selectReferencePackage` does **greedy marginal-gain (set-cover)**: repeatedly pick the image that
adds the most NEW weighted requirement coverage — **not** the top-N overall (that yields four faces).
It stops once nothing meaningful is added (avoids redundancy), always returns ≥1 reference (never
blocks generation), orders best-first by **weighted value** (top requirement weight × match), and
**explains every pick** ("Only image with leg tattoos.", "Best full body.", "Additional strong face
reference.").

**Scene-aware weighting.** Requirement weights are **context-aware** (`requirements.ts`): for a
`bodyDependent` prompt (swimwear · full-body · elegant/business · action · fashion), body-family
requirements (`fullBody`, leg/arm/chest tattoos, swimwear, outdoor) are boosted **above** the face,
and the face is softened (still always present + covered, just no longer dominant). So *"smiling at
the beach in a bikini"* **leads with a full-body / swimwear / leg-tattoo reference**, while a
*"business portrait"* still leads with the face. This directly addresses identity drift on
body/clothing generations.

### 4. Coverage validation

Before generation, hard requirements with no suitable reference produce a **warning** ("Back tattoos
requested but no suitable reference exists.") — surfaced in debug. **Generation is never blocked.**

## Persistence — analyze once, never at generation time

Vision knowledge is a property of the **image**, so it's stored per `UploadedMedia` in
**`MediaVisionKnowledge`** (`prisma/schema.prisma`): the frozen `im-2` `metadata` (JSON, includes
quality + reference suitability) + `score` (JSON) + `provider`/`model`/`version`/`overallScore`/
`analyzedAt`. **Only provider-neutral knowledge — never raw Gemini responses or debug values.**
Single-image coverage isn't stored — it's an aggregate, recomputed from `metadata`.

- `src/lib/vision/persist.ts`: `analyzeAndPersistMedia`, `analyzeIdentityLibrary`,
  `getPersistedKnowledge`.
- **Trigger:** user-initiated — the Identity → Training Media tab has an **"Analyze library"** button
  (`analyzeIdentityLibraryAction`). Analysis is ~seconds/image and there's no async Job queue yet, so
  it is deliberately *not* a blocking upload hook; fully-automatic on-upload analysis waits for the
  **async Job queue** milestone. **Generation NEVER analyzes** — it reads persisted knowledge only.

## Wiring into generation (providers unchanged)

`getIdentitySelectionCandidates(userId, identityId)` pairs each analyzed training image with its
signed URL. `runImageGeneration` already builds the `directive`; it now calls
`buildReferencePackage(directive, candidates)` and maps the package to the existing provider-neutral
`ReferenceImage[]` — **replacing** the static `toReferenceImages(visualPackage)`. If an identity has
no analyzed images yet, it **falls back** to the old static Visual Package (nothing breaks). **Fal and
every other provider are untouched** — they receive ordered `referenceImages` and never know how they
were chosen. The dev Debug panel gains the requirements + per-pick reasons + warnings.

## Synthesized identity description (Milestone 21, folded in)

Selecting the right *reference images* isn't enough — the **text prompt** must also describe the
identity richly. `synthesizeIdentityAppearance(metadatas)` (`src/lib/vision/synthesize.ts`) aggregates
the identity's analyzed images into ONE canonical appearance paragraph — **majority-voted** across
images (resolving single-image disagreement, e.g. one "brown" vs many "pink"): hair
(color/length/texture), accessories/piercings, **tattoo LAYOUT by region** ("sleeve tattoos on both
arms, chest and thigh tattoos" — region words, *never* imagery, so it can't inject a stray "snake"
into scene analysis), and age. The generation layer computes it from the already-loaded candidates
and passes it as `IdentityContext.appearance`; `resolveIdentity` carries it (keeping the scene-analyzed
`effectiveIdea` clean) and `compile.ts` **appends it verbatim** as the first enrichment clause. Result:
every generation prompt now leads with the user's idea + a detailed, knowledge-derived appearance,
replacing the sparse static description.

## Inspecting analyzed knowledge (Training Media page)

Analysis is no longer invisible. After **Analyze library**, every training-media card shows a compact
summary — star score, ✓ covered dimensions ("Front face / Full body / Leg tattoos"), hair, environment
— and clicking opens a **side panel** (`training-media-knowledge-panel.tsx`) with the full analysis:
reference suitability, coverage contribution, face-quality breakdown, visible body regions, tattoo
regions, hair, the `IdentityMetadata` JSON (dev toggle), and **Re-analyze**. It all reads persisted
`MediaVisionKnowledge` — **never calls Gemini** (only the explicit Analyze/Re-analyze actions do).
`getIdentity` attaches a `MediaKnowledgeSummary` per image (`summarizeMediaKnowledge`); the panel
fetches full detail via `getMediaVisionKnowledgeAction`. This is now the canonical place to inspect an
identity's images; `/debug/vision` remains a developer playground.

## Identity Anchor — "who is this person?" (invariant)

The selector answers *"what images describe this request?"* — a **separate** concern from *"who is
this person?"*. Every identity generation always includes exactly **one Identity Anchor**
(`src/lib/selection/anchor.ts`, `pickIdentityAnchor`): the strongest frontal face (highest face
quality × identity confidence, never cropped), chosen **independently** of the scene selector.

- It is **not** part of the selector's reasoning or Debug explanations (those stay scene-driven).
- It rides on the request as `ImageGenerationRequest.identityAnchor`; the **provider adapter prepends
  it** to the reference list immediately before sending (`fal.ts`), **deduped** — so it can never
  duplicate an already-selected image, and if the selector already led with the best face it's a
  no-op.
- So a bikini/beach generation sends `[identity anchor (clean face), full-body, leg-tattoo, smile]`:
  scene-aware selection **and** a guaranteed identity anchor. This is what keeps the face from drifting
  when the scene package leads with a body reference.

## Reference Safety / exposure (a selection constraint)

Diagnosis (reproduced in Fal Playground): the black images are **provider NSFW moderation triggered by
the reference images themselves** — a nude/lingerie training photo sent for a normal prompt. So
exposure is now a first-class selection dimension alongside face/body/tattoos/hair.

- **Classify** (`vision/exposure.ts`, `classifyExposure`) each analyzed image as `clothed · swimwear ·
  lingerie · nude`, derived from its `clothing` terms — **positive-signal only** (missing clothing ≠
  nude; that produced false positives). The Gemini prompt now reliably reports "nude/lingerie/bikini"
  in `clothing`.
- **Constrain** (`selection/exposure.ts`): `allowedExposureForPrompt(directive)` = the most-exposed
  level the prompt permits (business/portrait → `clothed`; beach/pool → `swimwear`; explicit request →
  `lingerie`/`nude`). `filterCandidatesByExposure` drops anything above it — applied to **both** the
  scene selection **and** the Identity Anchor (a nude image is never sent, even for its face).
- Result: a business portrait never sends swimwear/nude refs; a beach prompt uses swimwear but not
  nude; only an explicit request makes nude references eligible. The exposure class shows on each
  training-media card; the Debug panel reports the allowed level + how many refs were excluded.

## Content moderation (black images)

Even with the safety filter, Kontext's own moderation returns **HTTP 200 with a black placeholder image
+ `has_nsfw_concepts:[true]`**. `fal.ts` detects that and throws `CONTENT_MODERATED` **before** saving
anything — the generation fails with a clear message instead of silently storing a black square. The
Reference Safety filter reduces how often this fires; this is the backstop when it still does.

## Future-proofing — generic signals

`SelectionCandidate.signals?: Record<string, number>` is the extension point: **face-embedding
similarity** (M22), user favorites, LoRA availability, and learning-loop scores plug in as generic
numbers the optimizer can weight — **no selector redesign**. The selector never learns provider names.

## Transparency & verification

- **`/debug/selection`** — prompt + a few images → requirements · match matrix · selected package +
  reasons · warnings. Demos the engine without a saved identity.
- **`scripts/verify-selection.ts`** (offline, deterministic) — the yacht/office/back-view scenarios
  from the success criteria: diversity, coverage, reasons, and warnings.

## Boundaries

No Creative Director / Vision / provider redesign. The selector only *consumes* frozen knowledge and
*persists* it. Everything is pure and provider-neutral; the provider contract is unchanged.
