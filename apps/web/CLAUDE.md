# Frontend (apps/web)

Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui. See root `CLAUDE.md` for project overview.

## Structure

```
app/                  # Next.js App Router pages and layouts
components/ui/        # shadcn/ui base components (do not edit these manually)
components/           # Shared application components
features/             # Feature modules (tasks/, classes/, auth/)
  tasks/
    components/       # Task-specific components
    hooks/            # useTask, useTaskList, etc.
lib/
  api.ts              # Typed API client (wraps fetch, handles auth headers)
  utils.ts            # cn() and other utilities
```

## Rules

- Use shadcn/ui components as the base. Add via `npx shadcn@latest add <component>`.
- Tailwind only for styling. No CSS modules, no inline styles.
- Server Components by default. Add `'use client'` only when you need interactivity or browser APIs.
- All times stored in UTC. Display using `Intl.DateTimeFormat` with user's local timezone. Never hardcode a timezone.
- API calls go through `lib/api.ts`, never raw `fetch` in components.

## Views

The dashboard supports multiple views switchable by the user:
- List (default): tasks sorted by `dueAt`
- Board (kanban): columns are task status derived from `TaskUserState`
- Gantt: horizontal timeline, renders `blockedBy` dependency lines between tasks
- Calendar: tasks plotted on due date

## Color system

Each class has a `color` hex field. Use it for class label badges throughout the UI.
Support dark mode via Tailwind `dark:` variants. Use `next-themes` for theme toggling.