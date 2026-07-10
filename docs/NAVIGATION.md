# Navigation

> The route map and access rules for ai-studio. Guards are enforced **server-side** in
> each route (see [DECISIONS.md](./DECISIONS.md) #014), not client-only.

## Route map

### Public (unauthenticated)

| Route | Page | Notes |
| ----- | ---- | ----- |
| `/` | Landing / redirect | Redirects authed users to the landing page (see below), else `/login` |
| `/login` | Sign in | Redirects authed users to the landing page |
| `/register` | Create account | Redirects authed users to the landing page |

### Protected (authenticated)

Redirect to `/login` if there is no session.

| Route | Page | Purpose |
| ----- | ---- | ------- |
| `/projects` | Projects | **Primary authenticated landing page** — list of the user's projects |
| `/projects/[id]` | Project | A single project's workspace (see [WORKSPACE.md](./WORKSPACE.md)) |
| `/gallery` | Gallery | All generated + uploaded media |
| `/uploads` | Uploads | Upload + manage reference media |
| `/templates` | Templates | Reusable prompt/config presets |
| `/settings` | Settings | Account & preferences |
| `/dashboard` | Dashboard (temporary) | Kept only for auth verification (temp user menu). Not the long-term landing page. |

### Authenticated landing page (today → later)

We keep `/dashboard` for now so the already-verified auth flow doesn't break, then switch
the landing target to `/projects` once Projects is built:

```
Today                         Later
-----                         -----
Login                         Login
  ↓                             ↓
Dashboard (temp)              Projects
  ↓                             ↓
Projects                      Project Workspace
```

- **Now (implemented):** `/`, `/login`, and `/register` redirect authenticated users to
  **`/projects`** — the primary landing page.
- `/dashboard` remains reachable inside the shell for **auth verification only**, until removed.

## Access rules

Every protected page runs, at the top of the server component:

```ts
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");
```

Auth pages (`/login`, `/register`) do the inverse (`if (session) redirect("/dashboard")`).

> Future: consider a shared **route-group layout guard** (`app/(protected)/layout.tsx`)
> so the check lives in one place instead of every page (noted in DECISIONS #014).

## Layout structure

Protected routes are wrapped by **`AppShell`** — the root layout component for all
authenticated pages (`app/(protected)/layout.tsx`). It provides the Sidebar, Header,
Breadcrumb, and content area:

```
AppShell
┌───────────────────────────────────────────┐
│ Header (Logo · Breadcrumb · Search · User) │
├──────────┬────────────────────────────────┤
│ Sidebar  │ PageContainer                   │
│          │   SectionTitle                  │
│ Projects │   …page content…                │
│ Gallery  │                                 │
│ Uploads  │                                 │
│ Templates│                                 │
│ Settings │                                 │
└──────────┴────────────────────────────────┘
```

- **`AppShell`** = the authenticated root layout; runs the session guard once and renders
  Sidebar + Header + Breadcrumb around `{children}`.
- **Sidebar** = primary nav (Projects, Gallery, Uploads, Templates, Settings). Active
  item reflects the current route.
- **Header** = full-width top bar: `Logo`, `Breadcrumb` (current location), a placeholder
  `Search`, and the `UserNav` (avatar → name/email/sign out). On mobile it also holds the
  menu button that opens the Sidebar in a sheet.
- **Breadcrumb** = shows the path, e.g. `Projects / Summer Campaign / Gallery`.
- Project workspaces additionally use **`ProjectLayout`** inside `AppShell`
  (see [WORKSPACE.md](./WORKSPACE.md)).
- Public routes (login/register) use a **centered, shell-less** layout.

See [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md) for `AppShell`, `Sidebar`,
`Header`, `Breadcrumb`, `PageContainer`, `ProjectLayout`.

## Primary flows

```
/register → /dashboard → /projects → /projects/[id] → (upload → generate) → /gallery
/login → /dashboard
Sign out → /login
```
