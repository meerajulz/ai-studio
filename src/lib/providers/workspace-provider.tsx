"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Workspace context — the "current project" a user is working inside.
 *
 * This is the business concept of a workspace: components under the shell can ask for the
 * active project without prop-drilling. Today it powers the breadcrumb (showing the
 * project name instead of its id). Later it can expose the project's defaults (preferred
 * models, aspect ratio, templates — see DECISIONS #017 / WORKSPACE.md).
 */
type WorkspaceProject = { id: string; name: string } | null;

type WorkspaceContextValue = {
  project: WorkspaceProject;
  setProject: (project: WorkspaceProject) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<WorkspaceProject>(null);
  const value = useMemo(() => ({ project, setProject }), [project]);
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Safe accessor — returns a no-op default when used outside a provider. */
export function useWorkspace(): WorkspaceContextValue {
  return useContext(WorkspaceContext) ?? { project: null, setProject: () => {} };
}
