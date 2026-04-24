#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-run-$(date +%Y%m%d-%H%M%S)}"
OUT_DIR="${OUT_DIR:-perf/results/${RUN_ID}}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3001}"
FIXTURE_FILE="${FIXTURE_FILE:-perf/results/load-fixtures.json}"

mkdir -p "$OUT_DIR"

run_k6() {
  local name="$1"
  local script="$2"
  shift 2
  echo "==> ${name}"
  WEB_BASE_URL="$WEB_BASE_URL" API_BASE_URL="$API_BASE_URL" FIXTURE_FILE="$FIXTURE_FILE" \
    "$@" k6 run --summary-export "${OUT_DIR}/${name}-summary.json" "$script" \
      | tee "${OUT_DIR}/${name}.log"
}

for case_name in login users_me classes class_detail class_tasks task_detail my_tasks submit_content my_submission owner_submissions; do
  CASE="$case_name" run_k6 "api-${case_name}" "perf/k6/01-api-baseline.js" env CASE="$case_name"
done

run_k6 "ssr-pages" "perf/k6/02-ssr-pages.js" env
run_k6 "business-flow" "perf/k6/03-business-flow.js" env
run_k6 "soak" "perf/k6/04-soak.js" env
run_k6 "stress" "perf/k6/05-stress.js" env

node perf/scripts/report.mjs "$OUT_DIR"
echo "suite complete: $OUT_DIR"
