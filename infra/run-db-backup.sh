#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${DB_BACKUP_CONFIG:-$SCRIPT_DIR/.db-backup.env}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Backup config not found: $CONFIG_FILE" >&2
  echo "Run infra/install-db-backup-cron.sh first." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$CONFIG_FILE"
set +a

COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.prod.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-taskflow}"
POSTGRES_DB="${POSTGRES_DB:-taskflow}"
BACKUP_PREFIX="${BACKUP_PREFIX:-postgres}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$SCRIPT_DIR/backups}"
LOCAL_KEEP_COUNT="${LOCAL_KEEP_COUNT:-3}"
R2_REGION="${R2_REGION:-auto}"

required_vars=(
  R2_ENDPOINT
  R2_BUCKET
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required config value: $var_name" >&2
    exit 1
  fi
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the database backup." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required: docker compose version failed." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

normalize_endpoint() {
  case "$1" in
    http://*|https://*) printf '%s\n' "$1" ;;
    *) printf 'https://%s\n' "$1" ;;
  esac
}

R2_ENDPOINT="$(normalize_endpoint "$R2_ENDPOINT")"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_NAME="taskflow-db-$TIMESTAMP.dump"
TMP_DIR="$LOCAL_BACKUP_DIR/tmp"
FINAL_DIR="$LOCAL_BACKUP_DIR/postgres"
TMP_PATH="$TMP_DIR/$BACKUP_NAME"
FINAL_PATH="$FINAL_DIR/$BACKUP_NAME"
S3_KEY="$BACKUP_PREFIX/$BACKUP_NAME"

mkdir -p "$TMP_DIR" "$FINAL_DIR"

cleanup() {
  rm -f "$TMP_PATH"
}
trap cleanup EXIT

echo "[$(date -Is)] Starting PostgreSQL backup: $BACKUP_NAME"

docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$TMP_PATH"

if [[ ! -s "$TMP_PATH" ]]; then
  echo "pg_dump produced an empty file: $TMP_PATH" >&2
  exit 1
fi

echo "[$(date -Is)] Uploading to s3://$R2_BUCKET/$S3_KEY"

docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION="$R2_REGION" \
  -e AWS_EC2_METADATA_DISABLED=true \
  -v "$TMP_DIR:/backup:ro" \
  amazon/aws-cli:latest \
  --endpoint-url "$R2_ENDPOINT" \
  s3 cp "/backup/$BACKUP_NAME" "s3://$R2_BUCKET/$S3_KEY"

mv "$TMP_PATH" "$FINAL_PATH"
trap - EXIT

if [[ "$LOCAL_KEEP_COUNT" =~ ^[0-9]+$ ]] && (( LOCAL_KEEP_COUNT > 0 )); then
  mapfile -t old_backups < <(
    find "$FINAL_DIR" -maxdepth 1 -type f -name 'taskflow-db-*.dump' -printf '%T@ %p\n' \
      | sort -nr \
      | cut -d' ' -f2- \
      | awk -v keep="$LOCAL_KEEP_COUNT" 'NR > keep {print}'
  )

  if (( ${#old_backups[@]} > 0 )); then
    rm -f "${old_backups[@]}"
  fi
fi

echo "[$(date -Is)] Backup complete: $FINAL_PATH"
echo "[$(date -Is)] Restore check example:"
echo "  docker run --rm -v \"$FINAL_DIR:/backup:ro\" postgres:16-alpine pg_restore --list \"/backup/$BACKUP_NAME\" >/dev/null"
