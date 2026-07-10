# Navigation

> The route map and access rules for ai-studio. Guards are enforced **server-side** in
> each route (see [DECISIONS.md](./DECISIONS.md) #014), not client-only.

## Route map

### Public (unauthenticated)

| Route | Page | Notes |
| ----- | ---- | ----- |
| `/` | Landing / redirect | Redirects to `/dashboard` if authed, else `/login` |
| `/login` | Sign in | Redirects to `/dashboard` if already authed |
| `/register` | Create account | Redirects to `/dashboard` if already authed |

### Protected (authenticated)

Redirect to `/login` if there is no session.

| Route | Page | Purpose |
| ----- | ---- | ------- |
| `/dashboard` | Dashboard | Overview / entry point (temp user menu today) |
| `/projects` | Projects | List of the user's projects |
| `/projects/[id]` | Project | A single project's workspace |
| `/gallery` | Gallery | All generated + uploaded media |
| `/uploads` | Uploads | Upload + manage reference media |
| `/templates` | Templates | Reusable prompt/config presets |
| `/settings` | Settings | Account & preferences |

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

Protected routes share an app shell:

```
┌───────────────────────────────────────────┐
│ Header  (logo · page title · UserMenu)     │
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

- **Sidebar** = primary nav for protected area (Projects, Gallery, Uploads, Templates,
  Settings). Active item reflects the current route.
- **Header** = branding, current page title, and the user menu / sign-out.
- Public routes (login/register) use a **centered, sidebar-less** layout.

See [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md) for `Sidebar`, `Header`,
`PageContainer`.

## Primary flows

```
/register → /dashboard → /projects → /projects/[id] → (upload → generate) → /gallery
/login → /dashboard
Sign out → /login
```
