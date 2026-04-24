#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-perf/results/run-$(date +%Y%m%d-%H%M%S)}"
INTERVAL="${2:-5}"
API_URL="${API_BASE_URL:-http://127.0.0.1:3001}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [[ -z "$ADMIN_TOKEN" && -f infra/.env.perf ]]; then
  ADMIN_TOKEN="$(grep -E '^ADMIN_TOKEN=' infra/.env.perf | tail -n 1 | cut -d= -f2-)"
fi

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "ADMIN_TOKEN is required via env or infra/.env.perf" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/api-metrics.ndjson"

echo "writing API metrics to $OUT_FILE every ${INTERVAL}s"
while true; do
  ts="$(date -Iseconds)"
  body="$(curl -fsS -H "Authorization: Bearer ${ADMIN_TOKEN}" "${API_URL%/}/admin/metrics")"
  printf '{"timestamp":"%s","metrics":%s}\n' "$ts" "$body" >> "$OUT_FILE"
  sleep "$INTERVAL"
done
