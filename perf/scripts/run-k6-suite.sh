#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-run-$(date +%Y%m%d-%H%M%S)}"
OUT_DIR="${OUT_DIR:-perf/results/${RUN_ID}}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3001}"
FIXTURE_FILE="${FIXTURE_FILE:-perf/results/load-fixtures.json}"
RUN_VARIANTS="${RUN_VARIANTS:-cold,warm}"

case "$FIXTURE_FILE" in
  /*) ;;
  *) FIXTURE_FILE="$(pwd)/${FIXTURE_FILE}" ;;
esac

mkdir -p "$OUT_DIR"

run_k6() {
  local name="$1"
  local script="$2"
  shift 2
  local env_args=(
    -e "WEB_BASE_URL=${WEB_BASE_URL}"
    -e "API_BASE_URL=${API_BASE_URL}"
    -e "FIXTURE_FILE=${FIXTURE_FILE}"
  )
  for item in "$@"; do
    env_args+=(-e "$item")
  done
  echo "==> ${name}"
  k6 run "${env_args[@]}" --summary-export "${OUT_DIR}/${name}-summary.json" "$script" \
    | tee "${OUT_DIR}/${name}.log"
}

has_variant() {
  case ",${RUN_VARIANTS}," in
    *,"$1",*) return 0 ;;
    *) return 1 ;;
  esac
}

run_cold_warm() {
  local name="$1"
  local script="$2"
  shift 2
  if has_variant cold; then
    run_k6 "${name}-cold-login" "$script" AUTH_MODE=per_iter CACHE_MODE=cold "$@"
  fi
  if has_variant warm; then
    run_k6 "${name}-warm-session" "$script" AUTH_MODE=session CACHE_MODE=warm "$@"
  fi
}

run_k6 "api-login" "perf/k6/01-api-baseline.js" CASE=login

for case_name in users_me classes class_detail class_tasks task_detail my_tasks submit_content my_submission owner_submissions; do
  run_cold_warm "api-${case_name}" "perf/k6/01-api-baseline.js" CASE="$case_name"
done

run_cold_warm "ssr-pages" "perf/k6/02-ssr-pages.js"
run_cold_warm "business-flow" "perf/k6/03-business-flow.js"
run_cold_warm "soak" "perf/k6/04-soak.js"
run_cold_warm "stress" "perf/k6/05-stress.js"

node perf/scripts/report.mjs "$OUT_DIR"
echo "suite complete: $OUT_DIR"
