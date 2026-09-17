import { Camera } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = [
  "Instagram app → Settings → Account type → switch to a Professional account (Business or Creator), and link it to a Facebook Page.",
  "developers.facebook.com → create an app (type: Business) → add the Instagram Graph API product.",
  "Graph API Explorer → select your app and Page → request instagram_basic, instagram_manage_insights, pages_show_list and pages_read_engagement → generate a token.",
  "Exchange it for a long-lived Page token (60 days), then copy it into IG_ACCESS_TOKEN.",
  "Call /me/accounts → pick the Page → GET /{page-id}?fields=instagram_business_account to read the Instagram account id → copy it into IG_USER_ID.",
];

/** Shown instead of the dashboard when the Graph API credentials aren't set yet. */
export function InstagramSetupCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="size-4" aria-hidden />
          Connect your Instagram account
        </CardTitle>
        <CardDescription>
          Insights come from the Instagram Graph API, which needs a token for
          your own account. Nothing here is shared with a third-party service.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol className="text-muted-foreground grid list-decimal gap-2 pl-5 text-sm">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
          <code>{`IG_ACCESS_TOKEN="EAAG..."\nIG_USER_ID="1784..."`}</code>
        </pre>
        <p className="text-muted-foreground text-xs">
          Full walkthrough in <code>docs/INSTAGRAM_INSIGHTS.md</code>.
        </p>
      </CardContent>
    </Card>
  );
}
