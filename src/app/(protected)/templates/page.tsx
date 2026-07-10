import { LayoutTemplate } from "lucide-react";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function TemplatesPage() {
  return (
    <PageContainer>
      <SectionTitle
        title="Templates"
        description="Reusable prompt and configuration presets."
      />
      <EmptyState
        icon={LayoutTemplate}
        title="No templates yet"
        description="Save prompt presets to reuse them across generations."
      />
    </PageContainer>
  );
}
