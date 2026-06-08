---
doc_id: TWENTY_SANDBOX_STEP02
title: "Krok T2 — native webhook OUT w Twenty sandbox"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-08
related:
  - PREFLIGHT_TWENTY_WEBHOOK
---

# Krok T2 — Webhook Twenty → Stape (preflight)

**Czas:** ~1–2 h  
**Wykonawca:** Dawid (Twenty UI + opcjonalnie webhook.site na pierwszy strzał)  
**Po PASS:** agent dopasuje `parseTwentyPayload()` w `INBOUND_TWENTY_WEBHOOK.js`.

---

## 0. Dwie ścieżki URL (wybierz jedną na start)

### A) Szybki test struktury (bez Stape) — **zalecane na pierwszy webhook**

1. Wejdź na https://webhook.site — skopiuj unikalny URL.
2. W Twenty ustaw ten URL jako target webhooka.
3. Zrób akcje z §3 — payloady zapisz z webhook.site.
4. Potem podmień URL na Stape (§1).

### B) Od razu Stape

URL: `https://<twoja-domena-stape>/inbound/twenty_webhook`  
(wymaga wcześniejszego HTTP tagu — można stub który tylko `logToConsole` body).

---

## 1. Konfiguracja w Twenty

**Gdzie:** Settings → **Webhooks** (native — **nie** Workflows → HTTP action).

| Ustawienie | Wartość |
|------------|---------|
| URL | webhook.site **lub** Stape endpoint |
| Secret | Wygeneruj długi secret → zapisz w menedżerze haseł / zmienna Stape `twenty_webhook_secret` — **nie do git** |
| Events / Objects | **Opportunity** i **Person** — created + updated |
| Aktywny | Yes |

**Zakaz:** Workflow HTTP action (kredyty, inna semantyka — `EVENT_CONTRACT` §5.1).

---

## 2. Weryfikacja HMAC

Nagłówki kanoniczne (`ops/OPS_NOTES.md`, ADR #16):

- `X-Twenty-Webhook-Signature` — SHA256 HMAC
- `X-Twenty-Webhook-Timestamp`
- Signed string: `{timestamp}:{raw_body}`

Na webhook.site zobaczysz nagłówki w podglądzie requestu.  
Przy Stape: tag musi odrzucić request **bez** poprawnego podpisu.

---

## 3. Przechwyć 4 payloady (obowiązkowe)

Wykonaj w Twenty sandbox i zapisz **surowy JSON** lokalnie (`integrations/fixtures/webhook-captures/` — gitignore na PII).

| # | Akcja w Twenty | Plik | Co sprawdzić w JSON |
|---|----------------|------|---------------------|
| A | Nowa Opportunity ręcznie (bez idOid) | `webhook-opportunity-create.json` | `id`, `stage`, ścieżka do Person/email |
| B | Stage → QUALIFIED | `webhook-stage-qualified.json` | wartość `stage`, **brak** before/after |
| C | Stage → WON + `bizValueWon` | `webhook-stage-won.json` | `bizValueWon`, `stage` |
| D | `campaignRejected` false→true | `webhook-campaign-rejected.json` | nazwa pola API |

**Dodatkowo zapisz:**

- Dokładna wartość pola platformowego `event` (np. `opportunity.updated`) → wpisz do `OPS_NOTES.md` jako `[D:VERIFIED]`.
- Czy `Person.idOid` jest **w payloadzie** Opportunity, czy trzeba osobnego query (OQ-E3).

---

## 4. Wpis do OPS_NOTES (szablon)

Po przechwyceniu uzupełnij w `owocni-crm/ops/OPS_NOTES.md`:

```markdown
### Twenty webhook sandbox (2026-06-XX) [D:VERIFIED]

| Pytanie | Odpowiedź |
|---------|-----------|
| OQ-E2: pole `event` | np. `opportunity.updated` |
| OQ-E3: Person.idOid w payloadzie Opportunity | TAK/NIE — ścieżka JSON: `...` |
| ID Opportunity w payloadzie | pole: `data.id` / ... |
| HMAC na żywym requeście | PASS |
```

---

## 5. Zmienne Stape (przygotuj na S1)

W kontenerze Stape utwórz **Variables** (nie commituj wartości):

| Nazwa zmiennej | Przeznaczenie |
|----------------|---------------|
| `stape_base_url` | URL kontenera Stape |
| `stape_store_api_key` | Klucz Stape Store API |
| `twenty_webhook_secret` | Secret z Twenty webhook |
| `runtime_environment` | `sandbox` na czas testów |

---

## 6. Safe sink

- [ ] W taskach z adaptera ustawiaj `environment: sandbox`.
- [ ] Robot **nie** wysyła do prod Google/Meta gdy `environment=sandbox` (`ARCHITECTURE` §5.4).

---

## Checklist PASS T2

| # | Kryterium | ☐ |
|---|-----------|---|
| 1 | Native webhook (nie Workflow HTTP) | |
| 2 | HMAC zweryfikowany | |
| 3 | ≥4 zapisane payloady | |
| 4 | OQ-E2 i OQ-E3 mają odpowiedź | |
| 5 | Secret **nie** w repo | |

**Po PASS:** wróć do czatu z „T2 PASS" + (jeśli możesz) jeden zanonimizowany JSON lub odpowiedzi z tabeli §4.

Następny krok agenta: [BUILD_INBOUND_TWENTY_WEBHOOK.md](./BUILD_INBOUND_TWENTY_WEBHOOK.md).
