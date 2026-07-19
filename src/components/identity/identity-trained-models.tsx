"use client";

import { format } from "date-fns";
import { Boxes, Clock } from "lucide-react";

import { useIdentityEngineOverview } from "@/hooks/use-identities";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";

type Props = { identityId: string };

/** User-oriented training lifecycle label + tone (distinct from provider job status). */
const TRAINING_STATE_LABEL: Record<string, string> = {
  NOT_READY: "Not ready to train",
  READY_TO_TRAIN: "Ready to train",
  TRAINING: "Training…",
  TRAINED: "Trained",
  OUTDATED: "Outdated — retrain suggested",
  ARCHIVED: "Archived",
};

/**
 * Trained Models + Training Jobs (Milestone 22/23) — READ-ONLY. Trained models are versioned and never
 * overwritten (LoRA v1, v2, …). The UI adapts off engine capabilities + the training lifecycle state —
 * no hardcoded "if a LoRA exists…" / "if Fal…". No functional Train button yet (executes in M24).
 */
export function IdentityTrainedModels({ identityId }: Props) {
  const { data, isLoading } = useIdentityEngineOverview(identityId);

  if (isLoading) return <LoadingState variant="list" rows={3} />;

  const models = data?.trainedModels ?? [];
  const jobs = data?.trainingJobs ?? [];
  const caps = data?.capabilities;
  const trainingState = data?.trainingState;

  const techniques: { id: string; label: string; on: boolean }[] = caps
    ? [
        { id: "reference", label: "Reference", on: caps.conditioning.reference },
        { id: "lora", label: "LoRA", on: caps.conditioning.lora },
        { id: "pulid", label: "PuLID", on: caps.conditioning.pulid },
        { id: "instantid", label: "InstantID", on: caps.conditioning.instantid },
      ]
    : [];

  return (
    <div className="grid gap-8">
      {caps ? (
        <section className="grid gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Identity capabilities</h3>
            <span className="text-muted-foreground text-xs">
              Recommended: <span className="font-mono">{caps.conditioning.recommendedStrategy}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {techniques.map((t) => (
              <Badge key={t.id} variant={t.on ? "default" : "outline"}>
                {t.label}
                {t.on ? "" : " · off"}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {trainingState ? (
              <Badge variant="secondary">{TRAINING_STATE_LABEL[trainingState] ?? trainingState}</Badge>
            ) : null}
            <span className="text-muted-foreground text-xs">
              {caps.training.available && caps.training.providers.length
                ? `Training available via: ${caps.training.providers.join(", ")}`
                : "Training unavailable"}
            </span>
            {caps.training.available ? (
              <Badge variant="outline" className="ml-auto">
                Train — available in M24
              </Badge>
            ) : null}
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
