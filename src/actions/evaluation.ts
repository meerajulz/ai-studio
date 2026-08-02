"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  evaluateGeneration,
  getGenerationEvaluation,
  type IdentityEvaluation,
} from "@/lib/identity-engine";

/**
 * Identity Evaluation (Milestone 26) — score a generation against its identity. Client-driven so it never
 * adds latency to generation: the Generate view calls this AFTER the image is shown. Owner-scoped.
 */
export async function evaluateGenerationAction(generationId: string): Promise<IdentityEvaluation> {
  const userId = await requireUserId();
  return evaluateGeneration(userId, generationId);
}

/** Read a generation's persisted evaluation (owner-scoped); `null` if not evaluated yet. */
export async function getGenerationEvaluationAction(
  generationId: string,
): Promise<IdentityEvaluation | null> {
  const userId = await requireUserId();
  return getGenerationEvaluation(userId, generationId);
}
