/**
 * Fal.ai image provider (Milestone 15 · identity via Kontext in Milestone 17).
 *
 * The single file allowed to know about Fal. It maps a provider-neutral request → Fal's HTTP API
 * → image bytes, and maps failures → `ProviderError`. Auth via `FAL_KEY`. Uses `fetch` (no SDK).
 *
 * Model selection is a FAL-INTERNAL decision (all Fal specifics live here):
 *  - no reference images → a fast text-to-image model (`FAL_IMAGE_MODEL`, default flux/schnell).
 *  - with reference images → FLUX.1 **Kontext** for identity preservation (`FAL_IDENTITY_MODEL`
 *    for one reference, `FAL_IDENTITY_MULTI_MODEL` for several). See docs/PROVIDER_RESEARCH.md.
 *
 * The Creative Director / router / identity layer never know any of this — they speak capabilities
 * and provider-neutral reference images.
 */
import { capabilities } from "../capabilities";
import { getModel } from "../model-registry";
import {
  ProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
  type ReferenceImage,
} from "../ImageProvider";

const FAL_ENDPOINT = "https://fal.run";
const DEFAULT_T2I_MODEL = "fal-ai/flux/schnell";
const DEFAULT_IDENTITY_MULTI_MODEL = "fal-ai/flux-pro/kontext/max/multi"; // default when no model resolved
const MAX_REFERENCES = 4;

function getKey(): string | undefined {
  const value = process.env.FAL_KEY;
  return value && value.trim() ? value.trim() : undefined;
}

export function isFalConfigured(): boolean {
  return Boolean(getKey());
}

function mapError(status: number, message: string, model: string): ProviderError {
  const snippet = message ? ` — ${message.slice(0, 200)}` : "";
  // A locked account / exhausted balance also comes back as 403 — surface THAT (it's not a model or
  // credential problem), so the user tops up instead of chasing model access.
  if (/exhausted balance|is locked|top up|insufficient/i.test(message)) {
    return new ProviderError(
      "PROVIDER_UNAVAILABLE",
      "Your Fal account is out of balance — top up at fal.ai/dashboard/billing to generate or train.",
    );
  }
  // The MODEL's content policy refused the prompt/image (e.g. GPT Image is much stricter than FLUX).
  // Not a bug or a config issue — surface it cleanly with an actionable next step.
  if (/content[_ ]?policy|content checker|flagged by|safety system|moderation/i.test(message)) {
    return new ProviderError(
      "CONTENT_MODERATED",
      `"${model}" refused this request on its content policy. That model (e.g. GPT Image) is stricter ` +
        `than FLUX — rephrase the prompt, or switch to a FLUX / Kontext model (the Auto default).`,
    );
  }
  // 401 = the KEY is wrong/missing (a real config problem). 403 = the key is fine but the account
  // isn't allowed to use THIS model — a model-access problem, NOT "not configured". Keep them distinct
  // so the message is actionable (this was previously masked as "isn't configured yet").
  if (status === 401) {
    return new ProviderError("MISSING_TOKEN", `Fal rejected the credentials (401) — check FAL_KEY.`);
  }
  if (status === 403) {
    return new ProviderError(
      "GENERATION_FAILED",
      `Fal denied access to model "${model}" (403). Your Fal account may not have access to this ` +
        `model — enable it in the Fal dashboard, or pick a different model.${snippet}`,
    );
  }
  if (status === 429 || status === 503 || status === 502) {
    return new ProviderError("PROVIDER_UNAVAILABLE", "Fal is busy — try again in a moment.");
  }
  if (status === 408) return new ProviderError("TIMEOUT", "Fal request timed out.");
  return new ProviderError(
    "GENERATION_FAILED",
    `Fal request for "${model}" failed (${status})${snippet}`,
  );
}

type FalImage = { url: string; content_type?: string };
type FalResponse = {
  images?: FalImage[];
  seed?: number;
  timings?: Record<string, unknown>;
  has_nsfw_concepts?: boolean[];
};

/**
 * Decide the Fal model + request body — driven by the RESOLVED model's registry spec (Milestone 21),
 * NOT by FLUX-specific branching. The capability model router already chose `request.model`; here we
 * only map its `payloadKind` to a body. Unknown/absent model → sensible Fal defaults.
 */
function planRequest(request: ImageGenerationRequest): {
  model: string;
  body: Record<string, unknown>;
  usedRefs: ReferenceImage[];
  supportsReferenceImages: boolean;
} {
  // Identity Anchor invariant: prepend the anchor (the "who is this person" reference) ahead of the
  // scene-driven references, deduped by URL, immediately before sending.
  const scene = request.referenceImages ?? [];
  const anchor = request.identityAnchor;
  const merged = anchor ? [anchor, ...scene.filter((r) => r.url !== anchor.url)] : scene;

  const spec = request.model ? getModel(request.model) : undefined;
  const maxRefs = spec?.maxReferences || MAX_REFERENCES;
  // DEV benchmark cap (anchor stays first) ∩ the model's own max.
  const cap = Math.max(1, Math.min(maxRefs, request.maxReferences ?? maxRefs));
  const refs = merged.slice(0, cap);

  // No references → text-to-image (use a t2i model regardless of a stray edit-model id).
  if (refs.length === 0) {
    return {
      model: spec?.payloadKind === "t2i" ? spec.id : DEFAULT_T2I_MODEL,
      body: { prompt: request.prompt, image_size: "square_hd", num_images: 1 },
      usedRefs: [],
      supportsReferenceImages: false,
    };
  }

  const model = spec?.id ?? DEFAULT_IDENTITY_MULTI_MODEL;
  const kind = spec?.payloadKind ?? "image_urls";

  // PuLID face identity (Milestone 24.5): a single face image drives identity; the prompt drives the
  // scene. Zero-shot — no loras, no scene references. `reference_image_url` is the Identity Anchor face.
  if (kind === "pulid") {
    return {
      model,
      body: {
        prompt: request.prompt,
        reference_image_url: refs[0].url,
        id_weight: request.idWeight ?? 1,
        num_images: 1,
      },
      usedRefs: refs.slice(0, 1),
      supportsReferenceImages: true,
    };
  }

  // Reference + trained LoRA (Milestone 24): Kontext-LoRA takes a single `image_url` + a `loras`
  // array of trained-weights URLs. The Identity Engine set `request.loras` when the strategy is
  // `reference+lora`; the model router already picked this LoRA-capable model.
  if (kind === "image_url_lora") {
    return {
      model,
      body: {
        prompt: request.prompt,
        image_url: refs[0].url,
        loras: request.loras ?? [],
        num_images: 1,
      },
      usedRefs: refs,
      supportsReferenceImages: true,
    };
  }

  // Single-reference models take `image_url`; every multi/edit model takes `image_urls` (verified).
  if (kind === "image_url") {
    return {
      model,
      body: { prompt: request.prompt, image_url: refs[0].url, num_images: 1 },
      usedRefs: refs,
      supportsReferenceImages: true,
    };
  }

  return {
    model,
    body: { prompt: request.prompt, image_urls: refs.map((r) => r.url), num_images: 1 },
    usedRefs: refs,
    supportsReferenceImages: true,
  };
}

export const falProvider: ImageProvider = {
  id: "fal",
  defaultModel: DEFAULT_T2I_MODEL,
  capabilities: capabilities(
    "imageGeneration",
    "imageEditing",
    "referenceImages",
    "multipleReferenceImages",
    "identityPreservation",
    "inpainting",
    "outpainting",
    "lora",
    "ipAdapter",
    "controlNet",
    "asyncJobs",
  ),
  isConfigured: isFalConfigured,

  async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    const key = getKey();
    if (!key) {
      throw new ProviderError("MISSING_TOKEN", "Fal is not configured (set FAL_KEY).");
    }

    const { model, body, usedRefs, supportsReferenceImages } = planRequest(request);

    let response: Response;
    try {
      response = await fetch(`${FAL_ENDPOINT}/${model}`, {
        method: "POST",
        headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ProviderError("PROVIDER_UNAVAILABLE", "Could not reach Fal.");
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      // Dev diagnostic: which model + status actually failed (never logs the key).
      if (process.env.NODE_ENV !== "production") {
        console.error(`[fal] ${response.status} for model "${model}"${text ? `: ${text.slice(0, 300)}` : ""}`);
      }
      throw mapError(response.status, text, model);
    }

    const json = (await response.json()) as FalResponse;

    // NSFW moderation: Kontext/Flux still returns HTTP 200 with a BLACK PLACEHOLDER image and
    // `has_nsfw_concepts: [true]`. Detect it and fail with a clear message instead of silently
    // saving a black image (Milestone 20 fix).
    if (json.has_nsfw_concepts?.some(Boolean)) {
      throw new ProviderError(
        "CONTENT_MODERATED",
        "The model's safety filter blocked this generation and returned a blank image. " +
          "Try rephrasing the prompt or using different reference images.",
      );
    }

    const image = json.images?.[0];
    if (!image?.url) {
      throw new ProviderError("GENERATION_FAILED", "Fal returned no image.");
    }

    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new ProviderError("GENERATION_FAILED", "Could not download the Fal image.");
    }
    const data = Buffer.from(await imageResponse.arrayBuffer());
    if (data.length === 0) {
      throw new ProviderError("GENERATION_FAILED", "Fal returned an empty image.");
    }

    return {
      data,
      contentType: image.content_type || imageResponse.headers.get("content-type") || "image/jpeg",
      model,
      provider: "fal",
      // Secret-free echo (FAL_KEY is never included).
      requestPayload: {
        provider: "fal",
        model,
        prompt: request.prompt,
        supportsReferenceImages,
        usedReferenceImages: usedRefs.length,
        referenceRoles: usedRefs.map((r) => r.role),
        // The ACTUAL ordered images sent (signed URLs; dev Debug thumbnails). Never a secret.
        referenceImages: usedRefs.map((r) => ({ url: r.url, role: r.role })),
      },
      metadata: {
        seed: json.seed ?? null,
        timings: json.timings ?? null,
        hasNsfwConcepts: json.has_nsfw_concepts ?? null,
      },
    };
  },
};
