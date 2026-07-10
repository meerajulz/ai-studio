import { cn } from "@/lib/utils";

type PageContainerProps = React.ComponentProps<"div"> & {
  size?: "sm" | "default" | "wide";
};

const SIZES = {
  sm: "max-w-2xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const;

/** Consistent width + padding wrapper for page content. */
export function PageContainer({
  className,
  size = "default",
  ...props
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto flex w-full flex-col gap-6 p-6",
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
