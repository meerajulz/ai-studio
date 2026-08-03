# Identity Benchmark — where does identity drift come from?

> **Evidence before heuristics.** M20's selector demonstrably sends the right images for the request,
> yet the generated face can still drift. Before changing selection again, this benchmark isolates
> *where* the failure occurs: our selection logic vs. the provider's identity preservation.
> Dev-only tooling (Milestone 20); no production behavior changes.

## What the tooling gives you

1. **See the actual images sent.** The Generate → Debug panel now shows **thumbnails of the exact
   reference images sent to the provider, in order** (`referenceImages.sentImages`) — not just roles.
2. **Verify the Identity Anchor is first.** The first thumbnail is ringed and labelled **★ anchor**
   when an Identity Anchor was prepended, so you can confirm image #1 is always the best frontal face.
3. **Vary reference count without code changes.** A dev-only **References 1 · 2 · 3 · 4 · Auto**
   control on the Generate page caps how many references are sent (the anchor is always kept first, so
   `1` = anchor only). Requires an identity to be selected.
4. **Traceable results.** Each generation records `params.references` (`{ maxReferences, offered,
   anchorIncluded }`) so results are attributable to a reference count after the fact.
5. **Manual reference picker** (dev-only). On the Generate page, toggle **References → Manual** to pin
   *exactly which* analyzed training images are sent and **in what order** — bypassing the selector,
   the Identity Anchor, and the safety filter. Click thumbnails to include/exclude, drag to reorder;
   badges show **Anchor / Face / Body / Tattoos / Hair / Smile**; the ordered strip is the exact order
   sent to Fal (max 4). The Debug panel states **"Manual reference selection (dev)"**. This answers
   *which* image helps or hurts (not just how many): e.g. clean selfie alone, selfie + full body,
   selfie + back-tattoo, studio portrait only, four best portraits, or no tattoo images at all.

## Identity Anchor ranking (why THIS face was chosen)

The Generate → Debug panel prints the **anchor scoring breakdown** for the top candidates:

| column | meaning |
| ------ | ------- |
| `faceQ` | per-component face quality (sharpness/lighting/occlusion/symmetry/frontalness/eyes/resolution) |
| `frontal` | frontality (front = 100, three-quarter = 70, profile = 30, back = 0) |
| `eyes` · `light` | eye visibility · face lighting |
| `res` · `prom` | **face size** in frame (headshot ≈ 100, full-body ≈ 35) and the prominence multiplier |
| `score` | `frontal × faceQ × conf × prominence` — **face only**, never body coverage or overall utility |

The anchor is scored on **face quality alone** (confirmed) — but with an explicit **prominence** term so
a clear **close-up** beats a **full-body** studio shot whose face is small. (Before the prominence fix, a
full-body with slightly higher face confidence could win despite a tiny face; the `res`/`prom` columns
make that visible, and `verify-selection.ts` asserts a close-up now wins.) If, with this breakdown
visible, the full-body genuinely has the strongest, most prominent frontal face, then the anchor choice
is correct and remaining drift is the model's.

## Protocol

Pick one identity (analyzed) and **one fixed prompt** (e.g. *"Julieta, business portrait in an
office"*). Then generate **four times**, changing only the References control:

| Run | References | Sent to provider |
| --- | ---------- | ---------------- |
| A | **1** | identity anchor only (the clean frontal face) |
| B | **2** | anchor + top scene reference |
| C | **3** | anchor + 2 scene references |
| D | **4** | anchor + 3 scene references |

For each run, in the Debug panel confirm: image #1 is the **★ anchor**, and note the sent thumbnails.
Save/compare the four outputs (they're in the Gallery; `params.references.maxReferences` tags each).

Repeat for a **body/scene** prompt (e.g. *"…walking on the beach in a bikini"*) where the anchor is a
face but the scene references are full-body.

## What to look for

- **Does identity improve or degrade as references increase (1 → 4)?**
  - If **1 reference (anchor only) preserves identity best** and adding scene references *degrades*
    the face → the extra references are pulling identity away; the lever is *how* we combine references
    (or send fewer), not which we pick.
  - If **more references help** → keep them; drift is elsewhere.
  - If **the face drifts even at 1 clean anchor** → it is not a selection problem at all.
- **Is image #1 always the correct anchor?** If not, that's a pipeline bug to fix first. (Verified in
  `scripts/verify-selection.ts`: `pickIdentityAnchor` returns the strongest frontal face.)

## Model comparison (Kontext Max Multi vs Pro Multi)

Before researching LoRA, compare the two closest Fal multi-reference models with **everything else
held constant** (same prompt, same references + order, same identity package). A dev-only **Model**
selector on the Generate page swaps only the Fal model id:

- `fal-ai/flux-pro/kontext/max/multi` (Kontext Max Multi)
- `fal-ai/flux-pro/kontext/multi` (Kontext Pro Multi)

The chosen model rides as `modelOverride` → the Fal adapter uses it (forcing the multi request shape);
`Generation.model` records the exact model used per result, and the Debug panel shows "Chosen model".
**Adding another Fal model to benchmark is a config edit in `src/lib/ai/benchmark-models.ts` — no
business-logic change** (provider abstraction requirement).

**Protocol:** best done in **Manual** reference mode so the exact same images/order go to both models.
Fix the prompt + manual selection, then generate once per model. Compare:

| Criterion | Max Multi | Pro Multi |
| --------- | --------- | --------- |
| Facial identity preservation | | |
| Tattoo preservation | | |
| Hair consistency | | |
| Prompt adherence | | |
| Overall realism | | |

> _Seed:_ a fixed seed isn't sent yet, so outputs vary run-to-run — generate a few per model and judge
> the trend, not a single pair. (A dev seed input is a possible follow-up.)

**If the two models are essentially identical**, switching Kontext Pro↔Max Multi won't solve the facial
identity issue → move to **identity LoRA / stronger identity-conditioning**, not more selector tuning.

## Conclusion (fill in after running)

> _Record findings here._
>
> - Anchor is image #1 in every run: ☐ yes ☐ no
> - Best identity at N references: ☐ 1 ☐ 2 ☐ 3 ☐ 4
> - Face drifts even with a single clean anchor: ☐ yes ☐ no

**Interpretation.** If the selector is sending the correct images (anchor first, scene-appropriate
rest) and identity still drifts — especially if it drifts even at a single clean anchor — then the
bottleneck is **the provider's identity preservation** (Flux/Kontext is reference-*guided editing*, not
identity *binding*), **not AI Studio's selection logic.** That is the signal to stop tuning the selector
and move to the identity-preservation milestone: **face embeddings → similarity/drift scoring →
generation evaluation → LoRA**. Conversely, if adding references measurably hurts, we adjust how many
references we send (or their weighting) — with evidence, not guesswork.
