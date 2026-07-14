/**
 * Fal.ai image provider (Milestone 15) — the first premium provider.
 *
 * The single file allowed to know about Fal. It maps a provider-neutral request → Fal's HTTP API
 * → image bytes, and maps failures → `ProviderError`. Auth via `FAL_KEY`. Uses `fetch` (no SDK
 * dependency). Reference images (from an Identity Visual Package) are used ONLY when the chosen
 * model supports them; otherwise they are gracefully ignored — the Creative Director never cares.
 * See docs/PROVIDER_INTERFACE.md.
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
const DEFAULT_MODEL = "fal-ai/flux/schnell";

/**
 * Models that accept a reference image, and the request field they expect. The default t2i model
 * is not here, so reference images are ignored for it (graceful). Adding identity-preserving
 * models later = one entry here; no change anywhere else.
 */
const REFERENCE_IMAGE_FIELD: Record<string, string> = {
  "fal-ai/flux-pulid": "reference_image_url",
  "fal-ai/ip-adapter-face-id": "face_image_url",
};

function getKey(): string | undefined {
  const value = process.env.FAL_KEY;
  return value && value.trim() ? value.trim() : undefined;
}

export function isFalConfigured(): boolean {
  return Boolean(getKey());
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
type FalResponse = { images?: FalImage[] };

export const falProvider: ImageProvider = {
  id: "fal",
  defaultModel: DEFAULT_MODEL,
  // Fal (as a platform) supports the full premium feature set across its models. Whether a given
  // GENERATION uses references depends on the selected model (see REFERENCE_IMAGE_FIELD).
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
    const model = process.env.FAL_IMAGE_MODEL?.trim() || DEFAULT_MODEL;

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      image_size: "square_hd",
      num_images: 1,
    };

    // Use the Identity Visual Package's reference images ONLY if this model supports them.
    const refField = REFERENCE_IMAGE_FIELD[model];
    const usableRefs: ReferenceImage[] =
      refField && request.referenceImages?.length ? request.referenceImages : [];
    if (refField && usableRefs.length > 0) {
      body[refField] = usableRefs[0].url;
    }

    let response: Response;
    try {
      response = await fetch(`${FAL_ENDPOINT}/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
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
        supportsReferenceImages: Boolean(refField),
        usedReferenceImages: usableRefs.length,
      },
    };
  },
};
