#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.dev.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for local dev infrastructure."
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d postgres redis redis-cache minio

cat <<'EOF'
Local dev infrastructure is ready:
- postgres: localhost:5432
- redis (queue): localhost:6379
- redis-cache: localhost:6380
- minio api: localhost:9000
- minio console: localhost:9001
EOF
