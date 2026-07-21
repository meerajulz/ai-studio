# Identity Technologies — research & comparison (M24.5)

> Living reference for identity-preservation tech. Update it when new adapters ship so we don't
> re-run this research. Last updated 2026-07-21. See [IDENTITY_ENGINE.md](./IDENTITY_ENGINE.md).

## TL;DR

- **The face is the gap.** Benchmarking our FLUX LoRA on Julieta: tattoos/hair/jewelry/body =
  excellent; **facial identity = weak**. This is a *conditioning* limit, not our architecture.
- **Face-ID adapters and LoRA solve different halves.** Every face adapter (PuLID, InfiniteYou,
  InstantID, …) injects a **face embedding** — great faces, but **no tattoo/body/clothing preservation**
  (exactly what our LoRA is good at).
- **Hosted single-call APIs cannot stack LoRA + a face adapter.** PuLID-Flux takes a face image, not a
  `loras` array; Kontext-LoRA takes weights, not a face embedding. Stacking them needs ComfyUI (ruled
  out). So in hosted mode they are **alternative strategies**, chosen per request — not additive.
- **Hosted reality:** the best FLUX face adapter *on Fal* is **PuLID**. The best *overall* is
  **InfiniteYou** (beats PuLID) but it's **Replicate-only** — adopting it means adding a Replicate
  provider (which also finally gives AI Studio a 2nd inference provider).
- **Recommendation:** add **PuLID (Fal)** as the first face-identity module now (validates the
  pluggable architecture, hosted, cheap, drop-in), build the **reusable identity benchmark**, and adopt
  **InfiniteYou (Replicate)** next if PuLID's face isn't good enough. Keep **LoRA** — it stays the best
  option for tattoo/body-heavy scenes.

## The core trade-off

| Concern | Reference (Kontext) | Reference + **LoRA** | Face adapter (PuLID / InfiniteYou) |
|---|---|---|---|
| Facial identity | weak (drifts) | **weak** ← the gap | **strong** |
| Tattoos / body / clothing | medium | **strong** | weak (face-only) |
| Prompt/scene freedom | high | medium | medium–high |
| Multi-reference | up to 4 | 1 (Kontext-LoRA) | 1 (single face) |
| Per-identity cost | none | one training run | none (zero-shot) |

**Consequence:** no single hosted technique wins everything. The Identity Engine should pick the best
technique **per request** (portrait/face-critical → face adapter; full-body-with-tattoos → LoRA) and let
the benchmark decide the defaults. This is exactly what the strategy-routing was designed for.

## Comparison — identity technologies (2026-07)

| Tech | Base | Face | Tattoo/body | Multi-ref | Text align | Hosted API | License | Verdict |
|---|---|---|---|---|---|---|---|---|
| **PuLID-Flux** | FLUX.1-dev | good | ❌ face-only | ❌ single | medium (copy-paste) | **Fal** `fal-ai/flux-pulid`, Replicate | Apache-2.0 (code) | **ADOPT (Fal, now)** |
| **InfiniteYou** (InfU) | FLUX.1-dev | **best** | ❌ face-only | ❌ single | **high** | **Replicate** `zsxkib/infinite-you`, HF | Apache-2.0 (ICCV'25) | **ADOPT NEXT (needs Replicate)** |
| **LoRA** (portrait) | FLUX.1-dev | weak | **best** | 1 (Kontext-LoRA) | high | **Fal** (train + infer) | — | **KEEP** (already shipped) |
| **InstantID** | SDXL | good | ❌ | ❌ | medium | Fal/Replicate (SDXL) | Apache-2.0 | REJECT (SDXL base ≪ FLUX) |
| **DreamO** | FLUX.1-dev | medium | partial | ✅ | medium | Fal **DEPRECATED**; Replicate | — | REJECT (Fal deprecated) |
| **UNO** | FLUX.1-dev | good | subject-level | ✅ multi-subject | medium | Replicate | Apache-2.0 (ICCV'25) | WATCH (Replicate) |
| **WithAnyone** | FLUX | **strong**, low copy-paste | ❌ | ✅ multi-**person** | high | **none yet** (HF/GitHub) | research (ICLR'26) | WATCH (no hosted API) |
| **FLUX.2 multi-ref** | FLUX.2 | improving | via refs | ✅ up to 10 | high | **Fal** | BFL license | WATCH (needs FLUX.2 stack) |

## Per-technology notes

- **PuLID-Flux** — tuning-free ID customization for FLUX.1-dev; inject one face image + prompt.
  Params (Fal): `reference_image_url`, `prompt`, `id_weight` (identity strength), `true_cfg`,
  `start_step`, `num_inference_steps`, `guidance_scale`, `seed`, `image_size`. Output `images[]` +
  `has_nsfw_concepts` — **same shape our `fal.ts` already handles**. ~$0.033/MP. Weaknesses (per the
  InfiniteYou paper): degraded text alignment + "face copy-paste". **Cleanest drop-in.**
- **InfiniteYou** — ByteDance InfuseNet injects identity via residual connections into the DiT.
  Two variants: `aes_stage2` (default; best text/aesthetics), `sim_stage1` (max ID similarity).
  **Outperforms PuLID-Flux and IP-Adapter**; preferred in ~80% of human evals. Hosted on **Replicate**
  (`zsxkib/infinite-you`) — no Fal endpoint found. Adopting it = **add a Replicate provider**.
- **LoRA** (ours, `flux-lora-portrait-trainer` → `flux-kontext-lora`) — best for tattoos/body/hair;
  face is weak. Keep as one technique among several.
- **InstantID** — strong but **SDXL-native**; FLUX ports are immature. Base quality below FLUX. Reject.
- **DreamO / UNO** (ByteDance, unified customization, multi-condition) — promising for combining
  identity + subject, but **DreamO's Fal endpoint is deprecated** and UNO is Replicate-only. Revisit if
  re-hosted.
- **WithAnyone** (ICLR'26) — multi-**person**, contrastive ID loss, explicitly reduces copy-paste; no
  hosted API yet. Strong future candidate once someone hosts it.
- **FLUX.2 multi-reference** — native up-to-10-reference character consistency; a different (non-adapter)
  path. Requires moving the train+infer stack to FLUX.2 (see the ROADMAP note on FLUX.2).

## Provider support (hosted-first; ComfyUI excluded)

| Tech | Fal | Replicate | HF Inference | Together |
|---|---|---|---|---|
| PuLID-Flux | ✅ `fal-ai/flux-pulid` | ✅ | demo | — |
| InfiniteYou | ❌ | ✅ `zsxkib/infinite-you` | space | — |
| LoRA (FLUX.1) | ✅ train + infer | ✅ | — | — |
| DreamO | ⚠️ deprecated | ✅ `zsxkib/dream-o` | — | — |
| UNO / WithAnyone | ❌ | UNO ✅ / WithAnyone ❌ | space | — |

**Implication:** staying Fal-only limits us to **PuLID** for a face adapter. Getting **InfiniteYou**
(the quality leader) requires a **Replicate provider** — a worthwhile addition (2nd provider, and unlocks
InfiniteYou/UNO/DreamO). This aligns with the earlier "Image Router → multiple providers" evolution.

## Recommendation

1. **Now — PuLID as the first face-identity module (Fal).** It's the only strong FLUX face adapter
   hosted on our existing provider, drops into `fal.ts` (output shape already handled), and proves the
   Identity Engine can route a **second, non-LoRA** technique end-to-end. Strategy: `reference+pulid`
   (really "PuLID with a face reference" — one image).
2. **Build the reusable identity benchmark** (below) and compare **reference / reference+lora / pulid**
   on Julieta across the metrics. Let evidence set the Auto default per request type.
3. **Next — InfiniteYou via a new Replicate provider** if PuLID's face isn't sufficient (research says it
   likely won't fully satisfy). This also gives AI Studio its 2nd inference provider.
4. **Keep LoRA.** For tattoo/body-heavy scenes it remains the best hosted option. The engine chooses.
5. **Watch** WithAnyone (multi-ID, once hosted) and FLUX.2 (native multi-ref + LoRA).

**Non-goal:** proving PuLID "wins". The goal is a technology-agnostic engine that adopts whatever is
best — and the honest current answer is "**LoRA for body/tattoos, a face adapter for the face, chosen
per request; InfiniteYou > PuLID on quality but PuLID is the hosted-on-Fal option today**."

## Benchmark framework (reusable for every future adapter)

A single identity + prompt, generated by each available strategy, scored on:

| Metric | How (M25 evaluation engine) |
|---|---|
| Face similarity | InsightFace/ArcFace cosine vs the identity's reference faces |
| Tattoo preservation | region match vs `IdentityMetadata` tattoos (coverage engine) |
| Hair / accessories | attribute match vs synthesized appearance |
| Prompt adherence | CLIP text-image similarity |
| Composition | (qualitative now; CLIP/aesthetic later) |
| Generation time | wall-clock per call |
| Cost | provider price × megapixels |

Design: `benchmarkIdentity(identityId, prompt, strategies[])` → a table row per strategy. Wire it to the
reserved `IdentityEvaluation` metrics (M25) so the same harness feeds automatic scoring later. Until M25
lands, the harness runs the generations + records time/cost and leaves similarity scores for manual/eval.

## Roadmap

- **M24.5 (this):** research + this doc + PuLID module (Fal) + benchmark harness (generations + time/cost).
- **M25 — Identity Evaluation Engine:** implement `IdentityEvaluator` (InsightFace face similarity +
  embeddings) → fill the benchmark's similarity columns automatically.
- **M25.x — Replicate provider + InfiniteYou module** (if PuLID's face is insufficient).
- **M26 — Automatic best-candidate:** use the evaluator to pick the best strategy per request.
- **Watch:** WithAnyone (multi-ID hosting), FLUX.2 (native multi-ref + LoRA → the one path that could
  finally combine face + tattoos in a single hosted call).

## Sources

PuLID-Flux (Fal): https://fal.ai/models/fal-ai/flux-pulid/api ·
InfiniteYou (paper/Replicate): https://arxiv.org/abs/2503.16418 , https://replicate.com/zsxkib/infinite-you ·
DreamO (Fal, deprecated): https://fal.ai/models/fal-ai/dreamo ·
UNO: https://github.com/bytedance/UNO · WithAnyone: https://arxiv.org/abs/2510.14975 ·
InstantID: https://huggingface.co/InstantX
