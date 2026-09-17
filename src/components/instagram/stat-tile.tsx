import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: string;
  hint?: string;
  className?: string;
};

/**
 * Label · value · optional hint. No sparkline: where a metric has a shape worth seeing it
 * gets its own chart, and a tile repeating that shape would just be a smaller copy.
 */
export function StatTile({ label, value, hint, className }: StatTileProps) {
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "bg-card ring-foreground/10 grid gap-1 rounded-xl p-4 ring-1",
        className,
      )}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-2xl leading-none font-semibold">{value}</span>
      {hint ? (
        <span className="text-muted-foreground text-xs">{hint}</span>
      ) : null}
    </div>
  );
}
