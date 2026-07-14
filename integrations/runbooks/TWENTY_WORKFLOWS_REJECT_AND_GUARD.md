---
doc_id: TWENTY_WORKFLOWS_REJECT_AND_GUARD
title: "Twenty — workflowy SQL, odrzucenie leada, guard"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-07-10
related:
  - ../../owocni-crm/EVENT_CONTRACT.md
  - ../../owocni-crm/DATA_MODEL.md
  - KANBAN_CARD_SPEC.md
  - MIGRATE_TWENTY_CRM_TO_GCP.md
---

# Twenty — workflowy SQL, odrzucenie, guard

Runbook operacyjny dla akcji MANUAL i guardów DATABASE_EVENT na Opportunity. Semantyka eventów → `EVENT_CONTRACT.md`.

## 1. Przegląd

| Workflow | Trigger | Efekt w CRM | Event SSOT |
|----------|---------|-------------|------------|
| **Przyjmij jako SQL** | MANUAL (pinned) | `bizSqlConfirmed=true`, `bizSqlConfirmedAt`, `qualifiedAt`, `hoursToQualified`; `stage=QUALIFIED` tylko gdy deal otwarty (WON/LOST bez zmiany etapu) | `qualify_lead` (syntetyczny POST) |
| **Odrzuć leada** | MANUAL (pinned, IconBan) | `campaignRejected=true`, `rejectionReason`; **stage bez zmiany** | `rejected_lead` |
| **Guard odrzucony** | DATABASE_EVENT `opportunity.updated` | Cofa QUALIFIED/WON → `bizLastNonSqlStage` gdy `campaignRejected=true` | brak (cofnięcie etapu) |
| **Guard SQL (drag)** | DATABASE_EVENT | Cofa QUALIFIED bez `bizSqlConfirmed` | `SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM` w inbound |

Inbound adapter (`twenty-inbound-webhook`) dodatkowo blokuje emisję `qualify_lead` / `purchase` gdy `campaignRejected=true` (`SKIP_CAMPAIGN_REJECTED`).

## 2. „Przyjmij jako SQL"

- **Pola (atomowo w jednym UPDATE):** `bizSqlConfirmed=true`, `bizSqlConfirmedAt`, `qualifiedAt` (first-entry), `hoursToQualified`
- **Etap kanbanu:** otwarty deal → `QUALIFIED`; **WON/LOST → etap bez zmiany** (SQL dla reklam bez cofania wygranej)
- **Bez workflow:** sam drag na kolumnę SQL → guard cofa etap; inbound → `SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM`
- **Workflow ID (sandbox 2026-07-10):** `f6a43e81-21b6-4ad4-a118-9cd334ec46e4` (UI: „Opp · Przyjmij jako SQL v5")
- **Deploy:** `integrations/tools/deploy_workflow_sql_v5.py` (GraphQL 403 na kluczu API — preferuj MCP); backfill: `backfill_sql_qualified_at.py`
- **Root cause v4:** SQL na już zamkniętym deale wymuszał QUALIFIED; `qualifiedAt` zapisywał osobno Track Stage Time — przy szybkim powrocie na WON timestamp ginął mimo `bizSqlConfirmed=true`

### Test

1. Lead na etapie Rozeznanie → uruchom „Przyjmij jako SQL" → potwierdź.
2. W arkuszu sandbox: wiersz `qualify_lead`.
3. Drag z powrotem i ponownie bez workflow → etap cofnięty, brak drugiego `qualify_lead`.

## 3. „Odrzuć leada"

### Zachowanie

1. FORM — informacja (etap się nie zmieni).
2. FORM — `rejectionReason` (BUDGET / NOT_TARGET / SPAM / DUPLICATE / OTHER) + potwierdzenie „Tak".
3. UPDATE — `campaignRejected=true`, `rejectionReason`.
4. HTTP POST → `https://uinpcbwf.eug.stape.io/inbound/twenty_webhook` z `previousRecord.campaignRejected=false` (syntetyczny webhook dla adaptera).

### Deploy

```bash
export TWENTY_API_KEY=...   # z .env.local
python3 integrations/tools/deploy_workflow_reject_lead.py
```

Alternatywa: Twenty MCP `create_complete_workflow` (GraphQL API zwraca 403 — używać MCP lub skrypt).

**Workflow ID (sandbox 2026-07-10):** `8a742a9f-8bcb-4792-9934-35a0fbba560a`  
**Wersja:** `Opp · Odrzuc leada v1`

### Test

1. Lead aktywny (nie LOST) → „Odrzuć leada" → powód → Tak.
2. Etap **bez zmiany**; flaga `campaignRejected=true`.
3. Arkusz sandbox: wiersz `rejected_lead`.
4. Próba SQL lub wygranej → guard cofa etap; brak `qualify_lead` / `purchase`.

## 4. Guard odrzucony (QUALIFIED / WON)

### Zachowanie

DATABASE_EVENT na `opportunity.updated`:

- FILTER: `campaignRejected=true` AND (`stage=QUALIFIED` OR `stage=WON`)
- UPDATE: `stage={{bizLastNonSqlStage}}`, `bizSqlConfirmed=false`

### Deploy

```bash
export TWENTY_API_KEY=...
python3 integrations/tools/deploy_workflow_guard_rejected.py
```

Alternatywa: MCP `create_complete_workflow` + kroki FILTER/UPDATE (bez CODE).

**Workflow ID (sandbox 2026-07-10):** `f5f1fb34-0a6f-4c6f-bb8f-f602d5f30a95`  
**Nazwa:** `Opp · guard odrzucony v1`

## 5. Wartość wygranej (`purchase`)

Workflow wygranej **nie jest wymagany** (użytkownik odrzucił „Przyjmij wygraną").

Przy przejściu na WON:

- Preferowane: pole walutowe **`bizValueWon`**
- Fallback adaptera: `amount` → widełki → parser **`bizValueDisplay`** (np. `1222 PLN`)
- Robot: cennik `purchase_{bizProduct}` gdy `biz_value` puste

Szczegóły → `EVENT_CONTRACT.md` §5.7, `DATA_MODEL.md` §5.1.

## 6. Powiązane pliki kodu

| Komponent | Ścieżka |
|-----------|---------|
| Inbound adapter | `integrations/cloud-functions/twenty-inbound-webhook/handlers/processWebhook.js` |
| Robot + arkusz | `integrations/GoogleCloudRobot.js` |
| Deploy reject | `integrations/tools/deploy_workflow_reject_lead.py` |
| Deploy guard | `integrations/tools/deploy_workflow_guard_rejected.py` |
| Testy biz_value | `integrations/cloud-functions/twenty-inbound-webhook/handlers/normalizeBizValue.test.js` |

## 7. Checklist weryfikacji

- [ ] „Odrzuć leada" widoczne na karcie Opportunity (pinned)
- [ ] `rejected_lead` w arkuszu po odrzuceniu
- [ ] SQL na odrzuconym → cofnięcie etapu, brak eventu
- [ ] WON na odrzuconym → cofnięcie etapu, brak `purchase`
- [ ] `qualify_lead` tylko po „Przyjmij jako SQL"
- [ ] `purchase` z poprawnym `biz_value` (kolumna J)
