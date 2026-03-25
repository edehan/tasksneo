# TaskFlow - Project Context

TaskFlow is a class-based teaching task management system designed for university capstone projects. It allows teachers to manage classes, publish tasks with AI-assisted parsing, collect submissions, and grade them.

## Project Status & Policy
- **Solo Full-Stack**: This is a solo project.
- **Stable Backend**: The existing backend implementation and APIs in `apps/api` should be treated as stable. **Do not modify the backend** without a strong justification and prior discussion.
- **Language**: Use English as the main language for code and documentation.

## Project Overview

- **Architecture**: Monorepo using `pnpm` workspaces and `turbo`.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui.
- **Backend**: Hono (Node.js), TypeScript.
- **Database**: PostgreSQL 16 with Prisma 6 ORM.
- **Storage**: MinIO (S3-compatible) for file attachments.
- **Queue**: Bull + Redis for asynchronous notification jobs.

## Directory Structure

### `apps/api` (Backend)
- `src/routes/`: One file per resource. Routes **must** call services (no direct Prisma imports).
- `src/services/`: Business logic and database interactions.
- `src/middleware/`: `auth.ts` (JWT), `admin.ts` (ADMIN_TOKEN), `error.ts`.
- `src/lib/`: `db.ts`, `minio.ts`, `mailer.ts`, `llm.ts`, `queue.ts`.

### `apps/web` (Frontend)
- `src/app/`: App Router pages. `(auth)` for unauth, `(app)` for authed shell.
- `src/features/`: Feature-scoped modules (tasks, classes, editor, submissions, etc.).
- `src/components/ui/`: shadcn/ui primitives (do not redesign).
- `src/lib/api.ts`: Typed API client for all backend communication.
- `docs/ux/`: User journey specifications (flexible drafts).

### Shared & Infrastructure
- `packages/db`: Prisma schema and client.
- `packages/shared`: Shared types and Zod schemas.
- `infra/`: Docker Compose files for local dev and preview.

## Frontend Design: "Warm Paper Aesthetic"
Implementation must strictly match the prototype in `docs/prototype/`.
- **Theme**: Warm paper backgrounds (`#faf7f2` light, `#1a1816` dark). No pure whites/blacks.
- **Typography**:
  - **Headings**: `Source Serif 4` (via `.text-display`, `.text-heading-*`).
  - **UI/Body**: `DM Sans`.
  - **Code**: `JetBrains Mono`.
- **Class Accents**: Entire accent theme shifts per class via the `--class-accent` CSS variable.
- **Implementation**:
  - Server Components by default.
  - shadcn/ui + Tailwind CSS only. No other UI libraries.

## Development Conventions

### Data Model & Database
- **IDs**: UUID v4 for all primary keys (`@default(uuid())`).
- **Time**: `timestamptz` (UTC) in DB; frontend local conversion.
- **Soft Delete**: Only for `tasks.deletedAt`. Everything else is hard deleted.
- **Reference**: Check `docs/DATABASE.md` before DB changes.

### Backend Patterns
- **Pagination**: Cursor-based using `id`. **No offset pagination**.
- **Auth**:
  - **User**: Session-based JWT (`Authorization: Bearer <JWT>`).
  - **Admin**: `/admin/*` via `ADMIN_TOKEN` env var only. Admin is **not** a DB user.
- **Validation**: Strict Zod validation at route entry.
- **Errors**: `{ "error": "message", "code": "MACHINE_CODE" }`.

### File Storage (MinIO)
- DB stores only the `fileKey`.
- Bucket name from `process.env.MINIO_BUCKET`.
- Serve via short-lived presigned URLs (5-minute TTL).

## Building and Running

### Prerequisites
- Node.js 22+, pnpm, Docker.

### Commands
- `pnpm dev`: Full stack (Infra + API + Web).
- `pnpm dev:infra`: Only Postgres, Redis, MinIO.
- `cd packages/db && npx prisma migrate dev`: Database migrations.

## Important Constraints
- **Never** edit files in `packages/db/prisma/migrations/` manually.
- **No `any`** in TypeScript.
- **No cross-app imports**; use `packages/shared`.
- `allowLateSubmission` enforcement and `blockedBy` FK logic are **not implemented** in v1.
