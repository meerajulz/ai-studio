import { isImageProviderConfigured } from "@/lib/ai";
import { isBlobConfigured } from "@/lib/blob/server";
import { GenerateView } from "@/components/generate/generate-view";

export default async function ProjectGeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const providerReady = isImageProviderConfigured() && isBlobConfigured();
  return <GenerateView projectId={id} providerReady={providerReady} />;
}
