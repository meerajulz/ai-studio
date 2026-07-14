# Research — Identity Analysis (automatic reference selection)

> **Status: research-only.** Feeds "Identity Intelligence". No implementation.

## Question

How should AI Studio automatically **score and rank** an identity's training images and pick the
**best references per request** — removing manual Hero/Primary tagging?

## Per-image attributes to consider

face visibility · face quality · front / profile / back · body visibility (full/half) · tattoos
visible (which/where) · hair visibility · clothing · lighting quality · sharpness · pose · expression.

## Request-aware selection (examples)

- *business portrait* → best face + shoulders + hair
- *bikini at the beach* → full body + leg/back tattoos
- *standing in Paris* → front body + face + hair + tattoos

## To investigate

- How modern character-generation systems organize identity libraries (reference sets, "best of",
  auto-crop, per-attribute galleries).
- Deterministic heuristics (metadata + roles we already store) vs a vision model producing the
  attributes (see [VISION_MODELS.md](./VISION_MODELS.md)).
- A **scoring function**: given a request's needs (from the scene graph — face? body? tattoos?),
  rank images and assemble the package.

## Why it matters

Lessons Learned: identity quality now depends mostly on **reference quality/relevance**, not the
provider. Better selection is the biggest identity lever.

## Open questions

- Where do attributes live — computed on upload, or on demand? Cached where (no provider coupling)?
- How to keep selection **provider-neutral** (the adapter still just receives ranked references)?
