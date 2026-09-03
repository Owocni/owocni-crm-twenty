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

# YAML env file — przecinki w wartościach (POOL_IDS, META_ROBERT_IDS, HOLIDAYS)
# nie łamią --set-env-vars.
ENV_FILE="$(mktemp "${TMPDIR:-/tmp}/twenty-crm-worker-env.XXXXXX.yaml")"
cleanup() { rm -f "$ENV_FILE"; }
trap cleanup EXIT

yaml_escape() {
  # Quote values that need it (commas, colons, spaces, specials)
  local v="$1"
  printf "'%s'\n" "${v//\'/\'\'}"
}

{
  echo "STAPE_API_BASE: $(yaml_escape "$STAPE_API_BASE")"
  echo "TWENTY_REST_URL: $(yaml_escape "$TWENTY_REST_URL")"
  echo "LEADS_AT_MESSAGE_CHANNEL_ID: $(yaml_escape "${LEADS_AT_MESSAGE_CHANNEL_ID:-32629e97-6dc2-452f-aa26-38c72eaab3a4}")"
  echo "CREATE_LEAD_WRITE_ENABLED: $(yaml_escape "$CREATE_LEAD_WRITE_ENABLED")"
  echo "CONTINUITY_ROUTING_ENABLED: $(yaml_escape "$CONTINUITY_ROUTING_ENABLED")"
  echo "CUTOVER_AT: $(yaml_escape "${CUTOVER_AT:-2026-08-31T00:00:00+02:00}")"
  echo "TWENTY_OWNER_MACIEJ: $(yaml_escape "${TWENTY_OWNER_MACIEJ:-7fddba1d-e443-47d4-97b7-a3a829efd8c1}")"
  echo "TWENTY_OWNER_MARTA: $(yaml_escape "${TWENTY_OWNER_MARTA:-4704e0c0-8d77-4640-ad1e-1875294294df}")"
  echo "TWENTY_OWNER_GOSIA: $(yaml_escape "${TWENTY_OWNER_GOSIA:-ccac533d-a34b-4cfc-a036-9e75ee3f8910}")"
  echo "TWENTY_OWNER_EWA: $(yaml_escape "${TWENTY_OWNER_EWA:-b9e2b31e-0b4a-4936-9d2a-2e5b4a3e0b16}")"
  echo "TWENTY_OWNER_ROBERT: $(yaml_escape "${TWENTY_OWNER_ROBERT:-23ac9976-0232-4097-b056-5dc391bf7c34}")"

  if [[ -n "${CONTINUITY_OWNER_IDS:-}" ]]; then
    echo "CONTINUITY_OWNER_IDS: $(yaml_escape "$CONTINUITY_OWNER_IDS")"
  fi

  if [[ "${LEAD_DISPATCHER_ENABLED:-}" == "true" || "${LEAD_DISPATCHER_ENABLED:-}" == "1" ]]; then
    echo "LEAD_DISPATCHER_ENABLED: 'true'"
  fi
  if [[ -n "${LEAD_DISPATCH_FAILOVER_ENABLED:-}" ]]; then
    echo "LEAD_DISPATCH_FAILOVER_ENABLED: $(yaml_escape "$LEAD_DISPATCH_FAILOVER_ENABLED")"
  fi
  if [[ "${LEAD_DISPATCHER_SWEEP_ON_POLL:-}" == "true" || "${LEAD_DISPATCHER_SWEEP_ON_POLL:-}" == "1" ]]; then
    echo "LEAD_DISPATCHER_SWEEP_ON_POLL: 'true'"
  fi
  if [[ -n "${LEAD_DISPATCH_MANAGER_EMAIL:-}" ]]; then
    echo "LEAD_DISPATCH_MANAGER_EMAIL: $(yaml_escape "$LEAD_DISPATCH_MANAGER_EMAIL")"
  fi
  if [[ -n "${LEAD_DISPATCH_POOL_IDS:-}" ]]; then
    echo "LEAD_DISPATCH_POOL_IDS: $(yaml_escape "$LEAD_DISPATCH_POOL_IDS")"
  fi
  if [[ -n "${LEAD_DISPATCH_VACATION_IDS:-}" ]]; then
    echo "LEAD_DISPATCH_VACATION_IDS: $(yaml_escape "$LEAD_DISPATCH_VACATION_IDS")"
  fi
  if [[ -n "${LEAD_DISPATCH_HOLIDAYS:-}" ]]; then
    echo "LEAD_DISPATCH_HOLIDAYS: $(yaml_escape "$LEAD_DISPATCH_HOLIDAYS")"
  fi
  if [[ -n "${LEAD_DISPATCH_META_ROBERT_IDS:-}" ]]; then
    echo "LEAD_DISPATCH_META_ROBERT_IDS: $(yaml_escape "$LEAD_DISPATCH_META_ROBERT_IDS")"
  fi
  if [[ -n "${LEAD_DISPATCH_MANAGER_WEBHOOK_URL:-}" ]]; then
    echo "LEAD_DISPATCH_MANAGER_WEBHOOK_URL: $(yaml_escape "$LEAD_DISPATCH_MANAGER_WEBHOOK_URL")"
  fi
  if [[ -n "${LEAD_DISPATCH_MAX_OPEN:-}" ]]; then
    echo "LEAD_DISPATCH_MAX_OPEN: $(yaml_escape "$LEAD_DISPATCH_MAX_OPEN")"
  fi
  if [[ -n "${LEAD_DISPATCH_SWEEP_LIMIT:-}" ]]; then
    echo "LEAD_DISPATCH_SWEEP_LIMIT: $(yaml_escape "$LEAD_DISPATCH_SWEEP_LIMIT")"
  fi

  if [[ -n "${ENRICH_COMPANY_PL_TOKEN:-}" ]]; then
    echo "ENRICH_COMPANY_PL_TOKEN: $(yaml_escape "$ENRICH_COMPANY_PL_TOKEN")"
  fi
  if [[ -n "${GUS_BIR_KEY:-}" ]]; then
    echo "GUS_BIR_KEY: $(yaml_escape "$GUS_BIR_KEY")"
  fi
  if [[ -n "${X_INVOICE_TOKEN:-}" ]]; then
    echo "X_INVOICE_TOKEN: $(yaml_escape "$X_INVOICE_TOKEN")"
  fi
  if [[ -n "${FAKTUROWNIA_DOMAIN:-}" ]]; then
    echo "FAKTUROWNIA_DOMAIN: $(yaml_escape "$FAKTUROWNIA_DOMAIN")"
  fi
  if [[ -n "${FAKTUROWNIA_API_TOKEN:-}" ]]; then
    echo "FAKTUROWNIA_API_TOKEN: $(yaml_escape "$FAKTUROWNIA_API_TOKEN")"
  fi
  if [[ -n "${FAKTUROWNIA_DEPARTMENT_ID:-}" ]]; then
    echo "FAKTUROWNIA_DEPARTMENT_ID: $(yaml_escape "$FAKTUROWNIA_DEPARTMENT_ID")"
  fi

  if [[ "$USE_SECRETS" != "true" ]]; then
    echo "STAPE_API_KEY: $(yaml_escape "$STAPE_API_KEY")"
    echo "TWENTY_API_KEY: $(yaml_escape "$TWENTY_API_KEY")"
  fi
} >"$ENV_FILE"

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
  --env-vars-file="$ENV_FILE"
)

if [[ "$USE_SECRETS" == "true" ]]; then
  gcloud functions deploy "$FUNCTION_NAME" \
    "${DEPLOY_ARGS[@]}" \
    --set-secrets="STAPE_API_KEY=STAPE_API_KEY:latest,TWENTY_API_KEY=TWENTY_API_KEY:latest"
else
  gcloud functions deploy "$FUNCTION_NAME" \
    "${DEPLOY_ARGS[@]}"
fi

echo ""
echo "URL funkcji:"
gcloud functions describe "$FUNCTION_NAME" \
  --gen2 \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format='value(serviceConfig.uri)'
