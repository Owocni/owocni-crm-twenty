---
doc_id: BUILD_INBOUND_TWENTY
title: "Faza 3 — budowa adaptera inbound:twenty_webhook (Stape)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-07-10
related:
  - ../INBOUND_TWENTY_WEBHOOK.stub.js
  - ../../owocni-crm/EVENT_CONTRACT.md
---

# Faza 3 — build `inbound:twenty_webhook`

> **Sandbox (lipiec 2026):** pełna logika adaptera jest w **GCP** `cloud-functions/twenty-inbound-webhook/` (build `2026-07-10-gcp-v5`). Stape = edge proxy (`CLIENT` + `gcp-stub`). Ten runbook opisuje **logikę SSOT** wspólną dla GCP i legacy tagu Stape (`INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js`). Deploy sandbox → `MIGRATE_TWENTY_CRM_TO_GCP.md` § Faza 2.

**Cel:** implementacja zgodna z `EVENT_CONTRACT` §5.4–5.7, zapisana w repo po review.

**Parity:** P3, P4, P5, P7, P10 | **Bramy:** G2, G3, G4 (część).

---

## Architektura (skrót)

```
Twenty webhook OUT
    → HTTP endpoint Stape (inbound:twenty_webhook)
        → HMAC verify
        → filter object type (NR-5)
        → loop: pending-write check (NR-6) — NIE srcSystem-SKIP*
        → read/write Stape Store: last_stage, last_campaignRejected, last_delivery_fingerprint
        → map transition → business event_name (kanon)
        → Inteligentny Routing / task_queue
        → reason code log

* srcSystem-SKIP tylko dla backfill do smoke #4 (L-1 sekwencja 1-2-3)
```

---

## Kolejność implementacji (w Stape)

| Krok | Moduł | SSOT | Done |
|------|-------|------|------|
| 3.1 | HTTP trigger + raw body | §5.1 | ☐ |
| 3.2 | `verifyHmac(payload, secret)` | OPS_NOTES | ☐ |
| 3.3 | `parseTwentyPayload()` — mapowanie pól z preflight | Faza 2 | ☐ |
| 3.4 | `filterUnsupportedObject()` → `SKIP_UNSUPPORTED_OBJECT` | NR-5 | ☐ |
| 3.5 | Stape Store keys: `opp:{id}:last_stage`, `opp:{id}:last_campaignRejected` | §5.4 | ☐ |
| 3.6 | `detectTransition()` — cold-start baseline | §5.4 tabela cold-start | ☐ |
| 3.7 | `mapToBusinessEvent()` — tylko kanon nazw | §5.2 | ☐ |
| 3.8 | `checkPendingWrite()` — TTL echo | NR-6, §5.6 | ☐ |
| 3.9 | `emitToRouting()` lub `logReason(SKIP_*)` | §5.6 | ☐ |
| 3.10 | `envGuard()` — sandbox → safe sink | ARCHITECTURE §5.4 | ☐ |
| 3.11 | Manual create: `idOid IS NULL` → `generate_lead` | §5.4, G3 | ☐ |
| 3.12 | Backfill path + **zachowany** srcSystem-SKIP do smoke #4 | §6.1 L-1 | ☐ |

**Punkt wyjścia kodu:** skopiuj i dostosuj `../INBOUND_TWENTY_WEBHOOK.stub.js`.

---

## Mapowanie (kanon — kopiuj 1:1 z EVENT_CONTRACT)

| Warunek | `event_name` emitowany |
|---------|------------------------|
| create/update + Person.idOid null | `generate_lead` (manual) |
| stage → QUALIFIED (transition) | `qualify_lead` |
| stage → WON (transition) | `purchase` |
| campaignRejected false→true | `rejected_lead` |
| stage → LOST | **brak** (SKIP) |
| brak przejścia | `SKIP_NO_RELEVANT_TRANSITION` |

**Zakaz:** `lead_won`, `closed_won` jako `event_name`.

---

## Stape Store — pending-write (loop-prevention)

Przy zapisie do Twenty z Sortowni (np. `crm:twenty_update_person` backfill):

1. Zapisz `pending_write:{opportunityId}` z TTL np. 30–60 s (wartość z preflight).
2. Webhook w oknie TTL → `SKIP_ECHO_OWN_WRITE`.
3. Po TTL rekord znika — legalne późniejsze eventy handlowca przechodzą.

**Nie** używaj trwałego `srcSystem` jako SKIP (poza wyjątkiem L-1 na czas migracji backfill).

---

## Eksport do repo (po review w Stape)

1. Skopiuj finalny kod tagu do `integrations/INBOUND_TWENTY_WEBHOOK.js` (bez sekretów).
2. W `INTEGRATIONS_PARITY.md` zmień wiersz adaptera na **TAK**.
3. Commit: `Add inbound:twenty_webhook Stape adapter (sandbox-tested skeleton)`.

---

## Kryteria PASS (Faza 3 — implementacja gotowa do smoke)

| # | Kryterium | PASS |
|---|-----------|------|
| 1 | Tag deploy na sandbox Stape | ☐ |
| 2 | Reason codes widoczne w logu/safe sink | ☐ |
| 3 | Cold-start: pierwszy webhook = baseline bez emisji | ☐ |
| 4 | Drugi webhook po zmianie stage = emisja z kanonem | ☐ |
| 5 | Kod w repo (bez secretów) | ☐ |

---

## Następna faza

→ [SMOKE_MATRIX_EXECUTION.md](./SMOKE_MATRIX_EXECUTION.md)
