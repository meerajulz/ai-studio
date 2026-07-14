# Lessons Learned — First Identity-Preserving Generations (Fal Kontext)

> Discoveries from AI Studio's **first end-to-end identity-preserving generations** (Milestone 17,
> Fal FLUX.1 Kontext). Documentation of what we observed in real tests — not a spec. See
> [DECISIONS.md](./DECISIONS.md) (#036 provider foundation, #038 Kontext, #039 preserve-intent fix),
> [PROVIDER_RESEARCH.md](./PROVIDER_RESEARCH.md), [CREATIVE_DIRECTOR.md](./CREATIVE_DIRECTOR.md).

## Milestone: it works

AI Studio successfully completed its **first identity-preserving generation**. Selecting an
identity (e.g. "Julieta") and generating a new scene produced a **recognizable** person — same
face, hairstyle (pink hair), tattoos and body proportions — not a generic person described by text.
This validates the whole provider-agnostic architecture end to end.

## Identity architecture — validated

- The **Identity Visual Package** reaches the provider correctly. The provider receives the
  curated references (**Hero → Portrait → Full body → additional references**, best-first).
- The **capability router** correctly selects **Kontext** when reference images exist (needs
  `identityPreservation` + `referenceImages`), and falls back to normal text-to-image otherwise.
- The identity package genuinely arrives at the model — the earlier `supportsReferenceImages =
  false` / `usedReferenceImages = 0` bottleneck is gone.
- **The remaining identity improvements are about selecting *better* reference images, not about
  changing providers.** The pipeline is right; the *inputs* to it can be smarter.

## Provider — Kontext vs Schnell

- **Kontext performs significantly better than `flux/schnell` for identity.** Schnell is fine for
  generic text-to-image; it simply can't consume references.
- **Identity quality depends heavily on the quality and relevance of the reference images.** A
  good hero/portrait yields a strong likeness; poor or off-scene references weaken it. This is the
  single biggest lever now (→ research: Identity Intelligence / Image Understanding).
- Kontext is slower than Schnell (identity work costs time) — a future **async Job queue** will
  improve UX for slow identity models (deferred, `asyncJobs` capability + `Job` table already exist).

## Creative Director — observed issue (first fix shipped)

**Observed:** the Creative Director was *removing* important user intent. The v4 structured compiler
rebuilt the prompt from recognized scene-graph nodes only, so unrecognized words were dropped:

> User: *"She wears a bikini on a boat holding a Chihuahua."*
> Compiled (buggy): *"…the woman on the boat, portrait photography…"* — lost **bikini, Chihuahua,
> holding**, and weakened **on a boat → with boat**.

Kontext then faithfully rendered the reduced scene (identity ✓, scene ✗), and the tight-portrait
framing over-emphasised facial detail (made the face look older).

**First fix (Decision 039):** the **user's prompt is now the source of truth** — the compiler leads
with the full idea verbatim and only *appends* photographic direction. Nothing is dropped.

**Still future (the richer version):** turning *"on a boat"* into *"standing on a luxury yacht
overlooking the Mediterranean Sea"* — i.e. **enriching** intent with vivid, coherent detail (not
just preserving it) — is a larger effort (see FUTURE_RESEARCH → Scene Understanding v2). The
principle holds: **enrich, never replace or weaken.**

## Identity — what's good vs what needs work

**Good today:**
- recognizable face
- hairstyle
- tattoos
- body proportions

**Needs improvement (next):**
- **reference ranking** — which images best represent the person for *this* request
- **face consistency** — reduce drift across generations
- **automatic reference selection** — no manual Hero/Primary tagging (→ Identity Intelligence)

## Two now-independent tracks

Because identity generation now feeds Kontext correctly, the two systems can evolve separately:

1. **Identity System (~85%)** — better reference ranking, automatic face/body/tattoo selection,
   smarter packages.
2. **Creative Director (needs another pass)** — preserve intent (done), then richer action /
   object / relationship extraction, never discard clothing/props/interactions.

The next visible quality gains come mostly from the **Creative Director** (prompt richness) and
from **smarter reference selection** (identity inputs).
