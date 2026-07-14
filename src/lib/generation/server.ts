/**
 * Generation layer (server) — orchestrates one image generation, owner-scoped.
 *
 * It is the only new orchestrator: authorize → create `Generation` → call the provider
 * (behind `ImageProvider`) → persist bytes via the MEDIA layer → set status. It never imports
 * Blob or a provider SDK directly. First Light is synchronous (status on `Generation`; the
 * `Job` queue is deferred to async providers). See docs/GENERATION_PIPELINE.md.
 */
import { getImageProvider, isProviderError } from "@/lib/ai";
import { GenerationStatus, MediaType, prisma } from "@/lib/db";
import { createGeneratedMedia } from "@/lib/media/server";
import type { GenerateImageInput, GenerationResult } from "./types";

async function assertProjectOwnership(userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
}

async function assertIdentityInProject(
  userId: string,
  projectId: string,
  identityId: string,
): Promise<void> {
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId, projectId },
    select: { id: true },
  });
  if (!identity) throw new Error("Identity not found");
}

/** Generate one image and store it via the media layer (visible in the Gallery). */
export async function generateImage(
  userId: string,
  projectId: string,
  input: GenerateImageInput,
): Promise<GenerationResult> {
  await assertProjectOwnership(userId, projectId);

  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is required.");
  if (input.identityId) {
    await assertIdentityInProject(userId, projectId, input.identityId);
  }

  const provider = getImageProvider();

  const generation = await prisma.generation.create({
    data: {
      userId,
      projectId,
      identityId: input.identityId ?? null,
      type: MediaType.IMAGE,
      prompt,
      provider: provider.id,
      model: "", // set from the provider result below
      status: GenerationStatus.RUNNING,
    },
    select: { id: true },
  });

  try {
    const result = await provider.generateImage({ prompt });

    const media = await createGeneratedMedia(userId, {
      projectId,
      generationId: generation.id,
      data: result.data,
      contentType: result.contentType,
      originalFilename: buildGeneratedFilename(prompt, result.contentType),
    });

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: GenerationStatus.SUCCEEDED,
        provider: result.provider,
        model: result.model,
      },
    });

    return { generationId: generation.id, media };
  } catch (error) {
    await prisma.generation
      .update({
        where: { id: generation.id },
        data: { status: GenerationStatus.FAILED },
      })
      .catch(() => {});
    throw toFriendlyError(error);
  }
}

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

function buildGeneratedFilename(prompt: string, contentType: string): string {
  const slug =
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "generated";
  return `${slug}-${Date.now()}.${extensionFor(contentType)}`;
}

/** Map provider/storage failures to a user-facing message (the generation is already FAILED). */
function toFriendlyError(error: unknown): Error {
  if (isProviderError(error)) {
    switch (error.code) {
      case "MISSING_TOKEN":
        return new Error("Image generation isn't configured yet.");
      case "PROVIDER_UNAVAILABLE":
        return new Error("The model is warming up or busy — try again in a moment.");
      case "TIMEOUT":
        return new Error("Generation timed out — please try again.");
      default:
        return new Error("Generation failed — try a different prompt or try again.");
    }
  }
  return error instanceof Error ? error : new Error("Generation failed.");
}
