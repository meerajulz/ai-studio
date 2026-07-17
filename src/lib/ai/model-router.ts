/**
 * Model Router (Milestone 21) — choose the best MODEL for a request by CAPABILITY, never by a
 * hardcoded name. Sits beneath the provider router: the provider router picks WHO executes (Fal),
 * this picks WHICH model. Pure + deterministic.
 *
 *   Auto   → highest-priority enabled model whose capabilities satisfy the request's needs.
 *   Manual → a specific model id (benchmarking); falls back to Auto if invalid/disabled.
 */
import type { ProviderCapability } from "./capabilities";
import { MODEL_REGISTRY, type ModelSpec } from "./model-registry";

export type ModelMode = "auto" | "manual";

export type ModelRoutingCriteria = {
  provider: string;
  needs?: ProviderCapability[];
  mode?: ModelMode;
  manualModelId?: string;
};

export type ConsideredModel = {
  id: string;
  label: string;
  vendor: string;
  enabled: boolean;
  priority: number;
  capabilities: ProviderCapability[];
};

export type ModelRoutingDecision = {
  mode: ModelMode;
  chosen: string;
  label: string;
  vendor: string;
  reason: string;
  considered: ConsideredModel[];
};

const satisfies = (m: ModelSpec, needs: readonly ProviderCapability[]): boolean =>
  needs.every((c) => m.capabilities.includes(c));

const byPriority = (a: ModelSpec, b: ModelSpec) => b.priority - a.priority;

export function chooseModel(
  criteria: ModelRoutingCriteria,
  registry: ModelSpec[] = MODEL_REGISTRY,
): { model: ModelSpec; decision: ModelRoutingDecision } {
  const pool = registry.filter((m) => m.provider === criteria.provider);
  if (pool.length === 0) {
    throw new Error(`No models registered for provider "${criteria.provider}".`);
  }
  const considered: ConsideredModel[] = pool.map((m) => ({
    id: m.id,
    label: m.label,
    vendor: m.vendor,
    enabled: m.enabled,
    priority: m.priority,
    capabilities: m.capabilities,
  }));
  const needs = criteria.needs ?? [];
  const mode: ModelMode = criteria.mode ?? "auto";

  const decide = (model: ModelSpec, m: ModelMode, reason: string) => ({
    model,
    decision: { mode: m, chosen: model.id, label: model.label, vendor: model.vendor, reason, considered },
  });

  // Manual: honour an explicit, enabled model id (benchmarking); else fall through to Auto.
  if (mode === "manual" && criteria.manualModelId) {
    const picked = pool.find((m) => m.id === criteria.manualModelId && m.enabled);
    if (picked) return decide(picked, "manual", "manual selection (benchmark)");
  }

  // Auto: best capability match by priority.
  const eligible = pool.filter((m) => m.enabled && satisfies(m, needs)).sort(byPriority);
  if (eligible[0]) {
    return decide(
      eligible[0],
      "auto",
      needs.length ? `best capability match for [${needs.join(", ")}]` : "highest-priority model",
    );
  }

  // Fallback: the highest-priority enabled model (needs couldn't be fully met).
  const fallback = pool.filter((m) => m.enabled).sort(byPriority)[0];
  if (!fallback) throw new Error(`No enabled models for provider "${criteria.provider}".`);
  return decide(
    fallback,
    "auto",
    needs.length ? `no model satisfies [${needs.join(", ")}] — fell back to highest priority` : "highest-priority model",
  );
}
