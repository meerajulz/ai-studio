import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";

export default function SettingsPage() {
  return (
    <PageContainer size="sm">
      <SectionTitle
        title="Settings"
        description="Account and application preferences."
      />
      <div className="text-muted-foreground rounded-lg border p-6 text-sm">
        Settings are not available yet.
      </div>
    </PageContainer>
  );
}
