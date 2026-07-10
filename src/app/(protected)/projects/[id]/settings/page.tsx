import { SectionTitle } from "@/components/shared/section-title";

export default function ProjectSettingsPage() {
  return (
    <div className="grid gap-6">
      <SectionTitle
        title="Settings"
        description="Project preferences and defaults."
      />
      <div className="text-muted-foreground rounded-lg border p-6 text-sm">
        Project settings — including preferred models, default aspect ratio, and prompt
        templates — will live here.
      </div>
    </div>
  );
}
