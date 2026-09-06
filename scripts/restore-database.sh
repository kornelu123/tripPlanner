#!/bin/sh
set -eu

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must be an isolated drill database}"
: "${BACKUP_REPOSITORY:?BACKUP_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"

directory="$(mktemp -d)"
trap 'rm -rf "$directory"' EXIT
restic restore latest --tag trip-planner-db --target "$directory"
dump="$(find "$directory" -name trip-planner.dump -type f | head -n 1)"
test -n "$dump"
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" "$dump"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM users' -c 'SELECT count(*) FROM trips'
