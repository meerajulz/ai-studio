"use server";

import { requireUserId } from "@/lib/auth/session";
import { generateImage } from "@/lib/generation/server";
import type { GenerateImageInput, GenerationResult } from "@/lib/generation/types";

/**
 * Owner-scoped Server Action for AI image generation. Resolves the user and delegates to the
 * generation layer, which authorizes + orchestrates provider → media layer → Gallery.
 */
export async function generateImageAction(
  projectId: string,
  input: GenerateImageInput,
): Promise<GenerationResult> {
  const userId = await requireUserId();
  return generateImage(userId, projectId, input);
}
