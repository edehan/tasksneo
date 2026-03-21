# Frontend (apps/web) — Designer-First Contract

This file replaces the previous frontend plan.

## Source Of Truth (strict order)

1. `docs/prototype/app.tsx` and images in `docs/prototype/*.png`
2. `docs/ux/*.md` for flows not visible in the prototype
3. Existing API contracts in `apps/web/src/lib/api.ts`

If there is a conflict:
- For UI that already exists in the prototype, prototype wins.
- For missing features, follow UX docs while keeping prototype visual language.

## Product Goal

Rebuild the frontend to match the designer prototype as closely as possible, while completing missing UX-documented flows with minimal extra complexity.

## Delivery Constraints

- Do not spend time evaluating/switching component libraries unless blocked.
- Do not introduce new UI frameworks without explicit approval.
- Keep implementation concise and practical.
- Prefer extending existing `features/designer/*` code paths over creating parallel systems.

## Current Stack Policy

- Keep Next.js App Router for now.
- Vite/framework migration is allowed only if explicitly requested and approved as a dedicated task.
- Avoid new design systems; use project styles in `src/app/globals.css` and designer shell components.

## Visual + Interaction Contract

- Typography: Source Serif 4 (titles, emphasis) + DM Sans (UI text).
- Palette: warm paper neutrals in light/dark, not pure white/black.
- Class color drives `--class-accent` and must propagate consistently across active states.
- Motion is restrained: overlay fade, sidebar transitions, small hover/active transitions.
- Keep hierarchy flat: sidebar + top bar + single main content context.
- Avoid decorative complexity and unnecessary animation.

## Functional Coverage Requirements

Implement and keep consistent with docs:

- Auth: login/register, school + conditional student ID behavior, registration closed state.
- Dashboard: list + gantt view, filters, overdue behavior, class switching.
- Class management: create/join class dialogs, class settings, member management, ownership transfer.
- Task lifecycle: create with AI parse area, edit body, publish/update, task detail, delete confirmation variants.
- Submission lifecycle: create/update submission, attachment handling, late-submission behavior.
- Teacher review: submissions list, submission detail, grading, CSV export entry points.
- User settings: profile, notifications, account deletion safeguards.

## Coding Rules For Frontend Work

- Treat `features/designer/*` as primary implementation area for app shell pages.
- Reuse existing primitives (`taskflow-*` classes, shared format/data helpers) before adding new ones.
- Keep route behavior simple and explicit; avoid hidden abstraction layers.
- Keep accessibility baseline intact (labels, keyboard access, dialog semantics).
- Keep state local unless cross-page sharing is required.

## Admin Route Note

`/admin` can remain structurally separate. Align visuals only where low effort and non-breaking; prioritize main user-facing app flows first.

## Definition Of Done (frontend tasks)

- Matches prototype for implemented elements/interactions.
- Missing prototype features are filled from UX docs.
- `pnpm --filter web lint` passes.
- `pnpm --filter web build` passes.
- No unrelated framework or library churn.
