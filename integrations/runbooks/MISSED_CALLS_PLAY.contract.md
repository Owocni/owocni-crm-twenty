# MISSED calls (Play getCallHistory) → Twenty Opportunity counter

Status: **MVP 2026-07-23**

## Zasada

- `status=MISSED` z Play **≠ kontakt** → **nie** zmienia `lastContactAt`
- Na leadzie: `bizMissedCallsCount` + `bizLastMissedCallAt` + notatka w Timeline

## Flow

```
telefony/run.js (hosting)
  → getCallHistory (MISSED)
  → POST GCP action=enqueue_missed_call
  → task_queue crm:missed_call_ingest
  → Scheduler poll worker
  → match Person by phone → open Opportunity
  → increment counter + note
```

Transkrypty nadal: nagranie → STT → n8n → `enqueue_call_transcript`.

## Deploy

### 1. GCP worker (sandbox)
Deploy `twenty-crm-worker` (zawiera `missedCallIngest.js`).

### 2. Hosting telefony (cron STT)
Wgraj katalog `telefony/` i ustaw w `.env` (obok istniejących kluczy Play):

```
GCP_WORKER_URL=https://twenty-crm-worker-sandbox-hsxlhvflrq-lm.a.run.app
MISSED_CALLS_ENABLED=true
```

Potem jak zwykle: `node run.js` / cron.

**n8n nie trzeba zmieniać** — MISSED omija filtr transkryptów.

## Twenty UI

Dodaj na layout Opportunity pola:
- **Nieodebrane** (`bizMissedCallsCount`)
- **Ostatnie nieodebrane** (`bizLastMissedCallAt`)

## Idempotencja

Stape `twenty_state/missed_call_processed_{callSessionId}`.

## Poza MVP

- `ESTABLISHED` bardzo krótkie (często poczta) — osobna decyzja
- Parking MISSED bez Person
- Reset licznika po oddzwonieniu
