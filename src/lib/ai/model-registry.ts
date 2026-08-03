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
export type PayloadKind = "t2i" | "image_url" | "image_urls" | "image_url_lora" | "pulid";

export type ModelSpec = {
  id: string; // provider model id, e.g. "fal-ai/flux-pro/kontext/max/multi"
  provider: string; // the ImageProvider that executes it (all Fal-hosted today)
  vendor: string; // UI grouping: "FLUX" | "Google" | "OpenAI" | "ByteDance"
  label: string; // "Kontext Max Multi"
  capabilities: ProviderCapability[];
  maxReferences: number; // 1 (t2i has none) … 10 (Seedream)
  payloadKind: PayloadKind;
  priority: number; // Auto tiebreak (higher wins) — tune after benchmarking
  enabled: boolean; // registered + routable by the capability router
  /**
   * Auto-only: the capability router may choose it, but it is NOT offered in the Manual/Developer model
   * picker. For models that only work with extra inputs the app supplies automatically (e.g. a trained
   * LoRA) — manually picking them would send an incomplete request.
   */
  autoOnly?: boolean;
  note?: string; // caveats, e.g. "may require OpenAI BYOK on the Fal account"
  /** Rough per-image cost estimate (USD) for the benchmark's cost column — override the map below. */
  estimatedCostUsd?: number;
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
  {
    // Qwen Image Edit (Milestone 24.8). The 2509/2511 tiers take an `image_urls` array (multi-image
    // edit, strong text editing) → maps to the generic image_urls body, no adapter change.
    id: "fal-ai/qwen-image-edit-2509",
    provider: "fal",
    vendor: "Qwen",
    label: "Qwen Image Edit",
    capabilities: [...EDIT, "realism", "typography"],
    maxReferences: 4,
    payloadKind: "image_urls",
    priority: 78, // benchmark candidate — retune once it's scored
    enabled: true,
    note: "Qwen 2509/2511 take image_urls; -2511 is the newer tier (swap the id to try it)",
  },
  {
    // Wan image-to-image (Milestone 24.8). v2.6 is the current i2i tier (1–3 reference images; style
    // transfer + subject consistency). Multi-image → image_urls (confirm the exact param + tier live —
    // fal.ai was rate-limiting at scoping time; a wrong id/param surfaces as a clean Fal 4xx).
    id: "wan/v2.6/image-to-image",
    provider: "fal",
    vendor: "Wan",
    label: "Wan v2.6 Edit",
    capabilities: [...EDIT, "realism"],
    maxReferences: 3,
    payloadKind: "image_urls",
    priority: 76, // benchmark candidate
    enabled: true,
    note: "VERIFY at first run: exact endpoint id + image param (image_urls assumed; 1–3 refs)",
  },
  {
    // Reference + trained LoRA (Milestone 24). Kontext image-to-image that ALSO applies a trained
    // LoRA — the only Fal endpoint that does reference + LoRA together. Single reference (image_url).
    // Chosen by the model router only when the conditioning strategy includes a LoRA.
    id: "fal-ai/flux-kontext-lora",
    provider: "fal",
    vendor: "FLUX",
    label: "Kontext + LoRA",
    capabilities: [...EDIT, "realism", "lora"],
    maxReferences: 1, // Kontext-LoRA takes a single image_url; the LoRA carries identity
    payloadKind: "image_url_lora",
    priority: 90,
    enabled: true,
    // Auto-only: routed automatically when the identity has a trained LoRA (it needs the weights). NOT
    // a manual pick — selecting it by hand would send a request with no LoRA and Fal rejects it.
    autoOnly: true,
    note: "identity-trained LoRA + one reference (Identity Anchor); requires a trained model",
  },
  {
    // PuLID face-identity adapter (Milestone 24.5). Zero-shot: generates from ONE face image +
    // prompt (no training, no scene refs, no LoRA). Chosen only when the plan's primary technique is
    // PuLID. Face-only — pair with LoRA (per-request) for tattoo/body scenes.
    id: "fal-ai/flux-pulid",
    provider: "fal",
    vendor: "FLUX",
    label: "PuLID (face identity)",
    capabilities: ["imageGeneration", "identityPreservation", "faceId", "realism"],
    maxReferences: 1, // a single face image
    payloadKind: "pulid",
    priority: 86,
    enabled: true,
    autoOnly: true, // the app supplies the face — not a manual pick
    note: "zero-shot face identity; strong face, no tattoo/body preservation",
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

/**
 * ROUGH per-image cost estimates (USD) for the benchmark's cost column — public list prices, approximate,
 * and shown as "~est" in the UI. Retune from real invoices; a missing entry renders as "—", never $0.
 */
const MODEL_COST_USD: Record<string, number> = {
  "fal-ai/flux-pro/kontext/max/multi": 0.08,
  "fal-ai/flux-2-pro/edit": 0.06,
  "fal-ai/flux-pro/kontext/multi": 0.04,
  "fal-ai/nano-banana-pro/edit": 0.1,
  "fal-ai/gemini-25-flash-image/edit": 0.03,
  "openai/gpt-image-2/edit": 0.12,
  "fal-ai/bytedance/seedream/v4/edit": 0.03,
  "fal-ai/qwen-image-edit-2509": 0.03,
  "wan/v2.6/image-to-image": 0.03,
  "fal-ai/flux-pro/kontext": 0.04, // single-reference Kontext
  "fal-ai/flux-kontext-lora": 0.06, // reference + trained LoRA (autoOnly)
};

/** Rough per-image cost estimate for a model (USD), or `null` if unknown. */
export function estimatedCostUsd(modelId: string): number | null {
  return getModel(modelId)?.estimatedCostUsd ?? MODEL_COST_USD[modelId] ?? null;
}
