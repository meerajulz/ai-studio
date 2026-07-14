"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  generateImage,
  generateVariation,
  listRecentGenerations,
  regenerateGeneration,
} from "@/lib/generation/server";
import type {
  GenerateImageInput,
  GenerationHistoryItem,
  GenerationResult,
} from "@/lib/generation/types";

/**
 * Owner-scoped Server Actions for AI image generation. Each resolves the user and delegates
 * to the generation layer (authorize → provider → media layer → Gallery).
 */

export async function generateImageAction(
  projectId: string,
  input: GenerateImageInput,
): Promise<GenerationResult> {
  const userId = await requireUserId();
  return generateImage(userId, projectId, input);
}

export async function regenerateAction(
  projectId: string,
  generationId: string,
): Promise<GenerationResult> {
  const userId = await requireUserId();
  return regenerateGeneration(userId, projectId, generationId);
}

export async function generateVariationAction(
  projectId: string,
  generationId: string,
): Promise<GenerationResult> {
  const userId = await requireUserId();
  return generateVariation(userId, projectId, generationId);
}

export async function listGenerationsAction(
  projectId: string,
): Promise<GenerationHistoryItem[]> {
  const userId = await requireUserId();
  return listRecentGenerations(userId, projectId);
}
