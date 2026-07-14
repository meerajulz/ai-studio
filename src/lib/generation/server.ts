/**
 * Generation layer (server) — orchestrates image generation, owner-scoped.
 *
 * The only new orchestrator: authorize → create `Generation` → call the provider (behind
 * `ImageProvider`) → persist via the MEDIA layer → set status. Never imports Blob or a
 * provider SDK directly. First Light is synchronous (status on `Generation`; the `Job` queue
 * is deferred). The `Generation` record IS the recipe (Decision 030) — regenerate/variation
 * reuse it and tag lineage in `params`. See docs/GENERATION_PIPELINE.md, GENERATION_RECIPES.md.
 */
import { getImageProvider, isProviderError } from "@/lib/ai";
import { directCreative, type CreativeBrief } from "@/lib/creative";
import { GenerationStatus, MediaType, Prisma, prisma } from "@/lib/db";
import { createGeneratedMedia, getGeneratedMediaByIds } from "@/lib/media/server";
import type {
  GenerateImageInput,
  GenerationDebug,
  GenerationHistoryItem,
  GenerationResult,
} from "./types";

const HISTORY_LIMIT = 12;

/** Dev-only: the Debug panel is populated only outside production so nothing internal leaks. */
const DEBUG_ENABLED = process.env.NODE_ENV !== "production";

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

/**
 * Core runner: run the brief through the Creative Director, create a `Generation`, call the
 * provider with the ENRICHED prompt, persist the result via the media layer, and set status.
 * Shared by generate / regenerate / variation. Assumes ownership has already been checked.
 *
 * `Generation.prompt` stores the user's IDEA (the creative source); the compiled professional
 * prompt + brief live in `params.creative` so recipes stay reproducible and remixable. The
 * Director is the ONLY place a prompt is enriched — this runner never touches prompt text itself.
 */
async function runImageGeneration(
  userId: string,
  projectId: string,
  opts: {
    brief: CreativeBrief;
    identityId: string | null;
    /** Lineage tags (regenerate/variation) merged alongside the creative record. */
    lineage?: Record<string, unknown>;
  },
): Promise<GenerationResult> {
  const provider = getImageProvider();
  const directive = directCreative(opts.brief);

  const params: Prisma.InputJsonValue = {
    ...(opts.lineage ?? {}),
    creative: {
      version: directive.meta.version,
      style: directive.meta.style,
      focus: directive.meta.focus,
      category: directive.meta.category,
      compiledPrompt: directive.prompt,
    },
  };

  const generation = await prisma.generation.create({
    data: {
      userId,
      projectId,
      identityId: opts.identityId,
      type: MediaType.IMAGE,
      prompt: opts.brief.idea, // the user's idea — the creative source, not the compiled prompt
      provider: provider.id,
      model: "", // set from the provider result below
      params,
      status: GenerationStatus.RUNNING,
    },
    select: { id: true },
  });

  try {
    const result = await provider.generateImage({ prompt: directive.prompt });

    const media = await createGeneratedMedia(userId, {
      projectId,
      generationId: generation.id,
      data: result.data,
      contentType: result.contentType,
      originalFilename: buildGeneratedFilename(opts.brief.idea, result.contentType),
    });

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: GenerationStatus.SUCCEEDED,
        provider: result.provider,
        model: result.model,
      },
    });

    const debug: GenerationDebug | undefined = DEBUG_ENABLED
      ? {
          idea: opts.brief.idea,
          intent: directive.meta.category,
          style: directive.meta.style,
          focus: directive.meta.focus,
          rulesApplied: directive.meta.appliedModifiers,
          compiledPrompt: directive.prompt,
          provider: result.provider,
          model: result.model,
          payload: result.requestPayload ?? { prompt: directive.prompt },
        }
      : undefined;

    return { generationId: generation.id, media, debug };
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

/** Generate one image from a fresh creative idea (optionally attached to an identity). */
export async function generateImage(
  userId: string,
  projectId: string,
  input: GenerateImageInput,
): Promise<GenerationResult> {
  await assertProjectOwnership(userId, projectId);

  const idea = input.prompt.trim();
  if (!idea) throw new Error("Prompt is required.");
  const identityId = input.identityId ?? null;
  if (identityId) {
    await assertIdentityInProject(userId, projectId, identityId);
  }

  return runImageGeneration(userId, projectId, {
    brief: { idea, style: input.style, focus: input.focus, identityId },
    identityId,
  });
}

/** Re-run a generation's recipe unchanged (a new generation, lineage tagged in `params`). */
export async function regenerateGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<GenerationResult> {
  const source = await loadOwnedGeneration(userId, projectId, generationId);
  return runImageGeneration(userId, projectId, {
    brief: briefFromGeneration(source),
    identityId: source.identityId,
    lineage: { source: "regenerate", fromGenerationId: generationId },
  });
}

/** Generate a variation — for now, the same brief (future: injected variation params). */
export async function generateVariation(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<GenerationResult> {
  const source = await loadOwnedGeneration(userId, projectId, generationId);
  return runImageGeneration(userId, projectId, {
    brief: briefFromGeneration(source),
    identityId: source.identityId,
    lineage: { source: "variation", fromGenerationId: generationId },
  });
}

/** Recent generations for a project (the recipe + its signed result) — owner-scoped. */
export async function listRecentGenerations(
  userId: string,
  projectId: string,
): Promise<GenerationHistoryItem[]> {
  await assertProjectOwnership(userId, projectId);

  const generations = await prisma.generation.findMany({
    where: { userId, projectId, type: MediaType.IMAGE },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      id: true,
      prompt: true,
      provider: true,
      model: true,
      identityId: true,
      status: true,
      createdAt: true,
      results: {
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const resultIds = generations
    .map((g) => g.results[0]?.id)
    .filter((id): id is string => Boolean(id));
  const assets = await getGeneratedMediaByIds(userId, resultIds);
  const assetById = new Map(assets.map((a) => [a.id, a]));

  return generations.map((g) => {
    const resultId = g.results[0]?.id;
    return {
      generationId: g.id,
      prompt: g.prompt,
      provider: g.provider,
      model: g.model,
      identityId: g.identityId,
      status: g.status,
      createdAt: g.createdAt,
      media: resultId ? (assetById.get(resultId) ?? null) : null,
    };
  });
}

async function loadOwnedGeneration(
  userId: string,
  projectId: string,
  generationId: string,
) {
  const generation = await prisma.generation.findFirst({
    where: { id: generationId, userId, projectId },
    select: { id: true, prompt: true, identityId: true, params: true },
  });
  if (!generation) throw new Error("Generation not found");
  return generation;
}

/**
 * Rebuild the creative brief from a stored generation so regenerate/variation re-run the SAME
 * intent through the Creative Director. `Generation.prompt` is the idea; style/focus (if the
 * generation was created after the Creative Director shipped) live in `params.creative`. Older
 * generations simply fall back to a bare idea + Director defaults.
 */
function briefFromGeneration(source: {
  prompt: string;
  identityId: string | null;
  params: Prisma.JsonValue;
}): CreativeBrief {
  const creative = extractCreative(source.params);
  return {
    idea: source.prompt,
    style: creative.style,
    focus: creative.focus,
    identityId: source.identityId,
  };
}

/** Safely read `params.creative` (written by us) without trusting its runtime shape. */
function extractCreative(params: Prisma.JsonValue): {
  style?: CreativeBrief["style"];
  focus?: CreativeBrief["focus"];
} {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};
  const creative = (params as Record<string, unknown>).creative;
  if (!creative || typeof creative !== "object" || Array.isArray(creative)) return {};
  const record = creative as Record<string, unknown>;
  return {
    style:
      typeof record.style === "string"
        ? (record.style as CreativeBrief["style"])
        : undefined,
    focus:
      typeof record.focus === "string"
        ? (record.focus as CreativeBrief["focus"])
        : undefined,
  };
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
