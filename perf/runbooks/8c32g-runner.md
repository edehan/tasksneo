# 8c32g Load Generator Runbook

This machine runs k6 and report generation. It should not run the TaskFlow services.

Use an `8c32g` runner for the full suite. Earlier runs on `2c4g` were limited
by the load generator itself: k6 memory usage could climb to about `18GB`, so a
2c4g runner can distort service-side latency, error rate, and throughput
conclusions. Keep the service machine at `2c4g` when the goal is measuring the
single-node deployment boundary.

## 1. Install Tools

Install k6 and Node.js. On Debian, k6 can be installed from the official Grafana k6 apt repository or a release binary.

Verify:

```bash
k6 version
node --version
```

## 2. Copy Files From The 2c4g Service Machine

Required files:

```text
perf/k6/
perf/scripts/run-k6-suite.sh
perf/scripts/report.mjs
perf/results/load-fixtures.json
```

Optional files for final combined reports:

```text
perf/results/<run-id>/docker-stats.csv
perf/results/<run-id>/api-metrics.ndjson
```

## 3. Set Environment

```bash
export WEB_BASE_URL=http://<web-host>:3000
export API_BASE_URL=http://<api-host>:3001
export FIXTURE_FILE="$PWD/perf/results/load-fixtures.json"
```

## 4. Run Tests

Full suite:

```bash
bash perf/scripts/run-k6-suite.sh thesis-run-001
```

The full suite runs `cold-login` and `warm-session` variants by default. Use
`RUN_VARIANTS=cold` or `RUN_VARIANTS=warm` to run only one side of the
comparison.

Single API case:

```bash
k6 run -e CASE=task_detail -e AUTH_MODE=session -e CACHE_MODE=warm -e FIXTURE_FILE="$FIXTURE_FILE" --summary-export perf/results/thesis-run-001/api-task-detail-summary.json perf/k6/01-api-baseline.js
```

SSR only:

```bash
k6 run -e AUTH_MODE=session -e CACHE_MODE=warm -e FIXTURE_FILE="$FIXTURE_FILE" --summary-export perf/results/thesis-run-001/ssr-pages-summary.json perf/k6/02-ssr-pages.js
```

Business flow only:

```bash
k6 run -e AUTH_MODE=session -e CACHE_MODE=warm -e FIXTURE_FILE="$FIXTURE_FILE" --summary-export perf/results/thesis-run-001/business-flow-summary.json perf/k6/03-business-flow.js
```

## 5. Stop Criteria

Stop scaling up if any of these happens:

- Load-generator CPU is above 85%.
- `http_req_failed` exceeds 1-2%.
- p95 latency jumps sharply and remains high.
- Service machine shows sustained CPU saturation.

This keeps the thesis conclusion honest: report the system boundary rather than forcing a larger but invalid number.
