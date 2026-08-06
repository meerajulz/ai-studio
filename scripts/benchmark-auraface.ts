/**
 * AuraFace INSTRUMENT benchmark (M27 follow-up, Phase 1) — prove the evaluator is sound BEFORE
 * recalibrating how its score is presented. Deliberately touches neither the evaluator nor the
 * identity package: it reuses the REAL `auraFaceProvider.embed()` and the shared `cosine()`, then
 * runs a diagnostic matrix and prints RAW cosine values (no clamping, no percentage) so decisions
 * come from measured distributions instead of intuition.
 *
 * Two sections:
 *   A. Instrument sanity  — same/re-encoded/crop/mirror/real-vs-real/different-person vs expected
 *                           bands. If these land in range, AuraFace is working — stop touching it.
 *   B. Multi-anchor demo  — each generated image vs EVERY anchor → per-anchor + mean/median/best.
 *                           This is the evidence for (a) multi-anchor aggregation and (b) the score
 *                           distribution you'll calibrate the UI against.
 *
 * Image refs may be local file paths, http(s) URLs, or data URLs. Crop/mirror/re-encode variants are
 * derived locally with sharp and sent as base64 data-urls (the endpoint handler decodes those).
 *
 * Requires FACE_EMBED_ENDPOINT_URL + FACE_EMBED_API_KEY (.env / .env.local). Each distinct image
 * costs ONE embed call against the hosted endpoint — user-driven (real endpoint, real compute). Run:
 *   npx tsx scripts/benchmark-auraface.ts scripts/fixtures/auraface-benchmark.example.json
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { cosine } from "../src/lib/identity-engine/evaluation/cosine";
import { auraFaceProvider } from "../src/lib/identity-engine/evaluation/providers/auraface";
import type { Embedding } from "../src/lib/identity-engine/evaluation/providers/FaceSimilarityProvider";

// ── Config ─────────────────────────────────────────────────────────────────────────────────────
type BenchConfig = {
  reference: string; // the anchor used for the sanity tests (crop/mirror/re-encode)
  samePerson?: string[]; // more real photos of the SAME identity (real-vs-real)
  differentPerson?: string[]; // real photos of OTHER people (impostor baseline)
  generated?: string[]; // optional: generated images scored vs every anchor (section B)
  anchors?: string[]; // optional explicit anchor set for section B (default: reference + samePerson)
};

// Heuristic reference bands. NOT ground truth — they flag "roughly expected vs suspicious" at a glance.
// The RAW value is what matters; ✓/⚠/✗ is only a reading aid.
type Band = { pass: number; warn: number; dir: "high" | "low" };
const mark = (v: number, b: Band): string => {
  const ok = b.dir === "high" ? v >= b.pass : v <= b.pass;
  const warn = b.dir === "high" ? v >= b.warn : v <= b.warn;
  return ok ? "✓" : warn ? "⚠" : "✗";
};

// ── Image loading + local variants ───────────────────────────────────────────────────────────────
async function loadBytes(ref: string): Promise<Buffer> {
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    const res = await fetch(ref);
    if (!res.ok) throw new Error(`fetch ${res.status} for ${ref}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (ref.startsWith("data:") && ref.includes(",")) return Buffer.from(ref.split(",", 2)[1], "base64");
  return readFile(ref);
}

const toDataUrl = (buf: Buffer): string => `data:image/jpeg;base64,${buf.toString("base64")}`;

/** Re-encode to a fresh JPEG: same picture, different bytes — tests determinism, not vector identity. */
const reencode = (buf: Buffer) => sharp(buf).jpeg({ quality: 92 }).toBuffer();
/** Horizontal mirror. */
const mirror = (buf: Buffer) => sharp(buf).flop().jpeg({ quality: 92 }).toBuffer();
/** Center crop to 80% of each side — simulates a tighter re-crop of the same face. */
async function centerCrop(buf: Buffer): Promise<Buffer> {
  const img = sharp(buf);
  const { width, height } = await img.metadata();
  if (!width || !height) return reencode(buf);
  const w = Math.round(width * 0.8);
  const h = Math.round(height * 0.8);
  return sharp(buf)
    .extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h })
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ── Embedding (real endpoint, deduped within a run) ──────────────────────────────────────────────
// HF Inference Endpoints scale to zero when idle: the first call 503s while the box cold-starts (often
// 1–3 min). Treat 503 / service-unavailable as "warming up" and retry with backoff instead of failing.
const WARMUP_BUDGET_MS = 6 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isWarmingUp = (e: unknown): boolean => {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code;
  return /\b503\b|unavailable/i.test(msg) || code === "PROVIDER_UNAVAILABLE" || code === "TIMEOUT";
};

const embedCache = new Map<string, Promise<Embedding | null>>();
let embedCalls = 0;
let warmed = false;
function embed(label: string, dataUrl: string): Promise<Embedding | null> {
  const hit = embedCache.get(label);
  if (hit) return hit;
  const p = (async () => {
    embedCalls += 1;
    const deadline = Date.now() + WARMUP_BUDGET_MS;
    let wait = 12_000;
    for (;;) {
      try {
        const e = auraFaceProvider.embed ? await auraFaceProvider.embed(dataUrl) : null;
        warmed = true;
        if (!e) console.warn(`  ! no face detected: ${label}`);
        return e;
      } catch (err) {
        if (!warmed && isWarmingUp(err) && Date.now() < deadline) {
          const secs = Math.round(wait / 1000);
          console.warn(`  … endpoint cold-starting (503) — waiting ${secs}s then retrying [${label}]`);
          await sleep(wait);
          wait = Math.min(wait * 1.5, 30_000);
          continue;
        }
        throw err;
      }
    }
  })();
  embedCache.set(label, p);
  return p;
}

const cos = (a: Embedding | null, b: Embedding | null): number | null =>
  a && b && a.dim === b.dim ? cosine(a.vector, b.vector) : null;
const fmt = (v: number | null): string => (v == null ? "  n/a" : (v >= 0 ? " " : "") + v.toFixed(4));
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error(
      "usage: npx tsx scripts/benchmark-auraface.ts <config.json>\n" +
        "see scripts/fixtures/auraface-benchmark.example.json for the shape.",
    );
    process.exit(1);
  }
  if (!auraFaceProvider.isConfigured()) {
    console.error("FACE_EMBED_ENDPOINT_URL + FACE_EMBED_API_KEY must be set (.env / .env.local).");
    process.exit(1);
  }

  const cfg = JSON.parse(await readFile(configPath, "utf8")) as BenchConfig;
  console.log(`AuraFace instrument benchmark — provider version "${auraFaceProvider.version}"\n`);

  // Reference + its local variants.
  const refBytes = await loadBytes(cfg.reference);
  const refEmb = await embed("reference", toDataUrl(refBytes));
  if (!refEmb) {
    console.error("No face detected in the reference image — cannot run the sanity matrix.");
    process.exit(1);
  }
  const [reEmb, cropEmb, mirrorEmb] = await Promise.all([
    reencode(refBytes).then((b) => embed("reference·reencoded", toDataUrl(b))),
    centerCrop(refBytes).then((b) => embed("reference·crop80", toDataUrl(b))),
    mirror(refBytes).then((b) => embed("reference·mirror", toDataUrl(b))),
  ]);

  // ── Section A: instrument sanity ────────────────────────────────────────────────────────────────
  console.log("A. INSTRUMENT SANITY  (raw cosine; ✓/⚠/✗ = heuristic band, not ground truth)\n");
  console.log("   test                          raw       expected      read");
  const row = (test: string, v: number | null, exp: string, b: Band | null) =>
    console.log(`   ${test.padEnd(28)} ${fmt(v).padStart(7)}   ${exp.padEnd(12)} ${v != null && b ? mark(v, b) : " "}`);

  row("same image (re-encoded)", cos(refEmb, reEmb), "≥ 0.98", { pass: 0.98, warn: 0.95, dir: "high" });
  row("cropped (center 80%)", cos(refEmb, cropEmb), "≥ 0.85", { pass: 0.85, warn: 0.7, dir: "high" });
  row("mirrored", cos(refEmb, mirrorEmb), "≥ 0.80", { pass: 0.8, warn: 0.65, dir: "high" });

  const realReal: number[] = [];
  for (const [i, ref] of (cfg.samePerson ?? []).entries()) {
    const e = await embed(`samePerson[${i}]`, toDataUrl(await loadBytes(ref)));
    const v = cos(refEmb, e);
    if (v != null) realReal.push(v);
    row(`real vs real  #${i + 1}`, v, "0.35–0.85", { pass: 0.45, warn: 0.3, dir: "high" });
  }
  const impostor: number[] = [];
  for (const [i, ref] of (cfg.differentPerson ?? []).entries()) {
    const e = await embed(`differentPerson[${i}]`, toDataUrl(await loadBytes(ref)));
    const v = cos(refEmb, e);
    if (v != null) impostor.push(v);
    row(`different person #${i + 1}`, v, "< 0.25", { pass: 0.25, warn: 0.35, dir: "low" });
  }

  // ── Section B: multi-anchor aggregation on generated images ─────────────────────────────────────
  const anchorRefs = cfg.anchors?.length ? cfg.anchors : [cfg.reference, ...(cfg.samePerson ?? [])];
  const genScores: number[] = [];
  if (cfg.generated?.length) {
    const anchorEmbs: { label: string; emb: Embedding | null }[] = [];
    for (const [i, a] of anchorRefs.entries()) {
      const label = i === 0 && a === cfg.reference ? "reference" : `anchor[${i}]`;
      anchorEmbs.push({ label, emb: await embed(label, toDataUrl(await loadBytes(a))) });
    }

    console.log("\nB. MULTI-ANCHOR AGGREGATION  (each generated image vs EVERY anchor)\n");
    for (const [gi, g] of cfg.generated.entries()) {
      const gEmb = await embed(`generated[${gi}]`, toDataUrl(await loadBytes(g)));
      console.log(`   generated #${gi + 1}  (${g})`);
      const sims: number[] = [];
      for (const a of anchorEmbs) {
        const v = cos(gEmb, a.emb);
        if (v != null) sims.push(v);
        console.log(`     ${a.label.padEnd(20)} ${fmt(v).padStart(7)}`);
      }
      if (sims.length) {
        const mean = sims.reduce((s, x) => s + x, 0) / sims.length;
        genScores.push(Math.max(...sims)); // "best anchor" feeds the distribution summary
        console.log(
          `     ${"—".repeat(20)}\n` +
            `     mean ${fmt(mean).trim()}   median ${fmt(median(sims)).trim()}   ` +
            `best ${fmt(Math.max(...sims)).trim()}   worst ${fmt(Math.min(...sims)).trim()}\n`,
        );
      }
    }
  }

  // ── Distribution summary — the raw material for Phase 3 calibration ──────────────────────────────
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  console.log("DISTRIBUTION SUMMARY  (design the UI mapping from THESE, not from guesses)");
  console.log(`   same image (re-encoded) : ${fmt(cos(refEmb, reEmb)).trim()}`);
  console.log(`   real vs real     mean   : ${fmt(avg(realReal))}   (n=${realReal.length})`);
  console.log(`   generated (best) mean   : ${fmt(avg(genScores))}   (n=${genScores.length})`);
  if (genScores.length) console.log(`   generated (best) range  : ${fmt(Math.min(...genScores)).trim()} … ${fmt(Math.max(...genScores)).trim()}`);
  console.log(`   different person mean   : ${fmt(avg(impostor))}   (n=${impostor.length})`);
  console.log(`\n${embedCalls} embed call(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
