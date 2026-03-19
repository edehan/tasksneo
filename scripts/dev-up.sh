#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/dev-infra.sh"

if [[ "${TASKFLOW_DEV_SEED:-false}" == "true" ]]; then
  echo "Applying database migrations for local dev..."
  pnpm --filter @taskflow/db exec prisma migrate deploy

  echo "Seeding local demo data..."
  pnpm dev:seed
fi

cat <<'EOF'

Starting local dev servers:
- web: http://localhost:3000
- admin: http://localhost:3000/admin
- api: http://localhost:3001

Press Ctrl+C to stop the web/api dev processes.
Use `pnpm dev:down` if you also want to stop postgres/redis/minio.
EOF

pids=()

cleanup() {
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

bash "$ROOT_DIR/scripts/dev-api.sh" &
pids+=("$!")

bash "$ROOT_DIR/scripts/dev-web.sh" &
pids+=("$!")

wait -n "${pids[@]}"
