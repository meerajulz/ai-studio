import { LayoutTemplate } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProjectTemplatesPage() {
  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Templates"
        description="Reusable prompt and configuration presets for this project."
      />
      <EmptyState
        icon={LayoutTemplate}
        title="No templates yet"
        description="Save prompt presets to reuse them across generations."
      />
    </div>
  );
}
