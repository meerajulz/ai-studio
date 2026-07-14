/**
 * VisionProvider — the provider-agnostic contract for image UNDERSTANDING (Milestone 18A).
 *
 * Mirrors `ImageProvider`: the rest of AI Studio depends only on this interface + capabilities,
 * never on a vendor. A provider returns raw `VisionObservation`s; AI Studio normalizes them into
 * `IdentityMetadata` knowledge (`normalize.ts`). No provider is implemented in 18A — the first
 * adapter (Gemini / Qwen / Florence, per research) lands in 18B behind this exact interface.
 * See docs/research/RESEARCH_02_VISION.md §1, §13.
 */
import type { VisionCapabilities, VisionCapability } from "./capabilities";
import type { VisionObservation } from "./types";

export type VisionRequest = {
  /** A fetchable image URL (e.g. a signed Blob URL). The provider reads it server-side. */
  imageUrl: string;
  /** Which analyses to run. Omitted → all the provider supports. */
  tasks?: VisionCapability[];
};

export interface VisionProvider {
  readonly id: string;
  readonly defaultModel: string;
  readonly capabilities: VisionCapabilities;
  /** Whether the provider has the credentials it needs (for routing + graceful degradation). */
  isConfigured(): boolean;
  /**
   * Analyse one image and return provider OBSERVATIONS. The caller normalizes these into knowledge
   * (`normalizeToIdentityMetadata`) — this raw shape is never stored.
   */
  analyzeImage(request: VisionRequest): Promise<VisionObservation>;
  /** Optional: list the model ids this provider/key can use (for setup + debugging). */
  listModels?(): Promise<string[]>;
}

export type VisionErrorCode =
  | "MISSING_TOKEN"
  | "PROVIDER_UNAVAILABLE"
  | "ANALYSIS_FAILED"
  | "TIMEOUT"
  | "UNSUPPORTED";

/** Provider-neutral error. Vision adapters map their SDK/API failures to these codes. */
export class VisionError extends Error {
  readonly code: VisionErrorCode;
  constructor(code: VisionErrorCode, message: string) {
    super(message);
    this.name = "VisionError";
    this.code = code;
  }
}

export function isVisionError(error: unknown): error is VisionError {
  return error instanceof VisionError;
}
