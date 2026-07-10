import { cn } from "@/lib/utils";

type SectionTitleProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/** Consistent section heading (H2) with optional description + right-aligned action. */
export function SectionTitle({
  title,
  description,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4", className)}
      data-slot="section-title"
    >
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
