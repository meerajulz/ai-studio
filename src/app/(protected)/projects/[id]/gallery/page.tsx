import { Images } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProjectGalleryPage() {
  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Gallery"
        description="Generated images and videos for this project."
      />
      <EmptyState
        icon={Images}
        title="No media yet"
        description="Generated media will appear here."
      />
    </div>
  );
}
