import { ListChecks } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProjectJobsPage() {
  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Jobs"
        description="Background generation jobs and their progress."
      />
      <EmptyState
        icon={ListChecks}
        title="No jobs yet"
        description="Generation jobs will show their status and progress here."
      />
    </div>
  );
}
