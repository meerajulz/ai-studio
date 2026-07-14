# Creative Director

> **Status: IMPLEMENTED (Milestone 12 MVP, Decision 031).** Code: `src/lib/creative/`.
> Companion design: [PROMPT_BUILDER.md](./PROMPT_BUILDER.md) · [CREATIVE_WORKFLOW.md](./CREATIVE_WORKFLOW.md).

## What it is

The **Creative Director** is the intelligent translation layer between a user's creative **idea**
and the AI provider. The user *thinks creatively*; the Director *thinks technically*.

```
Creative idea  →  Creative Director  →  Professional prompt  →  Image provider  →  Gallery
   "my dog"          (this layer)         (enriched prompt)         (FLUX)
```

It is **the only place in the app that enriches a prompt.** Everything else passes the user's
words straight through to here.

## Contract

One pure entry point:

```ts
directCreative(brief: CreativeBrief): CreativeDirective
```

- **`CreativeBrief`** — the user's *intent*: `idea` (required) + optional `style`, `focus`,
  `identityId`. Never technical settings.
- **`CreativeDirective`** — `prompt` (professional, provider-neutral), reserved `params`
  (aspect/quality — future), and `meta` (version, resolved style/focus, applied modifiers,
  `identityAware`) for transparency + recipes.

**Deterministic + pure** for the MVP: same brief → same directive, no I/O, no provider SDKs, no
AI. This is deliberately a small rules engine so it can be **replaced by an LLM later without
changing callers** — the contract stays `CreativeBrief → CreativeDirective`.

## How the MVP enriches (deterministic rules)

1. **Intent classification** → `detectCategory(idea)` maps the idea to a **subject category**:
   `person · animal · interior · place · food · vehicle · product · object`. First keyword rule
   wins; **unknown → `object`**, the NEUTRAL fallback.
2. **Category framing** → each category picks a composition + subject detail. Only `person`/
   `animal` use portrait/eye framing; `interior`/`place` use wide/architectural framing;
   `object` adds **nothing** that biases the subject. (An explicit Focus answer overrides this.)
3. **Style preset** (`realistic` default · cinematic · illustration · fantasy) → a look
   descriptor, lighting, and a **"professional" quality floor** (the baseline that lifts quality
   even for a bare idea).
4. **Compose** → the user's idea first, then only new, de-duplicated phrases (empties dropped,
   never repeating something the user already wrote).

Examples:
- `"my dog"` → *animal* → *"my dog, detailed fur, expressive eyes, portrait, photorealistic, …"*
- `"sofa"` → *object* → *"sofa, photorealistic, natural soft lighting, highly detailed, …"* (no portrait)
- `"kitchen"` → *interior* → *"kitchen, natural light, architectural detail, wide-angle interior shot, …"*

### Intent classification must never force people

Two rules exist specifically to stop the Director hallucinating people onto generic subjects
(the Milestone 12 bug where `sofa`/`chair`/`table`/`kitchen` rendered a person/animal):

- **Neutral fallback.** An unrecognized subject is `object`, which adds no portrait/eye/face
  tokens. It must NEVER default to `face` — a face default made *every* unknown noun a portrait,
  and the portrait tokens dominated the model.
- **People-negation guard.** `PEOPLE_NEGATION` detects "no person / without people / no one /
  nobody / unoccupied". When present, the `person` rule is suppressed — so
  *"modern living room … no person on it"* classifies as **interior**, not a portrait of a man.

## Developer Debug Mode (development only)

To keep the Director transparent as it grows more intelligent, every generation returns a
`debug` trace **only when `NODE_ENV !== "production"`** (`GenerationResult.debug`, `undefined` in
production). The Generate page renders it as a panel: **user idea · detected intent · style ·
focus · creative rules applied · compiled prompt · provider · model · generation payload**. The
payload is a **secret-free echo** the provider adapter builds (`ImageGenerationResult.requestPayload`
— never contains the token). Nothing debug-related is shipped to production.

## Integration

- Wired at the single generation chokepoint: `runImageGeneration` (`src/lib/generation/server.ts`)
  calls `directCreative`, sends the compiled prompt to the provider, stores the user's **idea** in
  `Generation.prompt` and the brief + compiled prompt in `params.creative`.
- **Recipes stay reproducible** (Decision 030): regenerate/variation reconstruct the brief from
  `params.creative` and re-run it. No schema change.
- **Provider-agnostic** (Decision 007): the Director never imports a provider; any
  provider-specific mapping stays in the `ImageProvider` adapter.
- **UI:** only one optional creative question — **Style**. No CFG/steps/sampler/negative-prompt/
  LoRA/model/provider is ever exposed.
- **Identity:** the brief carries `identityId` so the Director *knows* an identity exists
  (`meta.identityAware`); identity-aware prompting is deferred.

## Future (behind the same entry point)

Prompt optimization (optionally an LLM pass), provider/model/pipeline selection, richer brief
facets + Creative Questions, identity-aware prompting, and video prompting — all added inside the
Creative Director without changing how callers invoke it.
