# Backend (apps/api)

Hono + Node.js REST API. See root `CLAUDE.md` for project overview.

## Structure

```
src/
  index.ts          # Entry point, registers all routers
  routes/           # One file per resource (auth.ts, classes.ts, tasks.ts, ...)
  middleware/        # auth.ts (JWT), admin.ts (ADMIN_TOKEN), error.ts
  services/         # Business logic, called by routes (no Prisma in routes directly)
  lib/              # db.ts, minio.ts, mailer.ts, llm.ts, queue.ts
```

## Patterns

- Routes call services. Services call `prisma` and other lib modules. Routes never import `prisma` directly.
- Every protected route goes through the `authMiddleware` first.
- Admin routes go through `adminMiddleware` which checks `Authorization: Bearer $ADMIN_TOKEN`.
- Pagination: cursor-based using `id` as cursor. No offset pagination.

## Prisma client

Import from `@taskflow/db`:
```typescript
import { prisma } from '@taskflow/db'
```

## File uploads

Files go to MinIO. DB stores only the `fileKey` (MinIO object key), never the file itself.
Bucket name is read from `process.env.MINIO_BUCKET`.

## Soft-deleted tasks

Always filter active tasks with `where: { deletedAt: null }` unless explicitly fetching deleted state.