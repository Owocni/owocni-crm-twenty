#!/usr/bin/env bash
# Lead Dispatcher v2.0 — RETIRED 2026-09-04.
#
# Biorę / least-loaded / failover / sweep / limit 3 are withdrawn.
# Assignment SSOT: createLead.js resolveOpportunityOwnerId
#   COPYWRITING → Maciej (first, any source)
#   even idOid hash → Gosia; odd → Marta
#
# Usage:
#   ./integrations/tools/start_lead_dispatcher.sh          # refuses go/prepare
#   ./integrations/tools/start_lead_dispatcher.sh retire   # deactivate Biorę WF (idempotent)
#
# Do NOT pass go / prepare — those modes are removed so a later deploy cannot restore Biorę.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKER_DIR="$REPO_ROOT/integrations/cloud-functions/twenty-crm-worker"
MODE="${1:-refuse}"

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

case "$MODE" in
  go|prepare|check)
    fail "Lead Dispatcher / Biorę RETIRED 2026-09-04. Use: $0 retire  (or omit). Do not restore LEAD_DISPATCHER_ENABLED."
    ;;
  retire|"")
    load_env
    log "Retire Biorę workflow on Twenty (deactivate if still ACTIVE)"
    (cd "$REPO_ROOT" && python3 integrations/tools/deploy_workflow_lead_ack.py)
    log "DONE — dispatcher will not be reinstalled. Worker deploy.sh always ships LEAD_DISPATCHER_ENABLED=false."
    ;;
  *)
    fail "Usage: $0 retire   # Biorę/dispatcher retired; go/prepare removed"
    ;;
esac
