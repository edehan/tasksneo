#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.preview"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.preview.example to .env.preview first."
  exit 1
fi

echo "Stopping preview stack and removing preview volumes..."
docker compose -p taskflow-preview --env-file "$ENV_FILE" -f "$ROOT_DIR/infra/docker-compose.preview.yml" down -v --remove-orphans
echo "Preview data has been reset."
