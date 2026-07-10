import { Fingerprint } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProjectIdentitiesPage() {
  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Identities"
        description="Reusable identities and styles for consistent generation."
      />
      <EmptyState
        icon={Fingerprint}
        title="No identities yet"
        description="Create an identity to keep faces and styles consistent."
      />
    </div>
  );
}
