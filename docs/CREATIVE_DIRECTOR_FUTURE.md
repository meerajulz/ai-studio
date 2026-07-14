# Creative Director — Future Roadmap

> **Documentation only.** None of the phases below are implemented. This captures the long-term
> evolution of the Creative Director so the vision isn't lost as we build incrementally. Current
> state: [CREATIVE_DIRECTOR.md](./CREATIVE_DIRECTOR.md) (v2 — deterministic scene-understanding
> pipeline). Guardrails that every phase must respect are at the bottom.

## Where we are (v2)

A deterministic, provider-agnostic reasoning pipeline:

```
idea → analyzeScene → analyzeIntent → planComposition → compilePrompt → prompt
```

Each stage is a pure function with a single responsibility and a structured hand-off. The next
milestone (**M14 — Identity-aware Generation, foundation**) inserts an optional **Identity
Context** stage *before* scene analysis, still provider-agnostic:

```
idea → [Identity Context] → scene → intent → composition → compile → prompt
```

Everything below builds on that shape — new intelligence goes *inside* a stage (or as a new
stage) behind the unchanged `directCreative(brief) → directive` contract.

## Phase 2 — Confidence & ambiguity

- **Confidence scores** for scene and intent detection. Each stage annotates its output with a
  confidence (e.g. `intent: automotive @ 0.9`). Powers everything else in this phase.
- **Ambiguity detection.** Recognise when a token is genuinely ambiguous — *"apple"* → fruit or
  company? *"jaguar"* → animal or car? Represent competing interpretations rather than silently
  picking the first.
- **A single clarification question, only when confidence is low.** If (and only if) confidence
  falls below a threshold, ask exactly one plain-language question ("Did you mean the fruit or the
  brand?"). Never interrogate the user; high-confidence prompts flow straight through.
- **Prompt specificity scoring.** Measure how detailed the user's idea already is. A vague prompt
  ("dog") gets heavy enrichment; a rich prompt ("golden retriever puppy on a mossy log at dawn,
  85mm, shallow depth of field") gets enriched *less* — the Director should respect a user who
  already knows what they want.

## Phase 3 — Project & identity awareness

- **Project-aware defaults.** A project can carry preferred style, realism, aspect ratio, palette,
  etc.; the Director uses them as defaults (still overridable per generation).
- **Identity-aware reasoning beyond simple context.** Go past "inject the identity's name/
  description" (M14) toward reasoning about the identity — consistent traits, framing that suits
  the subject, sensible defaults derived from its training media metadata.
- **Learn from successful generations in the project.** Use the project's own history (which
  briefs led to kept/favorited results) to bias defaults — a lightweight, local feedback loop.
- **Reusable creative presets.** Saved briefs / partial briefs the user can apply and tweak. This
  is the natural home of **Templates** (= saved Creative Director configurations).

## Phase 4 — LLM reasoning, scene graph & suggestions

- **Optional LLM-powered Scene Analysis behind the same interface.** Swap the deterministic Stage
  1 for an LLM implementation of `analyzeScene` without changing any caller — the whole pipeline
  was designed as isolated, replaceable stages precisely for this. Deterministic remains the
  default/fallback.
- **Provider-specific prompt optimization — while the Director stays provider-agnostic.** A final,
  optional optimization pass may tailor phrasing/weights to the *chosen* provider, but it lives in
  the provider adapter (or a clearly separated post-stage), never inside the reasoning stages.
- **Scene graph representation.** Evolve the flat `Scene` into a graph: primary subject, secondary
  subjects, and **spatial relationships** between them ("dog *on* sofa", "castle *behind* dragon").
  Enables far richer composition planning.
- **Creative suggestions.** Non-blocking, opt-in nudges surfaced to the user, e.g.:
  - "This prompt may work better as an interior scene."
  - "A cinematic composition would improve this result."
  - "Consider adding a focal subject."

## Guardrails (every phase must hold these)

1. **Provider-agnostic forever.** No stage imports a provider or model; only the compiled prompt
   leaves the layer (Decision 007). Provider-specific work stays in the adapter.
2. **Same public contract.** `directCreative(brief) → directive` stays stable; new intelligence
   goes *inside* stages. Callers never change.
3. **Deterministic default, LLM opt-in.** Determinism stays the baseline (reproducible recipes —
   Decision 030); LLM stages are opt-in and must degrade gracefully to the deterministic path.
4. **Simple by default.** The user still just describes what they want. Extra questions appear
   only when genuinely necessary (Phase 2), never technical settings.
5. **Transparent.** The dev Debug panel keeps exposing every stage (confidence, ambiguity,
   suggestions included) so the Director stays debuggable as it grows.
