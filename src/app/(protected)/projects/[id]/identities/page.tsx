import { IdentitiesView } from "@/components/identity/identities-view";

export default async function ProjectIdentitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IdentitiesView projectId={id} />;
}
