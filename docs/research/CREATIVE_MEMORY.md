# Research — Creative Memory (learn the user's style)

> **Status: research-only.** Feeds "Creative Memory & Style Profiles". No implementation.

## Question

How could AI Studio learn a user's **artistic style** over time — *not just their appearance* — while
staying **provider-agnostic**?

Example: a user often requests *cinematic · travel · Paris · fashion photography · realistic tattoos
· lifestyle*. AI Studio could begin to bias defaults toward that style.

## To investigate

- What signals to learn from: past briefs, kept/favorited results, chosen styles/intents, edits,
  regenerations — a lightweight, **local** feedback loop (project- or user-scoped).
- **Style profiles**: preferred style, realism, aspect ratio, palette, camera, mood → used as
  defaults in the Creative Director (still overridable per generation).
- How to keep it provider-neutral (a profile biases the *brief*, never a specific model), and
  private (user data stays in AI Studio, not sent to providers as training).
- Relationship to project-aware defaults (see [../CREATIVE_DIRECTOR_FUTURE.md](../CREATIVE_DIRECTOR_FUTURE.md) Phase 3).

## Why it matters

Moves AI Studio from a tool you re-instruct every time toward a **director that knows your taste** —
core to the Creative Operating System vision ([../VISION.md](../VISION.md)).

## Open questions

- Explicit profiles (user-set) vs learned (inferred) vs both?
- How much memory before it feels presumptuous? Always transparent + overridable.
- Storage/retention/consent model.
