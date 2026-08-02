"use server";

import { requireUserId } from "@/lib/auth/session";
import {
  evaluateGeneration,
  getGenerationEvaluationView,
  type EvaluationView,
} from "@/lib/identity-engine";

/**
 * Identity Evaluation (Milestone 26) — score a generation against its identity, then return the UI view
 * (face similarity + confidence + provider + timing + cache + per-anchor). Client-driven so it never adds
 * latency to generation: the Generate view calls this AFTER the image is shown. Owner-scoped.
 */
export async function evaluateGenerationAction(generationId: string): Promise<EvaluationView | null> {
  const userId = await requireUserId();
  await evaluateGeneration(userId, generationId);
  return getGenerationEvaluationView(userId, generationId);
}

/** Read a generation's persisted evaluation view (owner-scoped); `null` if not evaluated yet. */
export async function getGenerationEvaluationAction(
  generationId: string,
): Promise<EvaluationView | null> {
  const userId = await requireUserId();
  return getGenerationEvaluationView(userId, generationId);
}
