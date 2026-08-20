#!/usr/bin/env bash
# Deploy system-health-check (Faza A). Wymaga GO + SMTP.
# Nie odpalaj workera CRM, n8n ani workflow Twenty.
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
: "${TWENTY_API_KEY_SANDBOX:?Ustaw TWENTY_API_KEY_SANDBOX}"
: "${HEALTH_SMTP_USER:?Ustaw HEALTH_SMTP_USER}"
: "${HEALTH_SMTP_PASS:?Ustaw HEALTH_SMTP_PASS}"

FUNCTION_NAME="${FUNCTION_NAME:-system-health-check}"
HEALTH_GCS_BUCKET="${HEALTH_GCS_BUCKET:-owocni-system-health}"
HEALTH_ALERT_TO="${HEALTH_ALERT_TO:-dawidnowak@owocni.pl}"
HEALTH_SMTP_HOST="${HEALTH_SMTP_HOST:-smtp.example.com}"
HEALTH_SMTP_PORT="${HEALTH_SMTP_PORT:-587}"
echo "Deploying ${FUNCTION_NAME} to ${GCP_PROJECT} (${GCP_REGION})..."

gcloud config set project "$GCP_PROJECT" >/dev/null

gcloud services enable cloudfunctions.googleapis.com run.googleapis.com \
  cloudscheduler.googleapis.com storage.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project="$GCP_PROJECT" >/dev/null

if ! gcloud storage buckets describe "gs://${HEALTH_GCS_BUCKET}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${HEALTH_GCS_BUCKET}" \
    --project="$GCP_PROJECT" \
    --location="$GCP_REGION" \
    --uniform-bucket-level-access
fi

ENV_VARS="GCP_PROJECT=${GCP_PROJECT},GCP_REGION=${GCP_REGION},HEALTH_GCS_BUCKET=${HEALTH_GCS_BUCKET},HEALTH_ALERT_TO=${HEALTH_ALERT_TO},HEALTH_SMTP_HOST=${HEALTH_SMTP_HOST},HEALTH_SMTP_PORT=${HEALTH_SMTP_PORT},HEALTH_SMTP_USER=${HEALTH_SMTP_USER},HEALTH_SMTP_PASS=${HEALTH_SMTP_PASS},TWENTY_API_KEY_SANDBOX=${TWENTY_API_KEY_SANDBOX},TWENTY_REST_URL_SANDBOX=${TWENTY_REST_URL_SANDBOX:-https://api.twenty.com/rest}"

if [[ -n "${HEALTH_SMTP_FROM:-}" ]]; then
  ENV_VARS="${ENV_VARS},HEALTH_SMTP_FROM=${HEALTH_SMTP_FROM}"
fi
if [[ -n "${TWENTY_API_KEY_PROD:-}" ]]; then
  ENV_VARS="${ENV_VARS},TWENTY_API_KEY_PROD=${TWENTY_API_KEY_PROD},TWENTY_REST_URL_PROD=${TWENTY_REST_URL_PROD:-https://api.twenty.com/rest}"
fi
if [[ -n "${N8N_API_KEY:-}" ]]; then
  ENV_VARS="${ENV_VARS},N8N_API_KEY=${N8N_API_KEY},N8N_BASE_URL=${N8N_BASE_URL}"
fi
if [[ -n "${HEALTH_GATE_UNTIL:-}" ]]; then
  ENV_VARS="${ENV_VARS},HEALTH_GATE_UNTIL=${HEALTH_GATE_UNTIL}"
fi

gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --runtime=nodejs20 \
  --source=. \
  --entry-point=processSystemHealthCheck \
  --trigger-http \
  --no-allow-unauthenticated \
  --memory=256Mi \
  --timeout=60s \
  --min-instances=0 \
  --max-instances=1 \
  --set-env-vars="$ENV_VARS"

URI="$(gcloud functions describe "$FUNCTION_NAME" \
  --gen2 \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format='value(serviceConfig.uri)')"

# Runtime SA needs scheduler.list + GCS. Default compute SA is used by gen2 unless set.
PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT" --format='value(projectNumber)')"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud storage buckets add-iam-policy-binding "gs://${HEALTH_GCS_BUCKET}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.objectAdmin" \
  --quiet || true

gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/cloudscheduler.viewer" \
  --quiet || true

gcloud run services add-iam-policy-binding "$FUNCTION_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/run.invoker" \
  --quiet || true

create_job() {
  local name="$1"
  local schedule="$2"
  local body="$3"
  if gcloud scheduler jobs describe "$name" --location="$GCP_REGION" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$name" \
      --location="$GCP_REGION" \
      --schedule="$schedule" \
      --time-zone="Europe/Warsaw" \
      --uri="$URI" \
      --http-method=POST \
      --message-body="$body" \
      --oidc-service-account-email="$COMPUTE_SA" \
      --oidc-token-audience="$URI"
  else
    gcloud scheduler jobs create http "$name" \
      --location="$GCP_REGION" \
      --schedule="$schedule" \
      --time-zone="Europe/Warsaw" \
      --uri="$URI" \
      --http-method=POST \
      --headers="Content-Type=application/json" \
      --message-body="$body" \
      --oidc-service-account-email="$COMPUTE_SA" \
      --oidc-token-audience="$URI"
  fi
}

create_job "system-health-probe-every-30min" "*/30 7-20 * * 1-5" '{"mode":"probe"}'
create_job "system-health-digest-daily-0800" "0 8 * * *" '{"mode":"digest"}'

echo ""
echo "URL: $URI"
echo "Jobs: system-health-probe-every-30min  system-health-digest-daily-0800"
echo "Smoke: gcloud scheduler jobs run system-health-digest-daily-0800 --location=${GCP_REGION}"
