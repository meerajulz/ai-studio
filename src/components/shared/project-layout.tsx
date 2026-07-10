"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/providers/workspace-provider";
import { PageContainer } from "./page-container";

/** Workspace sections for a single project (see WORKSPACE.md / WORKSPACE_API.md). */
const TABS = [
  { label: "Overview", segment: "" },
  { label: "Uploads", segment: "uploads" },
  { label: "Gallery", segment: "gallery" },
  { label: "Identities", segment: "identities" },
  { label: "Templates", segment: "templates" },
  { label: "Jobs", segment: "jobs" },
  { label: "Settings", segment: "settings" },
] as const;

type ProjectLayoutProps = {
  project: { id: string; name: string; description: string | null };
  children: React.ReactNode;
};

/**
 * Layout for a single project workspace, nested inside the AppShell. Renders the project
 * header + tabbed section navigation, and publishes the active project to the workspace
 * context (so the breadcrumb shows the project name).
 */
export function ProjectLayout({ project, children }: ProjectLayoutProps) {
  const pathname = usePathname();
  const { setProject } = useWorkspace();
  const base = `/projects/${project.id}`;

  useEffect(() => {
    setProject({ id: project.id, name: project.name });
    return () => setProject(null);
  }, [project.id, project.name, setProject]);

  return (
    <PageContainer>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        {project.description ? (
          <p className="text-muted-foreground text-sm">{project.description}</p>
        ) : null}
      </div>

      <nav
        aria-label="Project sections"
        className="flex gap-1 overflow-x-auto border-b"
      >
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = tab.segment
            ? pathname.startsWith(href)
            : pathname === base;
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </PageContainer>
  );
}
