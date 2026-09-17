# Instagram Insights

A read-only dashboard for your own Instagram account, at `/instagram`. It reads the
Instagram Graph API with a token you generate yourself; nothing goes to a third party.

## What Instagram does and doesn't record

**Instagram does not track profile visitors.** There is no "who viewed my profile" data for
any account type — not in the app, not in the Graph API, not in an undocumented endpoint.
Meta never records it, so there is nothing for any app to read. Every paid "profile
visitors" app is doing one of three things: relabelling recent likers and commenters as
"visitors", generating names outright, or phishing the login it asks you to type into it.

What Meta *does* measure, and what this dashboard shows:

| Shown | Meaning | Identities? |
|---|---|---|
| Profile views | Times your profile was opened | No — a count only |
| Accounts reached | Unique accounts that saw your content | No |
| Follower / non-follower reach | That reach split by follow status | No — counts only |
| Accounts engaged | Accounts that interacted | No |
| Per-post reach, likes, comments, saves | Post performance | No |

The one place Instagram *does* give you names is **Story viewers**, visible in the Story
itself for 24 hours. That is in the app, not in this dashboard, and it is not available
through the Graph API.

## Requirements

- A **Professional** account (Business or Creator), linked to a Facebook Page.
- A Meta app with the Instagram Graph API product.
- Scopes: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
  `pages_read_engagement`.

## Setup

1. **Instagram app** → Settings → Account type → switch to a Professional account, and link
   it to a Facebook Page.
2. **developers.facebook.com** → create an app (type: Business) → add the Instagram Graph
   API product.
3. **Graph API Explorer** → pick your app and Page → request the four scopes above →
   Generate Access Token.
4. Exchange the short-lived token for a **long-lived Page token** (valid 60 days):
   ```
   GET /oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &fb_exchange_token={short-lived-token}
   ```
   Put the result in `IG_ACCESS_TOKEN`.
5. Find the Instagram account id (it is not your @handle):
   ```
   GET /me/accounts                                          → the Page id
   GET /{page-id}?fields=instagram_business_account          → the IG account id
   ```
   Put that id in `IG_USER_ID`.

```env
IG_ACCESS_TOKEN="EAAG..."
IG_USER_ID="17841400000000000"
# IG_GRAPH_VERSION="v23.0"   # optional pin
```

The token expires after 60 days — regenerate it and update the env var. The dashboard shows
Meta's own error text when it lapses, so the failure is legible rather than mysterious.

## Architecture

| File | Role |
|---|---|
| `src/lib/instagram/client.ts` | The only file that knows the wire format. Holds the token; server-only. |
| `src/lib/instagram/insights.ts` | Queries → `InsightsSnapshot`. Handles both API response shapes. |
| `src/lib/instagram/types.ts` | Domain types. Note that none of them carries a viewer identity. |
| `src/actions/instagram.ts` | Session-guarded Server Actions — the authorization boundary. |
| `src/hooks/use-instagram.ts` | TanStack Query hooks. |
| `src/components/instagram/*` | Dashboard UI. |

### Two response shapes

Meta serves insights in two incompatible forms, and which metric uses which has moved
between API versions:

- **Time series** (`period=day`) — one value per day in one call. `reach` still serves this.
- **Total value** (`metric_type=total_value`) — one number for the whole window.
  `profile_views` and `accounts_engaged` moved here, so a daily series means one call per
  day (bounded with `p-limit`).

`fetchSeries` tries the cheap time-series form and falls back to the per-day loop when Meta
rejects it with error 100. That way a metric changing form in a future API version degrades
into more requests rather than an empty chart.

### Gaps, not zeros

A metric Meta refuses becomes a `MetricGap` carrying the reason, rendered in its own card.
A silent `0` would read as "nobody viewed you" when it actually means "no answer" — the
exact confusion the fake visitor apps trade on.

## Rate limits

Meta allows roughly 200 calls per user per hour. A 30-day snapshot costs about 45 calls
(30 daily profile-view calls + reach + breakdown + account + up to 12 per-post calls), so
refreshing a few times an hour is fine; a tight refresh loop is not. Server-side fetches
are cached for 5 minutes and the client query is stale after 10.
