import { GalleryView } from "@/components/gallery/gallery-view";

export default async function ProjectGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GalleryView projectId={id} />;
}
