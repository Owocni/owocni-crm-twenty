# CONTRACT — lead dispatcher v2.0

> Owner: Dawid · Status: **IMPLEMENTING** · Spec: `integrations/runbooks/LEAD_DISPATCHER_PLAN.md`

| Pozycja | Wartość |
|---|---|
| Klasyfikacja + assign | `twenty-crm-worker` → `createLead.js` + `shared/leadDispatch.js` |
| Sweep | `workers/leadDispatchSweep.js` — `POST { action: "lead_dispatch_sweep" }` |
| First attempt EMAIL | `advanceNewToContacted.js` → `bizFirstAttemptAt` + `EMAIL` |
| First attempt MANUAL | sweep gdy `stage ≠ NEW` bez stempla |
| „Biorę” | Twenty manual workflow → `POST lead_ack` → `bizAckAt` |
| START runbook | `integrations/runbooks/LEAD_DISPATCHER_START.md` |
| START script | `integrations/tools/start_lead_dispatcher.sh go` |
| Flag | `LEAD_DISPATCHER_ENABLED=true` |
| Manager | `LEAD_DISPATCH_MANAGER_EMAIL` default `maciej@owocni.pl` |
| Metadata | `integrations/tools/deploy_lead_dispatcher_fields.py` |

## Kill-switch

`LEAD_DISPATCHER_ENABLED` off → createLead wraca do hash/COPY/Meta jak przed dyspozytorem.

## Idempotencja

- createLead: Opportunity po `idOid` / `metaLeadgenId` — SKIP jak dziś.
- Sweep: `bizManagerAlertedAt` raz; failover podnosi `bizFailoverCount` + nowy `bizAssignedAt`.
- First attempt: nie nadpisuje istniejącego `bizFirstAttemptAt`.

## Retry

Scheduler co 5 min w oknie pn–pt 8–18 (`LEAD_DISPATCH_HOLIDAYS` wyłącza dni).  
Crash-safe: stan tylko w polach Twenty.

## Env

| Env | Default |
|---|---|
| `LEAD_DISPATCHER_ENABLED` | off |
| `LEAD_DISPATCHER_SWEEP_ON_POLL` | off |
| `LEAD_DISPATCH_MANAGER_EMAIL` | maciej@owocni.pl |
| `LEAD_DISPATCH_POOL_IDS` | Marta,Gosia UUIDs |
| `LEAD_DISPATCH_VACATION_IDS` | empty |
| `LEAD_DISPATCH_HOLIDAYS` | empty `YYYY-MM-DD,...` |
| `LEAD_DISPATCH_META_ROBERT_IDS` | Piotr §3.1 — 8× `campaign_id`; empty = interim all FB→Robert |
| `LEAD_DISPATCH_MANAGER_WEBHOOK_URL` | optional POST hook |

## „Biorę” (Twenty UI)

Manual workflow **Opp · Biorę v1** — deploy: `integrations/tools/deploy_workflow_lead_ack.py`

1. Trigger: Manual (label **Biorę**, pinned)
2. HTTP POST worker `{ "action": "lead_ack", "data": { "opportunityId": "<id>" } }`
3. Worker ustawia `bizAckAt` (idempotentny jeśli już ack/kontakt/odrzucony)

Wzorzec jak merge_leads — datetime po stronie workera GCP.
