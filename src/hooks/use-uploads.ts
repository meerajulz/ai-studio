"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listUploads, removeUpload } from "@/actions/uploads";

export const uploadsKey = (projectId: string) =>
  ["uploads", projectId] as const;

/** Persisted uploads for a project (signed URLs are minted server-side per fetch). */
export function useUploads(projectId: string) {
  return useQuery({
    queryKey: uploadsKey(projectId),
    queryFn: () => listUploads(projectId),
  });
}

export function useDeleteUpload(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeUpload(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: uploadsKey(projectId) }),
  });
}
