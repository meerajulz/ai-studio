"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Bug, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import {
  useGenerateImage,
  useProjectGenerations,
} from "@/hooks/use-generation";
import {
  CREATIVE_STYLE_OPTIONS,
  DEFAULT_STYLE,
  type CreativeStyle,
} from "@/lib/creative";
import type { GenerationDebug } from "@/lib/generation/types";
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
 * AI Generation — the creative loop: describe an idea → generate → history → improve →
 * generate again. The user only describes what they want (plus an optional Style); the
 * Creative Director (`src/lib/creative`) turns that idea into a professional prompt. No
 * technical AI settings are exposed. Reuses existing generation data + the media layer.
 */
export function GenerateView({ projectId, providerReady }: GenerateViewProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<CreativeStyle>(DEFAULT_STYLE);
  const [viewing, setViewing] = useState<MediaAsset | null>(null);
  const [debug, setDebug] = useState<GenerationDebug | null>(null);
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
      const res = await generateMut.mutateAsync({ prompt: trimmed, style });
      setViewing(res.media);
      setDebug(res.debug ?? null); // dev-only; undefined in production
      toast.success("Image generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    }
  }

  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Generate"
        description="Describe your idea — AI Studio writes the prompt. Results appear here and in the Gallery."
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground mr-1 text-sm">Style</span>
          {CREATIVE_STYLE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={style === option.value ? "default" : "outline"}
              disabled={isPending || !providerReady}
              onClick={() => setStyle(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
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

      {debug ? <CreativeDebugPanel debug={debug} /> : null}

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

/**
 * Developer Debug Mode (development only). The `debug` payload is populated by the generation
 * layer solely when `NODE_ENV !== "production"`, so this panel never renders in production. It
 * makes the Creative Director transparent: idea → detected intent → rules → compiled prompt →
 * provider/model/payload. Contains no secrets.
 */
function CreativeDebugPanel({ debug }: { debug: GenerationDebug }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: "User idea", value: debug.idea },
    { label: "Detected intent", value: debug.intent },
    { label: "Style", value: debug.style },
    { label: "Focus", value: debug.focus },
    {
      label: "Creative rules applied",
      value: debug.rulesApplied.length ? debug.rulesApplied.join(", ") : "—",
    },
    { label: "Compiled prompt", value: debug.compiledPrompt },
    { label: "Provider", value: debug.provider },
    { label: "Model", value: debug.model },
  ];

  return (
    <section className="max-w-2xl rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bug className="size-4" />
        <h3 className="text-sm font-medium">Creative Director — Debug</h3>
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">
          dev only
        </span>
      </div>
      <dl className="grid gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-0.5">
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd className="font-mono text-xs break-words whitespace-pre-wrap">
              {row.value}
            </dd>
          </div>
        ))}
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground text-xs">Generation payload</dt>
          <dd className="bg-background overflow-x-auto rounded border p-2 font-mono text-xs">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(debug.payload, null, 2)}
            </pre>
          </dd>
        </div>
      </dl>
    </section>
  );
}
