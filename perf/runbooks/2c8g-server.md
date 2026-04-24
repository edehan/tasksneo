# 2c8g Service Machine Runbook

This machine runs the TaskFlow production-shaped stack and service-side metric collection.

## 1. Configure

Edit `infra/.env.perf`:

```env
NEXT_PUBLIC_API_BASE_URL=http://<api-host>:3001
CORS_ORIGINS=http://<web-origin>:3000
WEB_BIND_ADDR=0.0.0.0
API_BIND_ADDR=0.0.0.0
```

## 2. Start Services

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml up -d --build
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml ps
curl http://127.0.0.1:3001/health/ready
```

## 3. Seed Data

This command wipes and rebuilds the performance-test database. Use it only on the disposable test database.

```bash
FULL_SEED_CONFIRM_RESET=YES docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build reset-and-seed-full
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-task-submissions
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build build-load-fixtures
```

Outputs:

```text
perf/results/full-seed/users.json
perf/results/full-seed/public-classes.json
perf/results/full-seed/submissions.json
perf/results/load-fixtures.json
```

Copy `perf/results/load-fixtures.json`, `perf/k6/`, and `perf/scripts/report.mjs` to the 2c4g load-generator machine.

## 4. Collect Metrics

Start these before each k6 run:

```bash
bash perf/scripts/collect-docker-stats.sh perf/results/thesis-run-001 5
bash perf/scripts/collect-api-metrics.sh perf/results/thesis-run-001 5
```

Stop both collectors with `Ctrl+C` after the k6 run.

## 5. Notes

- Keep Docker service CPU/memory unrestricted to represent the real shared 2c8g VPS.
- Watch `docker stats`; if Postgres or Web/API saturates CPU, record that as the bottleneck instead of hiding it.
- Do not use large file-upload throughput as a thesis headline result.
