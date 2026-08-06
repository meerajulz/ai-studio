/**
 * Reference-package experiment #1 — FACE-CROP ANCHOR A/B (M27 follow-up, identity-preservation).
 *
 * Hypothesis: the pipeline sends WHOLE photos as the identity anchor (never a face crop), so the model
 * spends capacity on hair/tattoos/body/background instead of the face. Test it: for one prompt, generate
 * with the SAME source photo as anchor in two forms — (full) the whole photo vs (crop) tight to the
 * detected face — across several models, and score each output with AuraFace (best-anchor cosine, the
 * validated ruler). If `crop` beats `full`, cropping the anchor is the highest-ROI production change.
 *
 * Real Fal spend: (#models × 2 variants) generations. Tiny by default (4 models → 8 gens). User-driven.
 * Reuses the real fal provider, Blob (so Fal can fetch the anchor), and the AuraFace endpoint. Needs
 * FAL_KEY + BLOB token + FACE_EMBED_* (.env / .env.local). The endpoint must expose `bbox` — redeploy
 * deploy/auraface-endpoint/handler.py first (it now returns it). Run:
 *   npx tsx scripts/experiment-anchor-crop.ts scripts/experiment-anchor-crop.json
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

// @vercel/blob signs URLs with HMAC via WebCrypto. Node 18 doesn't expose `crypto` as a global (Node 20+
// does), so polyfill it from node:crypto — otherwise getSignedUrl throws "crypto.subtle not available".
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { cosine } from "../src/lib/identity-engine/evaluation/cosine";
import { falProvider } from "../src/lib/ai/providers/fal";
import { uploadAsset, getSignedUrl } from "../src/lib/blob/server";

type ExpConfig = {
  anchorPhoto: string; // the source photo used as anchor in BOTH arms (full vs its face-crop)
  evalAnchors: string[]; // real photos of the identity — the AuraFace references outputs are scored against
  prompt: string; // one fixed scene prompt
  models?: string[]; // resolved model ids (default: the four the user named)
  cropMargin?: number; // fraction of face size added around the bbox (default 0.4)
};

const DEFAULT_MODELS = [
  "openai/gpt-image-2/edit",
  "fal-ai/flux-pro/kontext/max/multi",
  "fal-ai/bytedance/seedream/v4/edit",
  "fal-ai/gemini-25-flash-image/edit",
];
const OUT_DIR = "public/img/_exp"; // generated images land here for eyeballing

// ── AuraFace endpoint (raw — we need `bbox`, which the provider drops) ────────────────────────────
type Detection = { vector: number[]; bbox: [number, number, number, number] | null; faces: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let warmed = false;

async function detect(dataUrl: string, label: string): Promise<Detection | null> {
  const url = process.env.FACE_EMBED_ENDPOINT_URL;
  const key = process.env.FACE_EMBED_API_KEY;
  if (!url || !key) throw new Error("FACE_EMBED_ENDPOINT_URL + FACE_EMBED_API_KEY must be set.");
  const deadline = Date.now() + 6 * 60_000;
  let wait = 12_000;
  for (;;) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: { image: dataUrl } }),
    });
    if (res.status === 503 && !warmed && Date.now() < deadline) {
      console.warn(`  … endpoint cold-starting (503) — waiting ${Math.round(wait / 1000)}s [${label}]`);
      await sleep(wait);
      wait = Math.min(wait * 1.5, 30_000);
      continue;
    }
    if (!res.ok) throw new Error(`face endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
    warmed = true;
    const body = (await res.json()) as { embedding: number[] | null; bbox?: number[]; faces?: number };
    if (!body.embedding) {
      console.warn(`  ! no face detected: ${label}`);
      return null;
    }
    return {
      vector: body.embedding,
      bbox: (body.bbox as [number, number, number, number]) ?? null,
      faces: body.faces ?? 1,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────
const loadBytes = (ref: string) =>
  ref.startsWith("http") ? fetch(ref).then((r) => r.arrayBuffer()).then((b) => Buffer.from(b)) : readFile(ref);
const toDataUrl = (buf: Buffer, mime = "image/jpeg") => `data:${mime};base64,${buf.toString("base64")}`;
const bestCosine = (v: number[], anchors: number[][]) =>
  anchors.reduce((mx, a) => (a.length === v.length ? Math.max(mx, cosine(v, a)) : mx), -1);
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "_");

/** Crop `buf` to the face bbox expanded by `margin`, clamped to the image. */
async function cropFace(buf: Buffer, bbox: [number, number, number, number], margin: number): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const [x1, y1, x2, y2] = bbox;
  const fw = x2 - x1;
  const fh = y2 - y1;
  const left = Math.max(0, Math.round(x1 - margin * fw));
  const top = Math.max(0, Math.round(y1 - margin * fh));
  const right = Math.min(width, Math.round(x2 + margin * fw));
  const bottom = Math.min(height, Math.round(y2 + margin * fh));
  return sharp(buf)
    .extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** Upload bytes to Blob and return a Fal-fetchable signed URL. */
async function publish(buf: Buffer, name: string): Promise<string> {
  const stored = await uploadAsset({ pathname: `experiments/anchor-crop/${name}`, data: buf, contentType: "image/jpeg" });
  return getSignedUrl(stored.pathname, { expiresInSeconds: 3600 });
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const cfgPath = process.argv[2];
  if (!cfgPath) {
    console.error("usage: npx tsx scripts/experiment-anchor-crop.ts <config.json>");
    process.exit(1);
  }
  if (!falProvider.isConfigured()) {
    console.error("Fal is not configured (set FAL_KEY).");
    process.exit(1);
  }
  const cfg = JSON.parse(await readFile(cfgPath, "utf8")) as ExpConfig;
  const models = cfg.models ?? DEFAULT_MODELS;
  const margin = cfg.cropMargin ?? 0.4;
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Anchor-crop A/B — ${models.length} model(s) × {full, crop}\n  prompt: "${cfg.prompt}"\n`);

  // 1. Detect the face in the anchor photo → crop.
  const anchorBytes = await loadBytes(cfg.anchorPhoto);
  const det = await detect(toDataUrl(anchorBytes), "anchor");
  if (!det?.bbox) {
    console.error(
      det && !det.bbox
        ? "Endpoint returned no bbox — redeploy deploy/auraface-endpoint/handler.py (it now returns `bbox`)."
        : "No face detected in the anchor photo.",
    );
    process.exit(1);
  }
  const cropBytes = await cropFace(anchorBytes, det.bbox, margin);
  await writeFile(path.join(OUT_DIR, "_anchor_facecrop.jpg"), cropBytes);
  console.log(`  face bbox ${det.bbox.map((n) => Math.round(n)).join(",")} (${det.faces} face(s)) → crop saved to ${OUT_DIR}/_anchor_facecrop.jpg`);

  // 2. Publish both anchor forms so Fal can fetch them.
  const fullUrl = await publish(anchorBytes, "anchor-full.jpg");
  const cropUrl = await publish(cropBytes, "anchor-crop.jpg");

  // 3. Embed the eval anchors once (the AuraFace references).
  const anchorVecs: number[][] = [];
  for (const [i, ref] of cfg.evalAnchors.entries()) {
    const d = await detect(toDataUrl(await loadBytes(ref)), `evalAnchor[${i}]`);
    if (d) anchorVecs.push(d.vector);
  }
  if (!anchorVecs.length) {
    console.error("No eval anchors embedded — cannot score outputs.");
    process.exit(1);
  }

  // 4. Generate full vs crop for each model; score each output (best-anchor cosine).
  const variants: { key: "full" | "crop"; url: string }[] = [
    { key: "full", url: fullUrl },
    { key: "crop", url: cropUrl },
  ];
  const results: { model: string; full: number | null; crop: number | null }[] = [];
  for (const model of models) {
    const row: { model: string; full: number | null; crop: number | null } = { model, full: null, crop: null };
    for (const v of variants) {
      try {
        const res = await falProvider.generateImage({
          prompt: cfg.prompt,
          model,
          identityAnchor: { url: v.url, role: "anchor" },
          referenceImages: [],
        });
        await writeFile(path.join(OUT_DIR, `${slug(model)}__${v.key}.png`), res.data);
        const d = await detect(toDataUrl(res.data, res.contentType), `${model}/${v.key}`);
        const score = d ? bestCosine(d.vector, anchorVecs) : null;
        row[v.key] = score;
        console.log(`  ${model.padEnd(38)} ${v.key.padEnd(4)} → ${score == null ? "no-face" : score.toFixed(4)}`);
      } catch (e) {
        console.warn(`  ${model.padEnd(38)} ${v.key.padEnd(4)} → FAILED: ${e instanceof Error ? e.message : e}`);
      }
    }
    results.push(row);
  }

  // 5. Ranked table.
  console.log("\nRESULT — best-anchor AuraFace cosine (higher = better identity)\n");
  console.log("  model                                   full     crop     Δ(crop-full)");
  const f = (v: number | null) => (v == null ? "  —   " : v.toFixed(4));
  for (const r of results) {
    const delta = r.full != null && r.crop != null ? r.crop - r.full : null;
    const tag = delta == null ? "" : delta > 0.01 ? "  ✅ crop wins" : delta < -0.01 ? "  ⬇ full wins" : "  ≈ tie";
    console.log(`  ${r.model.padEnd(38)} ${f(r.full)}   ${f(r.crop)}   ${delta == null ? "  —" : (delta >= 0 ? "+" : "") + delta.toFixed(4)}${tag}`);
  }
  console.log(`\n  images saved under ${OUT_DIR}/  — eyeball them; the ruler is only half the story.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
