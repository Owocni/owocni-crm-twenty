---
doc_id: SAMPLE_WEEK_BB_TWENTY
title: "Tydzień BB — Twenty sample routing + Ads sandbox"
layer: runbook
status: active
owner: "Dawid"
audience: "Dawid + Mariusz"
last_verified: 2026-09-04
related:
  - ADS_SQL_SIGNAL_ROLLBACK.md
  - PLAN_NAPRAWCZY_GATES.md
---

# Tydzień BB + Twenty w trybie testowym

**Cel:** sprzedaż i Ads z BB; Twenty żywy do dopracowania, bez pełnego napływu do Marty/Gosi/Maćka.

## Stan po włączeniu (2026-09-04)

| Warstwa | Stan |
|---|---|
| Twenty inbound `RUNTIME_ENVIRONMENT` | **sandbox** (SQL/WON nie na Ads) |
| BB `/api/analytics/lead` | **prod** (po deployu BB) |
| Worker `LEAD_SAMPLE_WEEK_ENABLED` | **true** |
| Holding owner | `owocni@gmail.com` (`2d65d0e6-…`) |
| Quota | **2 / dzień / osoba** (Marta, Gosia, Maciej), strefa `Europe/Warsaw` |
| Robert (Meta / MARKETING) | **bez limitu** |

## Zachowanie create_lead

1. Normalny dyspozytor / Meta→Robert / COPY→Maciej jak dziś.
2. Potem override sample-week:
   - Robert → bez zmian.
   - Marta/Gosia/Maciej → jeśli dziś `< 2` nowych Opp na nich → zostaje; inaczej → holding.
   - Inni / brak ownera → holding.
3. `bizRoutingRule`: `RULE-SAMPLE-WEEK-HOLDING` albo zachowana reguła / `RULE-SAMPLE-WEEK-QUOTA`.

Karty nadal powstają w Twenty (formularz, `leads@`, Meta) — tylko **owner** jest ograniczony.

## Parkowanie istniejących (2026-09-04)

Otwarte karty Marty / Gosi / Maćka → holding, żeby „Moje” było puste pod testy.

```bash
python3 integrations/tools/park_sample_week_owners.py dry-run
python3 integrations/tools/park_sample_week_owners.py apply --run 20260904T042844Z
# powrót:
python3 integrations/tools/park_sample_week_owners.py restore --run 20260904T042844Z
```

- Manifest: `integrations/runbooks/exports/sample_week_park/20260904T042844Z/`
- Stempel: `bizRoutingRule = PARKED-SAMPLE-WEEK:{marta|gosia|maciej}`
- WON/LOST zostawione u właścicieli
- Apply: **557** kart, 0 błędów

## Wyłączenie (powrót do normy)

Worker:

```bash
# w twenty-crm-worker/.env.deploy
LEAD_SAMPLE_WEEK_ENABLED=false
cd integrations/cloud-functions/twenty-crm-worker && bash deploy.sh
```

Ads roll-forward (Twenty z powrotem prod, BB sandbox): `ADS_SQL_SIGNAL_ROLLBACK.md` §8.

## Deploy BB (wymagane ręcznie)

Zmiana w `better-bitrix-main/app/api/analytics/lead/route.ts` (`environment: "prod"`).  
Bez deployu `crm.owocni.pl` Ads z BB dalej nie wrócą.

## Stape

Repo: `INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js` → `runtime_environment: "sandbox"`.  
**Publish** kontenera sGTM (spójność; mechanizm = Cloud Run).
