# MISSED calls (Play getCallHistory) → Twenty Opportunity counter

Status: **MVP 2026-07-23** · near-realtime GCP **2026-07-24**

## Zasada

- `status=MISSED` z Play **≠ kontakt** → **nie** zmienia `lastContactAt`
- Na leadzie: `bizMissedCallsCount` + `bizLastMissedCallAt` + notatka w Timeline

## Flow

```
Cloud Scheduler */5
  → Cloud Run Job telefony-play-poller (hoursBack=2, state=GCS)
  → getCallHistory (MISSED) + kursor GCS
  → POST GCP action=enqueue_missed_call
  → task_queue crm:missed_call_ingest
  → Scheduler */5 poll worker
  → match Person by phone → open Opportunity
  → increment counter + note
```

Transkrypty nadal: nagranie → STT → n8n (tylko nowe) → `enqueue_call_transcript`.

**Uwaga implementacji:** w dokumencie taska kolejki pole kolejki to `status: "pending"`; status CDR Play to `callStatus: "MISSED"` (nie nadpisywać `status`).

## Deploy

### 1. GCP worker (sandbox)
Deploy `twenty-crm-worker` (zawiera `missedCallIngest.js`). Scheduler poll: **`*/5`**.

### 2. Telefony (Cloud Run Job)
Sibling `telefony/` — `./deploy_gcp.sh` (Job + Scheduler + bucket `owocni-robot-telefony`).  
Env: `GCP_WORKER_URL`, `MISSED_CALLS_ENABLED=true`, `STATE_BACKEND=gcs`.  
Szczegóły: `telefony/docs/GCP_NEAR_REALTIME.md`.

**n8n nie trzeba zmieniać** — MISSED omija filtr transkryptów.

## Twenty UI

Pola na Opportunity:
- **Nieodebrane** (`bizMissedCallsCount`)
- **Ostatnie nieodebrane** (`bizLastMissedCallAt`)

## Idempotencja

Stape `twenty_state/missed_call_processed_{callSessionId}` + kursor GCS `telefony/state/missed/*`.

## Poza MVP

- `ESTABLISHED` bardzo krótkie (często poczta) — osobna decyzja
- Parking MISSED bez Person
- Reset licznika po oddzwonieniu
