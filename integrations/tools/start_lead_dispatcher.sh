#!/usr/bin/env bash
# Lead Dispatcher v2.0 — one-shot START (prepare or full go-live).
#
# Usage:
#   ./integrations/tools/start_lead_dispatcher.sh check    # preflight only
#   ./integrations/tools/start_lead_dispatcher.sh prepare  # deploy kod+pola+WF, flagi OFF
#   ./integrations/tools/start_lead_dispatcher.sh go       # pełny START (flagi ON + smoke)
#
# Wymaga: TWENTY_API_KEY w .env.local lub twenty-crm-worker/.env.deploy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKER_DIR="$REPO_ROOT/integrations/cloud-functions/twenty-crm-worker"
MODE="${1:-check}"

HOLIDAYS_DEFAULT="2026-01-01,2026-01-06,2026-05-01,2026-05-03,2026-08-15,2026-11-01,2026-11-11,2026-12-25,2026-12-26"
# Piotr 2026-08-25 — marketing/strategia → Robert (LEAD_DISPATCHER_PLAN §3.1)
META_ROBERT_IDS_DEFAULT="120250072847080433,120250072846850433,120250072722520433,120250072471360433,120250072471350433,120250072471300433,120250068162040433,120245791885450433"

log() { echo "==> $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

load_env() {
  if [[ -f "$REPO_ROOT/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$REPO_ROOT/.env.local"
    set +a
  fi
  if [[ -f "$WORKER_DIR/.env.deploy" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$WORKER_DIR/.env.deploy"
    set +a
  fi
}

preflight() {
  load_env
  [[ -n "${TWENTY_API_KEY:-}" ]] || fail "Brak TWENTY_API_KEY (.env.local lub .env.deploy)"
  [[ -f "$WORKER_DIR/deploy.sh" ]] || fail "Brak worker deploy.sh"
  command -v python3 >/dev/null || fail "python3 required"
  command -v node >/dev/null || fail "node required"
  command -v gcloud >/dev/null || fail "gcloud required (deploy CF)"
  log "Preflight OK (mode=$MODE)"
}

run_tests() {
  log "Unit tests leadDispatch"
  (cd "$WORKER_DIR" && npm test -- workers/leadDispatch.test.js 2>/dev/null || node --test workers/leadDispatch.test.js)
}

deploy_fields() {
  log "Metadata: pola dyspozytora"
  (cd "$REPO_ROOT" && python3 integrations/tools/deploy_lead_dispatcher_fields.py)
}

enable_flags_in_env_deploy() {
  local f="$WORKER_DIR/.env.deploy"
  [[ -f "$f" ]] || fail "Brak $f — skopiuj z .env.deploy.example"

  # Idempotent: uncomment dispatcher block if still commented
  if grep -q '^# LEAD_DISPATCHER_ENABLED=' "$f"; then
    log "Odkomentowuję flagi dyspozytora w .env.deploy"
    sed -i.bak \
      -e 's/^# LEAD_DISPATCHER_ENABLED=.*/LEAD_DISPATCHER_ENABLED=true/' \
      -e 's/^# LEAD_DISPATCHER_SWEEP_ON_POLL=.*/LEAD_DISPATCHER_SWEEP_ON_POLL=true/' \
      -e 's/^# LEAD_DISPATCH_MANAGER_EMAIL=.*/LEAD_DISPATCH_MANAGER_EMAIL=maciej@owocni.pl/' \
      -e "s|^# LEAD_DISPATCH_HOLIDAYS=.*|LEAD_DISPATCH_HOLIDAYS=${HOLIDAYS_DEFAULT}|" \
      -e "s|^# LEAD_DISPATCH_META_ROBERT_IDS=.*|LEAD_DISPATCH_META_ROBERT_IDS=${META_ROBERT_IDS_DEFAULT}|" \
      "$f"
    rm -f "$f.bak"
  fi

  # Ensure Meta list even if flags were already uncommented without IDs
  if ! grep -q '^LEAD_DISPATCH_META_ROBERT_IDS=.' "$f"; then
    if grep -q '^LEAD_DISPATCH_META_ROBERT_IDS=' "$f"; then
      sed -i.bak "s|^LEAD_DISPATCH_META_ROBERT_IDS=.*|LEAD_DISPATCH_META_ROBERT_IDS=${META_ROBERT_IDS_DEFAULT}|" "$f"
      rm -f "$f.bak"
    else
      echo "LEAD_DISPATCH_META_ROBERT_IDS=${META_ROBERT_IDS_DEFAULT}" >>"$f"
    fi
  fi

  # Ensure pool IDs if missing
  if ! grep -q '^LEAD_DISPATCH_POOL_IDS=' "$f"; then
    local marta="${TWENTY_OWNER_MARTA:-4704e0c0-8d77-4640-ad1e-1875294294df}"
    local gosia="${TWENTY_OWNER_GOSIA:-ccac533d-a34b-4cfc-a036-9e75ee3f8910}"
    echo "LEAD_DISPATCH_POOL_IDS=${marta},${gosia}" >>"$f"
  fi
}

deploy_worker() {
  log "Deploy twenty-crm-worker (GCP)"
  (cd "$WORKER_DIR" && bash deploy.sh)
}

deploy_meta_webhook() {
  local meta_dir="$REPO_ROOT/integrations/cloud-functions/meta-lead-webhook"
  if [[ -f "$meta_dir/deploy.sh" ]]; then
    log "Deploy meta-lead-webhook (campaign_id resolve)"
    (cd "$meta_dir" && bash deploy.sh) || log "WARN: meta-lead-webhook deploy failed — campaign_id może nie dojść"
  else
    log "WARN: brak meta-lead-webhook/deploy.sh"
  fi
}

worker_uri() {
  load_env
  gcloud functions describe "${FUNCTION_NAME:-twenty-crm-worker-sandbox}" \
    --gen2 \
    --project="${GCP_PROJECT:?GCP_PROJECT}" \
    --region="${GCP_REGION:?GCP_REGION}" \
    --format='value(serviceConfig.uri)'
}

deploy_biore_workflow() {
  local uri
  uri="$(worker_uri)"
  log "Deploy workflow Biorę → $uri"
  export TWENTY_CRM_WORKER_URL="$uri"
  (cd "$REPO_ROOT" && python3 integrations/tools/deploy_workflow_lead_ack.py)
}

smoke() {
  local uri
  uri="$(worker_uri)"
  log "Smoke: lead_dispatch_sweep"
  local sweep
  sweep="$(curl -sf -X POST "$uri" \
    -H 'Content-Type: application/json' \
    -d '{"action":"lead_dispatch_sweep"}')"
  echo "$sweep" | python3 -m json.tool | head -40
  echo "$sweep" | grep -q '"ok": true' || fail "Sweep smoke failed"
  log "Smoke OK"
}

case "$MODE" in
  check)
    preflight
    run_tests
    log "check PASS — gotowy na: $0 prepare | $0 go"
    ;;
  prepare)
    preflight
    run_tests
    deploy_fields
    deploy_worker
    deploy_meta_webhook
    deploy_biore_workflow
    log "prepare DONE — dyspozytor wdrożony z LEAD_DISPATCHER_ENABLED=false (domyślnie)"
    log "Pełny start: $0 go"
    ;;
  go)
    preflight
    run_tests
    deploy_fields
    enable_flags_in_env_deploy
    deploy_worker
    deploy_meta_webhook
    deploy_biore_workflow
    smoke
    log ""
    log "GO LIVE — Lead Dispatcher v2.0 AKTYWNY"
    log "  • nowe leady: least-loaded + klasy HOT/STANDARD/LOW"
    log "  • Meta lista Piotra → Robert; reszta Meta → pula"
    log "  • sweep co ~5 min (poll scheduler + LEAD_DISPATCHER_SWEEP_ON_POLL)"
    log "  • przycisk Biorę na Opportunity"
    log "  • eskalacje → maciej@owocni.pl (log/webhook)"
    log ""
    log "Kill-switch: LEAD_DISPATCHER_ENABLED=false w .env.deploy + redeploy"
    ;;
  *)
    fail "Usage: $0 check|prepare|go"
    ;;
esac
