# Provider Research — Identity-Preserving Image Models (Fal.ai)

> **Milestone 17, Phase 1.** Which Fal.ai model should power AI Studio's first true
> identity-preserving generation? Evaluated against identity preservation, character consistency,
> reference-image support (single + multiple), editing vs generation, photorealistic humans,
> commercial quality, API maturity, pricing, latency, and long-term maintenance.
>
> **Note on accuracy:** compiled from knowledge as of **January 2026**. Exact **endpoints,
> parameter names, pricing and latency change** — confirm against Fal's live docs
> (https://fal.ai/models) before relying on the numbers. The **recommendation and architecture**
> below are stable regardless of the exact figures.

## Why the current model can't do this

`fal-ai/flux/schnell` is a **text-to-image** model — it has no input-image port, so it cannot
consume our Identity Visual Package. Debug confirms `supportsReferenceImages = false`,
`usedReferenceImages = 0`. AI Studio correctly builds the package; the model just can't receive it.
We need a model with a **reference-image / in-context** input.

## Candidates

### 1. FLUX.1 Kontext (Black Forest Labs, via Fal) — **RECOMMENDED**

- **Endpoints:** `fal-ai/flux-pro/kontext` (single reference), `fal-ai/flux-pro/kontext/max`
  (higher fidelity), `fal-ai/flux-pro/kontext/max/multi` (multiple references).
- **Type:** **in-context editing + generation.** Takes an input image (the subject) + a text
  prompt and produces a new image that **keeps the subject** while changing scene / outfit / style.
- **Reference images:** ✅ single (`image_url`) and ✅ multiple (`image_urls`).
- **Identity / character consistency:** ✅✅ strong — built specifically for "same subject, new
  context." Preserves face, hair, build, and often tattoos/clothing detail far better than pure
  text.
- **Photorealistic humans:** ✅ excellent (FLUX Pro lineage).
- **Editing (outfit change / scene replacement / restyle):** ✅ this is its core competency —
  directly enables AI Studio's long-term vision (AI photo editing, travel photos, outfit changes).
- **API maturity:** ✅ hosted, stable sync endpoint, standard `{ images: [{ url }] }` response.
- **Pricing (approx., verify):** Kontext Pro ~\$0.04/img, Max ~\$0.08/img. Multi similar per image.
- **Latency (approx.):** ~10–25s (slower than schnell's ~1–3s; identity work costs time).
- **Long-term maintenance:** ✅ first-party BFL model, actively maintained; the same family scales
  to editing/inpainting workflows we'll want next.

### 2. PuLID (FLUX) — `fal-ai/flux-pulid`

- **Type:** face-identity injection into text-to-image (ID embedding from one face image).
- **Reference images:** ✅ single face (`reference_image_url`); ❌ not designed for multi-image
  curation.
- **Identity:** ✅ good **face** ID lock; weaker on body/tattoos/hair beyond the face.
- **Editing:** ❌ generation-only (not an editing model) — worse fit for outfit/scene edits.
- **Why not:** narrower (face-only), single reference, less aligned with the editing roadmap.

### 3. IP-Adapter Face ID — `fal-ai/ip-adapter-face-id`

- **Type:** face-conditioned generation via IP-Adapter.
- **Reference images:** ✅ face image(s). **Identity:** ⚠️ moderate — good likeness, can drift.
- **Editing:** ❌ generation-only. **Why not:** older technique; Kontext supersedes it for quality
  and for editing.

### 4. PhotoMaker — `fal-ai/photomaker`

- **Type:** identity from **multiple** photos → stylized/realistic generation.
- **Reference images:** ✅ multiple. **Identity:** ✅ decent, leans stylized; less faithful for
  strict photoreal likeness.
- **Editing:** ❌ generation-only. **Why not:** style-leaning, weaker strict photoreal identity.

### 5. InstantID — `fal-ai/instant-id`

- **Type:** single-image face ID + pose control. **Identity:** ✅ strong face lock.
- **Reference images:** ✅ single (+ optional pose). **Editing:** ❌ generation-only.
- **Why not:** face/pose focused, single reference, not an editing model.

## Comparison

| Model | Ref imgs | Multi | Editing | Identity (face/body) | Photoreal | API maturity | Fit for vision |
| ----- | :------: | :---: | :-----: | -------------------- | :-------: | :----------: | -------------- |
| **Flux Kontext** | ✅ | ✅ | ✅ | ✅✅ / ✅ | ✅ | ✅ | **best** |
| PuLID | ✅ | ❌ | ❌ | ✅ / ⚠️ | ✅ | ✅ | narrow |
| IP-Adapter FaceID | ✅ | ~ | ❌ | ✅ / ⚠️ | ✅ | ✅ | dated |
| PhotoMaker | ✅ | ✅ | ❌ | ✅ / ~ (stylized) | ~ | ✅ | stylized |
| InstantID | ✅ | ❌ | ✅ pose | ✅ / ⚠️ | ✅ | ✅ | face/pose |

## Recommendation — **FLUX.1 Kontext**

Kontext is chosen over the face-ID models because it is the only candidate that is simultaneously:
(1) **identity-preserving**, (2) an **editing / in-context** model, and (3) **multi-reference
capable**. AI Studio's long-term vision is explicitly *AI photo editing, scene replacement, outfit
changes, travel photos, identity-consistent generation and video* — all of which are **editing
workflows around a real person**, which is exactly what Kontext does. The face-ID models (PuLID,
InstantID, IP-Adapter) only *inject a face into a fresh generation*; they don't edit a real photo
and are single-reference / face-only, so they'd be a dead end for the roadmap.

**Integration plan (provider-neutral):**
- Default text-to-image stays `fal-ai/flux/schnell` (fast, cheap) for **no-identity** generation.
- When an identity with reference images is selected, the **Fal adapter** switches to Kontext:
  `fal-ai/flux-pro/kontext` for one reference, `fal-ai/flux-pro/kontext/max/multi` for several.
- Model choice lives **entirely inside the Fal adapter** (env-overridable: `FAL_IMAGE_MODEL`,
  `FAL_IDENTITY_MODEL`, `FAL_IDENTITY_MULTI_MODEL`). The router only knows *capabilities*
  (`identityPreservation` + `referenceImages`); the Creative Director stays text-only. Which
  reference image is "best" is decided **provider-neutrally** (hero → portrait → full body →
  curated references, best-first); the adapter takes the best one (single) or the set (multi).

**Deferred (out of scope, noted):** the sync `fal.run` endpoint is used for the MVP; if Kontext
latency exceeds the request budget, move to Fal's **queue API** behind the existing `asyncJobs`
capability + the `Job` table. No LoRA/DreamBooth/embeddings/fine-tuning — Kontext needs none.
