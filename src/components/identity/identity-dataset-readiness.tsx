"use client";

import { format } from "date-fns";
import { Sparkles } from "lucide-react";

import { useIdentityEngineOverview } from "@/hooks/use-identities";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  return (
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
  );
}
