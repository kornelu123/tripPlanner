#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_REPOSITORY:?BACKUP_REPOSITORY must point to off-server object storage}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"

directory="$(mktemp -d)"
trap 'rm -rf "$directory"' EXIT
pg_dump --format=custom --no-owner --file="$directory/trip-planner.dump" "$DATABASE_URL"
restic backup "$directory/trip-planner.dump" --tag trip-planner-db
restic forget --tag trip-planner-db --keep-daily 7 --keep-weekly 5 --keep-monthly 12 --prune
