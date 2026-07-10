import { PageContainer } from "./page-container";
import { cn } from "@/lib/utils";

/** Workspace sections for a single project (see WORKSPACE.md). */
const SECTIONS = [
  "Overview",
  "Identities",
  "Uploads",
  "Generate",
  "Gallery",
  "Templates",
  "Settings",
] as const;

type ProjectLayoutProps = {
  project: { id: string; name: string; description: string | null };
  children: React.ReactNode;
};

/**
 * Layout for a single project workspace, nested inside the AppShell. Renders the
 * project header + section tabs, then the workspace content.
 *
 * NOTE: section tabs are placeholders for now — individual sub-routes are not built yet.
 */
export function ProjectLayout({ project, children }: ProjectLayoutProps) {
  return (
    <PageContainer>
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        {project.description ? (
          <p className="text-muted-foreground text-sm">{project.description}</p>
        ) : null}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {SECTIONS.map((section, i) => (
          <span
            key={section}
            aria-current={i === 0 ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
              i === 0
                ? "border-foreground font-medium"
                : "text-muted-foreground border-transparent",
            )}
          >
            {section}
          </span>
        ))}
      </div>

      {children}
    </PageContainer>
  );
}
