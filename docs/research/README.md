# Research (docs/research/)

> **Research before implementation.** So far AI Studio has only researched **one** module — image
> generation providers (Fal/Kontext, see [../PROVIDER_RESEARCH.md](../PROVIDER_RESEARCH.md)). Every
> other major area below deserves the same treatment: **research the space first, make an informed
> architectural decision, then implement.** This fits AI Studio's direction — a platform driven by
> well-documented capabilities, not ad-hoc integrations.

## Workflow

Before each major milestone:
1. Open (or create) the relevant research doc here.
2. Survey approaches, models, trade-offs — capture findings + a recommendation.
3. Only then design architecture (a Decision in [../DECISIONS.md](../DECISIONS.md)) and implement.

## Completed research

| Doc | Covers |
| --- | ------ |
| [../PROVIDER_RESEARCH.md](../PROVIDER_RESEARCH.md) | **Research 01** — image generation providers (→ FLUX.1 Kontext) |
| [RESEARCH_02_VISION.md](./RESEARCH_02_VISION.md) | **Research 02** — Vision & Image Understanding (VLMs, detection, segmentation, pose, quality, embeddings, `VisionProvider` architecture) |

## Areas (backlog)

| Doc | Question | Feeds |
| --- | -------- | ----- |
| [PROVIDERS.md](./PROVIDERS.md) | Which generation providers, behind one capability router? | provider expansion |
| [IDENTITY_ANALYSIS.md](./IDENTITY_ANALYSIS.md) | How to score/rank identity reference images automatically? | Identity Intelligence |
| [VISION_MODELS.md](./VISION_MODELS.md) | How to semantically understand identity photos + outputs? (→ RESEARCH_02) | Image Understanding, evaluation |
| [SCENE_GRAPHS.md](./SCENE_GRAPHS.md) | Richer scene graphs (actions, relationships, context)? | Scene Understanding v2 |
| [PROMPT_ENGINEERING.md](./PROMPT_ENGINEERING.md) | How to score/optimize prompts before generating? | Prompt Quality |
| [IMAGE_EVALUATION.md](./IMAGE_EVALUATION.md) | How to evaluate output quality + identity consistency? | Character Consistency |
| [CREATIVE_MEMORY.md](./CREATIVE_MEMORY.md) | How to learn a user's style, provider-agnostically? | Creative Memory |

**Status:** all are **research-only** backlogs. Nothing here is implemented.
