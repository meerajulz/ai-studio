/**
 * Identity Evaluation Engine check (Milestone 26) — pure, offline, no DB/hosted calls.
 *
 * Validates the parts that don't need the network: cosine, the face evaluator against BOTH provider
 * capabilities (a mock `embed` and a mock `compare`), uniform `{score, confidence, details}`, Identity-
 * Package (role-labeled) anchors, engine composition, disabled evaluators, and version-as-cache-key.
 * Run:  npx tsx scripts/verify-evaluation.ts
 */
import { aggregateSims, headlineScore } from "../src/lib/identity-engine/evaluation/evaluators/aggregate";
import { cosine, toSimilarity } from "../src/lib/identity-engine/evaluation/cosine";
import { composeEvaluation } from "../src/lib/identity-engine/evaluation/engine";
import { faceEvaluator } from "../src/lib/identity-engine/evaluation/evaluators/face";
import { EVALUATORS, enabledEvaluators } from "../src/lib/identity-engine/evaluation/evaluators/registry";
import type { EvalContext, EvalImage } from "../src/lib/identity-engine/evaluation/evaluators/types";
import type { Embedding } from "../src/lib/identity-engine/evaluation/providers";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`✗ ${msg}`);
  passed += 1;
  console.log(`  ✓ ${msg}`);
}
const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** Deterministic mock embed: the vector is baked into the URL as `#a,b,c` (`#noface` → no face). */
const mockEmbed =
  (version = "mock-v1") =>
  async (img: EvalImage): Promise<Embedding | null> => {
    const hash = img.url.split("#")[1];
    if (!hash || hash === "noface") return null;
    const vector = hash.split(",").map(Number);
    return { vector, dim: vector.length, version };
  };
const img = (mediaId: string, vec: string, role?: string): EvalImage => ({ mediaId, url: `https://x/${mediaId}#${vec}`, role });

async function main() {
  console.log("Identity Evaluation:");

  // 1. Cosine.
  assert(approx(cosine([1, 0], [1, 0]), 1), "cosine of identical vectors = 1");
  assert(approx(cosine([1, 0], [0, 1]), 0), "cosine of orthogonal vectors = 0");
  assert(cosine([1, 2, 3], [1, 2]) === 0, "mismatched lengths → 0 (defensive)");
  assert(toSimilarity(-0.4) === 0 && toSimilarity(0.9) === 0.9, "toSimilarity clamps negatives to 0");

  // 2. Face evaluator — EMBED path. Role-labeled anchors, uniform {score, confidence, details}.
  const refs = [img("r1", "1,0,0", "face"), img("r2", "0.9,0.1,0", "canonical")];
  const embedCtx = (generated: EvalImage): EvalContext => ({ identityId: "id1", generated, references: refs, embed: mockEmbed() });
  const preserved = await faceEvaluator.evaluate(embedCtx(img("g", "1,0,0")));
  assert(preserved.score != null && preserved.score > 0.95, "embed: preserved face → high similarity");
  assert(preserved.confidence != null && preserved.confidence > 0, "embed: reports confidence");
  assert(Array.isArray((preserved.details as { anchorSims?: unknown[] }).anchorSims), "embed: per-anchor breakdown in details");
  const drifted = await faceEvaluator.evaluate(embedCtx(img("g", "0,1,0")));
  assert(drifted.score != null && drifted.score < 0.2, "embed: drifted face → low similarity");
  assert((await faceEvaluator.evaluate(embedCtx(img("g", "noface")))).score === null, "embed: no face in generated → null");

  // 3. Face evaluator — COMPARE path (a provider that returns scores, not vectors).
  const compareCtx: EvalContext = {
    identityId: "id1",
    generated: img("g", "x"),
    references: [img("r1", "x", "face"), img("r2", "x", "canonical")],
    compare: async (_a, b) => (b.includes("r1") ? 0.94 : 0.9),
  };
  const cmp = await faceEvaluator.evaluate(compareCtx);
  assert(cmp.score != null && approx(cmp.score, 0.92), "compare: aggregates direct similarity scores");
  assert(cmp.confidence != null && approx(cmp.confidence, 2 / 3), "compare: confidence = anchor coverage (2 of 3)");

  // 4. No provider capability at all → null (not-configured).
  const none = await faceEvaluator.evaluate({ identityId: "id1", generated: img("g", "1,0"), references: refs });
  assert(none.score === null && none.confidence === null, "no embed + no compare → null score");

  // 4b. Multi-anchor aggregation — every stat + the default reproduces the legacy top-K mean EXACTLY.
  const agg = aggregateSims([0.2, 0.6, 0.5, 0.3], 3);
  assert(agg.count === 4 && agg.max === 0.6 && agg.min === 0.2, "aggregate: count/max/min");
  assert(approx(agg.median, 0.4), "aggregate: median of 4 = mean of middle two");
  assert(approx(agg.mean, 0.4), "aggregate: mean across all anchors");
  assert(approx(agg.topKMean, (0.6 + 0.5 + 0.3) / 3), "aggregate: topKMean = mean of strongest K");
  assert(approx(headlineScore(agg), (0.6 + 0.5 + 0.3) / 3), "headline default = topKMean (legacy score unchanged)");
  assert(headlineScore(agg, "max") === 0.6, "headline 'max' = best anchor (swappable)");
  const solo = aggregateSims([0.42], 3);
  assert(solo.max === 0.42 && approx(solo.topKMean, 0.42) && solo.k === 1, "aggregate: single anchor — every stat = that value, k clamps");
  const drifted2 = await faceEvaluator.evaluate(embedCtx(img("g", "0,1,0")));
  assert((drifted2.details as { aggregate?: unknown }).aggregate != null, "face evaluator surfaces the aggregate distribution in details");

  // 5. Engine composition — uniform results → columns + weighted overall.
  const composed = composeEvaluation("id1", "gen1", "mock-v1", [
    { dimension: "face", score: 0.8, confidence: 1, weight: 1 },
    { dimension: "tattoo", score: null, confidence: null, weight: 0 },
  ]);
  assert(composed.face === 0.8 && composed.tattoos === null, "compose maps face column; unmeasured stays null");
  assert(approx(composed.overallIdentityScore ?? -1, 0.8), "overall = weighted mean of measured dims");
  assert(composeEvaluation("id1", "g", "not-configured", [{ dimension: "face", score: null, confidence: null, weight: 1 }]).overallIdentityScore === null, "no measured dims → overall null");

  // 6. Registry — face enabled; others registered but disabled.
  assert(enabledEvaluators().length === 1 && enabledEvaluators()[0].id === "face", "only face is enabled");
  assert(EVALUATORS.some((e) => e.dimension === "tattoo" && !e.enabled), "tattoo registered but disabled");

  // 7. Version = cache key.
  const e1 = await mockEmbed("auraface-v1")(img("r", "1,0"));
  const e2 = await mockEmbed("auraface-v2")(img("r", "1,0"));
  assert(e1?.version === "auraface-v1" && e2?.version === "auraface-v2", "embedding carries its version (cache key)");

  console.log(`\nAll ${passed} checks passed.`);
}

main();
