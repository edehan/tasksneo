# Frontend (apps/web)

Next.js 14 App Router + TypeScript + Tailwind CSS 4 + shadcn/ui. See root `CLAUDE.md` for the overall project overview.

## Design philosophy

**Warm paper aesthetic · Calm productivity**

Reference: `docs/prototype/` contains the designer's prototype (app.tsx + screenshots). All implementation must match the prototype's visual system as closely as possible.

1. **Paper-like warmth** — warm neutral backgrounds (#faf7f2 light, #1a1816 dark), no pure whites or blacks.
2. **Serif + Sans pairing** — Source Serif 4 for headings and display numbers, DM Sans for all functional text.
3. **Class accent theming** — a single `--class-accent` CSS variable shifts the entire accent color per class context.
4. **Restraint in motion** — only overlay fades, sidebar slide-in, hover transitions, Gantt bar scale-on-hover. No entrance animations, no bouncing, no parallax.
5. **Flat information architecture** — one top-level view state (which class context), modals/overlays for details.

## Visual system

### Color

All colors defined as hex CSS custom properties in `globals.css`.

- **Backgrounds**: `--background` (#faf7f2) for page, `--card` (#fffdf8) for elevated surfaces, `--surface-subtle` (#f9f6f0) for hover states
- **Text**: `--foreground` (#2c2825) primary, `--muted-foreground` (#8a8078) secondary, `--text-muted-soft` (#c0b8ad) tertiary
- **Borders**: `--border` (#e8e2d8), consistent warm tone
- **Destructive**: `--destructive` (#c45c5c) for errors and delete actions
- **Dark mode**: each color has an intentional dark counterpart, not inverted. `.dark` class via `next-themes`.

Class accent preset palette:
```
#5B8C6A green    #7B6CB0 violet (default)  #C4785B terracotta
#5886A5 steel    #8B7355 bronze            #B07090 rose
```

### Typography

| Role | Family | Weights | Use |
|---|---|---|---|
| Headings / display | Source Serif 4 | 400, 600, 700 | Page titles, section headings, stat numbers |
| UI / body | DM Sans | 400, 500, 600, 700 | All functional text, buttons, labels, lists |
| Code / mono | JetBrains Mono | 400, 500 | Code blocks, invite codes, filenames |

Utility classes in `globals.css`:
- `.text-display` — 1.875rem serif 700 (page titles)
- `.text-heading-lg` — 1.5rem serif 700 (section headings)
- `.text-heading-md` — 1.125rem serif 600 (card titles)
- `.text-label-upper` — 0.625rem uppercase tracking-wide (tiny labels)

### Spacing, radius, shadow

Same as shadcn/ui defaults. Base `--radius: 0.5rem` (8px). Minimal shadows — only for elevation.

### Icons

`lucide-react` exclusively.

## Structure

```text
app/
  (auth)/             # Unauthenticated routes (login, register)
  (app)/              # Authenticated routes (sidebar + header shell)
    dashboard/        # Homepage with all-class task views
    classes/[classId]/ # Class-scoped pages
    settings/         # User settings
  admin/              # Admin panel (standalone, not redesigned)
components/ui/        # shadcn/ui base components (do not redesign)
components/           # Shared application components (sidebar, header, dialogs)
features/             # Feature modules
  dashboard/          # Homepage components (stat-cards, filter-bar)
  tasks/              # Task views (gantt, list), task detail overlay, post-task
  classes/            # Class page, settings, members
  editor/             # Markdown editor, toolbar, preview
  submissions/        # Submission list, detail, grading
  settings/           # User profile, notifications, account
lib/
  api.ts              # Typed API client (stable, do not modify without reason)
  utils.ts            # cn() utility
hooks/                # Custom hooks (use-mobile, use-class-accent)
```

## Rules

### shadcn/ui + Tailwind only
- shadcn/ui as behavioral primitives (Dialog, DropdownMenu, ScrollArea, etc.)
- Tailwind CSS classes for all styling. No CSS modules, no inline styles.
- Do not introduce other UI libraries.

### Fonts
- Use `font-serif` class (or `.text-display` / `.text-heading-lg` / `.text-heading-md`) for headings.
- Default `font-sans` (DM Sans) for everything else.
- Never mix fonts within the same text element.

### Components
- Server Components by default. Add `'use client'` only when needed.
- API calls go through `lib/api.ts`.

### Dark mode
- Support via `dark:` variants + `next-themes`.
- Every color must have an intentional dark counterpart (not just inverted).

### Admin panel
- Separate route space (`/admin`), `admin_token` auth.
- Not subject to this design system — keep utilitarian.
