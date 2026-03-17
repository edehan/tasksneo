# Local Dev Workflow

This document is the default collaboration workflow for day-to-day frontend and full-stack development.

## Why `dev` Is the Default

For this project, the standard local development experience is:

- `Next.js dev` for instant frontend hot reload
- `tsx watch` for API restart on backend changes
- Docker only for local infrastructure (`postgres`, `redis`, `minio`)

This is the practical equivalent of older static-site tools such as Live Server, but adapted for a full-stack Next.js + API project.

## Recommended Flow

1. Copy `.env.example` to `.env`
2. Run `pnpm install`
3. Run `pnpm dev`
4. Open:
   - `http://localhost:3000`
   - `http://localhost:3000/admin`

Use `dev` while code is being written and reviewed together. It is the fastest way to see UI changes before commit.

If your local `.env` predates the `SYSTEM_CONFIG_SECRET` split, `pnpm dev` will temporarily reuse `ADMIN_TOKEN` for local development and print a warning. Update `.env` when convenient.

## Commands

- `pnpm dev`: start dev infra and both watch servers
- `pnpm dev:infra`: start `postgres`, `redis`, `minio`
- `pnpm dev:api`: start backend watch mode only
- `pnpm dev:web`: start Next.js dev server only
- `pnpm dev:down`: stop local dev infrastructure

## Ports

- `web`: `3000`
- `api`: `3001`
- `postgres`: `5432`
- `redis`: `6379`
- `minio`: `9000`
- `minio console`: `9001`

## Relationship to Preview

- `dev`: live collaboration and fast iteration
- `preview`: stable manual verification snapshot
- `test`: automated validation only

The default sequence is now:

1. Develop and review in `dev`
2. When needed, run `pnpm preview:deploy`
3. Open `http://localhost:35540` for a stable preview check
4. Commit only after the result is acceptable
