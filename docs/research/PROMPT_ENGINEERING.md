# Research — Prompt Engineering & Quality Analysis

> **Status: research-only.** Feeds "Prompt Quality Scoring". No implementation.

## Question

Can AI Studio **score a prompt before generating** and warn the user — saving credits on
low-quality or ambiguous prompts?

Target UX:
> **Prompt Quality 92/100** — ⚠ clothing missing · ⚠ lighting ambiguous · ⚠ camera angle
> unspecified · ⚠ hairstyle conflicts

## To investigate

- **Checks:** missing clothing / camera / lighting; conflicting instructions; ambiguity ("apple" =
  fruit or brand?); identity conflicts (prompt fights the identity); over/under-specification.
- Deterministic scoring from the scene graph + intent + composition (what's present vs a genre's
  expected slots) vs an LLM critic (optional).
- How **different providers interpret prompts** — provider-specific prompt optimization (kept in the
  adapter, Decision 007), while scoring stays provider-neutral.
- A "**Creative Critic**" pass (self-review before generation) — see also
  [../CREATIVE_DIRECTOR_FUTURE.md](../CREATIVE_DIRECTOR_FUTURE.md) Phase 2.5.

## Why it matters

Cheaper, better generations; fewer wasted credits; a teaching UX that improves user prompts.

## Open questions

- Warnings only, or also auto-fix (with consent)?
- Score thresholds → block, warn, or proceed?
