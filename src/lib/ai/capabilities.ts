/**
 * Provider capabilities (Milestone 15).
 *
 * The rest of AI Studio depends on CAPABILITIES, never on provider names. A provider advertises
 * what it can do; the router and generation layer reason over those capabilities. Adding a new
 * provider never requires an `if (provider === "…")` anywhere in feature code.
 */
export type ProviderCapability =
  | "imageGeneration"
  | "imageEditing"
  | "referenceImages"
  | "multipleReferenceImages"
  | "identityPreservation"
  | "inpainting"
  | "outpainting"
  | "video"
  | "lora"
  | "ipAdapter"
  | "controlNet"
  | "asyncJobs";

export type ProviderCapabilities = ReadonlySet<ProviderCapability>;

/** Build a capability set from a list (readonly). */
export function capabilities(...caps: ProviderCapability[]): ProviderCapabilities {
  return new Set(caps);
}

export function hasCapability(
  caps: ProviderCapabilities,
  cap: ProviderCapability,
): boolean {
  return caps.has(cap);
}

export function hasAll(
  caps: ProviderCapabilities,
  needs: readonly ProviderCapability[],
): boolean {
  return needs.every((c) => caps.has(c));
}
