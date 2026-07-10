"use client";

import { useState } from "react";
import { Menu, Search } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "./breadcrumb";
import { Logo, SidebarNav } from "./sidebar";
import { UserNav } from "./user-nav";

export function Header({ user }: { user: { name: string; email: string } }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4">
      {/* Mobile navigation */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          aria-label="Open navigation"
          className="hover:bg-muted inline-flex size-8 shrink-0 items-center justify-center rounded-lg md:hidden"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-3">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </SheetHeader>
          <div className="mb-4 flex h-9 items-center">
            <Logo />
          </div>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Logo */}
      <div className="shrink-0">
        <Logo />
      </div>

      {/* Location (desktop) — also acts as the spacer on mobile */}
      <div className="min-w-0 flex-1">
        <Breadcrumb className="hidden md:block" />
      </div>

      {/* Search (placeholder — not wired up yet) */}
      <div className="relative hidden w-full max-w-xs sm:block">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          readOnly
          placeholder="Search…"
          aria-label="Search (coming soon)"
          className="cursor-default pl-8"
        />
      </div>

      <UserNav name={user.name} email={user.email} />
    </header>
  );
}
