import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/shared/app-shell";

/**
 * Shared layout for all authenticated pages. The session guard is centralized here,
 * so individual pages don't repeat it. Pages that need user data can still call
 * `auth.api.getSession(...)` for that data.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell user={{ name: session.user.name, email: session.user.email }}>
      {children}
    </AppShell>
  );
}
