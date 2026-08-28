---
doc_id: LEAD_DISPATCHER_START
title: "Lead Dispatcher v2.0 — START (go-live w jednym miejscu)"
layer: runbook
status: ready
owner: Dawid
last_verified: 2026-08-25
related:
  - LEAD_DISPATCHER_PLAN.md
  - ../../workflows/lead-dispatch.contract.md
audience: "wdrożenie + LLM / agent"
---

# Lead Dispatcher — START

**Cel:** jedna komenda włącza pełny dyspozytor (pola Twenty → worker GCP → sweep → przycisk „Biorę”).

**SSOT reguł biznesowych:** `LEAD_DISPATCHER_PLAN.md`  
**SSOT techniczny:** `workflows/lead-dispatch.contract.md`

---

## Szybki START (dla Ciebie)

```bash
cd owocni-crm-github
chmod +x integrations/tools/start_lead_dispatcher.sh

# 1. Sprawdzenie (testy + env)
./integrations/tools/start_lead_dispatcher.sh check

# 2. Opcjonalnie: deploy bez włączania flag (bezpieczny staging)
./integrations/tools/start_lead_dispatcher.sh prepare

# 3. Pełny go-live (to jest Twoje „START”)
./integrations/tools/start_lead_dispatcher.sh go
```

Skrypt `go` robi **kolejno**:

1. Unit testy `leadDispatch.test.js`
2. Pola Metadata (`deploy_lead_dispatcher_fields.py`)
3. Odkomentowuje i ustawia flagi w `twenty-crm-worker/.env.deploy`
4. Deploy Cloud Function worker (`deploy.sh`)
5. Deploy `meta-lead-webhook` (rozwiązuje `campaign_id` z `ad_id`) — jeśli jeszcze nie
6. Workflow **Biorę** (`deploy_workflow_lead_ack.py`)
7. Smoke: `POST lead_dispatch_sweep`

---

## Wymagania przed START

| # | Co | Gdzie |
|---|---|---|
| 1 | `TWENTY_API_KEY` | `.env.local` lub `twenty-crm-worker/.env.deploy` |
| 2 | `GCP_PROJECT`, `GCP_REGION`, klucze Stape/Twenty | `.env.deploy` |
| 3 | `gcloud` zalogowany | lokalnie |
| 4 | Scheduler `twenty-crm-worker-sandbox` **ENABLED** | GCP (już jest `*/5`) |
| 5 | Decyzje biznesowe domknięte | §4 klasy, manager Maciej — patrz plan |

**Lista Meta Piotra:** §3.1 domknięta (8× campaign_id) — wpinana przy `go`.

---

## Co włącza `go`

| Env | Wartość po START |
|---|---|
| `LEAD_DISPATCHER_ENABLED` | `true` |
| `LEAD_DISPATCHER_SWEEP_ON_POLL` | `true` |
| `LEAD_DISPATCH_MANAGER_EMAIL` | `maciej@owocni.pl` |
| `LEAD_DISPATCH_HOLIDAYS` | lista PL 2026 (w skrypcie) |
| `LEAD_DISPATCH_POOL_IDS` | Marta + Gosia UUID |
| `LEAD_DISPATCH_META_ROBERT_IDS` | 8× campaign_id Piotra (§3.1) |

Sweep nie wymaga osobnego Schedulera — działa na istniejącym poll `*/5`.

---

## Kill-switch (rollback)

1. W `.env.deploy`: `LEAD_DISPATCHER_ENABLED=false` (i opcjonalnie `LEAD_DISPATCHER_SWEEP_ON_POLL=false`)
2. `cd integrations/cloud-functions/twenty-crm-worker && bash deploy.sh`
3. CreateLead wraca do hash/COPY/Meta jak przed dyspozytorem.

Pola CRM zostają — bez szkody.

---

## Smoke ręczny (po START)

### A. Sweep

```bash
WORKER_URL=$(gcloud functions describe twenty-crm-worker-sandbox \
  --gen2 --project=owocni-robot --region=europe-central2 \
  --format='value(serviceConfig.uri)')

curl -s -X POST "$WORKER_URL" \
  -H 'Content-Type: application/json' \
  -d '{"action":"lead_dispatch_sweep"}' | python3 -m json.tool
```

Oczekiwane: `"ok": true`, `sweep.ok` lub `sweep.skipped` (poza oknem 8–18).

### B. Nowy lead testowy

1. Submit formularz testowy (sandbox) lub task Stape `crm:twenty_create_lead`.
2. W Twenty: Opportunity NEW ma `bizLeadIntentClass`, `bizAssignedAt`, `bizRoutingRule`, owner.
3. Klik **Biorę** na karcie → `bizAckAt` wypełnione.
4. Wyślij mail OUT → `bizFirstAttemptAt` + kanał EMAIL.

### C. Failover (opcjonalnie, sandbox)

Lead HOT bez „Biorę” > 15 min roboczych → owner zmienia się na drugą osobę z puli.

---

## Checklist zespołu (po START)

- [ ] Marta/Gosia: widzą leady przypisane automatycznie
- [ ] Wszyscy: przycisk **Biorę** na Opportunity (pinned)
- [ ] Maciej: dostaje maile eskalacji (lub logi w Cloud Run — dopóki brak webhook mail)
- [ ] Robert: Meta z listy Piotra (§3.1) → Robert; reszta Meta → Marta/Gosia; Copy → Maciej
- [ ] Ewa: nadal tylko ręczne przypisania

---

## Pliki wdrożeniowe

| Plik | Rola |
|---|---|
| `integrations/tools/start_lead_dispatcher.sh` | **START** orchestrator |
| `integrations/tools/deploy_lead_dispatcher_fields.py` | Pola Opp |
| `integrations/tools/deploy_workflow_lead_ack.py` | Przycisk Biorę |
| `integrations/cloud-functions/twenty-crm-worker/shared/leadDispatch.js` | Klasy + routing |
| `integrations/cloud-functions/twenty-crm-worker/workers/leadDispatchSweep.js` | Failover/eskalacja |
| `integrations/cloud-functions/twenty-crm-worker/workers/leadAck.js` | API ack |
| `integrations/cloud-functions/twenty-crm-worker/workers/createLead.js` | Assign przy create |

---

## TODO po START (nie blokuje)

| Co | Kto |
|---|---|
| `LEAD_DISPATCH_MANAGER_WEBHOOK_URL` (prawdziwy mail) | Dawid |
| SMS przy przydziale | później |
| Święta w UI Twenty | operacje |
