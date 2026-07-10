import { Images } from "lucide-react";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function GalleryPage() {
  return (
    <PageContainer>
      <SectionTitle
        title="Gallery"
        description="Generated and uploaded media across your projects."
      />
      <EmptyState
        icon={Images}
        title="No media yet"
        description="Generated images and videos will appear here."
      />
    </PageContainer>
  );
}
