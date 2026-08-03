"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { useIdentityPackageInspection } from "@/hooks/use-identities";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/loading-state";
import { cn } from "@/lib/utils";

/** Anchor-role glyphs (mirrors the package panel). */
const ROLE_EMOJI: Record<string, string> = {
  face: "👤",
  body: "💪",
  tattoo: "🖋",
  hair: "💇",
  canonical: "⭐",
  pose: "🧍",
};

/**
 * Identity Package Inspector (Milestone 27 Phase 2) — the debuggable view of the package builder. For
 * every anchor role it shows all candidates ranked by fitness, with ✓ the chosen one and the reason each
 * other lost. Answers "why did this image win / lose a role?". Lazy: only scores candidates when opened.
 */
export function IdentityPackageInspector({ identityId }: { identityId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useIdentityPackageInspection(identityId, open);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="text-sm font-medium">
          Package Inspector
          <span className="text-muted-foreground ml-2 font-normal">why each image won or lost every role</span>
        </span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>

      {open ? (
        <div className="border-t p-3">
          {isLoading || !data ? (
            <LoadingState variant="list" rows={3} />
          ) : data.analyzedCount === 0 ? (
            <p className="text-muted-foreground text-sm">No analyzed images yet — run “Analyze library”.</p>
          ) : (
            <div className="grid gap-4">
              {data.stale ? (
                <Badge variant="secondary" className="w-fit text-[10px]">
                  persisted package built from {data.persistedAnalyzedCount} · now {data.analyzedCount} analyzed —
                  re‑analyze to refresh
                </Badge>
              ) : null}

              {data.explanation.roles.map((role) => {
                const chosen = role.candidates.find((c) => c.chosen);
                return (
                  <div key={role.role} className="grid gap-1.5">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <span>
                        {ROLE_EMOJI[role.role] ?? "•"} {role.role}
                      </span>
                      <span className="text-muted-foreground font-normal">
                        {chosen ? `→ ${Math.round(chosen.fitness)}` : "— no anchor"}
                      </span>
                    </div>
                    {role.candidates.map((c) => (
                      <div
                        key={c.mediaId}
                        className={cn(
                          "flex items-center gap-2 rounded border p-1.5",
                          c.chosen && "border-emerald-500/50 bg-emerald-500/5",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.url} alt="" className="size-9 shrink-0 rounded object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <div
                              className={cn("h-full rounded-full", c.chosen ? "bg-emerald-500" : "bg-foreground/40")}
                              style={{ width: `${Math.max(2, Math.round(c.fitness))}%` }}
                            />
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-[10px]">{c.reasons.join(" · ")}</p>
                        </div>
                        <div className="w-28 shrink-0 text-right">
                          <span className="font-mono text-[11px] tabular-nums">{Math.round(c.fitness)}</span>
                          <p
                            className={cn(
                              "text-[10px]",
                              c.chosen ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                            )}
                          >
                            {c.chosen ? "✓ chosen" : c.rejection}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
