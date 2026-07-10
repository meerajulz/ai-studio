"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Human labels for known route segments; unknown segments are title-cased. */
const LABELS: Record<string, string> = {
  projects: "Projects",
  gallery: "Gallery",
  uploads: "Uploads",
  templates: "Templates",
  settings: "Settings",
  dashboard: "Dashboard",
};

function labelFor(segment: string) {
  return LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

type Crumb = { label: string; href?: string };

/**
 * Breadcrumb for the current location. Derives crumbs from the pathname by default;
 * pass `items` to override (e.g. to show a project name instead of its id).
 */
export function Breadcrumb({
  items,
  className,
}: {
  items?: Crumb[];
  className?: string;
}) {
  const pathname = usePathname();

  const crumbs: Crumb[] =
    items ??
    pathname
      .split("/")
      .filter(Boolean)
      .map((segment, i, arr) => ({
        label: labelFor(segment),
        href: i < arr.length - 1 ? `/${arr.slice(0, i + 1).join("/")}` : undefined,
      }));

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
            ) : null}
            <li className="truncate">
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium">{crumb.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
