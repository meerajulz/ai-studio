# UI Design

> The visual contract for ai-studio. Every page/component must use these tokens and
> scales — never hard-coded colors, sizes, or radii. Tokens are defined in
> [`src/app/globals.css`](../src/app/globals.css) and consumed via Tailwind v4 + Base UI
> (shadcn `base-nova`).

## Principles

- **Calm, not cluttered** — the UI stays out of the way of the creative loop (see
  [VISION.md](./VISION.md)).
- **Token-driven** — use semantic tokens (`bg-background`, `text-muted-foreground`, …),
  not raw values. This keeps light/dark mode automatic.
- **Consistent building blocks** — compose pages from the shared components in
  [COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md).

## Colors (semantic tokens)

Palette is a **neutral OKLCH grayscale** with a red `destructive`. Use the semantic
role, not the literal color. Each has a paired `-foreground`.

| Token | Use |
| ----- | --- |
| `background` / `foreground` | Page base + primary text |
| `card` / `card-foreground` | Card surfaces |
| `popover` / `popover-foreground` | Menus, popovers, dialogs |
| `primary` / `primary-foreground` | Primary actions, emphasis |
| `secondary` / `secondary-foreground` | Secondary buttons/surfaces |
| `muted` / `muted-foreground` | Subtle backgrounds, secondary text |
| `accent` / `accent-foreground` | Hover/active surfaces |
| `destructive` | Errors, destructive actions |
| `border` · `input` · `ring` | Borders, form fields, focus rings |
| `sidebar*` | Sidebar surface, text, accents, border, ring |
| `chart-1..5` | Data viz |

- **Dark mode** is handled by the `.dark` class — never write dark-specific hex; the
  tokens flip automatically.
- Focus is always shown via `ring` (`focus-visible:ring-3 focus-visible:ring-ring/50`).

## Typography

- **Sans (default / headings):** `--font-sans` (Geist Sans) → `font-sans`
- **Mono:** `--font-mono` (Geist Mono) → `font-mono` (code, ids, tokens)

| Role | Classes |
| ---- | ------- |
| Page title (H1) | `text-xl font-semibold` |
| Section title (H2) | `text-sm font-medium` (see `SectionTitle`) |
| Body | `text-sm` |
| Secondary/help | `text-sm text-muted-foreground` |
| Meta/label | `text-xs text-muted-foreground` |

## Spacing

Tailwind's 4px scale. Defaults for consistency:

- **Page padding:** `p-6`
- **Section gap:** `gap-6` (vertical rhythm between blocks)
- **Card padding:** `p-4`
- **Form field gap:** `gap-2` (label → control), `gap-4` between fields
- **Inline gap:** `gap-1.5` / `gap-2`

## Radius

Base `--radius: 0.625rem`, with a scale: `rounded-sm` (×0.6) · `rounded-md` (×0.8) ·
`rounded-lg` (base) · `rounded-xl` · `rounded-2xl` …

- **Cards / inputs / buttons:** `rounded-lg`
- **Small controls (xs/sm):** `rounded-md`
- **Avatars / pills:** `rounded-full`

## Buttons

Use the `Button` component ([`ui/button.tsx`](../src/components/ui/button.tsx)).

- **Variants:** `default` (primary), `outline`, `secondary`, `ghost`, `destructive`, `link`
- **Sizes:** `xs` (h-6), `sm` (h-7), `default` (h-8), `lg` (h-9), and `icon` / `icon-xs` /
  `icon-sm` / `icon-lg`
- Icons: use `lucide-react`, auto-sized (`size-4` at default). Never set width/height inline.
- Show **loading** by disabling + swapping the label ("Signing in…"), matching the auth UI.

## Cards

Use the `Card` component; surface = `bg-card text-card-foreground border rounded-lg`,
padding `p-4`. Media cards use a fixed aspect ratio (see
[COMPONENT_GUIDELINES.md](./COMPONENT_GUIDELINES.md) — `MediaCard`).

## Animations

- **Library:** `tw-animate-css` for utility animations; **Framer Motion** for
  orchestrated/interactive motion.
- **Feel:** subtle and fast. Button press uses `active:translate-y-px`; transitions use
  `transition-all` / `transition-colors`.
- **Duration:** ~150–200ms for hovers/taps; keep entrance animations short and optional.
- **Respect** `prefers-reduced-motion` for any non-trivial motion.

## Do / Don't

- ✅ `className="text-muted-foreground"` · ❌ `style={{ color: "#888" }}`
- ✅ `rounded-lg` · ❌ `rounded-[10px]`
- ✅ `Button variant="destructive"` · ❌ a red `<button>`
- ✅ compose shared components · ❌ bespoke one-off layouts per page
