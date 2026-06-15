---
doc_id: SMOKE_MATRIX_EVIDENCE_20260615
title: "Evidence — smoke matrix 8/8 PASS (sandbox Twenty)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-15
related:
  - SMOKE_MATRIX_EXECUTION.md
  - POST_SMOKE_EVIDENCE.md
  - ../../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md
---

# Smoke matrix — evidence 2026-06-15

**Środowisko:** Twenty `zany-maroon-panther.twenty.com` · Stape `uinpcbwf.eug.stape.io` · `environment=sandbox` · Robot `robot-task-monitor` (europe-central2) · arkusz sandbox `GOOGLE_SHEET_ID_SANDBOX`.

**Kontener sGTM:** GTM-5ZM8KQ5S

| Adapter / endpoint | Plik repo | Stape |
|---|---|---|
| `inbound:twenty_webhook` | `INBOUND_TWENTY_WEBHOOK.sGTM.js` | Tag `inbound_twenty_webhook` |
| `crm:twenty_update_person` | `CRM_TWENTY_UPDATE_PERSON.sGTM.js` | Tag `crm_twenty_update_person` |
| Worker HTTP | `TWENTY_CRM_WORKER_CLIENT.sGTM.js` | `POST /crm/twenty_worker` |
| Scheduler | GCP `twenty-crm-worker-sandbox` | co ~2 min |

**Dowód logów Stape:** export CSV 2026-06-15 (`log.csv` — Incoming requests, host `uinpcbwf`).

---

## Macierz 8/8

| # | PASS | Data | Dowód |
|---|------|------|-------|
| 1 | ✅ | 2026-06-15 | Webhook sim: opp `a0000001-…000001` NEW→QUALIFIED → task `qualify_lead`, `oid_smoke1_qualify` |
| 2 | ✅ | 2026-06-15 | QUALIFIED→WON → task `purchase`, `oid_smoke2_purchase` |
| 3 | ✅ | 2026-06-15 | `campaignRejected` false→true → task `rejected_lead`, `oid_smoke3_rejected` |
| 4 | ✅ | 2026-06-15 | Opp `e812136a-a0a3-4c00-b348-6bba9ee9a258` bez idOid → 1× `generate_lead` + worker → idOid `XJTZK9S1BJZPN13SGVQZ0RDYEZ`, task `done`, brak duplikatu |
| 5 | ✅ | 2026-06-15 | Opp `a0000001-…000005` — zmiana opisu, stage NEW → 0 nowych tasków, `SKIP_NO_RELEVANT_TRANSITION` |
| 6 | ✅ | 2026-06-15 | Opp `a0000001-…000006` — rejected true→true → 0 nowych tasków, `SKIP_DUPLICATE_BUSINESS_EVENT` |
| 7 | ✅ | 2026-06-15 | Opp `a0000001-…000007` — ten sam payload 2× → 0 nowych tasków, `SKIP_DUPLICATE_DELIVERY` |
| 8 | ✅ | 2026-06-15 | Import QUALIFIED cold-start: opp `b0000001-…000008` → 0 tasków, `twenty_state.last_stage=QUALIFIED` |

---

## Smoke #4 — szczegóły (L-1 / G3 / G4 część)

1. **pending-write** — `pending_write_twenty_{oppId}` PUT przed PATCH Twenty (log Storage 10:46:08).
2. **Manual create** — Twenty API create, `idOid` puste, webhook `axios/1.17.0` → inbound.
3. **Task** — `pending_mint_1781520352515_generate_lead`, `job_type: crm:twenty_update_person`.
4. **Worker** — `POST /crm/twenty_worker` → task `status: done`, `backfill_completed_at` ustawione.
5. **Echo** — brak drugiego `generate_lead` (1 task na opp).
6. **Scheduler** — od 10:50 `Google-Cloud-Scheduler` → `/crm/twenty_worker` HTTP 200 + Storage `task_queue` poll.

---

## Bramy MUST-PASS (sandbox — stan po smoke)

| Brama | Status sandbox | Uwaga |
|-------|----------------|-------|
| **G1** event-semantics | **PASS** | Kanon w task_queue; Robot normalizuje `lead_won`→`purchase` (S2) |
| **G2** webhook-truth | **PASS*** | Store transitions + cold-start; *HMAC verify pełne — OPEN |
| **G3** manual-create | **PASS** | Smoke #4 |
| **G4** loop-prevention | **PASS*** | pending-write OK; *usunięcie `srcSystem`-SKIP (L-1 krok 3) — OPEN jeśli kiedyś dodane |
| **G5** data-model | **PASS** | T1 audit 2026-06-08 |
| **G6** import-safety | **PASS** | Smoke #8 cold-start |
| **G7** identity-safety | **OPEN** | Resolver T4/T5 — osobny plan |
| **G8** merge-safety | **OPEN** | Preflight merge |
| **G-PAR** | **OPEN** | Parzystość BB |

**Cutover:** nadal **NIE** — G7, G8, G-PAR otwarte + szkolenie + snapshot schemy w git.

---

## Następny krok (poza cutover)

1. Eksport/tag Stape zsynchronizowany w repo (pliki `.sGTM.js` — done).
2. Opcjonalnie: pełna weryfikacja HMAC w inbound (G2 domknięcie prod).
3. L-1 krok (3): jeśli w kodzie jest tymczasowy `srcSystem`-SKIP — usunąć (w inbound obecnie brak — nic do usuwania).
4. `POST_SMOKE_EVIDENCE.md` §5.4 — commit + status dla Mariusza (bez push bez prośby).
