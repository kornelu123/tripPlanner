#!/bin/sh
set -eu

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${MAPS_KEY:?MAPS_KEY is required}"
: "${MAPS_MAP_ID:?MAPS_MAP_ID is required}"

REGION="${REGION:-europe-central2}"
SERVICE="${SERVICE:-trip-planner}"
REPOSITORY="${REPOSITORY:-trip-planner}"
MIGRATION_JOB="${MIGRATION_JOB:-trip-planner-migrate}"

command -v gcloud >/dev/null 2>&1 || {
  echo "gcloud is required" >&2
  exit 1
}
command -v pnpm >/dev/null 2>&1 || {
  echo "pnpm is required" >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  echo "curl is required" >&2
  exit 1
}

test -z "$(git status --porcelain)" || {
  echo "Commit or stash all changes before deploying." >&2
  exit 1
}

revision="$(git rev-parse HEAD)"
image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE}:${revision}"
build_config="$(mktemp)"
trap 'rm -f "$build_config"' EXIT

cat >"$build_config" <<'EOF'
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - --build-arg
      - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${_MAPS_KEY}
      - --build-arg
      - NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=${_MAPS_MAP_ID}
      - --tag
      - ${_IMAGE}
      - .
images:
  - ${_IMAGE}
EOF

echo "Running checks for ${revision}"
pnpm lint
pnpm typecheck
pnpm test

echo "Building ${image}"
gcloud builds submit . \
  --config="$build_config" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --substitutions="_IMAGE=${image},_MAPS_KEY=${MAPS_KEY},_MAPS_MAP_ID=${MAPS_MAP_ID}"

echo "Running database migrations"
gcloud run jobs update "$MIGRATION_JOB" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$image" \
  --quiet
gcloud run jobs execute "$MIGRATION_JOB" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --wait

echo "Deploying ${SERVICE}"
gcloud run services update "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$image" \
  --quiet

app_url="$(
  gcloud run services describe "$SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(status.url)'
)"

echo "Checking ${app_url}/api/health"
attempt=1
while ! curl --fail --show-error --silent "${app_url}/api/health"; do
  if [ "$attempt" -eq 10 ]; then
    echo "Deployment finished, but the health check failed." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 3
done
printf '\nDeployed %s to %s\n' "$revision" "$app_url"
