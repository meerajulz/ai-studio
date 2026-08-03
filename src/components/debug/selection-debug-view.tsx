"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import { analyzeSelectionDebug, type SelectionDebugResult } from "@/actions/selection-debug";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";

/** Downscale a file to a small JPEG data URL — keeps the payload tiny, no Blob involved. */
function toDownscaledDataUrl(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line @next/next/no-img-element
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

export function SelectionDebugView({ visionConfigured }: { visionConfigured: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [dataUrls, setDataUrls] = useState<string[]>([]);
  const [result, setResult] = useState<SelectionDebugResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      setDataUrls(await Promise.all(Array.from(files).map((f) => toDownscaledDataUrl(f))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the images");
    }
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await analyzeSelectionDebug(prompt, dataUrls));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Selection failed");
    } finally {
      setLoading(false);
    }
  }

  const roleColor = (mediaId: string) =>
    result?.package.some((p) => p.mediaId === mediaId) ? "border-primary" : "opacity-60";

  return (
    <PageContainer>
      <SectionTitle
        title="Smart Reference Selection debug"
        description="Dev-only: prompt → Creative Director → requirements → analyze images → best package for THIS request. No persistence, no generation."
      />

      {!visionConfigured ? (
        <div className="text-muted-foreground flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            No vision provider configured. Set <code>GEMINI_API_KEY</code> and restart the dev server.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Julieta smiling on a yacht in a bikini"
          className="rounded border px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="text-sm" />
          <Button onClick={analyze} disabled={!prompt || !dataUrls.length || loading || !visionConfigured}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {loading ? "Selecting…" : "Analyze & select"}
          </Button>
          <span className="text-muted-foreground text-xs">{dataUrls.length} image(s)</span>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {result ? (
        <div className="grid gap-4">
          <Panel title="Prompt requirements">
            <div className="flex flex-wrap gap-1.5">
              {result.requirements.length ? (
                result.requirements.map((r) => (
                  <span key={r} className="bg-muted rounded px-2 py-0.5 text-xs">
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">none detected</span>
              )}
            </div>
          </Panel>

          <Panel title="Selected package (best-first)">
            <ol className="grid gap-2">
              {result.package.map((p, i) => (
                <li key={p.mediaId} className="flex items-baseline gap-2 text-sm">
                  <span className="text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}.</span>
                  <span className="bg-primary/10 rounded px-1.5 py-0.5 text-xs font-medium">{p.role}</span>
                  <span className="font-mono text-xs">{p.mediaId}</span>
                  <span className="text-muted-foreground">— {p.reason}</span>
                </li>
              ))}
            </ol>
          </Panel>

          {result.warnings.length ? (
            <Panel title="Coverage warnings">
              <ul className="text-sm">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-amber-600 dark:text-amber-400">
                    ⚠ {w}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Match matrix (all images × requirements)">
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pr-3 pb-1">image</th>
                    <th className="pr-3 pb-1">base</th>
                    {result.ranked[0]?.perRequirement.map((r) => (
                      <th key={r.id} className="px-2 pb-1 whitespace-nowrap">{r.id}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {result.ranked.map((row) => (
                    <tr key={row.mediaId} className={roleColor(row.mediaId)}>
                      <td className="pr-3">{row.mediaId}</td>
                      <td className="pr-3">{row.baseScore}</td>
                      {row.perRequirement.map((r) => (
                        <td key={r.id} className={`px-2 text-center ${r.score >= 50 ? "text-foreground" : "text-muted-foreground"}`}>
                          {r.score}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">Bordered/opaque rows are the selected package.</p>
          </Panel>
        </div>
      ) : null}
    </PageContainer>
  );
}
