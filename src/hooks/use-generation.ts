"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateImageAction,
  generateVariationAction,
  listGenerationsAction,
  regenerateAction,
} from "@/actions/generation";
import type { GenerateImageInput } from "@/lib/generation/types";
import { mediaKeys } from "./use-media";

export const generationKeys = {
  all: (projectId: string) => ["generations", projectId] as const,
};

/** Recent generations (recipe + result) for the project's history panel. */
export function useProjectGenerations(projectId: string) {
  return useQuery({
    queryKey: generationKeys.all(projectId),
    queryFn: () => listGenerationsAction(projectId),
  });
}

/** Refresh both the media (Gallery) and the generation history after a generation. */
function useAfterGeneration(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: mediaKeys.all(projectId) });
    qc.invalidateQueries({ queryKey: generationKeys.all(projectId) });
  };
}

export function useGenerateImage(projectId: string) {
  const refresh = useAfterGeneration(projectId);
  return useMutation({
    mutationFn: (input: GenerateImageInput) =>
      generateImageAction(projectId, input),
    onSuccess: refresh,
  });
}

export function useRegenerate(projectId: string) {
  const refresh = useAfterGeneration(projectId);
  return useMutation({
    mutationFn: (generationId: string) =>
      regenerateAction(projectId, generationId),
    onSuccess: refresh,
  });
}

export function useGenerateVariation(projectId: string) {
  const refresh = useAfterGeneration(projectId);
  return useMutation({
    mutationFn: (generationId: string) =>
      generateVariationAction(projectId, generationId),
    onSuccess: refresh,
  });
}
