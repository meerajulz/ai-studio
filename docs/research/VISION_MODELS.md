# Research — Vision Models (image understanding)

> **Status: research-only.** Feeds "Image Understanding" (identity photos → knowledge) and, later,
> output evaluation. No implementation.

## Question

Can AI Studio **automatically understand** identity photos (and generated outputs) — tattoos,
hairstyle, clothing, body pose, face orientation, expression — **without manual tagging**?

Example target for one image:
> *front pose · long pink hair · neutral face · arms visible · legs visible · floral chest tattoo ·
> left sleeve tattoo · black arm tattoo*

## To investigate

- **Vision-language models** for tagging/description (open-vocabulary): captioners, VQA, detection/
  segmentation for tattoos & body parts, face-orientation estimators, pose estimators.
- Hosted vs local; provider-agnostic access (a `VisionProvider` mirroring `ImageProvider`?).
- Cost/latency of analyzing every training image once (on upload) and caching structured results.
- Accuracy on the attributes that matter for identity (tattoo location, hair, orientation).

## Why it matters

Turns identity images from *files* into *structured knowledge* — the foundation for automatic
reference selection ([IDENTITY_ANALYSIS.md](./IDENTITY_ANALYSIS.md)) and consistency evaluation
([IMAGE_EVALUATION.md](./IMAGE_EVALUATION.md)).

## Open questions

- One vision model for tagging + evaluation, or specialized models per task?
- Store attributes as media metadata (media layer) without coupling to any provider?
- Privacy/consent implications of automated body/tattoo analysis.
