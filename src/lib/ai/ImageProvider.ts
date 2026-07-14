/**
 * ImageProvider — the provider-agnostic contract for turning a prompt into image bytes.
 *
 * The rest of the app depends ONLY on this interface (Decision 007). No provider SDK types
 * leak out. A provider returns raw bytes; storing them (Blob via the media layer) is the
 * app's job — a provider knows nothing about Blob, the DB, or the Gallery.
 * See docs/PROVIDER_INTERFACE.md.
 */

export type ImageGenerationRequest = {
  prompt: string;
  // First Light stops here. Reserved (NOT implemented): width/height/seed/negativePrompt/model.
};

export type ImageGenerationResult = {
  data: Buffer; // raw image bytes (provider-neutral)
  contentType: string; // e.g. "image/png"
  model: string; // the model actually used (for metadata)
  provider: string; // e.g. "huggingface"
};

export interface ImageProvider {
  readonly id: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export type ProviderErrorCode =
  | "MISSING_TOKEN"
  | "PROVIDER_UNAVAILABLE"
  | "GENERATION_FAILED"
  | "TIMEOUT";

/** Provider-neutral error. Providers map their SDK failures to these codes. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
