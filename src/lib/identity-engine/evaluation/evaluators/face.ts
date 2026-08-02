/**
 * Face Evaluator (Milestone 26) — the first evaluation module.
 *
 * Measures identity drift: embed the generated face, compare against the identity's cached reference face
 * embeddings, and report the mean of the strongest matches (robust to one weak reference). Provider-
 * neutral — it only ever sees embedding vectors via `ctx.embed`. `null` score when no face is detected on
 * either side (not a failure — the caller shows "no face measured").
 */
import { cosine, toSimilarity } from "../cosine";
import type { Evaluator, EvalContext, EvalResult } from "./types";

const TOP_K = 3; // average the strongest K reference matches

export const faceEvaluator: Evaluator = {
  id: "face",
  dimension: "face",
  enabled: true,
  weight: 1,
  async evaluate(ctx: EvalContext): Promise<EvalResult> {
    const gen = await ctx.embed(ctx.generated, "generated");
    if (!gen) return { dimension: "face", score: null, detail: { reason: "no face in generated image" } };

    const sims: { mediaId: string; sim: number }[] = [];
    for (const ref of ctx.references) {
      const emb = await ctx.embed(ref, "uploaded");
      if (emb && emb.dim === gen.dim) {
        sims.push({ mediaId: ref.mediaId, sim: toSimilarity(cosine(gen.vector, emb.vector)) });
      }
    }
    if (sims.length === 0) return { dimension: "face", score: null, detail: { reason: "no reference face embeddings" } };

    const top = sims.slice().sort((a, b) => b.sim - a.sim).slice(0, TOP_K);
    const score = top.reduce((s, x) => s + x.sim, 0) / top.length;
    return {
      dimension: "face",
      score,
      detail: { refSims: sims, usedRefs: top.map((t) => t.mediaId), topK: TOP_K },
    };
  },
};
