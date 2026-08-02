/**
 * Identity Evaluation Engine check (Milestone 26) — pure, offline, no DB/hosted calls.
 *
 * Validates the parts that don't need the network: cosine similarity, the face evaluator against a MOCK
 * embedding provider (identical vs drifted faces, no-face → null), engine composition (dimension →
 * column + weighted overall), disabled evaluators stay null, and the version cache-key behavior.
 * Run:  npx tsx scripts/verify-evaluation.ts
 */
import { cosine, toSimilarity } from "../src/lib/identity-engine/evaluation/cosine";
import { composeEvaluation } from "../src/lib/identity-engine/evaluation/engine";
import { faceEvaluator } from "../src/lib/identity-engine/evaluation/evaluators/face";
import { EVALUATORS, enabledEvaluators } from "../src/lib/identity-engine/evaluation/evaluators/registry";
import type { EvalContext, EvalImage } from "../src/lib/identity-engine/evaluation/evaluators/types";
import type { FaceEmbedding } from "../src/lib/identity-engine/evaluation/providers";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`✗ ${msg}`);
  passed += 1;
  console.log(`  ✓ ${msg}`);
}
const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** A deterministic mock provider: the embedding is baked into the image URL as `#a,b,c`. */
function mockEmbed(version = "mock-v1") {
  return async (img: EvalImage): Promise<FaceEmbedding | null> => {
    const hash = img.url.split("#")[1];
    if (!hash || hash === "noface") return null;
    const vector = hash.split(",").map(Number);
    return { vector, dim: vector.length, version };
  };
}
const img = (mediaId: string, vec: string): EvalImage => ({ mediaId, url: `https://x/${mediaId}#${vec}` });

async function main() {
  console.log("Identity Evaluation:");

  // 1. Cosine.
  assert(approx(cosine([1, 0], [1, 0]), 1), "cosine of identical vectors = 1");
  assert(approx(cosine([1, 0], [0, 1]), 0), "cosine of orthogonal vectors = 0");
  assert(cosine([1, 0], [-1, 0]) < 0, "cosine of opposite vectors < 0");
  assert(cosine([1, 2, 3], [1, 2]) === 0, "mismatched lengths → 0 (defensive)");
  assert(toSimilarity(-0.4) === 0 && toSimilarity(0.9) === 0.9, "toSimilarity clamps negatives to 0");

  // 2. Face evaluator — preserved identity scores high, drift scores low.
  const ctxBase = (generated: EvalImage): EvalContext => ({
    identityId: "id1",
    generated,
    references: [img("r1", "1,0,0"), img("r2", "0.9,0.1,0")],
    embed: mockEmbed(),
  });
  const preserved = await faceEvaluator.evaluate(ctxBase(img("g", "1,0,0")));
  assert(preserved.score != null && preserved.score > 0.95, "preserved face → high similarity");
  const drifted = await faceEvaluator.evaluate(ctxBase(img("g", "0,1,0")));
  assert(drifted.score != null && drifted.score < 0.2, "drifted face → low similarity");

  // 3. No-face handling.
  const noGenFace = await faceEvaluator.evaluate(ctxBase(img("g", "noface")));
  assert(noGenFace.score === null, "no face in generated image → score null");
  const noRefFace = await faceEvaluator.evaluate({
    identityId: "id1",
    generated: img("g", "1,0,0"),
    references: [img("r1", "noface")],
    embed: mockEmbed(),
  });
  assert(noRefFace.score === null, "no reference face embeddings → score null");

  // 4. Engine composition — dimension → column + weighted overall.
  const composed = composeEvaluation("id1", "gen1", "mock-v1", [
    { dimension: "face", score: 0.8, weight: 1 },
    { dimension: "tattoo", score: null, weight: 0 },
  ]);
  assert(composed.face === 0.8, "composeEvaluation maps face → face column");
  assert(composed.tattoos === null, "unmeasured tattoo dimension stays null");
  assert(approx(composed.overallIdentityScore ?? -1, 0.8), "overall = weighted mean of measured dims");
  assert(composed.method === "mock-v1", "method records the evaluator version");

  const emptyOverall = composeEvaluation("id1", "gen1", "not-configured", [
    { dimension: "face", score: null, weight: 1 },
  ]);
  assert(emptyOverall.overallIdentityScore === null, "no measured dimensions → overall null");

  // 5. Registry — face enabled; others registered but disabled.
  assert(enabledEvaluators().length === 1 && enabledEvaluators()[0].id === "face", "only face is enabled");
  assert(EVALUATORS.some((e) => e.dimension === "tattoo" && !e.enabled), "tattoo registered but disabled");
  assert(EVALUATORS.some((e) => e.dimension === "body" && !e.enabled), "body registered but disabled");

  // 6. Version = the cache key (a different provider version is a different embedding namespace).
  const e1 = await mockEmbed("arcface-v1")(img("r", "1,0"));
  const e2 = await mockEmbed("arcface-v2")(img("r", "1,0"));
  assert(e1?.version === "arcface-v1" && e2?.version === "arcface-v2", "embedding carries its version (cache key)");

  console.log(`\nAll ${passed} checks passed.`);
}

main();
