# Performance Tests

This directory is reserved for local performance-test scenarios and results.

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

## Stop

```bash
docker compose --env-file infra/.env.perf -f infra/docker-compose.perf.yml down
```

Use `down -v` only when you intentionally want to delete the performance-test
database and object storage volumes.
