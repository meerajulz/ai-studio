import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  variant?: "list" | "grid" | "card";
  rows?: number;
  className?: string;
};

/** Skeleton placeholder while a collection loads (see COMPONENT_GUIDELINES.md). */
export function LoadingState({
  variant = "list",
  rows = 6,
  className,
}: LoadingStateProps) {
  const items = Array.from({ length: rows });

  if (variant === "grid" || variant === "card") {
    return (
      <div
        data-slot="loading-state"
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
          className,
        )}
      >
        {items.map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div data-slot="loading-state" className={cn("grid gap-3", className)}>
      {items.map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}
