FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY apps/api/package.json apps/api/package.json
COPY node_modules node_modules
COPY apps/web/node_modules apps/web/node_modules
COPY apps/web/package.json apps/web/package.json
COPY apps/web/components.json apps/web/components.json
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY apps/web/postcss.config.mjs apps/web/postcss.config.mjs
COPY apps/web/next.config.ts apps/web/next.config.ts
COPY apps/web/.next apps/web/.next
COPY apps/web/public apps/web/public

WORKDIR /app/apps/web

CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
