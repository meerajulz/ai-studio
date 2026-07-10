import { Upload } from "lucide-react";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function UploadsPage() {
  return (
    <PageContainer>
      <SectionTitle
        title="Uploads"
        description="Reference media used as input for generation."
      />
      <EmptyState
        icon={Upload}
        title="No uploads yet"
        description="Uploading is not available yet — coming with storage integration."
      />
    </PageContainer>
  );
}
