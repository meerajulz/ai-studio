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

1. **Style preset** (`realistic` default · cinematic · illustration · fantasy) → a look
   descriptor, lighting, and a **"professional" quality floor** (the baseline that lifts image
   quality even for a bare idea).
2. **Subject detection** → keyword rules map the idea to an emphasis + subject-specific detail
   (e.g. pet → *detailed fur, expressive eyes*; person → *detailed skin texture*; product →
   *soft reflections, clean background*; landscape → *atmospheric depth*).
3. **Focus** framing (auto-detected, or the optional user answer) → composition + emphasis
   modifiers (face / environment / product / action).
4. **Compose** → the user's idea first, then only new, de-duplicated phrases (never repeating
   something the user already wrote).

Example: `"my dog"` → *"my dog, detailed fur, expressive eyes, portrait, close-up, photorealistic,
natural soft lighting, highly detailed, sharp focus, professional photography, high resolution,
shallow depth of field."*

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
