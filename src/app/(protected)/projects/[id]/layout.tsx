import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectLayout } from "@/components/shared/project-layout";

/**
 * Workspace layout — fetches the project once (owner-scoped) and renders the project
 * header + section tabs around whichever tab page is active.
 */
export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  return <ProjectLayout project={project}>{children}</ProjectLayout>;
}
