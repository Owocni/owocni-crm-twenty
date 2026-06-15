---
doc_id: SMOKE_MATRIX_EXEC
title: "Faza 4 — wykonanie smoke matrix (8 scenariuszy)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-02
related:
  - ../../owocni-crm/EVENT_CONTRACT.md
---

# Faza 4 — smoke matrix (go/no-go)

**Źródło prawdy:** `EVENT_CONTRACT.md` §6.3 — **wszystkie 8 scenariuszy = PASS** przed cutover.

**Środowisko:** Twenty sandbox + Sortownia sandbox + env-guard (brak prod Ads).

---

## Tabela wykonawcza

Dla każdego wiersza: data, tester, link do logu/safe sink, PASS/FAIL.

| # | Scenariusz | Kroki (skrót) | Oczekiwany `event_name` / wynik | Reason code | PASS |
|---|------------|---------------|----------------------------------|-------------|------|
| **1** | CONTACTED → QUALIFIED | Ustaw baseline stage, potem zmień na QUALIFIED | `qualify_lead` EMITTED | `EMITTED` | ✅ 2026-06-15 — `oid_smoke1_qualify`, task `qualify_lead` |
| **2** | QUALIFIED → WON (+ opcj. bizValue) | Transition do WON | `purchase` EMITTED | `EMITTED` | ✅ 2026-06-15 — `oid_smoke2_purchase`, task `purchase` |
| **3** | campaignRejected false→true | Odrzuć leada w UI | `rejected_lead` EMITTED | `EMITTED` | ✅ 2026-06-15 — `oid_smoke3_rejected`, task `rejected_lead` |
| **4** | Manual create (idOid null) → backfill | Utwórz opp bez idOid → mint → update Person | `generate_lead` raz; **brak drugiego generate_lead** | `EMITTED` + L-1 | ✅ 2026-06-15 — opp `e812136a-a0a3-4c00-b348-6bba9ee9a258`, idOid `XJTZK9S1BJZPN13SGVQZ0RDYEZ`, 1 task done, echo bez duplikatu |
| **5** | Zmiana opisu bez stage/rejected | Edytuj pole opisowe | SKIP | `SKIP_NO_RELEVANT_TRANSITION` | ✅ 2026-06-15 — opp `…000005`, 0 nowych tasków |
| **6** | campaignRejected true→true | Ponowny zapis bez zmiany | SKIP | `SKIP_DUPLICATE_BUSINESS_EVENT` | ✅ 2026-06-15 — opp `…000006`, 0 nowych tasków |
| **7** | Duplicate webhook | Wyślij ten sam payload 2× | SKIP (drugi raz) | `SKIP_DUPLICATE_DELIVERY` | ✅ 2026-06-15 — opp `…000007`, 0 nowych tasków |
| **8** | Import rekordu QUALIFIED | Import CSV/API historyczny | **no_emit** — zero tasków platform | cold-start / import guard | ✅ 2026-06-15 — opp `…000008`, cold-start baseline |

---

## Smoke #4 — szczegółowa sekwencja (L-1 / G4)

**To najważniejszy test migracji tożsamości.**

1. **(1)** Włącz pending-write na operacji backfill `idOid` do Twenty.
2. Utwórz Opportunity ręcznie (Person bez `idOid`).
3. Adapter emituje **`generate_lead`** (manual) — Sortownia mintuje `idOid`.
4. Sortownia wykonuje `crm:twenty_update_person` z nowym `idOid`.
5. Webhook echo w oknie pending-write → **SKIP** (nie drugi `generate_lead`).
6. Po TTL: normalne przejścia stage działają.
7. **(2)** Ten scenariusz oznacz PASS w tabeli #4.
8. **(3)** Dopiero po PASS #4: usuń tymczasowy `srcSystem`-SKIP na backfill (jedna ścieżka).

**FAIL #4 jeśli:** dwa razy `generate_lead` lub dwa różne `id_oid` dla tej samej osoby.

---

## Powiązanie z bramami G1–G8

| Scenariusz | Bramy wspierane |
|------------|-----------------|
| 1–3, 5–7 | G1, G2 |
| 4 | G3, G4 (L-1) |
| 8 | G6 |
| Wszystkie + env-guard | G2, P10 |

G7 (Resolver T4/T5), G8 (merge), G-PAR — osobne runbooki w `IMPLEMENTATION_PLAN` §5.2.

---

## Po PASS całej macierzy

→ [POST_SMOKE_EVIDENCE.md](./POST_SMOKE_EVIDENCE.md)  
→ Evidence: [SMOKE_MATRIX_EVIDENCE_2026-06-15.md](./SMOKE_MATRIX_EVIDENCE_2026-06-15.md)
