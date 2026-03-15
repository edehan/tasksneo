# TaskFlow

Class task management system for educators. Teachers create classes, publish tasks to members, collect file submissions, and grade them. Built as a university capstone project.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui (`apps/web`)
- **Backend**: Hono + TypeScript + Node.js (`apps/api`)
- **Database**: PostgreSQL + Prisma 6 ORM (`packages/db`)
- **File storage**: MinIO (S3-compatible, self-hosted)
- **Queue**: Bull + Redis (notification jobs)
- **Auth**: Session-based JWT; `/admin` routes use `ADMIN_TOKEN` from env only — no DB user

## Key documents (read before editing related code)

- Database schema and design rationale: `docs/DATABASE.md`
- API contract: `docs/openapi/openapi.yaml`
- Environment variables reference: `.env.example`

features details written in human language messy stored in `docs/features/`, read **only you are doing implementation**, These documents are not authoritative content.

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

## Running the project

```bash
# Start infrastructure (postgres, redis, minio)
cd infra && docker compose -f docker-compose.dev.yml up -d

# Install dependencies
pnpm install

# Run database migrations
cd packages/db && npx prisma migrate dev

# Start backend (port 3001)
cd apps/api && pnpm dev

# Start frontend (port 3000)
cd apps/web && pnpm dev
```

## IMPORTANT: Never modify files in `packages/db/prisma/migrations/` directly.

Always use `prisma migrate dev` to generate migration files.