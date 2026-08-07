#!/usr/bin/env bash
# Deploy meta-lead-webhook to Google Cloud Functions (Gen2).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f .env.deploy ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.deploy
  set +a
fi

: "${GCP_PROJECT:?Ustaw GCP_PROJECT}"
: "${GCP_REGION:?Ustaw GCP_REGION}"
: "${META_WEBHOOK_VERIFY_TOKEN:?Ustaw META_WEBHOOK_VERIFY_TOKEN}"
: "${META_PAGE_ACCESS_TOKEN:?Ustaw META_PAGE_ACCESS_TOKEN}"
: "${TWENTY_CRM_WORKER_URL:?Ustaw TWENTY_CRM_WORKER_URL}"

FUNCTION_NAME="${FUNCTION_NAME:-meta-lead-webhook-sandbox}"
META_PAGE_ID="${META_PAGE_ID:-149525518409675}"
META_GRAPH_API_VERSION="${META_GRAPH_API_VERSION:-v21.0}"
RUNTIME_ENVIRONMENT="${RUNTIME_ENVIRONMENT:-sandbox}"

echo "Deploying ${FUNCTION_NAME} to ${GCP_PROJECT} (${GCP_REGION})..."

gcloud config set project "$GCP_PROJECT" >/dev/null

gcloud services enable cloudfunctions.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project="$GCP_PROJECT" >/dev/null

META_FORM_IDS="${META_FORM_IDS:-1073605628462622}"
META_LEAD_POLL_SECRET="${META_LEAD_POLL_SECRET:-${META_WEBHOOK_VERIFY_TOKEN}}"

ENV_VARS="META_WEBHOOK_VERIFY_TOKEN=${META_WEBHOOK_VERIFY_TOKEN},META_PAGE_ACCESS_TOKEN=${META_PAGE_ACCESS_TOKEN},META_PAGE_ID=${META_PAGE_ID},META_GRAPH_API_VERSION=${META_GRAPH_API_VERSION},TWENTY_CRM_WORKER_URL=${TWENTY_CRM_WORKER_URL},RUNTIME_ENVIRONMENT=${RUNTIME_ENVIRONMENT},META_FORM_IDS=${META_FORM_IDS},META_LEAD_POLL_SECRET=${META_LEAD_POLL_SECRET}"

gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --runtime=nodejs20 \
  --source=. \
  --entry-point=processMetaLeadWebhook \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="$ENV_VARS"

echo ""
echo "Callback URL (wklej w Meta Webhooks → Page):"
gcloud functions describe "$FUNCTION_NAME" \
  --gen2 \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format='value(serviceConfig.uri)'
