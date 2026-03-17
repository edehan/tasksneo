# Frontend (apps/web)

Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui. See root `CLAUDE.md` for the overall project overview.

## Core direction for this phase

This phase of development will use **shadcn/ui exclusively as the primary UI foundation**.

For **V1**, we will adopt the **default shadcn/ui visual style** as much as possible. Do not introduce extra visual systems, alternative component libraries, or unnecessary frontend abstractions. The goal of the first version is **consistency, speed, and low design risk**, not experimentation.

All user-facing frontend work should follow these principles:

- Use **shadcn/ui default style** for the first release.
- Use **shadcn/ui components and official patterns wherever possible**.
- Any frontend component should, as much as possible, be built from:
  - existing `shadcn/ui` components,
  - official shadcn/ui patterns,
  - or plugins/tools already commonly used with shadcn/ui.
- **Do not introduce additional UI libraries** unless there is a very strong reason and explicit approval.
- **Do not over-engineer styling or architecture** in V1.
- Prefer consistency over novelty. Do not “improve” the visual system by adding unrelated design ideas.

## Documentation and research expectations

During development, the frontend team should rely heavily on **shadcn/ui online documentation**.

When implementation details are unclear:

1. Check the **official shadcn/ui documentation first**.
2. Search the web for relevant examples and implementation discussions.
3. Reference:
   - community forums,
   - GitHub issues,
   - blog posts,
   - and other real-world codebases using shadcn/ui.

Official docs should be the first source of truth for component usage and styling patterns. Community sources may be used for implementation reference, but the resulting code should still remain aligned with our chosen shadcn/ui-first approach.

If shadcn/ui does not cover a necessary V1 interaction, the team may introduce the smallest possible supporting library only after documenting the reason, impact, and fallback plan.

## Product surfaces

The user-facing frontend is divided into three main surfaces:

### 1. `www.example.com`
This is the public-facing marketing and promotional site for the product.

- Intended for visitors who are not logged in
- Should be indexable and readable by search engines
- Used for product introduction, landing pages, and basic public information
- **Not the development priority for now**
- Keep implementation simple and lightweight in this phase

### 2. `app.example.com`
This is the main product application.

- Users log in here
- Users access the core product functionality here
- This is the **main focus of frontend development**
- Most UI/UX effort, component work, state handling, and API integration belong here

### 3. `app.example.com/admin`
This is the admin panel.

- Uses a separate route space
- Uses `admin_token` for authentication
- Pages can remain simple and utilitarian
- Reuse with the main application is expected to be limited
- Do not spend unnecessary effort trying to force heavy component sharing with the main user app
- The design goal of /admin is "high efficiency and low maintenance," not "high fidelity to the main site experience."

## Structure

```text
app/                  # Next.js App Router pages and layouts
components/ui/        # shadcn/ui base components (do not manually redesign for V1)
components/           # Shared application components
features/             # Feature modules (tasks/, classes/, auth/, etc.)
  tasks/
    components/       # Task-specific components
    hooks/            # useTask, useTaskList, etc.
lib/
  api.ts              # Typed API client (wraps fetch, handles auth headers)
  utils.ts            # cn() and other utilities
```

## Rules

* Use **shadcn/ui as the default and preferred base for all UI work**.
* Add components via:

  * `npx shadcn@latest add <component>`
* Prefer composition of existing shadcn/ui components over building custom UI from scratch.
* Avoid introducing unrelated third-party UI kits, styling systems, or component frameworks.
* Tailwind CSS only for styling.

  * No CSS modules
  * No inline styles
  * No ad hoc visual systems
* Server Components by default.

  * Add `'use client'` only when interactivity or browser APIs are required.
* API calls must go through `lib/api.ts`.

  * Never use raw `fetch` directly inside page or feature components.
* All times are stored in UTC.

  * Display times using `Intl.DateTimeFormat` with the user's stored `timezone` preference (from `UserProfile`).
  * When the browser timezone differs from the stored preference, prompt the user to update (bubble notification).
  * Never hardcode a timezone.

## Views

The dashboard supports multiple user-switchable views:

* **List** (default): tasks sorted by `dueAt`
* **Board** (kanban): columns based on task status derived from `TaskUserState`
* **Gantt**: horizontal timeline with `blockedBy` dependency lines
* **Calendar**: tasks plotted by due date

These views should still follow the same shadcn/ui-first approach. Build each view from existing primitives and keep styling consistent with the default system.

## Color system

Each class has a `color` hex field.

Use this value for class label badges and other appropriate class-related UI markers throughout the application.

For theming:

* Support dark mode using Tailwind `dark:` variants
* Use `next-themes` for theme toggling
* Support i18n design, no need to create a separate custom visual language for V1
* Stay as close as possible to the default shadcn/ui design language