#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.prod.yml}"
STATIC_ROOT="${TASKFLOW_STATIC_ROOT:-/opt/taskflow-static}"

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/taskflow-static.XXXXXX")
cleanup() {
	rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TMP_DIR/_next/static" "$TMP_DIR/public"

docker compose -f "$COMPOSE_FILE" cp web:/app/apps/web/.next/static/. "$TMP_DIR/_next/static/"
docker compose -f "$COMPOSE_FILE" cp web:/app/apps/web/public/. "$TMP_DIR/public/"

mkdir -p "$STATIC_ROOT/_next"
rm -rf "$STATIC_ROOT/_next/static" "$STATIC_ROOT/public"
mv "$TMP_DIR/_next/static" "$STATIC_ROOT/_next/static"
mv "$TMP_DIR/public" "$STATIC_ROOT/public"

printf 'Synced Next.js static assets to %s\n' "$STATIC_ROOT"
