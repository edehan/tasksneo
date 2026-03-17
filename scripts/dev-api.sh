#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env first."
  exit 1
fi

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Missing node_modules in repository root. Run pnpm install first."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${SYSTEM_CONFIG_SECRET:-}" && -n "${ADMIN_TOKEN:-}" ]]; then
  export SYSTEM_CONFIG_SECRET="$ADMIN_TOKEN"
  echo "SYSTEM_CONFIG_SECRET is missing in .env. Falling back to ADMIN_TOKEN for local dev only."
fi

cd "$ROOT_DIR/apps/api"
pnpm dev
