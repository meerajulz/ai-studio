/**
 * Generation layer (server) — orchestrates image generation, owner-scoped.
 *
 * The only new orchestrator: authorize → create `Generation` → call the provider (behind
 * `ImageProvider`) → persist via the MEDIA layer → set status. Never imports Blob or a
 * provider SDK directly. First Light is synchronous (status on `Generation`; the `Job` queue
 * is deferred). The `Generation` record IS the recipe (Decision 030) — regenerate/variation
 * reuse it and tag lineage in `params`. See docs/GENERATION_PIPELINE.md, GENERATION_RECIPES.md.
 */
import {
  chooseModel,
  isProviderError,
  routeImageProvider,
  type ProviderCapability,
} from "@/lib/ai";
import { planConditioning, type TrainedModelRef } from "@/lib/identity-engine";
import { getIdentityTrainedModelRefs } from "@/lib/identity/training";
import {
  directCreative,
  type CreativeBrief,
  type IdentityContext,
} from "@/lib/creative";
import { GenerationStatus, MediaType, Prisma, prisma } from "@/lib/db";
import {
  getIdentityContext,
  getIdentitySelectionCandidates,
  getIdentityVisualPackage,
} from "@/lib/identity/server";
import type { IdentityVisualPackage } from "@/lib/identity/types";
import { type SelectionCandidate } from "@/lib/selection";
import { synthesizeIdentityAppearance } from "@/lib/vision";
import { createGeneratedMedia, getGeneratedMediaByIds } from "@/lib/media/server";
import type {
  GenerateImageInput,
  GenerationDebug,
  GenerationHistoryItem,
  GenerationResult,
  ReferenceSelectionDebug,
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
    /** Smart Reference Selection candidates (Milestone 20) — analyzed training images. Preferred. */
    candidates?: SelectionCandidate[];
    /** The identity's static Visual Package — FALLBACK when no analyzed candidates exist. */
    visualPackage?: IdentityVisualPackage | null;
    /** The identity's READY trained models (LoRA) — enables the `reference+lora` strategy (M24). */
    trainedModels?: TrainedModelRef[];
    /** DEV identity-benchmark cap on references sent (anchor kept first). */
    maxReferences?: number;
    /** DEV manual override: send exactly these media ids in this order (bypasses selector/anchor). */
    manualReferenceMediaIds?: string[];
    /** DEV manual model id (identity benchmark) — used when modelMode="manual". */
    modelOverride?: string;
    /** Model selection mode (Milestone 21): auto = capability router; manual = the id above. */
    modelMode?: "auto" | "manual";
    /** DEV strategy benchmark (Milestone 24.5): force the technique (reference | lora | pulid). */
    strategyOverride?: "reference" | "lora" | "pulid";
    /** Lineage tags (regenerate/variation) merged alongside the creative record. */
    lineage?: Record<string, unknown>;
  },
): Promise<GenerationResult> {
  const directive = directCreative(opts.brief);

  // Identity Engine (Milestone 22): Generation asks the engine HOW to condition this identity for
  // this request and receives a provider-neutral ConditioningPlan. The only enabled module today is
  // the Reference Engine (Smart Reference Selection + Identity Anchor, exposure-filtered), so the plan
  // is `reference` and output is unchanged; LoRA/PuLID/InstantID layer on here later WITHOUT touching
  // this call site. The Creative Director never sees references — text only.
  const plan = await planConditioning({
    identityId: opts.identityId,
    directive,
    candidates: opts.candidates ?? [],
    visualPackage: opts.visualPackage,
    trainedModels: opts.trainedModels,
    manualReferenceMediaIds: opts.manualReferenceMediaIds,
    maxReferences: opts.maxReferences,
    preferEngine: opts.strategyOverride ?? undefined,
  });
  let referenceImages = plan.referenceImages;
  let identityAnchor = plan.identityAnchor;
  const referenceSelectionReason = plan.reason;
  const selectionDebug: ReferenceSelectionDebug | null = plan.debug?.selection ?? null;
  const manualMode = plan.debug?.manual ?? false;

  // PuLID (Milestone 24.5): a DISTINCT generation path — a single face image drives identity, the
  // prompt drives the scene. It replaces the scene references entirely (no scene refs, no LoRA, no
  // trigger word). Mutually exclusive with LoRA/Kontext, which is why the engine picks one primary.
  const hasPulid = plan.pulidReferenceUrl != null;
  if (hasPulid) {
    referenceImages = [{ url: plan.pulidReferenceUrl as string, role: "anchor" as const }];
    identityAnchor = undefined;
  }

  // Route by capability, never by name. When we actually have reference images (scene refs OR an
  // identity anchor) we require a provider that can preserve identity (else the first configured one).
  const hasReferences = referenceImages.length > 0 || identityAnchor != null;
  const needs: ProviderCapability[] = hasReferences
    ? ["identityPreservation", "referenceImages"]
    : [];
  const { provider, decision } = routeImageProvider({ needs });

  // Capability MODEL routing (Milestone 21): the provider executes; the registry picks WHICH model by
  // capability (Auto), or the user's manual pick (benchmark). Only when we have references (the
  // identity/editing path); a no-reference generation falls through to the adapter's text-to-image.
  const totalRefs = referenceImages.length + (identityAnchor ? 1 : 0);
  const hasLora = plan.loraWeightsUrl != null;
  // PuLID → a faceId model (fal-ai/flux-pulid); LoRA → a lora model (fal-ai/flux-kontext-lora); else
  // the reference editor (Kontext Max Multi / single).
  const modelNeeds: ProviderCapability[] = hasPulid
    ? ["identityPreservation", "faceId"]
    : hasLora
      ? ["imageEditing", "referenceImages", "identityPreservation", "lora"]
      : totalRefs > 1
        ? ["imageEditing", "referenceImages", "identityPreservation", "multipleReferenceImages"]
        : ["imageEditing", "referenceImages", "identityPreservation"];
  const routedModel = hasReferences
    ? chooseModel({
        provider: provider.id,
        needs: modelNeeds,
        mode: opts.modelMode ?? "auto",
        manualModelId: opts.modelOverride,
      })
    : null;

  // The LoRA activates via its trigger phrase — prepend it to the compiled prompt when present.
  const promptForProvider =
    hasLora && plan.loraTriggerWord
      ? `${plan.loraTriggerWord}, ${directive.prompt}`
      : directive.prompt;

  const params: Prisma.InputJsonValue = {
    ...(opts.lineage ?? {}),
    creative: {
      version: directive.meta.version,
      style: directive.meta.style,
      focus: opts.brief.focus ?? null,
      intent: directive.meta.intent.type,
      compiledPrompt: directive.prompt,
    },
    // Identity-benchmark provenance: which reference cap + whether an anchor was used, per result.
    references: {
      maxReferences: opts.maxReferences ?? null,
      offered: referenceImages.length,
      anchorIncluded: identityAnchor != null,
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
    const result = await provider.generateImage({
      prompt: promptForProvider,
      referenceImages: referenceImages.length ? referenceImages : undefined,
      identityAnchor,
      maxReferences: opts.maxReferences,
      model: routedModel?.model.id,
      loras: hasLora ? [{ path: plan.loraWeightsUrl as string, scale: plan.loraScale ?? 1 }] : undefined,
      idWeight: hasPulid ? plan.pulidIdWeight ?? 1 : undefined,
    });

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
          identity: directive.meta.identity,
          scene: directive.meta.scene,
          graph: directive.meta.graph,
          intent: directive.meta.intent,
          composition: directive.meta.composition,
          compiledStructure: directive.meta.compiledStructure,
          rulesApplied: directive.meta.appliedModifiers,
          compiledPrompt: directive.prompt,
          provider: result.provider,
          model: result.model,
          providerCapabilities: [...provider.capabilities],
          routing: decision,
          visualPackage: summarizeVisualPackage(opts.visualPackage, referenceImages.length),
          referenceImages: {
            supportsReferenceImages: readBool(result.requestPayload, "supportsReferenceImages"),
            offered: referenceImages.length,
            offeredRoles: referenceImages.map((r) => r.role),
            sent: readNumber(result.requestPayload, "usedReferenceImages"),
            sentRoles: readStringArray(result.requestPayload, "referenceRoles"),
            sentImages: readRefImages(result.requestPayload),
            selectionReason: referenceSelectionReason,
            identityAnchor: identityAnchor != null,
            manual: manualMode,
            ...describeReferenceLimit({
              offered: referenceImages.length + (identityAnchor ? 1 : 0),
              sent: readNumber(result.requestPayload, "usedReferenceImages"),
              modelMax: routedModel?.model.maxReferences ?? null,
              devCap: opts.maxReferences ?? null,
              model: result.model,
              hasLora: hasLora,
            }),
          },
          referenceSelection: selectionDebug,
          // Identity-anchor diagnostic: the top face candidates + why the winner won (dev evidence).
          anchorRanking: plan.debug?.anchorRanking ?? [],
          // Identity Engine conditioning strategy (Milestone 22) — `reference` today.
          conditioning: plan.debug
            ? { strategy: plan.strategy, engines: plan.engines, engineNotes: plan.debug.engineNotes }
            : null,
          modelRouting: routedModel?.decision ?? null,
          responseMetadata: result.metadata ?? null,
          payload: result.requestPayload ?? { prompt: directive.prompt },
        }
      : undefined;

    return { generationId: generation.id, media, debug };
  } catch (error) {
    // Dev diagnostic: log the COMPILED prompt actually sent (not the user's idea) + the model, so a
    // provider refusal (e.g. GPT Image content policy) can be traced to specific wording.
    if (DEBUG_ENABLED) {
      console.error(
        `[generation] FAILED · ${provider.id}/${routedModel?.model.id ?? "t2i"}\n` +
          `  prompt sent: ${promptForProvider}\n` +
          `  error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await prisma.generation
      .update({
        where: { id: generation.id },
        data: { status: GenerationStatus.FAILED },
      })
      .catch(() => {});
    throw toFriendlyError(error);
  }
}

/** Safe readers for the provider's secret-free requestPayload echo. */
function readBool(obj: Record<string, unknown> | undefined, key: string): boolean {
  return Boolean(obj?.[key]);
}
function readNumber(obj: Record<string, unknown> | undefined, key: string): number {
  const v = obj?.[key];
  return typeof v === "number" ? v : 0;
}
function readStringArray(obj: Record<string, unknown> | undefined, key: string): string[] {
  const v = obj?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
/** Read the actual ordered `{url, role}` reference images a provider reported sending (dev debug). */
function readRefImages(obj: Record<string, unknown> | undefined): { url: string; role: string }[] {
  const v = obj?.referenceImages;
  if (!Array.isArray(v)) return [];
  return v.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const url = (r as Record<string, unknown>).url;
    const role = (r as Record<string, unknown>).role;
    return typeof url === "string" ? [{ url, role: typeof role === "string" ? role : "reference" }] : [];
  });
}

/**
 * Explain (for the Debug panel) why fewer references were sent than offered — the MODEL's own limit
 * (e.g. Kontext+LoRA accepts one `image_url`) vs the dev References cap. Resolves the confusing
 * "manual: 4 images" next to "1 of 4 sent": now the reason is explicit (Milestone 24 audit).
 */
function describeReferenceLimit(x: {
  offered: number;
  sent: number;
  modelMax: number | null;
  devCap: number | null;
  model: string;
  hasLora: boolean;
}): { modelMaxReferences: number | null; devCap: number | null; limitReason: string } {
  let limitReason = "";
  if (x.sent < x.offered) {
    const causes: string[] = [];
    if (x.modelMax != null && x.modelMax === x.sent) {
      causes.push(`the model "${x.model}" accepts ${x.modelMax} reference${x.modelMax === 1 ? "" : "s"}`);
    }
    if (x.devCap != null && x.devCap === x.sent) causes.push(`the dev References cap is ${x.devCap}`);
    limitReason = causes.length
      ? `Sent ${x.sent} of ${x.offered} — ${causes.join(" and ")}.`
      : `Sent ${x.sent} of ${x.offered}.`;
    if (x.hasLora && x.modelMax === 1) {
      limitReason += " The trained LoRA carries identity, so only the top reference is used.";
    }
  }
  return { modelMaxReferences: x.modelMax, devCap: x.devCap, limitReason };
}

/** Debug-safe summary of the Visual Package (booleans + counts, never signed URLs). */
function summarizeVisualPackage(
  pkg: IdentityVisualPackage | null | undefined,
  referenceCount: number,
) {
  if (!pkg) return null;
  return {
    hasHeroImage: pkg.heroImageUrl !== null,
    hasPortrait: pkg.bestPortraitUrl !== null,
    hasFullBody: pkg.bestFullBodyUrl !== null,
    referenceImages: referenceCount,
    totalMedia: pkg.metadata.totalMedia,
  };
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
  const inputs = await loadIdentityInputs(userId, identityId);

  return runImageGeneration(userId, projectId, {
    brief: { idea, style: input.style, focus: input.focus, identityId, identity: inputs.identity },
    identityId,
    candidates: inputs.candidates,
    visualPackage: inputs.visualPackage,
    trainedModels: inputs.trainedModels,
    maxReferences: input.maxReferences,
    manualReferenceMediaIds: input.manualReferenceMediaIds,
    modelOverride: input.modelOverride,
    modelMode: input.modelMode,
    strategyOverride: input.strategyOverride,
  });
}

/**
 * Load ALL of an identity's inputs for one generation (owner-scoped, provider-neutral):
 *  - the passive `IdentityContext` for the Creative Director (Milestone 14), now enriched with a
 *    **synthesized appearance** paragraph (Milestone 21) built from the analyzed images;
 *  - the Smart Reference Selection `candidates` (analyzed training images, Milestone 20);
 *  - the static Visual Package as a FALLBACK when nothing is analyzed yet.
 * The provider never sees any of this — the Director reasons over it and emits only a prompt.
 */
async function loadIdentityInputs(
  userId: string,
  identityId: string | null,
): Promise<{
  identity: IdentityContext | null;
  candidates: SelectionCandidate[];
  visualPackage: IdentityVisualPackage | null;
  trainedModels: TrainedModelRef[];
}> {
  if (!identityId) return { identity: null, candidates: [], visualPackage: null, trainedModels: [] };
  const [info, candidates, visualPackage, trainedModels] = await Promise.all([
    getIdentityContext(userId, identityId),
    getIdentitySelectionCandidates(userId, identityId),
    getIdentityVisualPackage(userId, identityId),
    // READY trained models (LoRA) so the Identity Engine can offer `reference+lora` automatically (M24).
    getIdentityTrainedModelRefs(userId, identityId),
  ]);
  const identity: IdentityContext | null = info
    ? {
        id: info.id,
        name: info.name,
        description: info.description,
        // Prefer a rich, synthesized appearance from analyzed images; null → static description.
        appearance: synthesizeIdentityAppearance(candidates.map((c) => c.metadata)),
        hasHeroImage: info.hasHeroImage,
        trainingMediaCount: info.trainingMediaCount,
      }
    : null;
  return { identity, candidates, visualPackage, trainedModels };
}

/** Re-run a generation's recipe unchanged (a new generation, lineage tagged in `params`). */
export async function regenerateGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<GenerationResult> {
  const source = await loadOwnedGeneration(userId, projectId, generationId);
  const brief = briefFromGeneration(source);
  const inputs = await loadIdentityInputs(userId, source.identityId);
  brief.identity = inputs.identity;
  return runImageGeneration(userId, projectId, {
    brief,
    identityId: source.identityId,
    candidates: inputs.candidates,
    visualPackage: inputs.visualPackage,
    trainedModels: inputs.trainedModels,
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
  const brief = briefFromGeneration(source);
  const inputs = await loadIdentityInputs(userId, source.identityId);
  brief.identity = inputs.identity;
  return runImageGeneration(userId, projectId, {
    brief,
    identityId: source.identityId,
    candidates: inputs.candidates,
    visualPackage: inputs.visualPackage,
    trainedModels: inputs.trainedModels,
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
        // Credentials rejected or absent. Surface the provider's specific message (e.g. 401 vs
        // "set FAL_KEY") so it's not the old misleading "isn't configured yet".
        return new Error(error.message || "Image generation credentials were rejected — check FAL_KEY.");
      case "PROVIDER_UNAVAILABLE":
        return new Error("The model is warming up or busy — try again in a moment.");
      case "TIMEOUT":
        return new Error("Generation timed out — please try again.");
      case "CONTENT_MODERATED":
        return new Error(error.message); // already user-facing + specific (safety filter / blank image)
      case "GENERATION_FAILED":
        // Now carries the model + HTTP status (e.g. a 403 model-access problem) — show it, don't mask it.
        return new Error(error.message || "Generation failed — try a different prompt or try again.");
      default:
        return new Error("Generation failed — try a different prompt or try again.");
    }
  }
  return error instanceof Error ? error : new Error("Generation failed.");
}
