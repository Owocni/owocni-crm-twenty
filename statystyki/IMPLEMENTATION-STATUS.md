# Status wdrożenia statystyk (ADR #18)

> Aktualizuj przy każdym kroku. **Ostatnia zmiana:** 2026-07-10

## Faza

| | |
|---|---|
| Plan review | ✅ właściciel 2026-07-09 |
| ADR #18 | ✅ **closed** 2026-07-09 (sandbox D2) |
| Sandbox (D1) | ✅ |
| Produkcja (D2) | ⏳ po imporcie legacy + PF-7 |

---

## Repo (Cursor / git)

| Zadanie | Status | Plik / commit |
|---------|--------|----------------|
| ADR #18 closed | ✅ | `owocni-crm/DECISION_REGISTER.md` §5.4 |
| PF-9 kanon produktów/kanałów | ✅ | `statystyki/PF-9-bizProduct-list.md` |
| `bizSource` → `DIRECT_EMAIL` + mapa UTM (UPPER_SNAKE_CASE) | ✅ | `createLead.js` |
| Usunięcie `biz_product: "web"` z Leads@ enqueue | ✅ | `processWebhook.js` |
| Kontrakt Track Stage Time | ✅ | `workflows/track-stage-time.contract.md` |
| Kontrakt First Outbound | ✅ | `workflows/first-outbound-response.contract.md` |
| Snapshot workflowów | ✅ | `workflows/snapshots/` |
| Deploy script PF-M2 (opcjonalny) | ✅ | `integrations/tools/deploy_workflow_first_outbound.py` |
| PF-4 testy adaptera | ✅ | `twenty-inbound-webhook/handlers/detectBusinessEvent.test.js` |
| PF-5 skrypt weryfikacji | ✅ | `integrations/tools/verify_metrics_pf5.py` |
| Dowód PF-5 sandbox | ✅ | `statystyki/PF-5-EVIDENCE-2026-07-09.md` |
| Promocja `METRICS.md` → SSOT | ✅ | `owocni-crm/METRICS.md` |
| Delta `DATA_MODEL.md` | ✅ | `owocni-crm/DATA_MODEL.md` §5.1.1 |

---

## Twenty (MCP — 2026-07-09)

| PF | Zadanie | Status |
|----|---------|--------|
| PF-0 | Wersja Twenty → OPS_NOTES | ⏳ |
| PF-1 | Owner filter + Group by na dashboardzie | ✅ (owner.name.firstName + bizProduct) |
| PF-2 | Pola metryk na Opportunity | ✅ |
| PF-2b | Enum `bizSource` (kanon + legacy) | ✅ UPPER_SNAKE_CASE |
| PF-3 | Workflow Track Stage Time | ✅ **v3 ACTIVE** `23b2a240-…` |
| PF-3b | Read-only pól metryk | ✅ Roles → Object-Level → See Field only |
| PF-M2 | M2 pierwsza odpowiedź | ✅ **GCP** `advanceNewToContacted.js` |
| PF-4 | SKIP adaptera po zapisie pól metryk | ✅ testy 7/7 |
| PF-5 | Ratio + AVG test vs REST | ✅ `verify_metrics_pf5.py` |
| PF-6 | Kredyty (opcjonalnie) | ⏳ |
| PF-7 | Import legacy `srcSystem` | ⏳ |
| D2 | Dashboard „Sprzedaż — Zespół" | ✅ 18 widgetów `3fc83007-…` |
| D2 | Dashboard „Sprzedaż — Oceny" | ✅ 4 taby × 7 widgetów `7c4a9cfd-…` |

### Dashboardy (linki)

| Dashboard | URL |
|-----------|-----|
| Sprzedaż — Zespół | https://zany-maroon-panther.twenty.com/object/dashboard/3fc83007-575c-475d-8cf8-48b1eb2bf5a1 |
| Sprzedaż — Oceny | https://zany-maroon-panther.twenty.com/object/dashboard/7c4a9cfd-3cfb-4367-a172-8bedabd2000e |

### Workflowy aktywne

| Nazwa | workflowId | Uwagi |
|-------|------------|-------|
| Track Stage Time v3 | `23b2a240-a769-4629-8d6f-1804859eb305` | Trigger: `stage` only → CODE → UPDATE |
| First Outbound / M2 | GCP `advanceNewToContacted.js` | OUTGOING mail → `firstResponseAt` + `hoursToFirstResponse` |
| Przyjmij jako SQL v5 | `f6a43e81-21b6-4ad4-a118-9cd334ec46e4` | atomowy `qualifiedAt` + `bizSqlConfirmedAt`; WON/LOST bez zmiany stage |
| Odrzuć leada | `8a742a9f-8bcb-4792-9934-35a0fbba560a` | `rejected_lead`, stage bez zmiany |
| Guard odrzucony | `f5f1fb34-0a6f-4c6f-bb8f-f602d5f30a95` | Cofa QUALIFIED/WON |

---

## Twenty UI

- [x] Read-only na 6 polach metryk (Roles)
- [x] Taby Oceny 7/14/30/90 dni + widgety
- [x] Widgety Zespół wg spec
- [x] PF-5 weryfikacja REST
- [x] Wstępna akceptacja dashboardów (właściciel 2026-07-09)

---

## Deploy integracji

| Zadanie | Status |
|---------|--------|
| Deploy `twenty-crm-worker` z `mapBizSource` | ✅ sandbox GCP |
| Deploy `twenty-inbound-webhook` | ✅ sandbox GCP (`gcp-v5`) |
| Deploy `robot-task-monitor` (`enrichPurchaseBizValues`) | ✅ `00065-rwb` |
| Workflow „Odrzuć leada" + guard odrzucony | ✅ Twenty sandbox |
| Dokumentacja SSOT + runbooki (lipiec 2026) | ✅ 2026-07-10 |
| Smoke: lead Leads@ → `bizSource=DIRECT_EMAIL` | ✅ `d.nowak@liderbudowlany.pl` → `87a54e8b-…` |

---

## Zamknięcie ADR #18 — ✅ 2026-07-09

Evidence: `DECISION_REGISTER.md` §5.4 #18 · `owocni-crm/METRICS.md` · testy poniżej.

### Test end-to-end

| Deal | ID | Wynik |
|------|-----|-------|
| test7858 | `72f62296-fdc3-473b-b99f-d71768e88469` | **PASS** — 6 pól metryk + WON |
| liderbudowlany Leads@ | `87a54e8b-ea4c-47e9-95c0-2ae2bde98ab8` | **PASS** — `DIRECT_EMAIL` + E2E mail |

### Backlog poza ADR (produkcja)

- PF-7: import legacy + `srcSystem=BETTER_BITRIX_LEGACY`
- PF-6: pomiar kredytów workflow (opcjonalnie)
- M4 weryfikacja na próbce ≥20 rekordów po imporcie
- Wyrównanie skali Y na M8a/M8b (ręcznie w UI jeśli potrzeba)
