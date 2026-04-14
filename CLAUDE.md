# TaskFlow

Class task management system for educators. Teachers create classes, publish tasks to members, collect file submissions, and grade them. Built as a university capstone project.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 16 App Router + TypeScript + Tailwind CSS + shadcn/ui (`apps/web`)
- **Data fetching**: SSR server-side prefetch via React `cache()` + SWR client-side cache with SSR fallback injection
- **Backend**: Hono + TypeScript + Node.js (`apps/api`)
- **Database**: PostgreSQL + Prisma 6 ORM (`packages/db`)
- **File storage**: S3-compatible service (Cloudflare R2 for production, MinIO for local dev)
- **Queue**: Bull + Redis (notification jobs)
- **Auth**: User requests carry opaque session tokens stored in the `sessions` table; `/admin` routes use `ADMIN_TOKEN` from env only — no DB user
- **Redis**: Bull queue + business caches only; not used as a user-auth cache

## Key documents (read before editing related code)

- Database schema and design rationale: `docs/DATABASE.md`
- API contract: `docs/openapi/openapi.yaml`
- Environment variables reference: `.env.example`

features details written in human language messy stored in `docs/features/` and the user journey specifications in `docs/ux/`, read **only you are doing implementation**, These documents are not authoritative content.

These documents are drafts. If there are any conflicts, please trust the most recently edited one or make an inquiry. Remember, you are speaking with a product manager, not an engineer. If there are unreasonable requests, ask questions and offer your insights.

## Critical design decisions

- Tasks belong to **exactly one class**. No multi-class publishing.
- Admin control plane (`/admin`) is authenticated by `ADMIN_TOKEN` env var. It is not a database user.
- Primary keys are UUID v4 (`@default(uuid())` in Prisma). Do not use sequential IDs.
- All timestamps are `timestamptz` (UTC). Frontend converts to user local timezone for display.
- Soft delete exists **only on `tasks`** (via `deletedAt` field). Everything else is hard deleted.
- `tasks.blockedBy` is a `String[]` of task UUIDs. No FK enforcement. Frontend handles rendering.

## Coding rules

- TypeScript strict mode everywhere. No `any`.
- All request bodies validated with Zod at the route entry point, before touching the database.
- Permission checks happen in middleware or a dedicated policy function, never scattered inside handlers.
- Never import from `apps/*` across packages. Shared types live in `packages/shared`.
- Return errors as `{ error: string, code: string }`.
- Use English as main language. 
- When coding the frontend, refer to `docs/ux/` for user journey specifications. You can change these docs to reflect implementation details at any time, they are user needs, not authoritative guidelines.

This is a solo full-stack project. For the frontend phase, the backend and database are already in place. The existing backend implementation and APIs should be treated as stable and should not be modified without good reason. If a feature requires backend changes, those changes may be developed in parallel after discussion with the user.

## IMPORTANT: Never modify files in `packages/db/prisma/migrations/` directly.

Always use `prisma migrate dev` to generate migration files.
