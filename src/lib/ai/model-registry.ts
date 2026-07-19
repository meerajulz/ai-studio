/**
 * Model Registry (Milestone 21) — AI Studio as a capability-routed orchestration layer, not a "FLUX
 * app". Each MODEL declares its capabilities + how its request is shaped; the pipeline requests
 * CAPABILITIES and the router picks the best compatible model. **Adding a state-of-the-art model is a
 * config entry here — no business-logic change.**
 *
 * Pure data (client-safe: the Manual model selector imports this). All request-shape knowledge is a
 * `payloadKind` the provider adapter maps to a body — no per-model branching in the adapter.
 *
 * Verified from Fal docs (2026-07): every target editing model accepts `{ prompt, image_urls }`.
 * Identity-preservation QUALITY and per-account availability are the user's live benchmark.
 */
import type { ProviderCapability } from "./capabilities";

/** How the provider adapter builds the request body for a model. */
export type PayloadKind = "t2i" | "image_url" | "image_urls";

export type ModelSpec = {
  id: string; // provider model id, e.g. "fal-ai/flux-pro/kontext/max/multi"
  provider: string; // the ImageProvider that executes it (all Fal-hosted today)
  vendor: string; // UI grouping: "FLUX" | "Google" | "OpenAI" | "ByteDance"
  label: string; // "Kontext Max Multi"
  capabilities: ProviderCapability[];
  maxReferences: number; // 1 (t2i has none) … 10 (Seedream)
  payloadKind: PayloadKind;
  priority: number; // Auto tiebreak (higher wins) — tune after benchmarking
  enabled: boolean; // registered + selectable
  note?: string; // caveats, e.g. "may require OpenAI BYOK on the Fal account"
};

const EDIT: ProviderCapability[] = [
  "imageGeneration",
  "imageEditing",
  "referenceImages",
  "multipleReferenceImages",
  "identityPreservation",
];

/**
 * The registry. Order is documentation only; routing uses `priority`. Priorities start with the
 * proven models high — retune once the benchmark ranks identity fidelity across vendors.
 */
export const MODEL_REGISTRY: ModelSpec[] = [
  {
    id: "fal-ai/flux-pro/kontext/max/multi",
    provider: "fal",
    vendor: "FLUX",
    label: "Kontext Max Multi",
    capabilities: [...EDIT, "realism"],
    maxReferences: 4,
    payloadKind: "image_urls",
    // Highest priority = the PROVEN Auto default. Retune only after benchmarking beats it.
    priority: 95,
    enabled: true,
  },
  {
    id: "fal-ai/flux-2-pro/edit",
    provider: "fal",
    vendor: "FLUX",
    label: "FLUX.2 Pro Edit",
    capabilities: [...EDIT, "realism"],
    maxReferences: 4,
    payloadKind: "image_urls",
    priority: 92, // SOTA candidate — try in Manual, promote if it wins the benchmark
    enabled: true,
    note: "FLUX.2 pro — state-of-the-art multi-reference editor (unbenchmarked here)",
  },
  {
    id: "fal-ai/flux-pro/kontext/multi",
    provider: "fal",
    vendor: "FLUX",
    label: "Kontext Pro Multi",
    capabilities: [...EDIT, "realism"],
    maxReferences: 4,
    payloadKind: "image_urls",
    priority: 85,
    enabled: true,
  },
  {
    id: "fal-ai/nano-banana-pro/edit",
    provider: "fal",
    vendor: "Google",
    label: "Nano Banana Pro",
    capabilities: [...EDIT, "realism", "typography"],
    maxReferences: 6,
    payloadKind: "image_urls",
    priority: 88,
    enabled: true,
  },
  {
    id: "fal-ai/gemini-25-flash-image/edit",
    provider: "fal",
    vendor: "Google",
    label: "Gemini Image (2.5 Flash)",
    capabilities: [...EDIT, "typography"],
    maxReferences: 6,
    payloadKind: "image_urls",
    priority: 74,
    enabled: true,
  },
  {
    id: "openai/gpt-image-2/edit",
    provider: "fal",
    vendor: "OpenAI",
    label: "GPT Image 2 Edit",
    capabilities: [...EDIT, "realism", "typography"],
    maxReferences: 4,
    payloadKind: "image_urls",
    priority: 80,
    enabled: true,
    note: "may require OpenAI BYOK on the Fal account",
  },
  {
    // Real Fal endpoint. The prior id `bytedance/seedream/v5/pro/edit` did NOT exist (missing the
    // `fal-ai/` prefix and no `v5/pro` tier) → every request 404'd. v4 edit accepts up to 10 refs.
    id: "fal-ai/bytedance/seedream/v4/edit",
    provider: "fal",
    vendor: "ByteDance",
    label: "Seedream 4 Edit",
    capabilities: [...EDIT, "realism"],
    maxReferences: 10,
    payloadKind: "image_urls",
    priority: 82,
    enabled: true,
    note: "fal-ai/bytedance/seedream/v4.5/edit is the newer tier — swap the id to try it",
  },
  // Non-identity fallbacks (used by routing when there are no references).
  {
    id: "fal-ai/flux-pro/kontext",
    provider: "fal",
    vendor: "FLUX",
    label: "Kontext (single ref)",
    capabilities: ["imageGeneration", "imageEditing", "referenceImages", "identityPreservation", "realism"],
    maxReferences: 1,
    payloadKind: "image_url",
    priority: 60,
    enabled: true,
  },
  {
    id: "fal-ai/flux/schnell",
    provider: "fal",
    vendor: "FLUX",
    label: "FLUX Schnell (text-to-image)",
    capabilities: ["imageGeneration"],
    maxReferences: 0,
    payloadKind: "t2i",
    priority: 50,
    enabled: true,
  },
];

export const listModels = (): ModelSpec[] => MODEL_REGISTRY;
export const getModel = (id: string): ModelSpec | undefined => MODEL_REGISTRY.find((m) => m.id === id);
export const modelsForProvider = (provider: string): ModelSpec[] =>
  MODEL_REGISTRY.filter((m) => m.provider === provider);
