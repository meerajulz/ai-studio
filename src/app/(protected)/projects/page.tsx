import { Folders } from "lucide-react";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <PageContainer>
      <SectionTitle
        title="Projects"
        description="Your workspaces for identity-based image and video generation."
        action={<Button disabled>New project</Button>}
      />
      <EmptyState
        icon={Folders}
        title="No projects yet"
        description="Create your first project to organize identities, uploads, and generations."
        action={
          <Button variant="outline" disabled>
            New project
          </Button>
        }
      />
    </PageContainer>
  );
}
