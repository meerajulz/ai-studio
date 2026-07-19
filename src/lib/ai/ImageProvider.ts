/**
 * ImageProvider — the provider-agnostic contract for turning a prompt into image bytes.
 *
 * The rest of the app depends ONLY on this interface (Decision 007) and on provider CAPABILITIES
 * (Milestone 15) — never on provider names. No provider SDK types leak out. A provider returns
 * raw bytes; storing them (Blob via the media layer) is the app's job — a provider knows nothing
 * about Blob, the DB, or the Gallery. See docs/PROVIDER_INTERFACE.md.
 */
import type { ProviderCapabilities } from "./capabilities";

/** A provider-neutral reference image (from an Identity Visual Package). */
export type ReferenceImage = {
  url: string;
  role: "anchor" | "hero" | "portrait" | "fullBody" | "reference";
};

export type ImageGenerationRequest = {
  prompt: string;
  /**
   * Reference images for identity preservation, provider-neutral. Adapters use them ONLY if the
   * chosen model is capable; otherwise they gracefully ignore them (Milestone 15). These describe
   * the REQUEST (body pose, tattoos, scene) — chosen by the Smart Reference Selector.
   */
  referenceImages?: ReferenceImage[];
  /**
   * The **Identity Anchor** — the single strongest frontal-face reference whose only job is to tell
   * the model WHO this person is (separate architectural concern from the scene selector). A capable
   * adapter **prepends** it to the reference list immediately before sending (deduped) so identity is
   * anchored regardless of the scene-driven selection. Non-capable adapters ignore it.
   */
  identityAnchor?: ReferenceImage;
  /** DEV cap on how many references to send (anchor kept first). Undefined = the adapter's max. */
  maxReferences?: number;
  /**
   * The RESOLVED model id to run (Milestone 21 — chosen by the capability model router, or a manual
   * benchmark pick). The adapter looks it up in the Model Registry for the request-shape (`payloadKind`)
   * and max references — no per-model branching. When absent, the adapter uses its own default.
   */
  model?: string;
  /**
   * Trained adapters (LoRA) to apply at inference, provider-neutral (Milestone 24). Each is a weights
   * URL + optional strength. Adapters use them ONLY if the chosen model is LoRA-capable; others ignore
   * them. Set by the Identity Engine when the conditioning strategy includes a trained model.
   */
  loras?: { path: string; scale?: number }[];
  // Reserved (NOT implemented): width/height/seed/negativePrompt.
};

export type ImageGenerationResult = {
  data: Buffer; // raw image bytes (provider-neutral)
  contentType: string; // e.g. "image/png"
  model: string; // the model actually used (for metadata)
  provider: string; // e.g. "huggingface" | "fal"
  /**
   * A secret-free echo of the request the provider actually sent — for the development Debug
   * panel only. MUST NEVER contain tokens/credentials. Optional.
   */
  requestPayload?: Record<string, unknown>;
  /** Provider response metadata (seed, timings, safety flags, …) for the dev Debug panel. */
  metadata?: Record<string, unknown>;
};

export interface ImageProvider {
  readonly id: string;
  /** The model this provider uses by default (for routing decisions + debug). */
  readonly defaultModel: string;
  /** What this provider can do — the app routes on these, never on `id`. */
  readonly capabilities: ProviderCapabilities;
  /** Whether the provider has the credentials it needs (for routing + graceful UI degradation). */
  isConfigured(): boolean;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export type ProviderErrorCode =
  | "MISSING_TOKEN"
  | "PROVIDER_UNAVAILABLE"
  | "GENERATION_FAILED"
  | "CONTENT_MODERATED" // the model's safety filter blocked it (often a black/blank placeholder image)
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
