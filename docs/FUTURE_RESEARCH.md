# Future Research — Backlog (documentation only)

> **Research topics, not implementation.** These capture the direction AI Studio is heading after
> the first successful Fal Kontext identity integration. Nothing here is built or scheduled; each
> topic should be **researched first** (see [`research/`](./research/)) before any architecture is
> designed. Long-term vision: [VISION.md](./VISION.md) (a **Creative Operating System**, not another
> image generator). Related: [CREATIVE_DIRECTOR_FUTURE.md](./CREATIVE_DIRECTOR_FUTURE.md),
> [LESSONS_LEARNED.md](./LESSONS_LEARNED.md).

## Guiding principle

AI Studio should become a **director** that understands *who the character is*, *what the scene is*,
*what style is desired*, *which provider is best*, *how to assemble references*, and *how to
evaluate the result* — so the underlying model is just one interchangeable component. Everything
below serves that, and must stay **provider-agnostic**.

## Research backlog

### Research 1 — Identity Intelligence (automatic reference selection)
Automatically **score** each identity image and pick the best references per request. Possible
attributes: face visibility, profile/front/back, body visibility, tattoos visible, hair visible,
clothing, lighting, sharpness, pose, expression. E.g. *business portrait* → best face/shoulders/hair;
*bikini at the beach* → full body + leg/back tattoos. Investigate how modern character-generation
systems organize identity libraries. → [`research/IDENTITY_ANALYSIS.md`](./research/IDENTITY_ANALYSIS.md)

### Research 2 — Image Understanding (semantic analysis of identity photos)
Turn identity images from *files* into *knowledge*: can AI Studio automatically understand tattoos,
hairstyle, clothing, body pose, face orientation — **without manual tagging**? (e.g. "Image 12:
front pose, long pink hair, neutral face, floral chest tattoo, left sleeve tattoo".)
→ [`research/VISION_MODELS.md`](./research/VISION_MODELS.md)

### Research 3 — Scene Understanding v2 (richer scene graphs)
Move beyond nouns to **actions, clothing, object interactions, spatial relationships, emotional
context**. Future graph: *Woman — holding Chihuahua — wearing bikini — standing — on yacht —
Mediterranean — golden sunset — wind in hair*. Research scene-graph approaches beyond our
deterministic parser. → [`research/SCENE_GRAPHS.md`](./research/SCENE_GRAPHS.md)

### Research 4 — Prompt Quality Analysis (score before generating)
Automatic prompt scoring **before** spending credits: e.g. *Prompt Quality 92/100* with warnings
(missing clothing, ambiguous lighting, unspecified camera angle, conflicting hairstyle). Suggest
improvements up front. → [`research/PROMPT_ENGINEERING.md`](./research/PROMPT_ENGINEERING.md)

### Research 5 — Character Consistency (evaluate the output)
Automatically evaluate whether a generated image still resembles the intended identity (*"Identity
confidence 58% — likely face drift"*), and if confidence drops, regenerate or choose different
references. Focus on **evaluation**, not generation. → [`research/IMAGE_EVALUATION.md`](./research/IMAGE_EVALUATION.md)

### Research 6 — Creative Memory (learn the user's style)
How could AI Studio learn a user's artistic style over time (cinematic, travel, Paris, fashion,
realistic tattoos, lifestyle) — *not just their appearance* — while staying provider-agnostic?
→ [`research/CREATIVE_MEMORY.md`](./research/CREATIVE_MEMORY.md)

## Product-vision milestones (documented, NOT scheduled)

The narrative these research topics feed into (order/scope will follow research):

- **M18 — Preserve User Intent** *(first fix shipped, Decision 039)* → richer enrichment still ahead.
- **M19 — Identity Intelligence** — automatic best-reference selection per request.
- **M20 — Image Understanding** — identity photos become structured knowledge.
- **M21 — Scene Understanding v2** — richer actions/relationships/context.
- **M22 — Prompt Quality Scoring** — evaluate + warn before generating.
- **M23 — Character Consistency Engine** — post-generation identity check + auto-correct.
- **M24 — Creative Memory** — style profiles.
- **M25 — Multi-step AI** — idea → creative director → identity selection → prompt optimization →
  provider selection → generation → quality eval → identity eval → final image.

## Suggested 8–12 week priority order

1. **Preserve User Intent** (critical bug — *first fix done*; richer enrichment next)
2. **Identity Intelligence** (automatic reference selection)
3. **Identity / Image Understanding** (analyze every identity photo)
4. **Scene Understanding v2** (richer actions & relationships)
5. **Prompt Quality & Identity Scoring** (evaluate before *and* after generation)
6. **Async Job Queue** (better UX for slower identity-preserving models)
7. **Creative Memory & Style Profiles**
8. **Provider Expansion** (OpenAI, Google, Ideogram, … behind the same capability router)
