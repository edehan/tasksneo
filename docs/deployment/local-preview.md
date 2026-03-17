# Local Preview Environment

This document defines the three local environments used by TaskFlow and the workflow for the local preview pipeline.

## Environment Roles

- `dev`: day-to-day implementation and debugging. Ports stay on the existing defaults.
- `preview`: a stable pre-release snapshot you can open in the browser after each commit.
- `test`: automated validation only. Tests may reset data and must never point at `preview`.

## Preview Ports

The preview stack is pinned to the `35500-35599` range:

- `web`: `35540`
- `api`: `35541`
- `postgres`: `35542`
- `redis`: `35543`
- `minio`: `35544`
- `minio console`: `35545`

The preview browser entrypoint is `http://localhost:35540`.

## Data Strategy

- Preview uses dedicated Docker volumes and keeps data between deploys.
- Dev and preview never share database, Redis, or MinIO state.
- Test should use `.env.test` and a separate database, even when it reuses local infrastructure.
- Preview data is only removed when `pnpm preview:reset` is run explicitly.

## Deployment Flow

`pnpm preview:deploy` performs the local preview rollout:

1. Read `.env.preview`
2. Build host artifacts for `api` and `web`
3. Start `postgres`, `redis`, and `minio`
4. Build the runtime images from local artifacts
5. Run `prisma migrate deploy` against the preview database
6. Start or replace the `api` and `web` containers
7. Check `http://localhost:35541/health` and `http://localhost:35540`

Useful commands:

- `pnpm preview:deploy`
- `pnpm preview:status`
- `pnpm preview:logs`
- `pnpm preview:reset`
- `pnpm preview:hooks`

## Post-Commit Automation

- `pnpm preview:hooks` configures `core.hooksPath` to use the repository `.githooks/` directory.
- The `post-commit` hook starts `scripts/preview-deploy.sh` in the background.
- Commit success is never blocked by preview deployment failure.
- Background logs are written to `.preview/post-commit.log`.

## Setup Checklist

1. Copy `.env.preview.example` to `.env.preview`
2. Copy `.env.test.example` to `.env.test`
3. Review secret values in both files
4. Run `pnpm preview:hooks`
5. Run `pnpm preview:deploy`
6. Open `http://localhost:35540`

## Troubleshooting

- If preview does not start, run `pnpm preview:status` and `pnpm preview:logs`.
- If the database migration fails, inspect the `api` logs first.
- If a deployment is already running, wait for it to finish or inspect `.preview/post-commit.log`.
- If you need a clean preview environment, run `pnpm preview:reset` and redeploy.

## Test Isolation Note

The API test helpers load `.env.test` first and fall back to `.env` only when `.env.test` is missing. Create `.env.test` before running destructive automated tests if you want full isolation from dev data.
