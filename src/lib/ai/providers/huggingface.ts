/**
 * Hugging Face image provider — the ONLY implemented provider (Milestone 10, First Light).
 *
 * This is the single file allowed to know about Hugging Face. It maps a provider-neutral
 * request → HF Inference `textToImage` → image bytes, and maps SDK failures → `ProviderError`.
 * Auth via `HF_TOKEN` (preferred) or `HUGGINGFACE_API_KEY`. See docs/PROVIDER_INTERFACE.md.
 */
import { InferenceClient } from "@huggingface/inference";

import {
  ProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
} from "../ImageProvider";

const TOKEN_ENV_NAMES = ["HF_TOKEN", "HUGGINGFACE_API_KEY"] as const;
const DEFAULT_MODEL = "black-forest-labs/FLUX.1-schnell";
const MAX_COLD_START_RETRIES = 2;

function getToken(): string | undefined {
  for (const name of TOKEN_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

/** Whether a Hugging Face token is present (so the UI can degrade gracefully). */
export function isHuggingFaceConfigured(): boolean {
  return Boolean(getToken());
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isColdStart(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("loading") ||
    message.includes("currently loading") ||
    message.includes("503")
  );
}

function mapError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : "Image generation failed.";
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return new ProviderError("TIMEOUT", message);
  }
  if (isColdStart(error) || lower.includes("unavailable") || lower.includes("overloaded")) {
    return new ProviderError("PROVIDER_UNAVAILABLE", message);
  }
  return new ProviderError("GENERATION_FAILED", message);
}

export const huggingFaceProvider: ImageProvider = {
  id: "huggingface",

  async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    const token = getToken();
    if (!token) {
      throw new ProviderError(
        "MISSING_TOKEN",
        "Hugging Face is not configured (set HF_TOKEN or HUGGINGFACE_API_KEY).",
      );
    }
    const model = process.env.HF_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
    const client = new InferenceClient(token);

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_COLD_START_RETRIES; attempt++) {
      try {
        const blob = await client.textToImage(
          { model, inputs: request.prompt, provider: "auto" },
          { outputType: "blob" },
        );
        const data = Buffer.from(await blob.arrayBuffer());
        if (data.length === 0) {
          throw new ProviderError("GENERATION_FAILED", "Provider returned an empty image.");
        }
        return {
          data,
          contentType: blob.type || "image/png",
          model,
          provider: "huggingface",
        };
      } catch (error) {
        lastError = error;
        // HF models can cold-start (503 "loading") — retry a bounded number of times.
        if (isColdStart(error) && attempt < MAX_COLD_START_RETRIES) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw mapError(error);
      }
    }
    throw mapError(lastError);
  },
};
