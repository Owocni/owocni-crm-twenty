#!/usr/bin/env bash
# Deploy twenty-inbound-webhook to Google Cloud Functions (Gen2).
# Wymaga: gcloud CLI, zalogowany projekt, env vars w .env.deploy (lokalnie, nie commituj).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f .env.deploy ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.deploy
  set +a
fi

: "${GCP_PROJECT:?Ustaw GCP_PROJECT (np. owocni-robot — NIE nazwa Cloud Run)}"
: "${GCP_REGION:?Ustaw GCP_REGION (np. europe-central2)}"
: "${STAPE_API_KEY:?Ustaw STAPE_API_KEY}"
: "${TWENTY_API_KEY:?Ustaw TWENTY_API_KEY}"

FUNCTION_NAME="${FUNCTION_NAME:-twenty-inbound-webhook-sandbox}"
STAPE_API_BASE="${STAPE_API_BASE:-https://uinpcbwf.eug.stape.io/stape-api}"
TWENTY_REST_URL="${TWENTY_REST_URL:-https://api.twenty.com/rest}"
RUNTIME_ENVIRONMENT="${RUNTIME_ENVIRONMENT:-sandbox}"
LEADS_AT_MESSAGE_CHANNEL_ID="${LEADS_AT_MESSAGE_CHANNEL_ID:-32629e97-6dc2-452f-aa26-38c72eaab3a4}"
USE_SECRETS="${USE_SECRETS:-false}"

# Stape Store API key = sam hash (bez prefiksu eug:container:)
if [[ "$STAPE_API_KEY" == eug:* ]]; then
  STAPE_API_KEY="${STAPE_API_KEY##*:}"
fi

echo "Deploying ${FUNCTION_NAME} to ${GCP_PROJECT} (${GCP_REGION})..."

# Bundle free-mail SSOT into CF source (isFreeMail + JSON next to shared/)
SHARED_SRC="$(cd "$SCRIPT_DIR/../../shared" && pwd)"
mkdir -p "$SCRIPT_DIR/shared/data"
cp "$SHARED_SRC/isFreeMail.js" "$SCRIPT_DIR/shared/isFreeMail.js"
cp "$SHARED_SRC/data/free_mail_domains_v1.json" \
  "$SCRIPT_DIR/shared/data/free_mail_domains_v1.json"
echo "Bundled free-mail SSOT → shared/data/free_mail_domains_v1.json"

gcloud config set project "$GCP_PROJECT" >/dev/null

gcloud services enable cloudfunctions.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project="$GCP_PROJECT" >/dev/null

ENV_VARS="STAPE_API_BASE=${STAPE_API_BASE},TWENTY_REST_URL=${TWENTY_REST_URL},RUNTIME_ENVIRONMENT=${RUNTIME_ENVIRONMENT},LEADS_AT_MESSAGE_CHANNEL_ID=${LEADS_AT_MESSAGE_CHANNEL_ID}"

DEPLOY_ARGS=(
  --gen2
  --project="$GCP_PROJECT"
  --region="$GCP_REGION"
  --runtime=nodejs20
  --source=.
  --entry-point=processTwentyInboundWebhook
  --trigger-http
  --allow-unauthenticated
)

if [[ "$USE_SECRETS" == "true" ]]; then
  gcloud functions deploy "$FUNCTION_NAME" \
    "${DEPLOY_ARGS[@]}" \
    --set-env-vars="$ENV_VARS" \
    --set-secrets="STAPE_API_KEY=STAPE_API_KEY:latest,TWENTY_API_KEY=TWENTY_API_KEY:latest"
else
  gcloud functions deploy "$FUNCTION_NAME" \
    "${DEPLOY_ARGS[@]}" \
    --set-env-vars="${ENV_VARS},STAPE_API_KEY=${STAPE_API_KEY},TWENTY_API_KEY=${TWENTY_API_KEY}"
fi

echo ""
echo "URL funkcji:"
gcloud functions describe "$FUNCTION_NAME" \
  --gen2 \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format='value(serviceConfig.uri)'
