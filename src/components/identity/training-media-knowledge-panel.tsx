"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

import {
  getMediaVisionKnowledgeAction,
  reanalyzeMediaAction,
} from "@/actions/identities";
import { renderStars, type MediaKnowledgeDetail } from "@/lib/vision";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  mediaId: string | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful re-analyze so the parent can refresh its cards. */
  onReanalyzed?: () => void;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h4 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function TrainingMediaKnowledgePanel({ mediaId, title, open, onOpenChange, onReanalyzed }: Props) {
  const [detail, setDetail] = useState<MediaKnowledgeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!open || !mediaId) return;
    let active = true;
    setLoading(true);
    setDetail(null);
    getMediaVisionKnowledgeAction(mediaId)
      .then((d) => active && setDetail(d))
      .catch(() => active && toast.error("Could not load analysis."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, mediaId]);

  async function reanalyze() {
    if (!mediaId) return;
    setReanalyzing(true);
    try {
      await reanalyzeMediaAction(mediaId);
      setDetail(await getMediaVisionKnowledgeAction(mediaId));
      onReanalyzed?.();
      toast.success("Re-analyzed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Re-analysis failed.");
    } finally {
      setReanalyzing(false);
    }
  }

  const m = detail?.metadata;
  const fq = m?.face.quality;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Image analysis</SheetTitle>
          <SheetDescription className="truncate">{title}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-8">
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading analysis…
            </div>
          ) : !detail || !m ? (
            <p className="text-muted-foreground py-8 text-sm">
              This image hasn&apos;t been analyzed yet. Use <strong>Analyze library</strong>, or
              re-analyze below.
            </p>
          ) : (
            <>
              <Section title="Overview">
                <Row
                  label="Overall score"
                  value={`${detail.summary.overallScore}/100 · ${detail.summary.usable ? "usable" : "not usable"}`}
                />
                <Row label="Hero suitability" value={`${detail.summary.heroSuitability}%`} />
              </Section>

              <Section title="Reference suitability">
                {(
                  [
                    ["Hero", detail.summary.heroSuitability],
                    ["Face", detail.summary.suitability.face],
                    ["Body", detail.summary.suitability.body],
                    ["Tattoo", detail.summary.suitability.tattoo],
                    ["Hair", detail.summary.suitability.hair],
                    ["Expression", detail.summary.suitability.expression],
                  ] as const
                ).map(([label, v]) => (
                  <Row key={label} label={label} value={`${v}%`} />
                ))}
                {m.referenceSuitability.reason ? (
                  <p className="text-muted-foreground mt-1 text-xs">{m.referenceSuitability.reason}</p>
                ) : null}
              </Section>

              <Section title="Coverage contribution">
                <div className="grid gap-0.5 font-mono text-xs">
                  {detail.coverage
                    .filter((d) => d.status !== "not-applicable")
                    .map((d) => (
                      <div key={d.id} className="flex justify-between">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span>{renderStars(d.stars)}</span>
                      </div>
                    ))}
                </div>
              </Section>

              <Section title="Face quality">
                {fq ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    {Object.entries(fq).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono">{pct(v as number)}</span>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-muted-foreground text-sm">Unavailable — face not visible.</p>
                )}
              </Section>

              <Section title="Visible body regions">
                <p className="text-sm">
                  {m.body.visibleRegions.join(", ") || "—"}
                  {m.body.visiblePercent != null ? ` (~${m.body.visiblePercent}%)` : ""}
                </p>
              </Section>

              <Section title="Tattoo regions">
                {m.tattoos.length ? (
                  <div className="grid gap-0.5 font-mono text-xs">
                    {m.tattoos.map((t, i) => (
                      <div key={i}>
                        <span>{t.region}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {pct(t.confidence)}
                          {t.description ? ` · ${t.description}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">None detected.</p>
                )}
              </Section>

              <Section title="Hair">
                <p className="text-sm">
                  {[
                    m.hair.color,
                    m.hair.length,
                    m.hair.texture,
                    `${m.hair.parting} part`,
                    m.hair.updo,
                    m.hair.bangs ? "bangs" : null,
                    m.hair.wet ? "wet" : null,
                    m.hair.windBlown ? "wind-blown" : null,
                  ]
                    .filter((x) => x && x !== "unknown")
                    .join(" · ") || "—"}
                </p>
              </Section>

              <Section title="Analyzed by">
                <Row label="Provider" value={`${detail.summary.provider} · ${detail.summary.model}`} />
                <Row label="Contract" value={detail.summary.version} />
                <Row
                  label="When"
                  value={new Date(detail.summary.analyzedAt).toLocaleString()}
                />
              </Section>

              <div>
                <button
                  type="button"
                  onClick={() => setShowJson((v) => !v)}
                  className="text-muted-foreground text-xs underline"
                >
                  {showJson ? "Hide" : "Show"} IdentityMetadata JSON (developer)
                </button>
                {showJson ? (
                  <pre className="bg-muted mt-2 max-h-72 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
                    {JSON.stringify(m, null, 2)}
                  </pre>
                ) : null}
              </div>
            </>
          )}

          <Button variant="outline" onClick={reanalyze} disabled={reanalyzing || !mediaId}>
            {reanalyzing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {reanalyzing ? "Re-analyzing…" : "Re-analyze image"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
