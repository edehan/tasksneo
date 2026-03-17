#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.preview"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.preview.example to .env.preview first."
  exit 1
fi

docker compose -p taskflow-preview --env-file "$ENV_FILE" -f "$ROOT_DIR/infra/docker-compose.preview.yml" ps

echo
echo "Preview web: http://localhost:35540"
echo "Preview api: http://localhost:35541"
echo "Preview minio console: http://localhost:35545"
