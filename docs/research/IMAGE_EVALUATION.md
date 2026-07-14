# Research — Image Evaluation (output quality & character consistency)

> **Status: research-only.** Feeds "Character Consistency Engine" (M23) and output quality checks.
> Focus on **evaluation**, not generation. No implementation.

## Question

After generating, can AI Studio automatically evaluate:
1. **Identity consistency** — *"does this still look like Julieta?"* (e.g. *Identity confidence 58%
   — likely face drift*), and
2. **Image quality** — sharpness, artifacts, anatomy, prompt adherence?

If identity confidence drops below a threshold → **regenerate or choose different references**.

## To investigate

- **Face/identity similarity** metrics (face embeddings, similarity to reference set) — provider-
  agnostic scoring on the output vs the Identity Visual Package.
- **Quality/aesthetic scoring** and **prompt-adherence** (does the image contain what was asked —
  ties to vision understanding, [VISION_MODELS.md](./VISION_MODELS.md)).
- A **feedback loop**: low score → auto-retry with different references / adjusted prompt (ties to
  Multi-step AI, M25).

## Why it matters

Turns AI Studio from "generate and hope" into "generate, evaluate, correct" — the difference between
a wrapper and an intelligent creative system.

## Open questions

- Cost of evaluating every generation vs on demand?
- Thresholds + how many auto-retries before asking the user?
- Where do evaluation scores live (recipe metadata), staying provider-neutral?
