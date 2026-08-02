# Reference Intelligence — the Identity Package (Milestone 25.2)

> **Status:** Design accepted (Decision 063). Phase A (shadow) + **Phase B (image channel, Decision 064) + Phase C (channel arbitration, Decision 065) SHIPPED.** Next = Phase D (persist package + roled providers).
> **This is the long-term abstraction of the project.** The Identity Package is the internal,
> provider-agnostic representation of *who a character is and how to reference them*. Providers
> render a **projection** of it into whatever API they support. Nothing above the renderer knows
> Flux/GPT/Nano Banana/Wan exist.

Part of the transform-first pivot — see [CHARACTER_TRANSFORMATION.md](./CHARACTER_TRANSFORMATION.md)
(Decisions 060–063). Consumes the Transformation Plan (M25.1).

## Why

M25.1 makes the *prompt* transformation-aware ("preserve tattoos, change the background"), but the
*reference* channel is still a bag of unlabeled images — the model has to guess which one is the face,
the body, the tattoos. The intelligence to fix this mostly exists (`src/lib/selection/` already tags
picks with a `role` + `reason`) but it's **destroyed at the provider boundary** (`toReferenceRole`
collapses everything to `"reference"` → `image_urls[]`). We promote and unify it into a first-class,
persistent, provider-agnostic **Identity Package**.

## The core idea: one package, two complementary channels

```
        Character knowledge (im-2) + Transformation Plan (M25.1 preserve/change)
                                  │
                    ┌─────────────┴──────────────┐
                    ▼                             ▼
             IMAGE channel                  TEXT channel
          Identity Package            Prompt (3 clean layers)
     best-per-role typed anchors    identity instruction · edit request · gap-filling descriptors
                    └──────────── arbitrated ─────┘
        A facet carried by an anchor is NOT re-described in text.
```

## Anchor roles

```
AnchorRole = "face" | "body" | "tattoo" | "hair" | "canonical" | "pose"
```

- **face** — WHO this is. The identity foundation (see invariant below).
- **body** — proportions / full-body shape.
- **tattoo** — the image with the widest, clearest coverage of the character's tattoo set.
- **hair** — hairstyle clearly visible.
- **canonical** — the single highest-quality image that best *represents* the character (was
  "Style", renamed: "style" implied clothing/aesthetic; this is a fidelity anchor).
- **pose** — optional; only when a specific pose is requested.

## Invariant: the Face Anchor is sacred

1. The Face Anchor is **always `anchors[0]`** and is **never dropped** to satisfy a model's reference cap.
2. If no candidate yields a confident face anchor → **fall back to the Hero image**.
3. If there is no Hero either → **refuse the transformation** (`NO_IDENTITY_ANCHOR`) rather than
   silently sending a weak identity reference. A bad face reference is worse than a clear error.

This is a pipeline invariant, enforced in `resolvePackage`, not a heuristic.

## Layered architecture (all provider-agnostic except the renderer)

```
1. RoleScorer (pluggable)          candidate × role → { fitness, reasons, signals }
       today: heuristicRoleScorer (im-2)        tomorrow: evaluatorRoleScorer (M26 InsightFace)
2. buildCharacterPackage(candidates) → CharacterPackage      the character's DEFAULT anchors (stable)
3. resolvePackage(default, plan, ctx) → IdentityPackage      the per-REQUEST view (needed roles + overrides)
4. renderPackageForModel(package, schema) → ProviderRefs     the ONLY provider-aware step
```

### 1. Pluggable scoring (M26-ready)

Role fitness comes from a `RoleScorer` strategy, not hardcoded — so evaluator scores drop in later
with no redesign:

```ts
interface RoleScorer {
  profile(candidate: SelectionCandidate): ReferenceProfile; // fitness + reasons + raw signals per role
}
```

- **Today** `heuristicRoleScorer` derives fitness from im-2: face reuses `anchor.ts scoreAnchor`
  (frontal × faceQuality × confidence × prominence); body from `body.visiblePercent`/`visibleRegions`
  × sharpness; tattoo from visible-region coverage of the identity's known tattoo set × confidence;
  hair from `hair.visible` penalized by `wet`/`windBlown`; canonical from `quality.overall` × face
  clarity; pose from action match.
- **Tomorrow** `evaluatorRoleScorer` (M26) fills `ReferenceProfile.signals` with face/tattoo/body/hair
  **similarity** from the Identity Evaluator (InsightFace). Same interface; `fitness` just gets truer.

### 2. Character package — the persistable default (M25.2 architecture, persistence later)

`buildCharacterPackage(candidates)` picks the best anchor **per role over the whole library** — the
character's stable identity fingerprint:

```
Character
  Face Anchor       (sacred)
  Body Anchor
  Tattoo Anchor
  Hair Anchor
  Canonical Anchor
```

Today this is computed on the fly inside the Reference Engine. It is deliberately shaped to become
**persistent** without a refactor — exactly like `IdentityDataset`: a future `IdentityPackage` table
(identityId, role, mediaId, score, reasons, computedAt, packageVersion) written by a
`refreshCharacterPackage` step (invalidated when training media / analysis changes) and read through
`getCharacterPackage(userId, identityId)`. Callers use that accessor now (compute), swap to
read-through-cache later — no caller change. *(Not implemented in M25.2; the seam is.)*

### 3. Request resolution — transformation-driven (M25.1 → M25.2)

`resolvePackage(characterPackage, transformationPlan, ctx)` produces the per-request package:

```
neededRoles from the Transformation Plan (NOT "best of everything"):
  face      → always (invariant)
  body      → "body" in preserve AND scene shows body
  tattoo    → "tattoos" in preserve AND visible in scene
  hair      → "hair" NOT in change  (changing hair → no Hair Anchor slot)
  canonical → include when slots remain (fidelity boost)
  pose      → only when a specific pose is requested (override/add)

then:
  • start from the character's DEFAULT anchors for the needed roles
  • apply request OVERRIDES (full-body shot → re-pick body; seated pose → add pose anchor)
  • enforce the Face-Anchor invariant (fallback → refuse)
  • MERGE by image: if one image is the argmax for several roles, it fills them all (one slot,
    many roles) — coverage > uniqueness; only pick a distinct image for a role when it is
    *meaningfully* better
  • order by importance (face #1; rest scene-weighted, reusing requirements.ts weights)
  • cap at the model's maxReferences, dropping lowest-importance first — NEVER the face
  • compute facetsCoveredByReference → drives prompt de-duplication
```

### 4. Provider projection — the only provider-aware code

```ts
type ReferenceSchema =
  | { kind: "image_urls"; max: number }                         // today
  | { kind: "named"; slots: Partial<Record<AnchorRole, 1>> };   // future: face_reference/controlnet/ip_adapter/mask
```

`renderPackageForModel(package, schema)`:
- **image_urls** → ordered best-first URLs, capped. *Exactly today's bytes, but the order is now
  semantic and logged.*
- **named** → map `face → face_reference`, `pose → controlnet`, etc.

A model declares its `referenceSchema` in the registry. **The planner never changes when a roled
provider arrives** — only the registry entry + (if new) a renderer branch.

## Prompt de-duplication (channel arbitration)

Identity facts today repeat across Stage-0 subject, the appearance paragraph, and the M25.1 preserve
list. New structure — each fact once, on its best channel:

```
[1] Identity instruction   ← M25.1 preserve-vs-change (imperative). No description.
[2] Creative edit request  ← the user's scene + composition/lighting.
[3] Visual descriptors     ← appearance paragraph, ONLY for facets in package.missingRoles (gap-filling).
```

If a Tattoo Anchor is sent, the tattoo-layout paragraph is dropped — the image carries it. Where a
facet has **no** anchor, the text describes it. `compile.ts` filters `identity.appearance` by
`package.facetsCoveredByReference`.

## Data structures (new types)

```ts
type IdentityFacet = "face" | "tattoos" | "hair" | "piercings" | "body";

type ReferenceProfile = {
  mediaId: string;
  fitness: Record<AnchorRole, number>;   // 0..100
  reasons: Record<AnchorRole, string[]>;
  signals: Record<string, number>;       // raw scoring inputs (+ M26 similarity)
  exposure: ExposureLevel;
};

type IdentityAnchor = {
  role: AnchorRole;
  mediaId: string;
  url: string;                // signed, filled at render time
  score: number;
  importance: number;
  reasons: string[];
  roles: AnchorRole[];        // all roles this one image fills (merge-by-image)
  coversFacets: IdentityFacet[];
};

type CharacterPackage = {     // stable default (persistable later)
  identityId: string;
  anchors: IdentityAnchor[];  // best per role over the whole library
  computedFrom: { mediaCount: number; analyzedCount: number };
};

type IdentityPackage = {      // per-request view
  anchors: IdentityAnchor[];  // importance-ordered, face #1
  neededRoles: AnchorRole[];
  filledRoles: AnchorRole[];
  missingRoles: AnchorRole[]; // → text fills these
  facetsCoveredByReference: IdentityFacet[];
  exposureCeiling: ExposureLevel;
  faceAnchorSource: "face" | "hero" | "none"; // none → refuse
  reason: string;
};
```

## How existing code changes

| File | Change |
|---|---|
| `selection/types.ts` | Add the types above. Keep `SelectedReference` as a compat view during migration. |
| `selection/roles.ts` *(new)* | `RoleScorer` + `heuristicRoleScorer` (face reuses `scoreAnchor`). |
| `selection/package.ts` *(new)* | `buildCharacterPackage`, `resolvePackage`, `renderPackageForModel`. Absorbs `pickIdentityAnchor` (→ face role). |
| `selection/index.ts` | Export the package API. `buildReferencePackage` stays as a compat wrapper during migration. |
| `identity-engine/types.ts` | `ConditioningPlan` gains `identityPackage`; `referenceImages` becomes the *rendered* output. |
| `engines/reference/reference-engine.ts` | Build the package; stop collapsing roles. |
| `ai/model-registry.ts` | Add optional `referenceSchema` (default `image_urls`). |
| `ai/providers/fal.ts` | Consume via `renderPackageForModel`; drop the ad-hoc anchor-prepend (order is intrinsic). |
| `creative/stages/compile.ts` + `transform/planner.ts` | Channel arbitration: filter appearance by covered facets. |
| `generate-view.tsx` debug | Show the typed package (role · reason · score per image). |

**No schema migration** — everything derives from persisted `MediaVisionKnowledge`. Persistence of the
character package is a *later* additive table behind `getCharacterPackage()`.

## Migration plan (load-bearing → phased, never big-bang)

- **Phase A — Shadow mode (zero behavior change).** Build `ReferenceProfile` + `CharacterPackage` +
  `IdentityPackage` *alongside* the current selector; surface in Debug only. Current refs still drive
  generation. Validate scoring on real libraries at zero risk. `verify-reference-package.ts`.
- **Phase B — Switch the image channel. ✅ SHIPPED (Decision 064).** The Reference Engine
  (`selectReferences`) now builds → resolves → renders the Identity Package and returns it as
  provider-neutral `referenceImages` + `identityAnchor` (face carried in the anchor slot; the adapter's
  proven `[anchor, ...scene]` merge/cap is the renderer). Needed roles are transformation-driven
  (`req.transformation` from M25.1). The **Face-Anchor invariant is an identity-confidence policy**:
  every face anchor must clear `FACE_ANCHOR_MIN_SCORE` (0.40, `selection/anchor.ts`); when the analyzed
  library has none, the Hero (`displayImageId`) is analyzed on demand + cached (`ensureConfidentFace` in
  `generation/server.ts`) so it's scored by the same system — no Hero special-case. Still none →
  `faceAnchorSource: "none"` → `runImageGeneration` throws `NO_IDENTITY_ANCHOR` (refuse, never a
  stranger). Scope: reference/Kontext path only — LoRA/PuLID/manual/no-candidate paths unchanged.
  Byte-parity on the face-only case (verified against `pickIdentityAnchor`).
- **Phase C — Channel arbitration. ✅ SHIPPED (Decision 065).** The **information-budget rule**: every
  identity fact lives once, in its STRONGEST channel — transformation instruction (if changing) >
  reference image (if preserving) > appearance text (fallback). One rule, no special cases: drop a facet
  from the synthesized appearance paragraph when the transformation CHANGES it OR a selected reference
  CARRIES it. `synthesizeIdentityAppearance(metadatas, { omitFacets })` (`vision/synthesize.ts`) skips the
  hair/piercings/tattoo clause; `facetsChangedBy(change)` (`transform/planner.ts`) maps the change list to
  facets; `runImageGeneration` computes `omitFacets = changed ∪ facetsCoveredByReference` and splices the
  filtered appearance into the compiled prompt (`applyChannelArbitration`, pure string swap, order
  preserved). Byte-parity when `omitFacets` is empty (every non-arbitrated path unchanged). Transformation
  instructions themselves are untouched — only the descriptive layout leaves the text. Debug: "4.7 ·
  Channel Arbitration".
- **Phase D — Persistence + roled providers.** `IdentityPackage` table behind `getCharacterPackage`;
  `named` `ReferenceSchema` + renderer mapping when a roled provider lands.

## Forward links
- **M26 Identity Evaluation** → `evaluatorRoleScorer` fills `ReferenceProfile.signals` with real
  similarity; `IdentityPackage` is where output scores attach.
- **M28 Character Library** → a promoted generated image can become the `canonical` (or a new
  `BestTransform`) anchor; `CharacterPackage` is where it lands.
