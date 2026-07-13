"use client";

import { useCallback, useRef, useState } from "react";
import pLimit from "p-limit";
import { toast } from "sonner";

import { createUpload } from "@/actions/uploads";
import { validateFile } from "@/lib/blob/validation";
import { uploadProjectMedia } from "@/lib/media/client";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "success"
  | "error"
  | "canceled";

export type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number; // 0..100
  error?: string;
};

/** Max simultaneous uploads — keeps the browser + network from being overwhelmed. */
const MAX_CONCURRENT_UPLOADS = 3;

/**
 * Client-side upload queue for a single project. Owns the transient state of in-flight
 * uploads (progress, cancel, retry); once a file is stored + persisted it disappears from
 * the queue and `onPersisted` refreshes the persisted grid. Server data lives in
 * `useUploads`, not here.
 */
export function useUploadManager(
  projectId: string,
  options: { onPersisted?: () => void } = {},
) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const limit = useRef(pLimit(MAX_CONCURRENT_UPLOADS));
  const onPersisted = options.onPersisted;

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const run = useCallback(
    (id: string, file: File) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);

      void limit.current(async () => {
        // Skip if the item was canceled while waiting for a concurrency slot.
        if (controller.signal.aborted) return;
        update(id, { status: "uploading", progress: 0, error: undefined });

        try {
          const result = await uploadProjectMedia({
            file,
            projectId,
            signal: controller.signal,
            onProgress: (percentage) => update(id, { progress: percentage }),
          });
          await createUpload({ ...result, projectId });

          controllers.current.delete(id);
          setItems((prev) => prev.filter((item) => item.id !== id));
          onPersisted?.();
        } catch (error) {
          controllers.current.delete(id);
          if (controller.signal.aborted) {
            update(id, { status: "canceled" });
            return;
          }
          const message =
            error instanceof Error ? error.message : "Upload failed.";
          update(id, { status: "error", error: message });
          toast.error(`Couldn't upload ${file.name}`, { description: message });
        }
      });
    },
    [projectId, update, onPersisted],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const check = validateFile({
          name: file.name,
          type: file.type,
          size: file.size,
        });
        if (!check.ok) {
          toast.error(`Can't add ${file.name}`, { description: check.message });
          continue;
        }
        const id = crypto.randomUUID();
        setItems((prev) => [
          ...prev,
          { id, file, status: "queued", progress: 0 },
        ]);
        run(id, file);
      }
    },
    [run],
  );

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
  }, []);

  const retry = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      run(id, item.file);
    },
    [items, run],
  );

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { items, addFiles, cancel, retry, remove };
}
