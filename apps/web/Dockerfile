FROM node:22.22.2-trixie-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=512

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_CAP_API_ENDPOINT
ARG INSTRUMENTATION_SNIPPET

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_CAP_API_ENDPOINT=$NEXT_PUBLIC_CAP_API_ENDPOINT
ENV INSTRUMENTATION_SNIPPET=$INSTRUMENTATION_SNIPPET

RUN corepack enable

WORKDIR /app

# Install dependencies using only manifests first for better Docker layer caching.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter web...

# Copy source and build the Next.js standalone output.
COPY apps/web ./apps/web
RUN pnpm --filter web run build

FROM node:22.22.2-trixie-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=builder /app/apps/web/public /app/apps/web/public

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["node", "server.js"]
