import { cn } from "@/lib/utils";

type IdentityAvatarProps = {
  name: string;
  heroImageUrl: string | null;
  className?: string;
};

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return letters.toUpperCase() || "?";
}

/** The identity's Hero Image (signed URL) with an initials fallback. Size via `className`. */
export function IdentityAvatar({
  name,
  heroImageUrl,
  className,
}: IdentityAvatarProps) {
  return (
    <div
      className={cn(
        "bg-muted text-muted-foreground relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
    >
      {heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImageUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-sm font-medium">{initials(name)}</span>
      )}
    </div>
  );
}
