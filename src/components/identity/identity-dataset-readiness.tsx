"use client";

import { format } from "date-fns";
import { Sparkles } from "lucide-react";

import { useIdentityEngineOverview } from "@/hooks/use-identities";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IdentityPackageInspector } from "./identity-package-inspector";

/** Anchor-role glyphs for the Identity Package visualization (Milestone 25.2). */
const ROLE_EMOJI: Record<string, string> = {
  face: "👤",
  body: "💪",
  tattoo: "🖋",
  hair: "💇",
  canonical: "⭐",
  pose: "🧍",
};

type Props = { identityId: string };

const RATING_LABEL: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

function stars(n: number): string {
  const s = Math.max(0, Math.min(5, Math.round(n)));
  return "★".repeat(s) + "☆".repeat(5 - s);
}

/** One 0..1 (or 0..100) metric rendered as a labeled bar. Read-only. */
function Metric({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div className="bg-foreground/70 h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Identity Dataset Readiness (Milestone 22) — READ-ONLY placeholder. Shows the persisted dataset
 * readiness score/rating/verdict + metric bars + gaps. Real computed data (from the coverage engine +
 * diversity/quality metrics). No training button — training is a future milestone.
 */
export function IdentityDatasetReadiness({ identityId }: Props) {
  const { data, isLoading } = useIdentityEngineOverview(identityId);

  if (isLoading) return <LoadingState variant="list" rows={3} />;

  const dataset = data?.dataset ?? null;
  if (!dataset) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Dataset not analyzed yet"
        description="Analyze the training library (Training Media tab → Analyze library) to compute a readiness score for identity training."
      />
    );
  }

  const m = dataset.metrics;
  const pkg = data?.characterPackage ?? null;
  const quality = data?.packageQuality ?? null;
  return (
    <div className="grid gap-6">
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overall Readiness</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-center">
          <div className="text-4xl font-semibold tabular-nums">{dataset.score}%</div>
          <div className="text-amber-500 text-lg" aria-label={`${dataset.stars} of 5 stars`}>
            {stars(dataset.stars)}
          </div>
          <div>
            <Badge variant="secondary">{RATING_LABEL[dataset.rating] ?? dataset.rating}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{dataset.verdict}</p>
          <p className="text-muted-foreground text-xs">
            {dataset.analyzedCount} of {dataset.imageCount} analyzed ·{" "}
            {format(new Date(dataset.computedAt), "PP")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Coverage" value={m.coverageOverall} max={100} />
          <Metric label="Overall quality" value={m.overallQuality} />
          <Metric label="Frontal face" value={m.frontalFaceCoverage} />
          <Metric label="Side profile" value={m.sideProfileCoverage} />
          <Metric label="Expression diversity" value={m.expressionDiversity} />
          <Metric label="Hairstyle coverage" value={m.hairstyleCoverage} />
          <Metric label="Tattoo visibility" value={m.tattooVisibility} />
          <Metric label="Lighting diversity" value={m.lightingDiversity} />
          <Metric label="Body visibility" value={m.bodyVisibility} />
          <Metric label="Sharpness" value={m.sharpness} />
        </div>

        {dataset.gaps.length ? (
          <div className={cn("grid gap-2 rounded-lg border p-4")}>
            <h4 className="text-sm font-medium">Suggested improvements</h4>
            <ul className="text-muted-foreground grid list-disc gap-1 pl-5 text-sm">
              {dataset.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>

      {quality ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm">
              <span>
                Package Quality
                <span className="text-muted-foreground ml-2 font-normal">predicted strength before generation</span>
              </span>
              <span className="text-2xl font-semibold tabular-nums">{quality.overall}<span className="text-muted-foreground text-sm">/100</span></span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <p className="text-muted-foreground text-xs font-medium">Coverage</p>
              {quality.coverage.map((c) => (
                <div key={c.role} className="flex items-center justify-between text-xs">
                  <span>
                    {c.status === "strong" ? "✓" : c.status === "weak" ? "⚠" : "✗"}{" "}
                    {ROLE_EMOJI[c.role] ?? "•"} {c.role}
                  </span>
                  <span
                    className={cn(
                      "font-mono",
                      c.status === "strong"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : c.status === "weak"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-destructive",
                    )}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid gap-1.5">
              <p className="text-muted-foreground text-xs font-medium">Predicted preservation</p>
              {(["face", "hair", "tattoo", "body"] as const).map((dim) => {
                const v = quality.predicted[dim];
                if (v == null) return null;
                return (
                  <div key={dim} className="grid gap-0.5 text-xs">
                    <div className="flex justify-between">
                      <span>{dim}</span>
                      <span className="font-mono tabular-nums">{Math.round(v * 100)}</span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div className="bg-foreground/60 h-full rounded-full" style={{ width: `${Math.round(v * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-muted-foreground mt-1 text-[10px]">heuristic prediction, not a measurement</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pkg && pkg.anchors.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Identity Package
              <span className="text-muted-foreground ml-2 font-normal">
                the character&apos;s default anchors ({pkg.analyzedCount} analyzed) — generation starts here
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {pkg.anchors.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className="size-12 shrink-0 rounded object-cover" />
                <div className="grid gap-0.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">
                      {a.roles.map((r) => `${ROLE_EMOJI[r] ?? "•"} ${r}`).join(" · ")}
                    </span>
                    {a.exposure !== "clothed" ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {a.exposure}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground font-mono">confidence {a.score}</p>
                  <p className="text-muted-foreground">{a.reasons.join(", ")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <IdentityPackageInspector identityId={identityId} />
    </div>
  );
}
