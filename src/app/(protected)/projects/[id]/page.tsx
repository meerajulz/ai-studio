import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FolderOpen } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectLayout } from "@/components/shared/project-layout";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The protected layout guards auth; we read the session to scope the query.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    notFound();
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, name: true, description: true },
  });
  if (!project) {
    notFound();
  }

  return (
    <ProjectLayout project={project}>
      <EmptyState
        icon={FolderOpen}
        title="Workspace coming soon"
        description="Identities, uploads, generation, and this project's gallery will live here."
      />
    </ProjectLayout>
  );
}
