/**
 * AI layer — the provider-agnostic entry point. Feature code calls `getImageProvider()` and
 * depends only on the `ImageProvider` interface; it never imports a provider file directly.
 * Adding Fal/OpenAI/Replicate/local later = a new file under `providers/` + a case here.
 * See docs/PROVIDER_INTERFACE.md, AI_GENERATION.md.
 */
import type { ImageProvider } from "./ImageProvider";
import {
  huggingFaceProvider,
  isHuggingFaceConfigured,
} from "./providers/huggingface";

/** The active image provider. First Light: always Hugging Face. */
export function getImageProvider(): ImageProvider {
  return huggingFaceProvider;
}

/** Whether the active provider is configured (for graceful UI degradation). */
export function isImageProviderConfigured(): boolean {
  return isHuggingFaceConfigured();
}

export {
  ProviderError,
  isProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ImageProvider,
} from "./ImageProvider";
