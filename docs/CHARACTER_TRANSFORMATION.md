# Character Transformation Architecture

> **Status:** Design accepted (Decision 060). Implementation sequenced M25 → M28.
> **This is the load-bearing doc for the post-M24.5 direction.** It reframes what sits
> *above* the Identity Engine. The Identity Engine, Vision layer, Selection engine, and
> Model Registry are all kept — nothing below this line is thrown away.

## 1. The thesis

AI Studio has been architected as *"generate a character."* Every experiment (Kontext,
LoRA, PuLID, InfiniteYou research) has taught the same lesson: **the models we use are
editors, not generators.** They take a real person and move them into a new context.

So the mental model changes:

```
OLD:  Identity  →  synthesize a person into a scene
NEW:  Character →  transform a known person into a new context
```

This is not a rewrite. It is a **reframe of the top of the pipeline** plus one genuinely
new capability (a feedback loop that lets a character *accumulate* good source images).
The core asset stops being "a model checkpoint" and becomes **the character's library of
images** — originals plus every generated image that measurably preserved identity. That
is a compounding advantage no single new identity model can provide.

**LoRA / PuLID / InstantID stop being the center of the system.** They become *optional
tools* the planner may reach for, not the thing every generation is organized around.

## 2. The new pipeline

```
                    USER  ("Julieta on the beach")
                      │
                      ▼
              Character Engine            ← which character?
                      │
                      ▼
           Source Image Selector          ← best portrait / full-body / tattoos / pose
                      │                       FOR THIS transformation (already exists: src/lib/selection)
                      ▼
           Transformation Planner         ← NEW. splits the request into:
                      │                       PRESERVE {face, body, tattoos, piercings, scars, proportions}
                      │                       CHANGE   {location, outfit, pose, lighting, hair, expression}
                      ▼
              Edit Provider               ← GPT Image / Kontext / Seedream / FLUX Edit
                      │                       chosen by transformation type (Model Registry, extended)
                      ▼
           Identity Evaluation            ← NEW real scoring: face / tattoos / body / hands / composition
                      │
                      ▼
            Character Library             ← if score > threshold AND beats originals on identity axes,
                                            save the output as a reusable, tagged source
```

## 3. What already exists vs. what is new

The good news: ~70% of this is reframing and gap-filling over parts already built.

| Pipeline stage | Today | Gap to close |
|---|---|---|
| Character Engine | `Identity` + `IdentityMedia` (curated training links) | UI relabel to "Character"; keep `Identity` as the internal model name (see §7) |
| Source Image Selector | **Built** — `src/lib/selection/` (requirements → match → greedy diversity) + `anchor.ts` | Make it **transformation-aware**: pick the *right single source* (full-body for a full-body shot) instead of a diverse package |
| Transformation Planner | **Missing** — the compiler leads with user intent + appends an appearance paragraph; it never says *"do not change the face; only change the location"* | Build it (§5). Highest value / lowest cost |
| Edit Provider routing | **Half-built** — `model-registry.ts` routes on capability + `priority` | Add a **transformation-type** taxonomy (face-edit vs scene-transform vs style-transfer), driven by measured eval data |
| Identity Evaluation | **Reserved stub** — `evaluation/IdentityEvaluator.ts` returns nulls | Implement real scoring. **This is the keystone** (§4) |
| Character Library feedback loop | **Missing** — confirmed: nothing feeds generated media back as a source | Build it, with the drift guardrail (§6). Highest leverage / highest risk |

## 4. The keystone: Evaluation comes *second*, not fourth

Three later stages secretly depend on **trustworthy scoring**:

- **Adaptive provider routing** — you cannot *assert* "GPT is best at faces, Kontext at
  scenes." You have to *measure* it. Without eval, "best-at" is vibes.
- **Auto-promote** — obviously.
- **The compounding-library thesis** — "the character evolves" is only true if the thing
  deciding what to keep is right.

Therefore evaluation is not a late milestone. It is the foundation the rest stands on, and
it is sequenced **immediately after** the (cheap, independent) Transformation Planner.

The evaluator scores each output on independent axes so the system — not a human eyeballing
thumbnails — knows whether output B beat output A:

```
face 94   body 97   hair 95   tattoos 62   hands 83   composition 88   → overall 86
```

Face similarity → InsightFace embeddings (per `research/RESEARCH_03_FACE_EMBEDDINGS.md`).
Tattoos/hair/body → region-aware comparison against the character's persisted knowledge.

## 5. The Transformation Planner (start here)

Instead of compiling `"Generate Julieta on the beach"`, the engine builds an **edit
instruction** with an explicit contract:

```
Preserve this person's identity exactly. Do NOT change:
  face · body proportions · tattoos · piercings · skin tone · age · scars
Only change:
  location → beach · outfit → bikini · expression → smiling
```

This is a *fundamentally different instruction* to an edit model, and it should improve
consistency **immediately, with no schema, no eval, and no library** — which is exactly why
it is the first cut. It also produces the material the evaluator will later score.

The planner's job is to parse the user's request into two typed sets — `preserve` and
`change` — where `preserve` is seeded from the character's identity-defining attributes
(face, tattoos, piercings, scars, proportions) and `change` from the scene/outfit/pose
deltas the prompt asks for. It sits above the existing Creative Director compiler.

## 6. The guardrail that makes or breaks Auto-Promote

The Lightroom analogy is seductive and **breaks in one dangerous way**: Lightroom edits are
non-destructive on the *original*. This loop would use generated — lossy, already slightly
drifted — images as new sources. **That is photocopying a photocopy.**

If the evaluator is even a few percent wrong, auto-promote does not make a character
*evolve* — it makes it **drift with confidence**. Each generation starts from a slightly
worse image, the score says "96," and the degradation is invisible until every character has
quietly become a different person. Compounding degradation is worse than no loop at all.

Non-negotiable guardrails, baked in from day one:

1. **Originals are sacred.** Human-provided photos are the permanent identity anchor and can
   never be evicted or outranked as the identity source by a generated image.
2. **Generated images are convenience sources, not identity sources.** A promoted output can
   become "best beach full-body," tagged `generated`, but the *identity* it is measured
   against is always the originals.
3. **Promote on identity axes with a margin**, not on `overall`. An output is only promotable
   if it *exceeds the originals on face + tattoos*, not because it composed a pretty scene.
4. **Track provenance.** Every source records its lineage (original → gen → gen …). If a
   chain gets too deep, force a reset to an original. This is how we detect and stop drift.

## 7. Data model direction (not yet migrations)

- **Keep `Identity` as the internal model name.** Renaming the Prisma model → `Character`
  is high churn (every import, a migration) for zero functional gain. Present "Character" in
  the **UI**; rename the model only if it ever pays for itself.
- **Generated-as-source** needs the input/output distinction we already reserved
  (Decision 026): `Identity → IdentityMedia → MediaAsset` *teaches*; the library feedback
  loop lets a `GeneratedMedia` be *promoted into* the teaching set with a `generated` tag +
  provenance. This is the first schema work of the refactor and lands in M28, not before.
- **Tags** (portrait, full-body, beach, tattoos, smile, profile, night, studio) are derived
  from the persisted `MediaVisionKnowledge` we already compute — not a new manual system.

## 8. Resequenced roadmap

The pieces are the user's; the order is corrected so evaluation (the keystone) precedes the
things that depend on it, and the risky compounding loop lands **last**, once trustworthy
scores gate it. **Provider breadth is front-loaded** (M24.8) so the planner has the best
editors to route to, and so the benchmark harness that M26 later auto-scores is built first.

| Milestone | Goal | Why here |
|---|---|---|
| **M24.8 — Edit Provider Expansion + Benchmark Harness** | add Qwen Image Edit, Wan (Nano Banana Pro already registered); a **permanent, model-pluggable harness** that persists source/prompt/output grids | Reuses the payload-kind abstraction (a same-shape model = one registry line). De-risks provider choice before the planner is designed. **Human-judged until M26**, then auto-scored. |
| **M25 — Transformation Planner** | preserve-vs-change prompt + transformation-aware source selection | Cheap, no schema, immediate consistency win; now has real models to test against. |
| **M25.5 — Character Image Ranking** | **heuristic/manual** ranking (human stars + cheap signals: resolution, recency, face-detected) | Useful + cheap. *Quality* ranking waits for M26 — you cannot rank by quality without a score. |
| **M26 — Identity Evaluation** | real face/tattoo/body/hands scoring (InsightFace + region compare); **auto-scores the M24.8 grid** | The keystone. Turns the harness into the real eval suite; unlocks everything below. |
| **M27 — Adaptive Provider Routing** | route by transformation type, **driven by measured eval data** | Needs M26's scores to be honest, not asserted. |
| **M28 — Character Library + Auto-Promote** | store/tag generated images; promote the best as sources | Needs the §6 guardrail *and* trustworthy M26 scores gating it. Highest risk → last. |

Two ordering rules this encodes (both are dependency-inversions avoided):
- **A benchmark is only an "eval suite" once it is auto-scored.** M24.8 builds the *harness*
  (persisted grid); it is human-judged until M26 attaches scores to the same stored cells.
- **You cannot rank by quality without the evaluator.** M25.5 is heuristic/manual;
  quality-ranking arrives with M26.

Supersedes the prior M25–M28 plan (Evaluation → Retry → PuLID → InstantID). PuLID shipped
early in M24.5; InstantID and other adapters remain **optional plug-in tools** the planner
may use, no longer milestones the system is organized around.

> **Cost note:** M24.8's *code* is cheap, but each benchmark *run* costs real Fal spend
> (every model × every source×prompt cell). Runs are user-driven (needs `FAL_KEY` balance).

## 9. Open questions (resolve during each milestone, not now)

- **Where does InsightFace inference run?** Python service / ONNX-in-Node / hosted. (Carried
  over from RESEARCH_03; M26 decides.)
- **Transformation taxonomy granularity** — how many transformation *types* does the router
  distinguish, and how are they inferred from the prompt? (M27.)
- **Promotion thresholds + margins** — exact numbers are empirical; set them from real M26
  score distributions, not guesses. (M28.)
- **Source-chain depth limit** before a forced reset to an original. (M28.)

## 10. What this buys us

The product stops resembling "yet another image generator" and starts resembling a
professional creative tool: the core asset is the **character**, and every successful edit
makes that character's library richer and more reliable. That is a compounding advantage —
the one thing a competitor cannot get by swapping in a newer model.
