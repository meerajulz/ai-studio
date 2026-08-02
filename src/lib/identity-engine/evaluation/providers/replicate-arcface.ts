/**
 * Replicate ArcFace embedding provider (Milestone 26) — the first concrete `EmbeddingProvider`.
 *
 * ALL Replicate specifics live here (fetch-based predictions create+poll; no SDK). The engine never
 * imports this file — it goes through the router. Swap this for Fal / a self-hosted InsightFace service
 * by adding a sibling provider; the engine is untouched.
 *
 * ⚠ VERIFY at first live run: the exact model version hash + the output shape. Rate limits / tiering can
 * change the endpoint (same lesson as the Fal milestones). Env: `REPLICATE_API_TOKEN`,
 * `REPLICATE_FACE_EMBED_MODEL` (a version hash; overrides the default below).
 */
import {
  EmbeddingProviderError,
  type EmbeddingProvider,
  type FaceEmbedding,
} from "./EmbeddingProvider";

const API = "https://api.replicate.com/v1/predictions";
const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 60_000;

// A well-known ArcFace/face-embedding model version. Overridable via env until verified live.
const DEFAULT_MODEL = process.env.REPLICATE_FACE_EMBED_MODEL ?? "";

/** Pull a numeric vector out of Replicate's (model-dependent) output shape. Best-effort + defensive. */
function parseVector(output: unknown): number[] | null {
  if (Array.isArray(output) && output.every((n) => typeof n === "number")) return output as number[];
  // Some models wrap it: { embedding: [...] } or [{ embedding: [...] }] or { embeddings: [[...]] }.
  const first = Array.isArray(output) ? output[0] : output;
  if (first && typeof first === "object") {
    const obj = first as Record<string, unknown>;
    for (const key of ["embedding", "embeddings", "vector", "face_embedding"]) {
      const v = obj[key];
      if (Array.isArray(v) && v.every((n) => typeof n === "number")) return v as number[];
      if (Array.isArray(v) && Array.isArray(v[0])) return v[0] as number[]; // [[...]]
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const replicateArcFaceProvider: EmbeddingProvider = {
  id: "replicate-arcface",
  model: DEFAULT_MODEL,
  version: "arcface-v1",

  isConfigured() {
    return Boolean(process.env.REPLICATE_API_TOKEN && DEFAULT_MODEL);
  },

  async embedFace(imageUrl: string): Promise<FaceEmbedding | null> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token || !DEFAULT_MODEL) {
      throw new EmbeddingProviderError("MISSING_TOKEN", "Set REPLICATE_API_TOKEN + REPLICATE_FACE_EMBED_MODEL.");
    }

    const create = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ version: DEFAULT_MODEL, input: { image: imageUrl } }),
    });
    if (!create.ok) {
      const text = await create.text().catch(() => "");
      throw new EmbeddingProviderError("EMBED_FAILED", `Replicate create ${create.status}: ${text.slice(0, 200)}`);
    }
    let pred = (await create.json()) as { id: string; status: string; output?: unknown; error?: string };

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
      if (Date.now() > deadline) throw new EmbeddingProviderError("TIMEOUT", "Replicate embedding timed out.");
      await sleep(POLL_INTERVAL_MS);
      const poll = await fetch(`${API}/${pred.id}`, { headers: { Authorization: `Bearer ${token}` } });
      pred = (await poll.json()) as typeof pred;
    }
    if (pred.status !== "succeeded") {
      // A model that detects "no face" may fail cleanly — treat an explicit no-face as null, else error.
      if (pred.error && /no face|face not|0 faces/i.test(pred.error)) return null;
      throw new EmbeddingProviderError("EMBED_FAILED", pred.error || "Replicate embedding failed.");
    }

    const vector = parseVector(pred.output);
    if (!vector || vector.length === 0) return null; // no face / empty → not an error
    return { vector, dim: vector.length, version: this.version };
  },
};
