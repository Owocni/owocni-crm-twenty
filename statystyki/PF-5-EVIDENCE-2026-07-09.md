# PF-5 — weryfikacja metryk (sandbox 2026-07-09)

Skrypt: `integrations/tools/verify_metrics_pf5.py`

## Wynik REST vs oczekiwane (dashboard Zespół, 90d)

| Metryka | REST (skrypt) | Dashboard (oczekiwane) | Status |
|---------|---------------|------------------------|--------|
| M9 otwarte | 111 | 111 (stock) | ✅ zgodne |
| M7 SQL pipeline | 1 | 1 (stock) | ✅ zgodne |
| M6 świeże (90d) | 111 | ~111 | ✅ zgodne |
| HIG bez produktu | 13 | 13 | ✅ zgodne |
| M4 Win Rate | 100% (1/1) | 100% przy 1 WON | ✅ zgodne (mała próba) |
| M1 śr. cykl | 2.24 dni (n=1) | test7858 | ✅ zgodne |
| M2 śr. 1. odp. | 54.19 h (n=2) | ~54 h | ✅ zgodne |
| M3 śr. do SQL | 137.8 h (n=2) | ~138 h | ✅ zgodne |

**Uwaga:** M4/M1 na małej próbie (1 zamknięty deal) — pełna weryfikacja Ratio wymaga ≥20 rekordów (METRICS §8).

## PF-4 — adapter SKIP

Testy jednostkowe: `integrations/cloud-functions/twenty-inbound-webhook/handlers/detectBusinessEvent.test.js`

```
npm test  # w twenty-inbound-webhook — 7/7 PASS
```

Scenariusze: zapis pól metryk bez zmiany `stage` → `SKIP_NO_RELEVANT_TRANSITION` (zero EMITTED).

## Smoke Leads@ → DIRECT_EMAIL

- **Mapowanie (unit):** `twenty-crm-worker/workers/createLead.bizSource.test.js` — 4/4 PASS
- **E2E na sandboxie:** ⏳ brak rekordów z `bizSource=DIRECT_EMAIL` w API (0/112) — wyślij testowy mail na Leads@ lub uruchom worker z taskiem `inbound_channel=leads_at`
