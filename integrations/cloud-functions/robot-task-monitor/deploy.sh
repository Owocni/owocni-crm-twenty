#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGRATIONS_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$SCRIPT_DIR"

cp "$INTEGRATIONS_DIR/GoogleCloudRobot.js" .
cp -r "$INTEGRATIONS_DIR/shared" .

if [[ -f .env.deploy ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.deploy
  set +a
fi

: "${GCP_PROJECT:?Ustaw GCP_PROJECT}"
: "${GCP_REGION:?Ustaw GCP_REGION}"

gcloud config set project "$GCP_PROJECT" >/dev/null

echo "Deploying robot-task-monitor (Meta CAPI + biz_value sheet)..."

DEPLOY_ARGS=(
  --project="$GCP_PROJECT"
  --region="$GCP_REGION"
  --source=.
  --function=processTaskQueue
  --base-image=google-22/nodejs22
  --no-allow-unauthenticated
)

if [[ -n "${META_PIXEL_ID:-}" && -n "${META_CAPI_ACCESS_TOKEN:-}" ]]; then
  UPDATE_ENV="META_PIXEL_ID=${META_PIXEL_ID},META_CAPI_ACCESS_TOKEN=${META_CAPI_ACCESS_TOKEN},META_GRAPH_API_VERSION=${META_GRAPH_API_VERSION:-v21.0}"
  if [[ -n "${META_INSTA_FORM_CAPI_FROM_SANDBOX:-}" ]]; then
    UPDATE_ENV+=",META_INSTA_FORM_CAPI_FROM_SANDBOX=${META_INSTA_FORM_CAPI_FROM_SANDBOX}"
  fi
  echo "Updating Meta CAPI env (pixel ${META_PIXEL_ID})..."
  DEPLOY_ARGS+=(--update-env-vars="$UPDATE_ENV")
else
  echo "META_PIXEL_ID / META_CAPI_ACCESS_TOKEN not in env — Cloud Run keeps existing Meta vars (if any)."
  if [[ -n "${META_INSTA_FORM_CAPI_FROM_SANDBOX:-}" ]]; then
    echo "Updating META_INSTA_FORM_CAPI_FROM_SANDBOX=${META_INSTA_FORM_CAPI_FROM_SANDBOX}"
    DEPLOY_ARGS+=(--update-env-vars="META_INSTA_FORM_CAPI_FROM_SANDBOX=${META_INSTA_FORM_CAPI_FROM_SANDBOX}")
  fi
fi

gcloud run deploy robot-task-monitor "${DEPLOY_ARGS[@]}"

echo "URL:"
gcloud run services describe robot-task-monitor \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format='value(status.url)'
