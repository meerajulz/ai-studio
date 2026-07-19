/**
 * Identity ↔ Training persistence (Milestone 23). Owner-scoped, server-side, prisma-direct (mirrors
 * `identity/dataset.ts`). These are the LIFECYCLE seams the training flow uses: append-only model
 * versioning, job create/transition, and persisting a finished versioned model.
 *
 * M23 ships them typechecked and ready; no user path drives real training yet — the Fal LoRA backend
 * (which calls these) lands in M24. Keeping them here (not in the pure identity-engine) preserves the
 * boundary: the engine decides WHICH trainer; the app owns DB + ownership.
 */
import { prisma, type Prisma } from "@/lib/db";

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
