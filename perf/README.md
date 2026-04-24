# Performance Tests

This directory is reserved for local performance-test scenarios and results.

## Tooling

- `k6`: main HTTP/API/SSR load-test runner on the 2c4g load-generator machine.
- `docker stats`: resource sampling on the 2c8g service machine.
- `GET /admin/metrics`: API route-level latency/error snapshot.
- `node perf/scripts/report.mjs`: converts k6 summaries and resource samples into CSV, Markdown, and SVG chart files.

## Environment

Use `infra/docker-compose.perf.yml` on the 2c8g test server. The compose file
starts the same production-shape services used by the single-host deployment:

- Next.js SSR web
- API
- PostgreSQL
- Redis/Valkey
- MinIO for S3-compatible file flows

It intentionally does not set container CPU or memory hard limits. On a clean
2c8g host, that better represents a real VPS where services share the machine.
Redis is configured with a cache-size limit so it cannot grow without bound.

## Start

```bash
cp infra/.env.perf.example infra/.env.perf
# Edit infra/.env.perf with the test server IP/domain and generated secrets.
# If you keep S3_ENDPOINT=minio.perf.local, add it to DNS or /etc/hosts on the
# browser/load-generator machine so it points at the test server IP.
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml up -d --build
```

## Verify

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml ps
curl http://<test-server>:3001/health/ready
curl -I http://<test-server>:3000
```

## Seed Users And Classes

Create 100 random test users and one non-personal class per user:

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-users-classes
```

The script creates fresh random data on every run:

- email: random local part under `@example.com`
- password: `12345678` by default
- class name: random suffix

At the end it prints a `seed_users` JSON event containing every created user:
`email`, `password`, `userId`, `classId`, and `className`.

The class creation request sends an `Origin` header. By default it uses the
first `CORS_ORIGINS` value from `infra/.env.perf`; override `SEED_ORIGIN` if
you need a different allowed web origin.

To also write the list to disk:

```bash
SEED_OUTPUT_FILE=/app/perf/results/seed-users.json docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-users-classes
```

Useful overrides:

```bash
SEED_COUNT=25 docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-users-classes
```

## Seed Memberships From Existing Classes

Pick 200 existing non-personal classes, write them to
`perf/results/class-pool-200.json`, then make every active user join 5 random
classes from that pool:

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-class-memberships
```

Useful overrides:

```bash
SEED_POOL_CLASS_COUNT=200 SEED_JOIN_CLASSES_PER_USER=5 docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-class-memberships
```

The class pool file includes `ownerId`, `ownerEmail`, and `ownerPassword` for
each class, so later scripts can log in as the class owner.

## Seed Tasks For Recorded Classes

Read `perf/results/class-pool-200.json`, then create 5-10 random published
tasks in each recorded class. Start dates are 30 days ago to 1 day from now.
Due dates are 3-15 days from now.

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-class-tasks
```

The task list is written to `perf/results/class-tasks.json`.

## Export Class Owners

If `perf/results/class-pool-200.json` already exists and you only need owner
accounts for those classes, export them without changing memberships, classes,
or tasks:

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build export-class-owners
```

The output is written to `perf/results/class-owners-200.json` and includes
`classId`, `className`, `inviteCode`, `ownerId`, `ownerEmail`, and
`ownerPassword`.

## Full Reset And Seed

This destructive command wipes seeded application data, then creates:

- 5000 users, all with password `12345678`
- 200 public classes owned by 200 of those users
- each user joined to 3-10 public classes total
- each public class with 3-10 published tasks
- task start dates from 30 days ago to 2 days from now
- task due dates from 3 to 15 days from now
- task bodies with 200-1000 real English words

Run it only on the disposable performance database:

```bash
FULL_SEED_CONFIRM_RESET=YES docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build reset-and-seed-full
```

The two primary output files are written to `perf/results/full-seed/`:

- `users.json`
- `public-classes.json`

`users.json` contains login information for all 5000 users.
`public-classes.json` contains all 200 public classes and their owner login
information.

## Seed Submissions And Build k6 Fixtures

After the full seed, create submission data for owner submission-list tests:

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build seed-task-submissions
```

Build the fixture file consumed by k6:

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml --profile seed run --rm --build build-load-fixtures
```

The generated fixture is:

```text
perf/results/load-fixtures.json
```

Copy this fixture and the `perf/k6` directory to the 2c4g load-generator machine.

## Run k6 From The Load Generator

On the 2c4g load-generator machine:

```bash
export WEB_BASE_URL=http://<web-host>:3000
export API_BASE_URL=http://<api-host>:3001
export FIXTURE_FILE=perf/results/load-fixtures.json

bash perf/scripts/run-k6-suite.sh thesis-run-001
```

Run a single baseline case:

```bash
CASE=classes k6 run --summary-export perf/results/thesis-run-001/api-classes-summary.json perf/k6/01-api-baseline.js
```

Common cases:

```text
login users_me classes class_detail class_tasks task_detail my_tasks submit_content my_submission owner_submissions
```

## Collect Service Metrics

On the 2c8g service machine, start these in separate terminals before running k6:

```bash
bash perf/scripts/collect-docker-stats.sh perf/results/thesis-run-001 5
bash perf/scripts/collect-api-metrics.sh perf/results/thesis-run-001 5
```

Stop them with `Ctrl+C` after the k6 run. Copy their output into the same run
directory used by the load-generator, then generate the report:

```bash
node perf/scripts/report.mjs perf/results/thesis-run-001
```

See:

- `perf/runbooks/2c8g-server.md`
- `perf/runbooks/2c4g-runner.md`

## Stop

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml down
```

Use `down -v` only when you intentionally want to delete the performance-test
database and object storage volumes.
