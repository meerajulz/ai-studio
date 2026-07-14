"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { generateImageAction } from "@/actions/generation";
import type { GenerateImageInput } from "@/lib/generation/types";
import { mediaKeys } from "./use-media";

/**
 * Generate an image and refresh the project's media so it appears in the Gallery. The
 * generated asset flows through the media layer — no separate media pipeline.
 */
export function useGenerateImage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateImageInput) =>
      generateImageAction(projectId, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: mediaKeys.all(projectId) }),
  });
}
