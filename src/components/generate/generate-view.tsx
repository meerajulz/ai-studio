"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Bug, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import {
  useGenerateImage,
  useProjectGenerations,
} from "@/hooks/use-generation";
import {
  useIdentities,
  useIdentity,
  useIdentityEngineOverview,
  defaultIdentityFilters,
} from "@/hooks/use-identities";
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
import { ManualReferencePicker, type PickerImage } from "./manual-reference-picker";
import type { MediaKnowledgeSummary } from "@/lib/vision";
import { MODEL_REGISTRY } from "@/lib/ai/model-registry";

const MAX_PROMPT = 1000;

/** Compact badges for the manual reference picker, derived from the persisted knowledge summary. */
function badgesFor(k: MediaKnowledgeSummary, isAnchor: boolean): string[] {
  const b: string[] = [];
  if (isAnchor) b.push("Anchor");
  if (k.covered.some((c) => /face|profile/i.test(c))) b.push("Face");
  if (k.covered.some((c) => /body/i.test(c))) b.push("Body");
  if (k.covered.some((c) => /tattoo/i.test(c))) b.push("Tattoos");
  if (k.covered.some((c) => /hair/i.test(c))) b.push("Hair");
  if (k.smiling) b.push("Smile");
  return b;
}

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
  const [identityId, setIdentityId] = useState<string>("");
  const [viewing, setViewing] = useState<MediaAsset | null>(null);
  const [debug, setDebug] = useState<GenerationDebug | null>(null);
  // DEV identity-benchmark controls (not shown in prod).
  const [maxReferences, setMaxReferences] = useState<number | undefined>(undefined);
  const [refMode, setRefMode] = useState<"auto" | "manual">("auto");
  const [manualSelected, setManualSelected] = useState<string[]>([]);
  // DEV model selection: Auto (capability router) · Manual (pick one) · Developer (Manual + metadata).
  const [modelMode, setModelMode] = useState<"auto" | "manual" | "developer">("auto");
  const [modelId, setModelId] = useState<string | undefined>(undefined);
  // Identity STRATEGY benchmark (M24.5): undefined = Auto; else force reference / lora / pulid.
  const [strategyOverride, setStrategyOverride] =
    useState<"reference" | "lora" | "pulid" | undefined>(undefined);
  const generateMut = useGenerateImage(projectId);
  const isDev = process.env.NODE_ENV !== "production";
  // Selected identity's analyzed images (for the manual reference picker). Fetch only in dev.
  const { data: identityDetail } = useIdentity(isDev && identityId ? identityId : "");
  // Whether the identity has a trained LoRA — generation then uses ONE reference + the LoRA.
  const { data: engineOverview } = useIdentityEngineOverview(isDev && identityId ? identityId : "");
  const hasTrainedLora = engineOverview?.capabilities.conditioning.lora ?? false;
  const { data: history, isLoading: historyLoading } =
    useProjectGenerations(projectId);
  const { data: identities } = useIdentities(projectId, defaultIdentityFilters);

  const pickerImages = useMemo<PickerImage[]>(() => {
    const items = identityDetail?.trainingMedia ?? [];
    // Anchor badge = the analyzed image with the strongest visible front face.
    let anchorId: string | null = null;
    let bestFace = -1;
    for (const t of items) {
      const k = t.knowledge;
      if (k && k.covered.some((c) => /front face/i.test(c)) && k.suitability.face > bestFace) {
        bestFace = k.suitability.face;
        anchorId = t.media.id;
      }
    }
    return items
      .filter((t) => t.media.type === "IMAGE")
      .map((t) => ({
        mediaId: t.media.id,
        url: t.media.url,
        analyzed: t.knowledge != null,
        badges: t.knowledge ? badgesFor(t.knowledge, t.media.id === anchorId) : [],
      }));
  }, [identityDetail]);

  // Registry models grouped by vendor for the Manual/Developer selector (config-driven; t2i hidden;
  // auto-only models like Kontext+LoRA hidden — they need inputs the app supplies automatically).
  const modelsByVendor = useMemo(() => {
    const groups = new Map<string, typeof MODEL_REGISTRY>();
    for (const m of MODEL_REGISTRY) {
      if (m.payloadKind === "t2i" || m.autoOnly) continue;
      groups.set(m.vendor, [...(groups.get(m.vendor) ?? []), m]);
    }
    return [...groups.entries()];
  }, []);

  const isPending = generateMut.isPending;
  const trimmed = prompt.trim();
  const tooLong = prompt.length > MAX_PROMPT;
  const canGenerate = providerReady && !isPending && trimmed !== "" && !tooLong;

  async function handleGenerate() {
    if (!canGenerate) return;
    try {
      const res = await generateMut.mutateAsync({
        prompt: trimmed,
        style,
        identityId: identityId || undefined,
        maxReferences: isDev && refMode === "auto" ? maxReferences : undefined,
        manualReferenceMediaIds:
          isDev && refMode === "manual" && manualSelected.length ? manualSelected : undefined,
        modelMode: isDev && modelMode === "auto" ? "auto" : isDev ? "manual" : undefined,
        modelOverride: isDev && modelMode !== "auto" ? modelId : undefined,
        strategyOverride: isDev ? strategyOverride : undefined,
      });
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
        {identities && identities.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground mr-1 text-sm">Identity</span>
            <Button
              type="button"
              size="sm"
              variant={identityId === "" ? "default" : "outline"}
              disabled={isPending || !providerReady}
              onClick={() => setIdentityId("")}
            >
              None
            </Button>
            {identities.map((identity) => (
              <Button
                key={identity.id}
                type="button"
                size="sm"
                variant={identityId === identity.id ? "default" : "outline"}
                disabled={isPending || !providerReady}
                onClick={() => setIdentityId(identity.id)}
              >
                {identity.name}
              </Button>
            ))}
          </div>
        ) : null}

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
        {isDev && identityId ? (
          <div className="grid gap-2 rounded-md border border-dashed p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground mr-1 text-sm">
                Identity strategy <span className="text-[10px] uppercase">dev</span>
              </span>
              {(
                [
                  [undefined, "Auto", true],
                  ["reference", "Reference", true],
                  ["lora", "Reference + LoRA", hasTrainedLora],
                  ["pulid", "PuLID (face)", engineOverview?.capabilities.conditioning.pulid ?? false],
                ] as const
              ).map(([value, label, enabled]) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={strategyOverride === value ? "default" : "outline"}
                  disabled={isPending || !enabled}
                  onClick={() => setStrategyOverride(value)}
                >
                  {label}
                </Button>
              ))}
              <span className="text-muted-foreground text-xs">
                benchmark: same prompt across techniques (Debug shows the strategy + model)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground mr-1 text-sm">
                References <span className="text-[10px] uppercase">dev</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant={refMode === "auto" ? "default" : "outline"}
                disabled={isPending}
                onClick={() => setRefMode("auto")}
              >
                Auto (selector)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={refMode === "manual" ? "default" : "outline"}
                disabled={isPending}
                onClick={() => setRefMode("manual")}
              >
                Manual
              </Button>
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground mr-1 text-sm">Model</span>
                {(
                  [
                    ["auto", "Auto (Recommended)"],
                    ["manual", "Manual"],
                    ["developer", "Developer"],
                  ] as const
                ).map(([m, label]) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={modelMode === m ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => setModelMode(m)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {modelMode === "auto" ? (
                <p className="text-muted-foreground text-xs">
                  AI Studio routes to the best model by capability — see the Debug panel for the chosen
                  model + reason.
                </p>
              ) : (
                <div className="grid gap-2">
                  {modelsByVendor.map(([vendor, models]) => (
                    <div key={vendor} className="grid gap-1">
                      <span className="text-muted-foreground text-[11px] font-medium uppercase">
                        {vendor}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {models.map((mdl) => (
                          <Button
                            key={mdl.id}
                            type="button"
                            size="sm"
                            variant={modelId === mdl.id ? "default" : "outline"}
                            disabled={isPending || !mdl.enabled}
                            onClick={() => setModelId(mdl.id)}
                            title={mdl.note ? `${mdl.id} — ${mdl.note}` : mdl.id}
                          >
                            {mdl.label}
                          </Button>
                        ))}
                      </div>
                      {modelMode === "developer" ? (
                        <div className="text-muted-foreground grid gap-0.5 text-[10px]">
                          {models.map((mdl) => (
                            <div key={mdl.id}>
                              <span className="font-mono">{mdl.label}</span> · p{mdl.priority} · refs≤
                              {mdl.maxReferences} · {mdl.capabilities.join(", ")}
                              {mdl.note ? ` · ⚠ ${mdl.note}` : ""}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!modelId ? (
                    <p className="text-muted-foreground text-xs">Pick a model for this generation.</p>
                  ) : null}
                </div>
              )}
            </div>

            {refMode === "auto" ? (
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={maxReferences === n ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() => setMaxReferences(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={maxReferences === undefined ? "default" : "outline"}
                  disabled={isPending}
                  onClick={() => setMaxReferences(undefined)}
                >
                  Auto
                </Button>
                <span className="text-muted-foreground text-xs">anchor stays first; 1 = anchor only</span>
              </div>
            ) : pickerImages.length ? (
              <ManualReferencePicker
                images={pickerImages}
                selected={manualSelected}
                onChange={setManualSelected}
                max={4}
                disabled={isPending}
                note={
                  hasTrainedLora
                    ? "This identity has a trained LoRA — generation uses your #1 reference + the LoRA (one image, model fal-ai/flux-kontext-lora). Extra picks are ignored."
                    : undefined
                }
              />
            ) : (
              <p className="text-muted-foreground text-xs">
                No analyzed images for this identity yet — run <strong>Analyze library</strong> first.
              </p>
            )}
          </div>
        ) : null}
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

function DebugRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono text-xs break-words whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function DebugStage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border bg-background p-3">
      <h4 className="mb-2 text-xs font-semibold tracking-wide uppercase">{title}</h4>
      <dl className="grid gap-2">{children}</dl>
    </div>
  );
}

const entityList = (entities: { token: string; kind: string }[]) =>
  entities.length ? entities.map((e) => `${e.token} (${e.kind})`).join(", ") : "—";

/**
 * Developer Debug Mode (development only). The `debug` payload is populated by the generation
 * layer solely when `NODE_ENV !== "production"`, so this panel never renders in production. It
 * makes the Creative Director's reasoning pipeline transparent — every stage shown separately:
 * scene analysis → intent analysis → composition plan → compiled prompt → provider/payload.
 */
function CreativeDebugPanel({ debug }: { debug: GenerationDebug }) {
  const { identity, scene, graph, intent, composition, compiledStructure } = debug;
  const nodeLabel = (id: string) => {
    const n = graph.nodes.find((node) => node.id === id);
    return n ? (n.descriptor ? `${n.descriptor} ${n.token}` : n.token) : "?";
  };
  return (
    <section className="max-w-2xl rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bug className="size-4" />
        <h3 className="text-sm font-medium">Creative Director — Debug</h3>
        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">
          dev only
        </span>
      </div>

      <div className="grid gap-3 text-sm">
        <DebugStage title="User prompt">
          <DebugRow label="Idea" value={debug.idea} />
        </DebugStage>

        <DebugStage title="0 · Identity context">
          <DebugRow label="Identity" value={identity.present ? identity.name : "none"} />
          {identity.present ? (
            <>
              <DebugRow label="Reference phrase" value={identity.referencePhrase ?? "—"} />
              <DebugRow
                label="Signals"
                value={`description: ${identity.signals.hasDescription ? "yes" : "no"} · hero image: ${
                  identity.signals.hasHeroImage ? "yes" : "no"
                } · training media: ${identity.signals.trainingMediaCount}`}
              />
            </>
          ) : null}
        </DebugStage>

        <DebugStage title="1 · Scene analysis">
          <DebugRow
            label="Primary subject"
            value={
              scene.primarySubject
                ? `${scene.primarySubject.token} (${scene.primarySubject.kind})`
                : "—"
            }
          />
          <DebugRow label="Secondary subjects" value={entityList(scene.secondarySubjects)} />
          <DebugRow label="Objects" value={entityList(scene.objects)} />
          <DebugRow label="Environment" value={scene.environment} />
          <DebugRow label="Setting" value={scene.setting ?? "—"} />
          <DebugRow label="Location" value={scene.location ?? "—"} />
          <DebugRow label="Time / weather" value={`${scene.timeOfDay ?? "—"} / ${scene.weather ?? "—"}`} />
          <DebugRow label="Actions" value={scene.actions.length ? scene.actions.join(", ") : "—"} />
          <DebugRow
            label="Fantasy elements"
            value={scene.fantasyElements.length ? scene.fantasyElements.join(", ") : "—"}
          />
        </DebugStage>

        <DebugStage title="1.5 · Spatial analysis (scene graph)">
          <DebugRow label="Anchor" value={graph.anchor ? nodeLabel(graph.anchor) : "—"} />
          <DebugRow
            label="Nodes"
            value={
              graph.nodes.length
                ? graph.nodes
                    .map(
                      (n) =>
                        `${n.descriptor ? n.descriptor + " " : ""}${n.token} (${n.kind}, ${n.role})${
                          n.position ? " @" + n.position : ""
                        }`,
                    )
                    .join(", ")
                : "—"
            }
          />
          <DebugRow
            label="Relationships (confidence)"
            value={
              graph.relationships.length
                ? graph.relationships
                    .map(
                      (r) =>
                        `${nodeLabel(r.from)} → ${r.type} → ${nodeLabel(r.to)} (${r.confidence.toFixed(
                          1,
                        )})`,
                    )
                    .join("  ·  ")
                : "—"
            }
          />
        </DebugStage>

        <DebugStage title="3.5 · Compiled structure (before final prompt)">
          <DebugRow label="Subject" value={compiledStructure.subject} />
          <DebugRow
            label="Relationships"
            value={
              compiledStructure.relationships.length
                ? compiledStructure.relationships.join(" · ")
                : "—"
            }
          />
          <DebugRow
            label="Objects"
            value={compiledStructure.objects.length ? compiledStructure.objects.join(", ") : "—"}
          />
          <DebugRow label="Genre" value={compiledStructure.genre} />
        </DebugStage>

        <DebugStage title="2 · Intent analysis">
          <DebugRow label="Intent" value={`${intent.label} (${intent.type})`} />
          <DebugRow label="Why" value={intent.rationale} />
        </DebugStage>

        <DebugStage title="3 · Composition plan">
          <DebugRow label="Framing" value={composition.framing} />
          <DebugRow
            label="Camera"
            value={`${composition.cameraDistance} · ${composition.cameraAngle}`}
          />
          <DebugRow label="Composition" value={composition.composition} />
          <DebugRow label="Perspective" value={composition.perspective ?? "—"} />
          <DebugRow label="Depth of field" value={composition.depthOfField} />
          <DebugRow label="Lighting" value={composition.lighting} />
          <DebugRow label="Realism" value={composition.realism} />
        </DebugStage>

        <DebugStage title="4 · Prompt compilation">
          <DebugRow
            label="Creative rules applied"
            value={debug.rulesApplied.length ? debug.rulesApplied.join(", ") : "—"}
          />
          <DebugRow label="Compiled prompt" value={debug.compiledPrompt} />
        </DebugStage>

        <DebugStage title="Provider & routing">
          <DebugRow label="Chosen provider" value={debug.provider} />
          <DebugRow label="Chosen model" value={debug.model} />
          {debug.modelRouting ? (
            <>
              <DebugRow
                label="Model routing"
                value={`${debug.modelRouting.mode} → ${debug.modelRouting.label} (${debug.modelRouting.vendor}) — ${debug.modelRouting.reason}`}
              />
              <DebugRow
                label="Models considered"
                value={
                  <div className="grid gap-0.5 font-mono text-[11px]">
                    {debug.modelRouting.considered
                      .slice()
                      .sort((a, b) => b.priority - a.priority)
                      .map((m) => (
                        <div
                          key={m.id}
                          className={
                            m.id === debug.modelRouting?.chosen
                              ? "text-foreground font-semibold"
                              : m.enabled
                                ? "text-muted-foreground"
                                : "text-muted-foreground/50"
                          }
                        >
                          {m.id === debug.modelRouting?.chosen ? "★ " : ""}
                          {m.label} · {m.vendor} · p{m.priority}
                          {m.enabled ? "" : " · disabled"}
                        </div>
                      ))}
                  </div>
                }
              />
            </>
          ) : null}
          <DebugRow
            label="Provider capabilities"
            value={
              debug.providerCapabilities.length
                ? debug.providerCapabilities.join(", ")
                : "—"
            }
          />
          <DebugRow
            label="Routing decision"
            value={`${debug.routing.reason} · considered: ${debug.routing.considered
              .map((c) => `${c.id}${c.configured ? "" : " (not configured)"}`)
              .join(", ")}`}
          />
          <DebugRow
            label="Identity visual package"
            value={
              debug.visualPackage
                ? `hero: ${debug.visualPackage.hasHeroImage ? "yes" : "no"} · portrait: ${
                    debug.visualPackage.hasPortrait ? "yes" : "no"
                  } · full body: ${debug.visualPackage.hasFullBody ? "yes" : "no"} · references: ${
                    debug.visualPackage.referenceImages
                  } / ${debug.visualPackage.totalMedia} media`
                : "none"
            }
          />
          <DebugRow
            label="Supports reference images"
            value={debug.referenceImages.supportsReferenceImages ? "yes" : "no"}
          />
          {debug.referenceImages.manual ? (
            <DebugRow
              label="Selection mode"
              value={
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  Manual reference selection (dev) — exact chosen images/order
                </span>
              }
            />
          ) : null}
          <DebugRow
            label="References selected"
            value={`${debug.referenceImages.offered}${debug.referenceImages.manual ? " (manual)" : ""}`}
          />
          <DebugRow
            label="Model reference limit"
            value={
              debug.referenceImages.modelMaxReferences != null
                ? `${debug.referenceImages.modelMaxReferences}${debug.model ? ` — ${debug.model}` : ""}`
                : "—"
            }
          />
          {debug.referenceImages.devCap != null ? (
            <DebugRow label="Dev References cap" value={`${debug.referenceImages.devCap}`} />
          ) : null}
          <DebugRow
            label="Reference images sent"
            value={`${debug.referenceImages.sent} of ${debug.referenceImages.offered}${
              debug.referenceImages.sentRoles.length
                ? ` (${debug.referenceImages.sentRoles.join(", ")})`
                : ""
            }`}
          />
          {debug.referenceImages.limitReason ? (
            <DebugRow label="Why fewer than selected" value={debug.referenceImages.limitReason} />
          ) : null}
          {debug.referenceImages.sentImages.length ? (
            <DebugRow
              label="Images sent (in order)"
              value={
                <div className="flex flex-wrap gap-2">
                  {debug.referenceImages.sentImages.map((img, i) => (
                    <div key={`${img.url}-${i}`} className="grid gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.role}
                        className={cn(
                          "size-20 rounded border object-cover",
                          i === 0 && img.role === "anchor" ? "ring-primary ring-2" : "",
                        )}
                      />
                      <span className="text-center text-[10px]">
                        {i + 1}. {i === 0 && img.role === "anchor" ? "★ anchor" : img.role}
                      </span>
                    </div>
                  ))}
                </div>
              }
            />
          ) : null}
          <DebugRow label="Why these images" value={debug.referenceImages.selectionReason} />
          {debug.anchorRanking.length ? (
            <DebugRow
              label="Identity anchor ranking (FACE only)"
              value={
                <div className="overflow-x-auto">
                  <table className="text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground text-left">
                        {["#", "img", "orient", "faceQ", "frontal", "eyes", "light", "res", "prom", "conf", "score"].map(
                          (h) => (
                            <th key={h} className="px-1 pb-1 font-normal">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {debug.anchorRanking.map((a, i) => (
                        <tr
                          key={a.mediaId}
                          className={i === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}
                        >
                          <td className="px-1">{i === 0 ? "★" : i + 1}</td>
                          <td className="px-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url} alt="" className="size-10 rounded object-cover" />
                          </td>
                          <td className="px-1">{a.orientation}</td>
                          <td className="px-1 text-center">{Math.round(a.faceQuality * 100)}</td>
                          <td className="px-1 text-center">{Math.round(a.frontalness * 100)}</td>
                          <td className="px-1 text-center">{Math.round(a.eyeVisibility * 100)}</td>
                          <td className="px-1 text-center">{Math.round(a.lighting * 100)}</td>
                          <td className="px-1 text-center">{Math.round(a.resolution * 100)}</td>
                          <td className="px-1 text-center">{Math.round(a.prominence * 100)}</td>
                          <td className="px-1 text-center">{Math.round(a.confidence * 100)}</td>
                          <td className="px-1 text-center">{a.score.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-muted-foreground mt-1">
                    ★ = chosen anchor. score = frontal × faceQ × conf × prominence. `res`/`prom` reflect
                    face size (headshot ≈ 100, full-body ≈ 35) — a close-up should beat a full-body.
                  </p>
                </div>
              }
            />
          ) : null}
          <DebugRow
            label="Provider response metadata"
            value={
              debug.responseMetadata ? (
                <pre className="bg-muted overflow-x-auto rounded p-2 whitespace-pre-wrap">
                  {JSON.stringify(debug.responseMetadata, null, 2)}
                </pre>
              ) : (
                "—"
              )
            }
          />
          <DebugRow
            label="Generation payload"
            value={
              <pre className="bg-muted overflow-x-auto rounded p-2 whitespace-pre-wrap">
                {JSON.stringify(debug.payload, null, 2)}
              </pre>
            }
          />
        </DebugStage>
      </div>
    </section>
  );
}
