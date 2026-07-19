"use client";

import { format } from "date-fns";
import { Boxes, Clock } from "lucide-react";

import { useIdentityEngineOverview } from "@/hooks/use-identities";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";

type Props = { identityId: string };

/**
 * Trained Models + Training Jobs (Milestone 22) — READ-ONLY placeholders. Trained models are versioned
 * and never overwritten (LoRA v1, v2, …). No "Train" button — training is a future milestone; this
 * only renders the structure + empty states so the Identity Engine is visible in the UI.
 */
export function IdentityTrainedModels({ identityId }: Props) {
  const { data, isLoading } = useIdentityEngineOverview(identityId);

  if (isLoading) return <LoadingState variant="list" rows={3} />;

  const models = data?.trainedModels ?? [];
  const jobs = data?.trainingJobs ?? [];
  const caps = data?.capabilities;

  // The UI adapts off engine capabilities — no hardcoded "if a LoRA exists…".
  const techniques: { id: string; label: string; on: boolean }[] = caps
    ? [
        { id: "reference", label: "Reference", on: caps.reference },
        { id: "lora", label: "LoRA", on: caps.lora },
        { id: "pulid", label: "PuLID", on: caps.pulid },
        { id: "instantid", label: "InstantID", on: caps.instantid },
      ]
    : [];

  return (
    <div className="grid gap-8">
      {caps ? (
        <section className="grid gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Identity capabilities</h3>
            <span className="text-muted-foreground text-xs">
              Recommended: <span className="font-mono">{caps.recommendedStrategy}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {techniques.map((t) => (
              <Badge key={t.id} variant={t.on ? "default" : "outline"}>
                {t.label}
                {t.on ? "" : " · off"}
              </Badge>
            ))}
            <Badge variant={caps.trainingAvailable ? "secondary" : "outline"}>
              {caps.trainingAvailable ? "Training available" : "Training unavailable"}
            </Badge>
          </div>
        </section>
      ) : null}
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Trained models</h3>
          <span className="text-muted-foreground text-xs">Versioned · never overwritten</span>
        </div>
        {models.length ? (
          <ul className="grid gap-2">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.label}</span>
                    <Badge variant="outline">{m.engine}</Badge>
                    <span className="text-muted-foreground">v{m.version}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {m.provider}
                    {m.triggerWord ? ` · trigger “${m.triggerWord}”` : ""} ·{" "}
                    {format(new Date(m.createdAt), "PP")}
                  </div>
                </div>
                <Badge variant="secondary">{m.status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Boxes}
            title="No trained models yet"
            description="Trained identity models (LoRA, adapters, …) will appear here, each as a new version. Training lands in a future milestone."
          />
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium">Training jobs</h3>
        {jobs.length ? (
          <ul className="grid gap-2">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{j.engine}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {j.provider} · dataset v{j.datasetVersion}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {format(new Date(j.createdAt), "PPp")}
                  </div>
                </div>
                <Badge variant="secondary">{j.status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Clock}
            title="No training jobs"
            description="Training runs will appear here with their status, cost, and duration once training is enabled."
          />
        )}
      </section>
    </div>
  );
}
