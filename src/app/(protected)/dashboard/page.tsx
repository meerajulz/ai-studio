import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";

/**
 * Temporary page — kept only to verify authentication. The primary authenticated
 * landing page is Projects (see NAVIGATION.md). The layout guards access; we read the
 * session here only to display the current user.
 */
export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <PageContainer size="sm">
      <SectionTitle
        title="Dashboard (temporary)"
        description="Kept only for auth verification. The primary landing page is Projects."
      />
      <div className="grid max-w-sm gap-2 rounded-lg border p-4 text-sm">
        <div>
          <span className="text-muted-foreground">Name:</span>{" "}
          {session?.user.name}
        </div>
        <div>
          <span className="text-muted-foreground">Email:</span>{" "}
          {session?.user.email}
        </div>
      </div>
    </PageContainer>
  );
}
