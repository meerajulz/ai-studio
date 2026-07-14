"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import { useGenerateImage } from "@/hooks/use-generation";
import type { MediaAsset } from "@/lib/media/types";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type GenerateViewProps = {
  projectId: string;
  providerReady: boolean;
};

/**
 * First Light — the minimal generation surface: one prompt, one button. The result flows
 * through the media layer and shows up in the Gallery. Intentionally minimal (no history,
 * models, negative prompts, or identity picker yet).
 */
export function GenerateView({ projectId, providerReady }: GenerateViewProps) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<MediaAsset | null>(null);
  const generateMut = useGenerateImage(projectId);
  const isPending = generateMut.isPending;

  async function handleGenerate() {
    const value = prompt.trim();
    if (!value) return;
    try {
      const res = await generateMut.mutateAsync({ prompt: value });
      setResult(res.media);
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

      <div className="grid max-w-2xl gap-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="A serene mountain lake at sunrise, cinematic lighting"
          disabled={isPending || !providerReady}
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerate}
            disabled={isPending || !providerReady || prompt.trim() === ""}
          >
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
          {isPending ? (
            <span className="text-muted-foreground text-sm">
              This can take 10–30s (the model may be warming up)…
            </span>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="grid max-w-md gap-2">
          <div className="bg-muted overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt={result.originalFilename ?? "Generated image"}
              className="w-full"
            />
          </div>
          <Link
            href={`/projects/${projectId}/gallery`}
            className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
          >
            View in Gallery
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
