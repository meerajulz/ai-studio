import { isBlobConfigured } from "@/lib/blob/server";
import { UploadsView } from "@/components/upload/uploads-view";

export default async function ProjectUploadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UploadsView projectId={id} blobReady={isBlobConfigured()} />;
}
