# Thesis Performance Test Plan

## Machines

- Service machine: `service-host`
  - Role: run `web`, `api`, `postgres`, `redis`, `minio`
  - Spec: `2c4g`
  - Reason: earlier service runs on the larger host only peaked a little above
    `2GB` memory, so 4GB leaves enough headroom for this workload.
- Load machine: `load-host`
  - Role: run `k6`, store plans, fixtures, reports
  - Spec: `8c32g`
  - Reason: earlier `2c4g` runs were limited by the load generator; k6 memory
    usage could climb to about `18GB`, so the runner needs enough headroom to
    keep service-side results valid.

## Endpoints

- Web: `http://<web-host>:3000`
- API: `http://<api-host>:3001`

## Seed Dataset

- Users: `5000`
- Public classes: `200`
- Personal classes: `5000`
- Public class memberships: random `3-10` public classes per user
- Tasks: random `3-10` tasks per public class
- Task submissions: random `5-20` submissions per task

Generated files on the service machine:

- `perf/results/full-seed/users.json`
- `perf/results/full-seed/public-classes.json`
- `perf/results/full-seed/submissions.json`
- `perf/results/load-fixtures.json`

## Test Scenarios

### 1. API Baseline

Run each case independently:

- `login`
- `users_me`
- `classes`
- `class_detail`
- `class_tasks`
- `task_detail`
- `my_tasks`
- `submit_content`
- `my_submission`
- `owner_submissions`

Purpose:

- establish single-endpoint latency and throughput
- identify whether bottlenecks first appear in `api` or `postgres`

### 2. SSR Pages

Page requests:

- `/`
- `/classes/:classId`
- `/tasks/:taskId`
- `/tasks/:taskId/submissions`

Purpose:

- measure server-side rendering latency
- observe `web` CPU behavior under authenticated HTML traffic

### 3. Business Flow

Per virtual user:

1. login
2. fetch classes
3. fetch class tasks
4. fetch task detail
5. mark task viewed
6. update my submission
7. fetch my submission

Purpose:

- reflect realistic classroom usage
- provide the main results table for the thesis

### 4. Soak Test

- sustained medium concurrency
- duration: `30 minutes`

Purpose:

- verify error rate stability
- detect memory growth and latency drift

### 5. Stress Test

- staged concurrency growth
- stop when test-node CPU saturates or error rate exceeds threshold

Purpose:

- find the practical boundary of `2c4g` single-node deployment

## Result Collection

On `service-host`:

- `perf/scripts/collect-docker-stats.sh`
- `perf/scripts/collect-api-metrics.sh`

On `load-host`:

- `perf/scripts/run-k6-suite.sh`
- `perf/scripts/report.mjs`

## Commands

### Prepare on k6 machine

```bash
cd <repo-root>
export WEB_BASE_URL=http://<web-host>:3000
export API_BASE_URL=http://<api-host>:3001
export FIXTURE_FILE="$PWD/perf/results/load-fixtures.json"
```

### Example single scenario

```bash
k6 run -e CASE=classes -e FIXTURE_FILE="$FIXTURE_FILE" \
  --summary-export perf/results/thesis-run-001/api-classes-summary.json \
  perf/k6/01-api-baseline.js
```

### Full suite

```bash
cd <repo-root>
bash perf/scripts/run-k6-suite.sh thesis-run-001
```

### Build report

```bash
cd <repo-root>
node perf/scripts/report.mjs perf/results/thesis-run-001
```

## Notes For The Thesis

- All conclusions should be described as results for a `2c4g` single-node deployment.
- The `8c32g` machine is only the traffic generator and report node; do not
  describe it as part of the service capacity.
- Do not use file-upload throughput as the main system-performance conclusion.
- Prefer `p95`, error rate, and resource curves over raw peak RPS alone.
