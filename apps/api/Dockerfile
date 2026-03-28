FROM node:25-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY node_modules node_modules
COPY apps/api/node_modules apps/api/node_modules
COPY apps/api/package.json apps/api/package.json
COPY apps/api/dist apps/api/dist
COPY packages/db packages/db
COPY packages/db/node_modules packages/db/node_modules

WORKDIR /app/apps/api

CMD ["node", "dist/index.js"]
