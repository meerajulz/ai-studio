import { Upload } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProjectUploadsPage() {
  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Uploads"
        description="Reference media used as input for this project."
      />
      <EmptyState
        icon={Upload}
        title="No uploads yet"
        description="Uploading arrives with storage integration."
      />
    </div>
  );
}
