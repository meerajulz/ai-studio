# Research — Scene Graphs (Scene Understanding v2)

> **Status: research-only.** Feeds "Scene Understanding v2". Builds on the current deterministic
> parser ([../CREATIVE_DIRECTOR.md](../CREATIVE_DIRECTOR.md), v4). No implementation.

## Question

How do we make the scene graph much richer — capturing **actions, clothing, object interactions,
spatial relationships and emotional context** — rather than only nouns + a few prepositions?

## Now → future

```
now:     Dog — on — Table
future:  Woman — holding Chihuahua — wearing bikini — standing — on yacht —
         Mediterranean — golden sunset — wind in hair
```

## To investigate

- Scene-graph representations beyond our deterministic lexicon parser: dependency parsing, semantic
  role labeling, open-vocabulary extraction; LLM-based extraction (kept optional, behind the same
  stage interface, deterministic default).
- Modeling **attributes on nodes** (clothing, color), **actions as edges**, **emotional/atmospheric
  context** (mood, weather, light) as first-class.
- Keeping the guarantee from Decision 039: **the user's prompt stays the source of truth**; the graph
  informs composition and enrichment, never replaces the words.

## Why it matters

Richer understanding → richer, more faithful prompts (the next big prompt-quality gain), and better
composition decisions.

## Open questions

- Deterministic-vs-LLM boundary per attribute (start deterministic, LLM opt-in)?
- How to enrich ("on a boat" → "standing on a luxury yacht overlooking the Mediterranean") *without*
  fabricating facts the user didn't ask for? Confidence + neutral wording (as today) extended.
