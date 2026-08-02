/**
 * AuraFace face-embedding provider (Milestone 26 Phase 2) — the first concrete `FaceSimilarityProvider`.
 *
 * IMPORTANT: this file knows ONLY the `FaceSimilarityProvider` interface + a generic HTTP contract — NOT
 * Hugging Face. The hosted endpoint is pure config (`FACE_EMBED_ENDPOINT_URL` + `FACE_EMBED_API_KEY`). If
 * AuraFace later moves from an HF endpoint to Fal / Replicate / AWS / a self-hosted service, you change
 * the env (or, at most, this one file) and NOTHING else in the system changes. That's the whole point of
 * the capability-based abstraction.
 *
 * Endpoint contract (host-agnostic — deploy AuraFace/InsightFace behind it):
 *   POST {FACE_EMBED_ENDPOINT_URL}
 *     Authorization: Bearer {FACE_EMBED_API_KEY}
 *     Content-Type: application/json
 *     { "image": "<signed image url>" }
 *   → 200 { "embedding": number[] }     // the 512-d face vector
 *   → 200 { "embedding": null }         // no face detected (not an error)
 *   (bare [...] / { vector: [...] } / [{ embedding: [...] }] are also accepted, defensively)
 */
import { FaceSimilarityError, type Embedding, type FaceSimilarityProvider } from "./FaceSimilarityProvider";

const TIMEOUT_MS = 30_000;

/** Pull a numeric vector out of the (deployment-dependent) response shape. Defensive. */
function parseVector(out: unknown): number[] | null {
  if (Array.isArray(out) && out.every((n) => typeof n === "number")) return out as number[];
  const first = Array.isArray(out) ? out[0] : out;
  if (first && typeof first === "object") {
    const obj = first as Record<string, unknown>;
    for (const key of ["embedding", "vector", "face_embedding", "embeddings"]) {
      const v = obj[key];
      if (Array.isArray(v) && v.every((n) => typeof n === "number")) return v as number[];
      if (Array.isArray(v) && Array.isArray(v[0])) return v[0] as number[];
    }
  }
  return null;
}

export const auraFaceProvider: FaceSimilarityProvider = {
  id: "auraface",
  version: process.env.FACE_EMBED_VERSION ?? "auraface-v1",

  isConfigured() {
    return Boolean(process.env.FACE_EMBED_ENDPOINT_URL && process.env.FACE_EMBED_API_KEY);
  },

  async embed(imageUrl: string): Promise<Embedding | null> {
    const url = process.env.FACE_EMBED_ENDPOINT_URL;
    const key = process.env.FACE_EMBED_API_KEY;
    if (!url || !key) {
      throw new FaceSimilarityError("MISSING_TOKEN", "Set FACE_EMBED_ENDPOINT_URL + FACE_EMBED_API_KEY.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        // HF's inference toolkit requires an `inputs` key; the handler unwraps it back to { image }.
        body: JSON.stringify({ inputs: { image: imageUrl } }),
        signal: controller.signal,
      });
    } catch (e) {
      throw new FaceSimilarityError(
        e instanceof Error && e.name === "AbortError" ? "TIMEOUT" : "PROVIDER_UNAVAILABLE",
        `Face embedding request failed: ${e instanceof Error ? e.message : "unknown"}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new FaceSimilarityError("PROVIDER_FAILED", `Face embedding ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = (await res.json().catch(() => null)) as unknown;
    // Explicit no-face signal.
    if (body && typeof body === "object" && "embedding" in body && (body as { embedding: unknown }).embedding === null) {
      return null;
    }
    const vector = parseVector(body);
    if (!vector || vector.length === 0) return null; // no face / empty → not an error
    return { vector, dim: vector.length, version: this.version };
  },
};
