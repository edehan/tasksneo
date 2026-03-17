#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.preview"
LOCK_DIR="/tmp/taskflow-preview-deploy.lock"
COMPOSE_ARGS=(-p taskflow-preview --env-file "$ENV_FILE" -f "$ROOT_DIR/infra/docker-compose.preview.yml")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.preview.example to .env.preview first."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for preview deployment."
  exit 1
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "A preview deployment is already running. Check .preview/post-commit.log or retry later."
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

trap cleanup EXIT

cd "$ROOT_DIR"

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Missing node_modules in repository root. Run pnpm install first."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

required_env_vars=(
  ADMIN_TOKEN
  SYSTEM_CONFIG_SECRET
  JWT_SECRET
  DATABASE_URL
  REDIS_URL
  MINIO_ENDPOINT
  MINIO_PORT
  MINIO_ACCESS_KEY
  MINIO_SECRET_KEY
  MINIO_BUCKET
  NEXT_PUBLIC_API_BASE_URL
)

for env_var in "${required_env_vars[@]}"; do
  if [[ -z "${!env_var:-}" ]]; then
    echo "Missing required preview env var: $env_var"
    exit 1
  fi
done

echo "Building host artifacts for preview..."
pnpm --filter @taskflow/db exec prisma generate
pnpm --filter @taskflow/api build
pnpm --filter web build

echo "Starting preview infrastructure..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis minio

echo "Waiting for preview postgres..."
for _ in {1..30}; do
  if docker compose "${COMPOSE_ARGS[@]}" exec -T postgres pg_isready -U taskflow -d taskflow_preview >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker compose "${COMPOSE_ARGS[@]}" exec -T postgres pg_isready -U taskflow -d taskflow_preview >/dev/null 2>&1; then
  echo "Preview postgres did not become ready in time."
  exit 1
fi

echo "Building preview images..."
docker compose "${COMPOSE_ARGS[@]}" build api web

echo "Applying preview database migrations..."
docker compose "${COMPOSE_ARGS[@]}" run --rm api node ../../packages/db/node_modules/prisma/build/index.js migrate deploy --schema ../../packages/db/prisma/schema.prisma

echo "Starting preview application services..."
docker compose "${COMPOSE_ARGS[@]}" up -d api web

wait_for_http() {
  local url="$1"
  local label="$2"

  for _ in {1..30}; do
    if node -e "fetch(process.argv[1]).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))" "$url"; then
      echo "$label is ready at $url"
      return 0
    fi
    sleep 2
  done

  echo "$label did not become ready at $url"
  return 1
}

wait_for_http "http://localhost:35541/health" "Preview API"
wait_for_http "http://localhost:35540" "Preview web"

echo "Preview deployment completed."
