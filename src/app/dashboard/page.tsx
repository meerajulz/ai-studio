import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground text-sm">
        Authentication verified. Temporary user menu:
      </p>
      <UserMenu name={session.user.name} email={session.user.email} />
    </main>
  );
}
