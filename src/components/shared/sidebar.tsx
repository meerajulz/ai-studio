"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The navigation list — reused by the desktop Sidebar and the mobile menu. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

/** Brand mark — links to the primary landing page (/projects). */
export function Logo() {
  return (
    <Link href="/projects" className="flex items-center gap-2 px-1 font-semibold">
      <Sparkles className="size-5 text-primary" />
      <span>AI Studio</span>
    </Link>
  );
}

/** Desktop sidebar (hidden on mobile; the Header provides a mobile menu). */
export function Sidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col gap-4 border-r p-3 md:flex">
      <SidebarNav />
    </aside>
  );
}
