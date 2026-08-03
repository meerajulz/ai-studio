/**
 * Face Evaluator (Milestone 26) — the first evaluation module; every other dimension mirrors it.
 *
 * Measures identity drift by comparing the generated face against the character's SEMANTIC anchors
 * (Face / Canonical from the Identity Package), aggregating the strongest matches (robust to one weak
 * anchor). Provider-neutral: prefers the cacheable `embed` path, falls back to a direct `compare` API,
 * and returns `null` when neither is available or no face is present. Output is a normalized
 * `{ score, confidence, details }` — the engine never learns how it was produced.
 */
import { cosine, toSimilarity } from "../cosine";
import type { Evaluator, EvalContext, EvalResult } from "./types";

const TOP_K = 3; // average the strongest K anchor matches

type AnchorSim = { mediaId: string; role: string; sim: number };

/** Compute per-anchor similarities via whichever provider capability is available. */
async function anchorSimilarities(ctx: EvalContext): Promise<AnchorSim[] | null> {
  if (ctx.embed) {
    const gen = await ctx.embed(ctx.generated, "generated");
    if (!gen) return null; // no face in the generated image
    const sims: AnchorSim[] = [];
    for (const ref of ctx.references) {
      const emb = await ctx.embed(ref, "uploaded");
      if (emb && emb.dim === gen.dim) {
        sims.push({ mediaId: ref.mediaId, role: ref.role ?? "reference", sim: toSimilarity(cosine(gen.vector, emb.vector)) });
      }
    }
    return sims;
  }
  if (ctx.compare) {
    const sims: AnchorSim[] = [];
    for (const ref of ctx.references) {
      const s = await ctx.compare(ctx.generated.url, ref.url);
      if (s != null) sims.push({ mediaId: ref.mediaId, role: ref.role ?? "reference", sim: toSimilarity(s) });
    }
    return sims;
  }
  return null; // no provider capability configured
}

export const faceEvaluator: Evaluator = {
  id: "face",
  dimension: "face",
  enabled: true,
  weight: 1,
  async evaluate(ctx: EvalContext): Promise<EvalResult> {
    const sims = await anchorSimilarities(ctx);
    if (sims == null) return { dimension: "face", score: null, confidence: null, details: { reason: "no face / no provider" } };
    if (sims.length === 0) return { dimension: "face", score: null, confidence: 0, details: { reason: "no comparable anchors" } };

    const top = sims.slice().sort((a, b) => b.sim - a.sim).slice(0, TOP_K);
    const score = top.reduce((s, x) => s + x.sim, 0) / top.length;
    // Confidence = how many of the desired anchors we could actually compare against (coverage).
    const confidence = Math.min(1, sims.length / TOP_K);
    return {
      dimension: "face",
      score,
      confidence,
      details: { anchorSims: sims, usedAnchors: top.map((t) => ({ role: t.role, mediaId: t.mediaId })), topK: TOP_K },
    };
  },
};
