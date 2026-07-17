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
import {
  ProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
  type ReferenceImage,
} from "../ImageProvider";

const FAL_ENDPOINT = "https://fal.run";
const DEFAULT_T2I_MODEL = "fal-ai/flux/schnell";
const DEFAULT_IDENTITY_MODEL = "fal-ai/flux-pro/kontext"; // single reference
const DEFAULT_IDENTITY_MULTI_MODEL = "fal-ai/flux-pro/kontext/max/multi"; // multiple references
const MAX_REFERENCES = 4;

function getKey(): string | undefined {
  const value = process.env.FAL_KEY;
  return value && value.trim() ? value.trim() : undefined;
}

export function isFalConfigured(): boolean {
  return Boolean(getKey());
}

function models() {
  return {
    t2i: process.env.FAL_IMAGE_MODEL?.trim() || DEFAULT_T2I_MODEL,
    identity: process.env.FAL_IDENTITY_MODEL?.trim() || DEFAULT_IDENTITY_MODEL,
    identityMulti: process.env.FAL_IDENTITY_MULTI_MODEL?.trim() || DEFAULT_IDENTITY_MULTI_MODEL,
  };
}

function mapError(status: number, message: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError("MISSING_TOKEN", "Fal rejected the credentials (check FAL_KEY).");
  }
  if (status === 429 || status === 503 || status === 502) {
    return new ProviderError("PROVIDER_UNAVAILABLE", "Fal is busy — try again in a moment.");
  }
  if (status === 408) return new ProviderError("TIMEOUT", "Fal request timed out.");
  return new ProviderError("GENERATION_FAILED", message || "Fal image generation failed.");
}

type FalImage = { url: string; content_type?: string };
type FalResponse = {
  images?: FalImage[];
  seed?: number;
  timings?: Record<string, unknown>;
  has_nsfw_concepts?: boolean[];
};

/** Decide the Fal model + request body from the provider-neutral request. */
function planRequest(request: ImageGenerationRequest): {
  model: string;
  body: Record<string, unknown>;
  usedRefs: ReferenceImage[];
  supportsReferenceImages: boolean;
} {
  const m = models();
  // Identity Anchor invariant: prepend the anchor (the "who is this person" reference) ahead of the
  // scene-driven references, deduped by URL, immediately before sending. If the selector already led
  // with that image, the dedupe makes this a no-op.
  const scene = request.referenceImages ?? [];
  const anchor = request.identityAnchor;
  const merged = anchor ? [anchor, ...scene.filter((r) => r.url !== anchor.url)] : scene;
  const refs = merged.slice(0, MAX_REFERENCES);

  if (refs.length === 0) {
    return {
      model: m.t2i,
      body: { prompt: request.prompt, image_size: "square_hd", num_images: 1 },
      usedRefs: [],
      supportsReferenceImages: false,
    };
  }

  if (refs.length === 1) {
    return {
      model: m.identity,
      body: { prompt: request.prompt, image_url: refs[0].url, num_images: 1 },
      usedRefs: refs,
      supportsReferenceImages: true,
    };
  }

  return {
    model: m.identityMulti,
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
      throw mapError(response.status, text);
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
      },
      metadata: {
        seed: json.seed ?? null,
        timings: json.timings ?? null,
        hasNsfwConcepts: json.has_nsfw_concepts ?? null,
      },
    };
  },
};
