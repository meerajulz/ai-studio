# AI Studio — AI Architecture (the intelligence stack)

> One picture of the whole intelligence stack — and, more importantly, the **philosophy** behind it.
> Several AI layers have appeared (Creative Director, Identity Intelligence, providers, and soon
> embeddings + evaluation); this document explains not just *how* they fit together but *why* the
> system is built this way. Each layer has **one job** and talks to the next through a
> **provider-neutral contract**, never a vendor name.
>
> Deep dives: [CREATIVE_DIRECTOR.md](./CREATIVE_DIRECTOR.md) ·
> [IDENTITY_INTELLIGENCE.md](./IDENTITY_INTELLIGENCE.md) ·
> [AI_PROVIDERS.md](./AI_PROVIDERS.md) · [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md) ·
> research: [RESEARCH_02_VISION.md](./research/RESEARCH_02_VISION.md) ·
> [RESEARCH_03_FACE_EMBEDDINGS.md](./research/RESEARCH_03_FACE_EMBEDDINGS.md).

## Philosophy

**AI Studio is not an image generator. It is an intelligence system that thinks before it generates.**

Instead of asking one giant AI model to solve every problem, AI Studio **decomposes creativity into
specialized intelligence layers**. Each layer has exactly one responsibility. Each layer produces
*knowledge* that the next layer consumes. The image-generation model is only the final renderer —
**most of the intelligence happens before a single pixel is created.**

This architecture makes the system:

- **explainable** — you can see *why* every decision was made, at every layer
- **modular** — each layer is understood, tested, and improved on its own
- **deterministic where possible** — reasoning that doesn't need a model doesn't use one
- **provider-neutral** — layers speak contracts, never vendor names
- **replaceable** — any single model or provider can be swapped without touching the rest
- **continuously improvable** — every layer is a place to get smarter over time

> The goal is not to depend on one model becoming smarter.
> **The goal is to make AI Studio smarter.**

### The defining principle

> ## Provider → **Observations** · AI Studio → **Knowledge**

A provider *observes* ("a woman with pink hair and a chest tattoo"). AI Studio never stores that
sentence — it **normalizes observations into structured knowledge** it can query, score, and reason
over. This one idea is the spine of the whole stack: it is what makes the system provider-neutral,
explainable, and replaceable. Observations are disposable and vendor-specific; **knowledge is the
schema, and it belongs to AI Studio.** (See [IDENTITY_INTELLIGENCE.md](./IDENTITY_INTELLIGENCE.md).)

## Human first

Everything begins with **human intent**. No layer invents a goal; every layer serves the user's idea.

```
Human
  ↓
Idea
  ↓
Creative Director
```

**The user's intention always remains the source of truth.** The stack below exists to understand,
enrich, and faithfully realize that intention — never to replace it.

## The stack

```
                          User Prompt
                               │
   ┌───────────────────────────▼───────────────────────────┐
   │ CREATIVE DIRECTOR            src/lib/creative/          │
   │ intent · scene graph · composition · genre · camera ·  │
   │ lighting · relationships · prompt compiler             │  ← the creative reasoning engine
   └───────────────────────────┬───────────────────────────┘
                               │  (text: the user's idea is the source of truth)
   ┌───────────────────────────▼───────────────────────────┐
   │ IDENTITY INTELLIGENCE       src/lib/vision/            │
   │ Vision provider → IdentityMetadata → Coverage Engine → │
   │ Image Score → Reference Suitability → Identity Coverage│  ← observations in, KNOWLEDGE out
   │ (19B: + Face Embeddings)                               │
   └───────────────────────────┬───────────────────────────┘
                               │
   ┌───────────────────────────▼───────────────────────────┐
   │ REFERENCE SELECTOR          src/lib/selection/         │
   │ prompt requirements → match → package optimization →   │
   │ reasons + coverage warnings → best refs FOR THIS req   │  ← the decision layer
   └───────────────────────────┬───────────────────────────┘
                               │
   ┌───────────────────────────▼───────────────────────────┐
   │ PROMPT BUILDER              src/lib/prompt/            │
   │ identity package · scene · creative rules ·            │
   │ provider-specific optimization                         │  ← the translation layer
   └───────────────────────────┬───────────────────────────┘
                               │  (provider-neutral request + reference images)
   ┌───────────────────────────▼───────────────────────────┐
   │ IMAGE PROVIDER              src/lib/ai/                │
   │ routes on CAPABILITIES, never names: Fal · HF · …      │
   │ (Flux/Kontext/SDXL/…)                                  │  ← the final renderer (the only pixels)
   └───────────────────────────┬───────────────────────────┘
                               │
                        Generated Image
                               │
   ┌───────────────────────────▼───────────────────────────┐
   │ GENERATION INTELLIGENCE     (future — M22+)           │
   │ identity similarity · quality scoring · drift          │
   │ detection · automatic critique · retry suggestions ·   │
   │ generation ranking · learning                          │  ← the feedback layer
   └───────────────────────────┬───────────────────────────┘
                               │
   ┌───────────────────────────▼───────────────────────────┐
   │ CREATIVE MEMORY             (future)                   │
   │ which refs make the best portraits · which work for    │
   │ tattoos · which shine in beach scenes · which          │
   │ identities drift under which prompts · learned taste   │  ← the long-term memory
   └────────────────────────────────────────────────────────┘
```

## Layer responsibilities

Read top to bottom as a chain of **intelligence layers**, not software modules — each turns its input
into knowledge the next one consumes.

| Layer | What it really is | Where | Status |
| ----- | ----------------- | ----- | ------ |
| **Creative Director** | The creative reasoning engine — understands the user's *intention* before generation (intent, scene graph, composition), with the user's words as the source of truth | `src/lib/creative/` | ✅ v4 |
| **Identity Intelligence** | The perception layer — turns identity images into structured **knowledge** (metadata, coverage, image scores, reference suitability; soon face embeddings), **persisted** per image | `src/lib/vision/` | ✅ 19 · 19A · 19C · (19B next) |
| **Reference Selector** | The decision layer — prompt requirements → match → package optimization; chooses the *right* refs for *this* request, with reasons + warnings | `src/lib/selection/` | ✅ M20 |
| **Identity Engine** | Identity as a subsystem — Generation asks *how should I condition this identity?* → `ConditioningPlan`. Pluggable `IdentityModule`s (Reference ✅; LoRA/PuLID/InstantID designed), Identity Dataset (readiness), training + evaluation architecture. The Reference Selector is now the Reference Engine behind it | `src/lib/identity-engine/` | ✅ M22 (foundation) |
| **Prompt Builder** | The translation layer — turns intent + identity into a provider-optimized request | `src/lib/prompt/` | ◑ partial |
| **Image Provider** | The final renderer — the *only* layer that produces pixels, chosen by **capability**, never by name. A **Model Registry** routes to the best MODEL by capability (Auto/Manual/Dev); adding a model is config | `src/lib/ai/` | ✅ Fal + HF · model registry |
| **Generation Intelligence** | The feedback layer — measures, critiques, ranks, and learns from results (identity similarity, drift, quality, retry suggestions) | (M22+) | ⏳ |
| **Creative Memory** | The long-term memory — accumulated creative knowledge about what works, per identity/scene/reference | (future) | ⏳ |

### Why "Generation Intelligence", not "Evaluation"

This layer will do far more than score a finished image. It will measure **identity similarity**,
detect **drift**, produce **automatic critique** and **retry suggestions**, **rank** generations, and
feed **learning** back into the stack. "Evaluation" describes only the first of those — the layer is
intelligence about generation, so that is what we call it.

### Creative Memory (future) — accumulated knowledge, not model training

Over time AI Studio should *remember* creative knowledge, such as:

- which references consistently produce the best **portraits**
- which references work best for **tattoos**
- which images perform best in **beach scenes**
- which identities **drift** under certain prompts
- learned **preferences** over time

This is **not** model training and **not** fine-tuning. It is *accumulated creative knowledge* — the
system getting better because it learns from its own history, while the underlying models stay
replaceable. Clearly a **future** layer; noted here so the destination is visible.

## Identity Anchor — a separate question from selection

Two different questions, deliberately kept apart:

| Concept | Question it answers | Where |
| ------- | ------------------- | ----- |
| **Reference Selector** | *What images best DESCRIBE this request?* (body, tattoos, smile, scene) | `src/lib/selection/select.ts` |
| **Identity Anchor** | *WHO is this person?* | `src/lib/selection/anchor.ts` |

Every identity generation includes **exactly one Identity Anchor**: the strongest frontal face —
highest face quality, highest identity confidence, never cropped, **never replaced by scene logic**.
Its sole job is to tell the model who the subject is. It is chosen *independently* of the scene
selector, does **not** appear in the selector's reasoning/Debug, and the **provider adapter prepends
it** (deduped) to the reference list immediately before sending. If the selector already led with that
face, the dedupe makes it a no-op. This is an architectural invariant, not a provider-specific hack —
it just happens to also make reference-guided models (Kontext) preserve identity far better. Carried
as `ImageGenerationRequest.identityAnchor`; see [SMART_REFERENCE_SELECTION.md](./SMART_REFERENCE_SELECTION.md).

## The invariant that keeps this sane

Every boundary is a **provider-neutral contract**, and every layer has exactly one responsibility:

- **Gemini** never measures identity. **InsightFace** never understands tattoos. **Coverage** never
  understands smiles. **Providers** advertise capabilities; the app routes on those, never on names.
- Vision returns **observations**; AI Studio stores **knowledge**. Swapping a vendor changes exactly
  one adapter file and nothing else.

## Milestone map

**M20 marks the transition from an AI analysis *pipeline* to an AI *knowledge system*:** from here on,
uploaded identity images become **permanent structured knowledge** (`MediaVisionKnowledge`) that powers
every future generation — analyzed once, never at generation time. See
[SMART_REFERENCE_SELECTION.md](./SMART_REFERENCE_SELECTION.md).

`18 Identity Intelligence` → `19 Vision Intelligence` *(→ 19A rich metadata → 19B face embeddings)*
→ `20 Smart Reference Selection` ✅ → `21 Identity Description Synthesis` → `22 Generation Intelligence`
→ `23 Learning Loop` → `24 LoRA Benchmark` → `25 Dedicated Identity Models` → *(later)* Creative
Memory. See [ROADMAP.md](./ROADMAP.md).

## The philosophy, in one paragraph

**AI Studio does not ask one AI model to be intelligent. It builds intelligence by combining
specialized layers, each responsible for one part of the creative process.** The image model is only
the final renderer; the creative reasoning happens long before a single pixel is generated. A new
developer should leave this document understanding not only *how* AI Studio is built, but *why* it is
built this way — because that "why" is the architecture.
