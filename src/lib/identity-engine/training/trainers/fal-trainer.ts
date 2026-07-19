/**
 * FalTrainer (Milestone 24) — the first REAL provider trainer. Trains a LoRA on Fal via the queue API
 * (`fal-ai/flux-lora-portrait-trainer` — identity/portrait-tuned) and returns the trained weights URL.
 *
 * The single file allowed to know Fal's TRAINING API (mirrors `ai/providers/fal.ts` for generation):
 * fetch-based, no SDK, auth via `FAL_KEY`. It does NOT touch the DB — the orchestration
 * (`identity/training.ts`) owns jobs + persistence + ownership. Long-running, so it uses the queue API
 * (submit → status → result); the app polls (webhooks can't reach localhost).
 */
import type { Trainer } from "../Trainer";
import type {
  TrainingJob,
  TrainingOptions,
  TrainingResult,
  TrainingStatus,
} from "../../engines/lora/types";

const QUEUE = "https://queue.fal.run";
const DEFAULT_TRAINER_MODEL = "fal-ai/flux-lora-portrait-trainer";
const DEFAULT_STEPS = 2500;
const LORA_INFERENCE_MODEL = "fal-ai/flux-kontext-lora"; // what the produced LoRA is compatible with

function trainerModel(): string {
  return process.env.FAL_LORA_TRAINER_MODEL?.trim() || DEFAULT_TRAINER_MODEL;
}

function getKey(): string {
  const value = process.env.FAL_KEY;
  if (!value || !value.trim()) throw new Error("Fal is not configured for training (set FAL_KEY).");
  return value.trim();
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Key ${getKey()}`, "Content-Type": "application/json" };
}

/** Map Fal's queue status → our provider-neutral TrainingStatus. */
function mapStatus(falStatus: string | undefined): TrainingStatus {
  switch (falStatus) {
    case "IN_QUEUE":
      return "QUEUED";
    case "IN_PROGRESS":
      return "RUNNING";
    case "COMPLETED":
      return "SUCCEEDED";
    case "ERROR":
    case "FAILED":
      return "FAILED";
    default:
      return "QUEUED";
  }
}

type SubmitResponse = { request_id?: string; status?: string };
type StatusResponse = { status?: string };
type FileRef = { url?: string };
type TrainResult = { diffusers_lora_file?: FileRef; config_file?: FileRef } & Record<string, unknown>;

export const falTrainer: Trainer = {
  id: "fal",
  label: "Fal",
  supports: ["lora"],
  enabled: true,
  priority: 100,

  async startTraining(opts: TrainingOptions): Promise<TrainingJob> {
    if (!opts.imagesDataUrl) throw new Error("FalTrainer needs a packaged dataset (imagesDataUrl).");
    const model = trainerModel();
    const res = await fetch(`${QUEUE}/${model}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        images_data_url: opts.imagesDataUrl,
        trigger_phrase: opts.triggerWord,
        steps: opts.steps ?? DEFAULT_STEPS,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Fal training submit failed (${res.status}): ${text || "unknown error"}`);
    }
    const json = (await res.json()) as SubmitResponse;
    if (!json.request_id) throw new Error("Fal did not return a training request id.");

    const now = new Date();
    return {
      id: "", // owned by the DB layer
      identityId: "",
      engine: "lora",
      provider: "fal",
      status: mapStatus(json.status),
      providerJobId: json.request_id,
      datasetVersion: opts.datasetVersion ?? 1,
      triggerWord: opts.triggerWord ?? null,
      params: { model, steps: opts.steps ?? DEFAULT_STEPS },
      cost: null,
      error: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    };
  },

  async pollStatus(job: TrainingJob): Promise<TrainingStatus> {
    if (!job.providerJobId) throw new Error("No provider job id to poll.");
    const model = trainerModel();
    const res = await fetch(`${QUEUE}/${model}/requests/${job.providerJobId}/status`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      if (res.status === 404) return "QUEUED"; // not visible yet
      const text = await res.text().catch(() => "");
      throw new Error(`Fal training status failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as StatusResponse;
    return mapStatus(json.status);
  },

  async fetchResult(job: TrainingJob): Promise<TrainingResult> {
    if (!job.providerJobId) throw new Error("No provider job id to fetch.");
    const model = trainerModel();
    const res = await fetch(`${QUEUE}/${model}/requests/${job.providerJobId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Fal training result failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as TrainResult;
    const weights = json.diffusers_lora_file?.url;
    if (!weights) throw new Error("Fal training finished but returned no LoRA weights.");

    return {
      modelId: "",
      identityId: job.identityId,
      engine: "lora",
      artifactRef: weights,
      configUrl: json.config_file?.url ?? null,
      providerMetadata: { requestId: job.providerJobId, trainerModel: model },
      metadata: {
        provider: "fal",
        status: "SUCCEEDED",
        version: 0, // assigned by the DB layer (nextModelVersion)
        triggerWord: job.triggerWord,
        createdDate: new Date(),
        cost: null,
        duration: null,
        modelCompatibility: [LORA_INFERENCE_MODEL],
      },
    };
  },

  async cancel(job: TrainingJob): Promise<void> {
    if (!job.providerJobId) return;
    const model = trainerModel();
    await fetch(`${QUEUE}/${model}/requests/${job.providerJobId}/cancel`, {
      method: "PUT",
      headers: authHeaders(),
    }).catch(() => {});
  },
};
