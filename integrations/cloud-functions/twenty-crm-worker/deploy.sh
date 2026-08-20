#!/usr/bin/env bash
# Deploy twenty-crm-worker to Google Cloud Functions (Gen2).
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

FUNCTION_NAME="${FUNCTION_NAME:-twenty-crm-worker-sandbox}"
STAPE_API_BASE="${STAPE_API_BASE:-https://uinpcbwf.eug.stape.io/stape-api}"
TWENTY_REST_URL="${TWENTY_REST_URL:-https://api.twenty.com/rest}"
CREATE_LEAD_WRITE_ENABLED="${CREATE_LEAD_WRITE_ENABLED:-true}"
CONTINUITY_ROUTING_ENABLED="${CONTINUITY_ROUTING_ENABLED:-false}"
USE_SECRETS="${USE_SECRETS:-false}"

# Stape Store API key = sam hash (bez prefiksu eug:container:)
if [[ "$STAPE_API_KEY" == eug:* ]]; then
  STAPE_API_KEY="${STAPE_API_KEY##*:}"
fi

echo "Deploying ${FUNCTION_NAME} to ${GCP_PROJECT} (${GCP_REGION})..."

gcloud config set project "$GCP_PROJECT" >/dev/null

gcloud services enable cloudfunctions.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com \
  --project="$GCP_PROJECT" >/dev/null

ENV_VARS="STAPE_API_BASE=${STAPE_API_BASE},TWENTY_REST_URL=${TWENTY_REST_URL},CREATE_LEAD_WRITE_ENABLED=${CREATE_LEAD_WRITE_ENABLED},CONTINUITY_ROUTING_ENABLED=${CONTINUITY_ROUTING_ENABLED},TWENTY_OWNER_MACIEJ=${TWENTY_OWNER_MACIEJ:-7fddba1d-e443-47d4-97b7-a3a829efd8c1},TWENTY_OWNER_MARTA=${TWENTY_OWNER_MARTA:-4704e0c0-8d77-4640-ad1e-1875294294df},TWENTY_OWNER_GOSIA=${TWENTY_OWNER_GOSIA:-ccac533d-a34b-4cfc-a036-9e75ee3f8910},TWENTY_OWNER_EWA=${TWENTY_OWNER_EWA:-b9e2b31e-0b4a-4936-9d2a-2e5b4a3e0b16},TWENTY_OWNER_ROBERT=${TWENTY_OWNER_ROBERT:-23ac9976-0232-4097-b056-5dc391bf7c34}"

if [[ -n "${CONTINUITY_OWNER_IDS:-}" ]]; then
  ENV_VARS="${ENV_VARS},CONTINUITY_OWNER_IDS=${CONTINUITY_OWNER_IDS}"
fi

# Optional: company enrichment (ENRICH_COMPANY_PL) + GUS when available
if [[ -n "${ENRICH_COMPANY_PL_TOKEN:-}" ]]; then
  ENV_VARS="${ENV_VARS},ENRICH_COMPANY_PL_TOKEN=${ENRICH_COMPANY_PL_TOKEN}"
fi
if [[ -n "${GUS_BIR_KEY:-}" ]]; then
  ENV_VARS="${ENV_VARS},GUS_BIR_KEY=${GUS_BIR_KEY}"
fi
# Fakturownia issue invoice
if [[ -n "${X_INVOICE_TOKEN:-}" ]]; then
  ENV_VARS="${ENV_VARS},X_INVOICE_TOKEN=${X_INVOICE_TOKEN}"
fi
if [[ -n "${FAKTUROWNIA_DOMAIN:-}" ]]; then
  ENV_VARS="${ENV_VARS},FAKTUROWNIA_DOMAIN=${FAKTUROWNIA_DOMAIN}"
fi
if [[ -n "${FAKTUROWNIA_API_TOKEN:-}" ]]; then
  ENV_VARS="${ENV_VARS},FAKTUROWNIA_API_TOKEN=${FAKTUROWNIA_API_TOKEN}"
fi
if [[ -n "${FAKTUROWNIA_DEPARTMENT_ID:-}" ]]; then
  ENV_VARS="${ENV_VARS},FAKTUROWNIA_DEPARTMENT_ID=${FAKTUROWNIA_DEPARTMENT_ID}"
fi

DEPLOY_ARGS=(
  --gen2
  --project="$GCP_PROJECT"
  --region="$GCP_REGION"
  --runtime=nodejs20
  --source=.
  --entry-point=processTwentyCrmWorker
  --trigger-http
  --allow-unauthenticated
  --timeout=300s
)

if [[ "$USE_SECRETS" == "true" ]]; then
  gcloud functions deploy "$FUNCTION_NAME" \
    "${DEPLOY_ARGS[@]}" \
    --set-env-vars="$ENV_VARS" \
    --set-secrets="STAPE_API_KEY=STAPE_API_KEY:latest,TWENTY_API_KEY=TWENTY_API_KEY:latest"
else
  # Sandbox: klucze z .env.deploy (brak Secret Manager w projekcie)
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
