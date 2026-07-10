---
doc_id: PREFLIGHT_TWENTY
title: "Faza 2 — preflight webhook Twenty (payload + HMAC)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-07-10
related:
  - ../../owocni-crm/ops/OPS_NOTES.md
  - ../../owocni-crm/EVENT_CONTRACT.md
---

# Faza 2 — preflight Twenty webhook

**Cel:** rozstrzygnąć **OQ-E2**, **OQ-E3** i fakty HMAC z instancji — oraz zweryfikować **GCP inbound** w sandboxie (build `2026-07-10-gcp-v5`).

**Bramy:** przygotowanie **G2** (webhook-truth).

---

## Checklist preflight

### 2.1 Konfiguracja webhooka w Twenty (sandbox)

- [ ] Native webhook OUT (nie Workflow HTTP — `EVENT_CONTRACT` §5.1).
- [ ] Target URL: `https://<sortownia>/inbound/twenty_webhook` — Stape Client forwarduje do GCP (`MIGRATE_TWENTY_CRM_TO_GCP.md` § Faza 2).
- [ ] Obiekty: **Opportunity**, **Person** — create + update.
- [ ] Secret HMAC skopiowany do zmiennej Stape (nie do repo).

### 2.2 HMAC

- [ ] Zweryfikuj nagłówki i signed-string wg `ops/OPS_NOTES.md` § Twenty Verified Facts.
- [ ] Test: webhook z Twenty → endpoint testowy odrzuca bez podpisu / akceptuje z podpisem.

### 2.3 Przechwyć payloady (minimum 4)

Wykonaj akcję w Twenty sandbox i zapisz **surowy JSON** (lokalnie; PII → gitignore):

| # | Akcja w Twenty | Plik roboczy (sugerowana nazwa) | Co wyciągnąć |
|---|----------------|----------------------------------|--------------|
| A | Utwórz Opportunity (manual, bez idOid) | `webhook-opportunity-create.json` | ścieżka do `Person.idOid`, pole `stage` |
| B | Zmiana stage → QUALIFIED | `webhook-stage-qualified.json` | wartość `stage`, brak diff before/after |
| C | Zmiana stage → WON | `webhook-stage-won.json` | `bizValueWon` jeśli jest |
| D | `campaignRejected` false→true | `webhook-campaign-rejected.json` | nazwa pola API (`campaignRejected` vs inna) |

Opcjonalnie: zapisz **nazwę pola platformowego** `event` (np. `opportunity.updated`) — wpisz w `OPS_NOTES.md` jako `[D:VERIFIED]`.

### 2.4 Odpowiedzi na pytania blokujące implementację

Wypełnij tabelę (skopiuj do `OPS_NOTES.md` lub notatki PR):

| ID | Pytanie | Odpowiedź z sandboxa |
|----|---------|----------------------|
| OQ-E2 | Dokładna nazwa pola `event` w payloadzie | |
| OQ-E3 | Czy Opportunity payload niesie `Person.idOid` inline | |
| — | ID rekordu Opportunity (`id` / `recordId`) | |
| — | Typ obiektu w payloadzie (filtr NR-5) | |

### 2.5 Safe sink sandbox

- [ ] `environment=sandbox` w routingu → **tylko** arkusz safe sink / log (nie Google Ads API prod).
- [ ] Potwierdź z `ARCHITECTURE.md` §5.4 — osobny arkusz niż backup formularzy.

### 2.6 Weryfikacja GCP inbound (sandbox, po deploy)

- [ ] `curl POST` do `twenty-inbound-webhook-sandbox` → `build_id: 2026-07-10-gcp-v5`
- [ ] Zmiana stage bez istotnej zmiany (np. tylko metryki) → `SKIP_NO_RELEVANT_TRANSITION`
- [ ] Workflow „Odrzuć leada" → `rejected_lead` w `task_queue` (patrz `TWENTY_WORKFLOWS_REJECT_AND_GUARD.md`)

---

## Kryteria PASS (Faza 2)

| # | Kryterium | PASS |
|---|-----------|------|
| 1 | HMAC PASS na żywym webhooku | ☐ |
| 2 | Masz ≥4 zapisane payloady reprezentujące ścieżki ze smoke matrix | ☐ |
| 3 | Wiesz, gdzie w JSON jest `idOid`, `stage`, `campaignRejected` | ☐ |
| 4 | OQ-E2/OQ-E3 mają odpowiedź `[D:VERIFIED]` lub wpis w OPS_NOTES | ☐ |

---

## Następna faza

→ [BUILD_INBOUND_TWENTY_WEBHOOK.md](./BUILD_INBOUND_TWENTY_WEBHOOK.md)
