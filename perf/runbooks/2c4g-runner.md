# 2c4g Load Generator Runbook

This machine runs k6 and report generation. It should not run the TaskFlow services.

## 1. Install Tools

Install k6 and Node.js. On Debian, k6 can be installed from the official Grafana k6 apt repository or a release binary.

Verify:

```bash
k6 version
node --version
```

## 2. Copy Files From The 2c8g Machine

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
export FIXTURE_FILE=perf/results/load-fixtures.json
```

## 4. Run Tests

Full suite:

```bash
bash perf/scripts/run-k6-suite.sh thesis-run-001
```

Single API case:

```bash
CASE=task_detail k6 run --summary-export perf/results/thesis-run-001/api-task-detail-summary.json perf/k6/01-api-baseline.js
```

SSR only:

```bash
k6 run --summary-export perf/results/thesis-run-001/ssr-pages-summary.json perf/k6/02-ssr-pages.js
```

Business flow only:

```bash
k6 run --summary-export perf/results/thesis-run-001/business-flow-summary.json perf/k6/03-business-flow.js
```

## 5. Stop Criteria

Stop scaling up if any of these happens:

- Load-generator CPU is above 85%.
- `http_req_failed` exceeds 1-2%.
- p95 latency jumps sharply and remains high.
- Service machine shows sustained CPU saturation.

This keeps the thesis conclusion honest: report the system boundary rather than forcing a larger but invalid number.
