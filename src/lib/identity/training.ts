/**
 * Identity ↔ Training persistence (Milestone 23). Owner-scoped, server-side, prisma-direct (mirrors
 * `identity/dataset.ts`). These are the LIFECYCLE seams the training flow uses: append-only model
 * versioning, job create/transition, and persisting a finished versioned model.
 *
 * M23 ships them typechecked and ready; no user path drives real training yet — the Fal LoRA backend
 * (which calls these) lands in M24. Keeping them here (not in the pure identity-engine) preserves the
 * boundary: the engine decides WHICH trainer; the app owns DB + ownership.
 */
import { zipSync } from "fflate";
import { prisma, type Prisma } from "@/lib/db";
import { getMediaByIds } from "@/lib/media/server";
import { getSignedUrl, uploadAsset } from "@/lib/blob/server";
import { falTrainer, type TrainingJob, type TrainingStatus } from "@/lib/identity-engine";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type PackagedDataset = { imagesDataUrl: string; imageCount: number; datasetVersion: number };

/**
 * Package the CURATED training set (Milestone 24): the recommended images (NOT every image) → a ZIP
 * uploaded to Blob → a signed URL Fal can fetch. Owner-scoped; reuses the media layer (signed
 * originals) and the blob layer (store + sign). The dataset must have been analyzed (curation exists).
 */
export async function packageDataset(userId: string, identityId: string): Promise<PackagedDataset> {
  const dataset = await prisma.identityDataset.findFirst({
    where: { identityId, userId },
    select: { recommendedImageIds: true, datasetVersion: true },
  });
  if (!dataset || dataset.recommendedImageIds.length === 0) {
    throw new Error("No recommended images to train on — analyze the library first.");
  }

  const assets = await getMediaByIds(userId, dataset.recommendedImageIds);
  const files: Record<string, Uint8Array> = {};
  let i = 0;
  for (const asset of assets) {
    if (asset.type !== "IMAGE") continue; // LoRA trains on images only
    const res = await fetch(asset.url);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ext = (asset.mimeType && EXT_BY_MIME[asset.mimeType]) || "jpg";
    files[`image_${String(i).padStart(3, "0")}.${ext}`] = bytes;
    i += 1;
  }
  if (i === 0) throw new Error("Could not fetch any recommended images to package.");

  const zip = zipSync(files); // Uint8Array
  const stored = await uploadAsset({
    pathname: `identities/${identityId}/datasets/v${dataset.datasetVersion}-${Date.now()}.zip`,
    data: Buffer.from(zip),
    contentType: "application/zip",
  });
  // A generous TTL so Fal can fetch the archive well after the job is submitted.
  const imagesDataUrl = await getSignedUrl(stored.pathname, { expiresInSeconds: 60 * 60 * 6 });

  return { imagesDataUrl, imageCount: i, datasetVersion: dataset.datasetVersion };
}

/** Next append-only version for (identity, engine) — trained models are never overwritten. */
export async function nextModelVersion(
  userId: string,
  identityId: string,
  engine: string,
): Promise<number> {
  const latest = await prisma.identityTrainedModel.findFirst({
    where: { identityId, userId, engine },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

export type CreateTrainingJobInput = {
  engine: string;
  provider: string;
  datasetVersion: number;
  triggerWord?: string | null;
  params?: Prisma.InputJsonValue;
};

/** Create a training job in PENDING state (owner-scoped). */
export async function createTrainingJob(
  userId: string,
  identityId: string,
  input: CreateTrainingJobInput,
): Promise<{ id: string }> {
  const job = await prisma.identityTrainingJob.create({
    data: {
      userId,
      identityId,
      engine: input.engine,
      provider: input.provider,
      datasetVersion: input.datasetVersion,
      triggerWord: input.triggerWord ?? null,
      params: input.params ?? undefined,
      status: "PENDING",
    },
    select: { id: true },
  });
  return job;
}

export type JobTransition = {
  status: "PENDING" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  providerJobId?: string | null;
  cost?: number | null;
  error?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  trainedModelId?: string | null;
};

/** Move a job to a new provider-reported status (owner-scoped). */
export async function transitionTrainingJob(
  userId: string,
  jobId: string,
  patch: JobTransition,
): Promise<void> {
  await prisma.identityTrainingJob.updateMany({
    where: { id: jobId, userId },
    data: patch,
  });
}

export type PersistTrainedModelInput = {
  engine: string;
  provider: string;
  version: number;
  label: string;
  datasetVersion: number;
  triggerWord?: string | null;
  artifactRef?: string | null;
  modelCompatibility?: string[];
  cost?: number | null;
  durationSeconds?: number | null;
  params?: Prisma.InputJsonValue;
  status?: "DRAFT" | "READY" | "FAILED" | "ARCHIVED";
};

/** Persist a finished, versioned trained model (append-only; owner-scoped). */
export async function persistTrainedModel(
  userId: string,
  identityId: string,
  input: PersistTrainedModelInput,
): Promise<{ id: string }> {
  const model = await prisma.identityTrainedModel.create({
    data: {
      userId,
      identityId,
      engine: input.engine,
      provider: input.provider,
      version: input.version,
      label: input.label,
      datasetVersion: input.datasetVersion,
      triggerWord: input.triggerWord ?? null,
      artifactRef: input.artifactRef ?? null,
      modelCompatibility: input.modelCompatibility ?? [],
      cost: input.cost ?? null,
      durationSeconds: input.durationSeconds ?? null,
      params: input.params ?? undefined,
      status: input.status ?? "READY",
    },
    select: { id: true },
  });
  return model;
}

// ── Orchestration (Milestone 24) ─────────────────────────────────────────────

const ACTIVE_JOB = ["PENDING", "QUEUED", "RUNNING"] as const;
const msg = (e: unknown) => (e instanceof Error ? e.message : "training failed");

/** A distinctive, stable LoRA trigger phrase for an identity (used in training + at inference). */
function triggerWordFor(identityId: string): string {
  return `idnt${identityId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

/**
 * Kick off a LoRA training run for an identity (Milestone 24). Packages the CURATED dataset, submits it
 * to the Fal trainer, and records a QUEUED job. Owner-scoped. Guards against a second concurrent run.
 * The client then polls `pollIdentityTraining`. Real training is asynchronous + costs money.
 */
export async function startIdentityTraining(
  userId: string,
  identityId: string,
): Promise<{ jobId: string }> {
  const active = await prisma.identityTrainingJob.findFirst({
    where: { identityId, userId, status: { in: [...ACTIVE_JOB] } },
    select: { id: true },
  });
  if (active) throw new Error("A training job is already running for this identity.");

  const pkg = await packageDataset(userId, identityId);
  const triggerWord = triggerWordFor(identityId);

  const { id: jobId } = await createTrainingJob(userId, identityId, {
    engine: "lora",
    provider: "fal",
    datasetVersion: pkg.datasetVersion,
    triggerWord,
    params: { imageCount: pkg.imageCount } as Prisma.InputJsonValue,
  });

  try {
    const started = await falTrainer.startTraining({
      engine: "lora",
      imagesDataUrl: pkg.imagesDataUrl,
      triggerWord,
      datasetVersion: pkg.datasetVersion,
    });
    await transitionTrainingJob(userId, jobId, {
      status: started.status === "FAILED" ? "FAILED" : "QUEUED",
      providerJobId: started.providerJobId,
      startedAt: new Date(),
    });
  } catch (e) {
    await transitionTrainingJob(userId, jobId, {
      status: "FAILED",
      error: msg(e),
      finishedAt: new Date(),
    });
    throw e;
  }

  return { jobId };
}

export type PollResult = { status: TrainingStatus; trainedModelId?: string };

/**
 * Reconcile one in-flight training job against Fal (Milestone 24 — client-driven polling; webhooks
 * can't reach localhost). On completion, persists a new versioned `IdentityTrainedModel` with FULL
 * provenance (provider/trainer/base model/dataset version/params) so runs are comparable + reproducible.
 */
export async function pollIdentityTraining(
  userId: string,
  jobId: string,
): Promise<PollResult> {
  const row = await prisma.identityTrainingJob.findFirst({
    where: { id: jobId, userId },
  });
  if (!row) throw new Error("Training job not found.");
  if (!(ACTIVE_JOB as readonly string[]).includes(row.status)) {
    return { status: row.status as TrainingStatus };
  }

  const trainerJob: TrainingJob = {
    id: row.id,
    identityId: row.identityId,
    engine: "lora",
    provider: "fal",
    status: row.status as TrainingStatus,
    providerJobId: row.providerJobId,
    datasetVersion: row.datasetVersion,
    triggerWord: row.triggerWord,
    params: null,
    cost: row.cost,
    error: row.error,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  };

  let status: TrainingStatus;
  try {
    status = await falTrainer.pollStatus(trainerJob);
  } catch (e) {
    await transitionTrainingJob(userId, jobId, { status: "FAILED", error: msg(e), finishedAt: new Date() });
    return { status: "FAILED" };
  }

  if (status === "QUEUED" || status === "RUNNING") {
    if (status !== row.status) await transitionTrainingJob(userId, jobId, { status });
    return { status };
  }

  if (status === "FAILED" || status === "CANCELED") {
    await transitionTrainingJob(userId, jobId, { status, finishedAt: new Date() });
    return { status };
  }

  // SUCCEEDED → fetch weights + persist a versioned model with provenance.
  try {
    const result = await falTrainer.fetchResult(trainerJob);
    const version = await nextModelVersion(userId, row.identityId, "lora");
    const imageCount = (row.params as { imageCount?: number } | null)?.imageCount ?? null;
    const provenance = {
      provider: "fal",
      trainer: result.providerMetadata?.trainerModel ?? "fal-ai/flux-lora-portrait-trainer",
      baseModel: "flux-lora-portrait-trainer",
      datasetVersion: row.datasetVersion,
      imageCount,
      trainingParameters: { steps: 2500 },
      providerMetadata: { ...(result.providerMetadata ?? {}), configFile: result.configUrl },
    };

    const model = await persistTrainedModel(userId, row.identityId, {
      engine: "lora",
      provider: "fal",
      version,
      label: `LoRA v${version}`,
      datasetVersion: row.datasetVersion,
      triggerWord: row.triggerWord,
      artifactRef: result.artifactRef,
      modelCompatibility: result.metadata.modelCompatibility,
      params: provenance as Prisma.InputJsonValue,
      status: "READY",
    });

    await transitionTrainingJob(userId, jobId, {
      status: "SUCCEEDED",
      trainedModelId: model.id,
      finishedAt: new Date(),
    });
    return { status: "SUCCEEDED", trainedModelId: model.id };
  } catch (e) {
    await transitionTrainingJob(userId, jobId, { status: "FAILED", error: msg(e), finishedAt: new Date() });
    return { status: "FAILED" };
  }
}
