# TaskFlow - Project Context

TaskFlow is a class-based teaching task management system designed for university capstone projects. It allows teachers to manage classes, publish tasks with AI-assisted parsing, collect submissions, and grade them.

## Project Status & Policy
- **Solo Full-Stack**: This is a solo project.
- **Stable Backend**: The existing backend implementation and APIs in `apps/api` should be treated as stable. **Do not modify the backend** without a strong justification and prior discussion.
- **Language**: Use English as the main language for code and documentation.

## Project Overview

- **Architecture**: Monorepo using `pnpm` workspaces and `turbo` (optional pipeline).
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui.
- **Backend**: Hono (Node.js), TypeScript.
- **Database**: PostgreSQL 16 with Prisma 6 ORM.
- **Storage**: MinIO (S3-compatible) for file attachments.
- **Queue**: Bull + Redis for asynchronous notification jobs.

## Directory Structure

- `apps/api`: Hono backend service.
  - `src/routes`: API endpoints with Zod validation.
  - `src/services`: Business logic (routes must call services, not Prisma directly).
  - `src/lib`: Shared utilities (storage, mailer, queue, etc.).
- `apps/web`: Next.js frontend application.
  - `src/app`: Pages and layouts.
  - `src/features`: Feature-based modules (tasks, classes, auth).
  - `src/components`: Shared UI components.
- `packages/db`: Prisma schema and generated client.
- `packages/shared`: Shared types and Zod schemas between API and Web.
- `docs/`: Documentation, including `DATABASE.md`, `openapi/openapi.yaml`, and feature specs.
  - `docs/ux/`: User journey specifications (refer to these for frontend implementation; they are flexible drafts).

## Building and Running

### Prerequisites
- Node.js 22+
- pnpm
- Docker (for PostgreSQL, Redis, MinIO)

### Setup
1. `cp .env.example .env`
2. `pnpm install`
3. `cd packages/db && npx prisma migrate dev`
4. `pnpm dev:seed` (optional, for demo data)

### Development Commands
- `pnpm dev`: Start infrastructure (Docker), API, and Web concurrently.
- `pnpm dev:infra`: Start only Docker services (Postgres, Redis, MinIO).
- `pnpm dev:api`: Start API service (`localhost:3001`).
- `pnpm dev:web`: Start Web application (`localhost:3000`).
- `pnpm dev:down`: Stop all services and containers.

## Development Conventions

### Data Model & Database
- **IDs**: Use UUID v4 for all primary keys (`@default(uuid())`). Never use sequential IDs.
- **Time**: All timestamps are `timestamptz` (UTC) in DB. Frontend converts to user local timezone for display.
- **Soft Delete**: Soft delete exists **only on `tasks`** via `deletedAt`. Everything else is hard deleted.
- **Reference**: Always check `docs/DATABASE.md` before DB changes.

### Backend (Hono)
- **Pattern**: `Route -> Zod Validation -> Service -> Prisma`.
- **Services**: All business logic must reside in services.
- **Auth**:
  - **User**: Session-based JWT; `Authorization: Bearer <JWT>` (via `authMiddleware`).
  - **Admin**: Control plane (`/admin/*`) is authenticated by `ADMIN_TOKEN` env var only. The admin is **not** a database user.
- **Errors**: Return `{ "error": "message", "code": "MACHINE_CODE" }`.

### Frontend (Next.js)
- **Styling**: Tailwind CSS + shadcn/ui.
- **API Client**: Use the typed client in `apps/web/src/lib/api.ts`.
- **UX**: Refer to `docs/ux/` for journey specs. These are not authoritative and can be updated to reflect implementation.

### File Storage
- Store files in MinIO.
- DB stores only the `fileKey`.
- Serve files via presigned URLs (5-minute TTL).

## Important Constraints
- **Do not** edit Prisma migrations manually in `packages/db/prisma/migrations/`.
- **Do not** use `any` in TypeScript.
- **Do not** import across `apps/` packages; use `packages/shared`.
- `allowLateSubmission` enforcement is NOT implemented in v1.
- `blockedBy` is a simple `String[]` of task UUIDs without FK enforcement.
