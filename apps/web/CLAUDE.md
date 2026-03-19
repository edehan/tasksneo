# Frontend (apps/web)

Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui. See root `CLAUDE.md` for the overall project overview.

## Design philosophy

**Calm productivity · Warm functionalism**

1. **Clarity over flair** — function first, decoration second.
2. **One primary action per context** — never more than one Primary button on screen.
3. **Progressive disclosure** — complex info unfolds on demand, not all at once.
4. **Warm neutrality** — restrained color; texture comes from spacing and typography, not saturation.
5. **Consistency over novelty** — no per-page inventions; reuse existing patterns.

Reference points: Notion's quietness and document-centric feel, but with stronger typing around the task→submission→feedback workflow. Avoid Notion's "everything app" clutter.

## Visual system

### Color

All colors are defined as CSS custom properties in `globals.css` using oklch.

- **Neutrals**: `stone` series (warm undertone, "paper" feel). No pure black (`#000`) text — use `foreground` token.
- **Accent**: dynamically set per class via `--class-accent`. Used **only** for: interactive buttons, links, focus rings, selected state. Never large-area fills.
- **Semantic**: `--status-success`, `--status-warning`, `--status-error`, `--status-info` — low saturation, office-tool feel.
- **Dark mode**: Tailwind `dark:` variants, toggled via `next-themes`.

Class color theming: when a user navigates into a class context, the app sets `--class-accent` to that class's `color` hex. This makes the accent color shift per-class — an intentional branding choice.

Preset class palette:
```
#6366f1 indigo (default)  #0ea5e9 sky     #10b981 emerald
#f59e0b amber             #ec4899 pink    #8b5cf6 violet
#14b8a6 teal              #f97316 orange
```

### Typography

Fonts loaded via Google Fonts import in `globals.css`:

| Role | Family | Fallback |
|---|---|---|
| UI text | Inter | PingFang SC, Noto Sans SC, system-ui |
| Code / mono | JetBrains Mono | ui-monospace, monospace |

Type scale (all `rem`, base 16px):

| Token | Size | Weight | Use |
|---|---|---|---|
| display | 1.875rem | 600 | Page titles |
| heading-lg | 1.5rem | 600 | Section headings |
| heading-md | 1.125rem | 500 | Card titles, sidebar groups |
| heading-sm | 0.875rem | 500 | Table headers, label groups |
| body | 0.875rem | 400 | Default text, list items |
| body-sm | 0.8125rem | 400 | Timestamps, helper text |
| label | 0.75rem | 500 | Badges, status tags |
| mono | 0.8125rem | 400 | Code, filenames, invite codes |

### Spacing

Base unit: 4px. All spacing multiples of 4.

Key values: `space-2` (8px) button padding · `space-4` (16px) card padding, form gap · `space-6` (24px) card-to-card gap · `space-8` (32px) page section gap.

### Radius

`--radius: 0.5rem` (8px) is the base. shadcn derives `radius-sm/md/lg/xl` from it.

- Inputs, small badges: `radius-sm` (4px)
- Cards, buttons, dropdowns: `radius-md` (6px)
- Modals, drawers: `radius-lg` (8px)
- Avatars, pills: `rounded-full`

### Shadow

Minimal — only for elevation, never decoration.

- `shadow-sm`: `0 1px 2px rgba(0,0,0,0.05)` — card rest state
- `shadow-md`: `0 4px 6px -1px rgba(0,0,0,0.07)` — card hover, dropdown
- `shadow-lg`: `0 10px 15px -3px rgba(0,0,0,0.08)` — modal, floating layer

### Icons

`lucide-react` exclusively. No mixing icon libraries.

## Component guidelines

### Button

| Variant | Use | Constraint |
|---|---|---|
| Primary | Main action (submit, publish, save) | Max 1 per screen context |
| Secondary | Cancel, back, secondary confirm | — |
| Ghost | Toolbar, inline actions | — |
| Destructive | Delete, remove, deactivate | Must have confirmation step |

### Card / Panel

- Background: `card` token. Border: `border` 1px. Radius: `radius-md`.
- Padding: 16px. Hover: shadow `sm→md`, 150ms ease.

### Badge / Status

Task status badges (derived from `TaskUserState`):

| State | Style |
|---|---|
| Unread | `stone-200` bg / `stone-600` text |
| Read | `blue-50` bg / `blue-700` text |
| Submitted | `green-50` bg / `green-700` text |

Role badges: OWNER / ADMIN / MEMBER — muted style.

### Sidebar

- Width: 240px fixed; mobile: sheet/drawer.
- Class items: 4px left border in class color, hover `bg-subtle`.
- Active state: `--action-selected-bg` / `--action-selected-text`.

### Data lists

- Row height: 48px (standard), 32px (compact).
- Hover: `bg-subtle` 150ms. Selected: `--action-selected-bg`.
- Dividers: `border-subtle` 1px.

### Input / Form

- Border: `border` 1px. Focus: `ring` 2px, no glow.
- Error: `status-error` border + red helper text below.
- Label above input, `body-sm`, `muted-foreground`.
- Field gap: 16px vertical.

## Page layout

```
┌──────────┬─────────────────────────────────────┐
│ Sidebar  │ Header (breadcrumb)                           │
│ 240px    ├─────────────────────────────────────┤
│          │ Content area                        │
│          │ centered, max-width varies           │
└──────────┴─────────────────────────────────────┘
```

Content max-widths:
- List pages: 960px
- Detail pages (task, submission): 720px
- Settings: 640px
- Full-width (Gantt): unconstrained

## Structure

```text
app/                  # Next.js App Router pages and layouts
  (auth)/             # Unauthenticated routes (login, register)
  (app)/              # Authenticated routes (sidebar + header shell)
components/ui/        # shadcn/ui base components (do not redesign in V1)
components/           # Shared application components
features/             # Feature modules (tasks/, classes/, auth/, etc.)
  tasks/
    components/       # Task-specific components
    hooks/            # useTask, useTaskList, etc.
lib/
  api.ts              # Typed API client (wraps fetch, handles auth headers)
  utils.ts            # cn() and other utilities
docs/ux/              # User journey / interaction flow documents (markdown)
```

## Product surfaces

### `app.example.com` — Main application

Primary development focus. Users log in, manage classes, view/submit tasks.

### `app.example.com/admin` — Admin panel

Separate route space, `admin_token` auth. Keep utilitarian — no need to match main app polish. Goal: high efficiency, low maintenance.

### `www.example.com` — Marketing site

Not a priority for V1. Keep simple and lightweight.

## Rules

### shadcn/ui first

- Use shadcn/ui as the default foundation for all UI.
- Add components via `npx shadcn@latest add <component>`.
- Compose existing shadcn/ui primitives before building custom UI.
- Do not introduce other UI libraries without explicit approval and a documented reason.
- When unclear, check **shadcn/ui official docs first**, then community examples.

### Styling

- Tailwind CSS only. No CSS modules, no inline styles.
- Reference CSS custom properties from `globals.css` (via Tailwind theme tokens), never raw Tailwind color classes like `stone-500` directly.
- Support dark mode via `dark:` variants + `next-themes`.

### Components

- Server Components by default. Add `'use client'` only when interactivity or browser APIs are needed.
- API calls go through `lib/api.ts`. Never raw `fetch` in page/feature components.

### Time handling

- All times stored UTC. Display via `Intl.DateTimeFormat` with user's stored `timezone`.
- When browser timezone ≠ stored preference, prompt user to update (toast notification).
- Never hardcode a timezone.

## Views

The dashboard supports user-switchable views:

- **List** (default): tasks sorted by `dueAt`
- **Board** (kanban): columns by task status from `TaskUserState`
- **Gantt**: horizontal timeline with `blockedBy` dependency lines
- **Calendar**: tasks plotted by due date

All views follow the same shadcn/ui-first approach and design system.

## Prohibitions

- Large-area high-saturation fills (accent color ≤ 10% visible area)
- Heavy gradients (gradient only for loading skeletons)
- More than 3 levels of nested shadows
- More than 1 Primary button per screen context
- Mixing icon libraries (lucide-react only)
- Pure black (`#000000`) text
- Interactive elements without focus styles (a11y requirement)
