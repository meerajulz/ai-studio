import {
  Wand2,
  Upload,
  Images,
  Video,
  ListChecks,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-muted-foreground text-xs">{label}</div>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  icon: Icon,
  title,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="text-muted-foreground size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">{empty}</CardContent>
    </Card>
  );
}

/** Project home — statistics + quick generate + recent activity (all empty for now). */
export function ProjectOverview() {
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Uploads" value="0" />
        <Stat label="Images" value="0" />
        <Stat label="Videos" value="0" />
        <Stat label="Jobs" value="0" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wand2 className="text-muted-foreground size-4" />
            Quick Generate
          </CardTitle>
          <CardDescription>
            Generate images and videos directly in this project. (Coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled>
            <Wand2 className="size-4" />
            Generate
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SectionCard icon={Upload} title="Recent Uploads" empty="No uploads yet." />
        <SectionCard icon={Images} title="Recent Images" empty="No images yet." />
        <SectionCard icon={Video} title="Recent Videos" empty="No videos yet." />
        <SectionCard icon={ListChecks} title="Current Jobs" empty="No active jobs." />
        <SectionCard
          icon={LayoutTemplate}
          title="Templates"
          empty="No templates yet."
        />
      </div>
    </div>
  );
}
