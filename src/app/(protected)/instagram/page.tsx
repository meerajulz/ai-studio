import { PageContainer } from "@/components/shared/page-container";
import { InsightsView } from "@/components/instagram/insights-view";

export const metadata = {
  title: "Instagram insights",
};

export default function InstagramPage() {
  return (
    <PageContainer size="wide">
      <InsightsView />
    </PageContainer>
  );
}
