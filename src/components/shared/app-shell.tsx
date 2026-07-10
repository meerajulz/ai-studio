import { WorkspaceProvider } from "@/lib/providers/workspace-provider";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  user: { name: string; email: string };
  children: React.ReactNode;
};

/**
 * Root layout for authenticated pages (see NAVIGATION.md / COMPONENT_GUIDELINES.md).
 * Renders the Sidebar (desktop) + Header (with mobile menu) around the page content.
 * The session guard lives in `app/(protected)/layout.tsx`, which renders this shell.
 */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <WorkspaceProvider>
      <div className="flex min-h-svh flex-col">
        <Header user={user} />
        <div className="flex flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
