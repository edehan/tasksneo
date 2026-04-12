# ---- Builder ----
FROM node:22.22.2-trixie-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace config and package manifests for dependency caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install all dependencies (devDeps needed for tsc + prisma CLI)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Generate Prisma client
COPY packages/db/prisma ./packages/db/prisma
RUN pnpm --filter @taskflow/db exec prisma generate

# Build packages/db to JS (so production Node.js can load it)
COPY packages/db/src ./packages/db/src
RUN cd packages/db && npx tsc --target ES2022 --module NodeNext --moduleResolution NodeNext \
    --esModuleInterop --skipLibCheck --outDir dist --declaration src/index.ts

# Build API
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
RUN pnpm --filter @taskflow/api run build

# Rewrite packages/db main to compiled JS BEFORE copying node_modules
# (pnpm symlinks in node_modules point to packages/db, so this propagates)
RUN node -e "\
  const f='packages/db/package.json';\
  const p=JSON.parse(require('fs').readFileSync(f,'utf8'));\
  p.main='./dist/index.js';\
  require('fs').writeFileSync(f,JSON.stringify(p,null,2));"

# ---- Production ----
FROM node:22.22.2-trixie-slim

ENV NODE_ENV=production
WORKDIR /app

# Copy dependency tree from builder (Docker resolves pnpm symlinks to real dirs)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
