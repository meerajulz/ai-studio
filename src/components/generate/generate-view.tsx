"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";

import {
  useGenerateImage,
  useProjectGenerations,
} from "@/hooks/use-generation";
import type { MediaAsset } from "@/lib/media/types";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaViewer } from "@/components/media/media-viewer";
import { GenerationHistory } from "./generation-history";

const MAX_PROMPT = 1000;

type GenerateViewProps = {
  projectId: string;
  providerReady: boolean;
};

/**
 * AI Generation v2 — the creative loop: prompt → generate → history → improve → generate
 * again. Intentionally simple (no chat, no prompt builder). Reuses existing generation data
 * for history and the media layer for results.
 */
export function GenerateView({ projectId, providerReady }: GenerateViewProps) {
  const [prompt, setPrompt] = useState("");
  const [viewing, setViewing] = useState<MediaAsset | null>(null);
  const generateMut = useGenerateImage(projectId);
  const { data: history, isLoading: historyLoading } =
    useProjectGenerations(projectId);

  const isPending = generateMut.isPending;
  const trimmed = prompt.trim();
  const tooLong = prompt.length > MAX_PROMPT;
  const canGenerate = providerReady && !isPending && trimmed !== "" && !tooLong;

  async function handleGenerate() {
    if (!canGenerate) return;
    try {
      const res = await generateMut.mutateAsync({ prompt: trimmed });
      setViewing(res.media);
      toast.success("Image generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    }
  }

  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Generate"
        description="Describe an image. When it's ready it appears here and in the Gallery."
      />

      {!providerReady ? (
        <div className="text-muted-foreground flex items-start gap-3 rounded-lg border border-dashed p-6 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-foreground font-medium">
              Generation isn&apos;t configured
            </p>
            <p>
              Set <code>HUGGINGFACE_API_KEY</code> (or <code>HF_TOKEN</code>) and{" "}
              <code>BLOB_READ_WRITE_TOKEN</code> to enable image generation.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid max-w-2xl gap-2">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder="A serene mountain lake at sunrise, cinematic lighting"
          disabled={isPending || !providerReady}
          aria-invalid={tooLong}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={cn(
              "text-xs tabular-nums",
              tooLong ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {prompt.length}/{MAX_PROMPT}
            {tooLong ? " — too long" : ""}
          </span>
          <div className="flex items-center gap-3">
            {isPending ? (
              <span className="text-muted-foreground text-sm">
                This can take 10–30s (the model may be warming up)…
              </span>
            ) : null}
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
        {generateMut.isError ? (
          <p className="text-destructive text-sm">
            {generateMut.error instanceof Error
              ? generateMut.error.message
              : "Generation failed."}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-medium">Recent generations</h3>
        {historyLoading ? (
          <LoadingState variant="list" rows={3} />
        ) : !history || history.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No generations yet"
            description="Your generated images will show up here and in the Gallery."
          />
        ) : (
          <GenerationHistory
            items={history}
            onOpen={setViewing}
            onUsePrompt={setPrompt}
          />
        )}
      </div>

      <MediaViewer
        media={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </div>
  );
}
