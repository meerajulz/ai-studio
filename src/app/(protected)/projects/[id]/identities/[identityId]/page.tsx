import { IdentityDetailView } from "@/components/identity/identity-detail-view";

export default async function IdentityDetailPage({
  params,
}: {
  params: Promise<{ id: string; identityId: string }>;
}) {
  const { id, identityId } = await params;
  return <IdentityDetailView projectId={id} identityId={identityId} />;
}
