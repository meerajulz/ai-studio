"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import {
  analyzeVisionDebug,
  listVisionModels,
  type VisionDebugResult,
} from "@/actions/vision-debug";
import { renderStars } from "@/lib/vision";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";

/** Downscale the file to a small JPEG data URL — keeps the payload tiny, no Blob involved. */
function toDownscaledDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line @next/next/no-img-element
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image"));
    };
    img.src = url;
  });
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="bg-muted max-h-96 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function VisionDebugView({ visionConfigured }: { visionConfigured: boolean }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VisionDebugResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState<string>("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setDataUrl(await toDownscaledDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the image");
    }
  }

  async function loadModels() {
    setError(null);
    try {
      const { models: m } = await listVisionModels();
      setModels(m);
      // Preselect a good default for identity analysis.
      const preferred =
        m.find((x) => x === "gemini-3.5-flash") ??
        m.find((x) => x === "gemini-flash-latest") ??
        m.find((x) => /flash/.test(x) && !/lite|image|tts/.test(x)) ??
        m[0] ??
        "";
      if (!model) setModel(preferred);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not list models");
    }
  }

  async function analyze() {
    if (!dataUrl) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await analyzeVisionDebug(dataUrl, model || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <SectionTitle
        title="Vision debug"
        description="Dev-only: run the full Vision pipeline on one image (provider → normalize → score → coverage). No persistence, no generation."
      />

      {!visionConfigured ? (
        <div className="text-muted-foreground flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            No vision provider configured. Set <code>GEMINI_API_KEY</code> and restart the dev server.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm"
        />
        <Button onClick={analyze} disabled={!dataUrl || loading || !visionConfigured}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? "Analyzing…" : "Analyze"}
        </Button>
        <Button variant="outline" onClick={loadModels} disabled={!visionConfigured}>
          List models
        </Button>
        {models && models.length ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {model
          ? `Using model: ${model}`
          : "Using the server default (GEMINI_VISION_MODEL or gemini-flash-latest). Click “List models” to pick one here."}
      </p>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {models ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="mb-2 font-medium">
            Models your key can use ({models.length}) — set <code>GEMINI_VISION_MODEL</code> to one:
          </p>
          <div className="grid gap-0.5 font-mono text-xs">
            {models.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {dataUrl ? (
          <Panel title="Image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="upload" className="max-h-96 rounded" />
          </Panel>
        ) : null}

        {result ? (
          <>
            <Panel title="Run">
              <dl className="grid gap-1 text-sm">
                <div>Provider: <span className="font-mono">{result.provider}</span></div>
                <div>Model: <span className="font-mono">{result.model}</span></div>
                <div>Duration: <span className="font-mono">{result.durationMs} ms</span></div>
                <div>
                  Tokens:{" "}
                  <span className="font-mono">
                    {result.tokenUsage
                      ? `${result.tokenUsage.total ?? "?"} (prompt ${result.tokenUsage.prompt ?? "?"} + out ${result.tokenUsage.candidates ?? "?"})`
                      : "n/a"}
                  </span>
                </div>
              </dl>
            </Panel>

            {result.warnings.length ? (
              <Panel title="Warnings">
                <ul className="text-sm">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-amber-600 dark:text-amber-400">
                      ⚠ {w}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <Panel title="Image score">
              <dl className="grid gap-1 text-sm">
                <div className="font-semibold">Overall: {result.score.overall}/100 · {result.score.usable ? "usable" : "not usable"}</div>
                <div>Face quality: {result.score.faceQuality}</div>
                <div>Tattoo visibility: {result.score.tattooVisibility}</div>
                <div>Body coverage: {result.score.bodyCoverage}</div>
                <div>Hair visibility: {result.score.hairVisibility}</div>
                <div>Lighting: {result.score.lighting}</div>
                <div>Sharpness: {result.score.sharpness}</div>
                <div>Expression: {result.score.expression ?? "—"}</div>
                {result.score.reasons.length ? (
                  <div className="text-muted-foreground">{result.score.reasons.join(", ")}</div>
                ) : null}
              </dl>
            </Panel>

            <Panel title="Coverage contribution (this image alone)">
              <div className="grid gap-0.5 font-mono text-xs">
                {result.coverage.dimensions.map((d) => (
                  <div key={d.id}>
                    {d.label.padEnd(18)} {renderStars(d.stars)}
                    {d.status === "not-applicable" ? "  (n/a)" : ""}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Normalized IdentityMetadata (knowledge)">
              <Json value={result.metadata} />
            </Panel>

            <Panel title="Raw provider response">
              <Json value={result.raw} />
            </Panel>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
