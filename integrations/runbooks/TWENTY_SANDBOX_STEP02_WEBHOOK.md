---
doc_id: TWENTY_SANDBOX_STEP02
title: "Krok T2 — native webhook OUT w Twenty sandbox"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-07-10
related:
  - PREFLIGHT_TWENTY_WEBHOOK
  - MIGRATE_TWENTY_CRM_TO_GCP
  - TWENTY_WORKFLOWS_REJECT_AND_GUARD
---

# Krok T2 — Webhook Twenty → Stape → GCP (preflight)

**Czas:** ~1–2 h (pierwszy raz) · **utrzymanie:** weryfikacja po każdym deploy inbound CF  
**Wykonawca:** Dawid (Twenty UI) + agent (dopasowanie kodu GCP)  
**Po PASS:** logika w `cloud-functions/twenty-inbound-webhook/handlers/processWebhook.js` (build `2026-07-10-gcp-v5`).

---

## 0. Architektura sandbox (lipiec 2026)

```
Twenty native webhook OUT (HMAC)
    → Stape Client  POST /inbound/twenty_webhook
    → Stape stub    INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js
    → GCP CF        twenty-inbound-webhook-sandbox
    → Stape Store   task_queue + shadow-state
    → Robot         GoogleCloudRobot.js → arkusz sandbox
```

**Twenty UI:** URL webhooka **nie zmienia się** przy migracji na GCP — zmienia się tylko tag w Stape (stub zamiast pełnej logiki).

**Prod:** pełny tag `INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js` lub przyszły `twenty-inbound-webhook-prod`.

---

## 1. Dwie ścieżki URL (pierwszy test vs produkcyjny sandbox)

### A) Szybki test struktury (bez Stape) — opcjonalnie na start

1. https://webhook.site — skopiuj URL.
2. W Twenty ustaw jako target webhooka.
3. Wykonaj akcje z §3 — zapisz payloady.
4. Podmień URL na Stape (§2).

### B) Docelowy sandbox (Stape + GCP)

| Warstwa | URL / komponent |
|---------|-----------------|
| Twenty webhook target | `https://uinpcbwf.eug.stape.io/inbound/twenty_webhook` (Stape Client) |
| Stub | `INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js` → Constant `GCP_INBOUND_WEBHOOK_URL` |
| GCP | `twenty-inbound-webhook-sandbox` (region `europe-central2`) |

Deploy i checklist → [MIGRATE_TWENTY_CRM_TO_GCP.md](./MIGRATE_TWENTY_CRM_TO_GCP.md) § P2.

---

## 2. Konfiguracja w Twenty

**Gdzie:** Settings → **Webhooks** (native — **nie** Workflows → HTTP action jako główny transport).

| Ustawienie | Wartość |
|------------|---------|
| URL | Stape `/inbound/twenty_webhook` (patrz §1B) |
| Secret | → zmienna Stape `twenty_webhook_secret` — **nie do git** |
| Events / Objects | **Opportunity** i **Person** — created + updated |
| Aktywny | Yes |

**Zakaz:** Workflow HTTP jako **zamiennik** native webhook OUT (`EVENT_CONTRACT` §5.1).  
**Wyjątek:** workflow „Odrzuć leada" wysyła **jednorazowy** POST po UPDATE — patrz `TWENTY_WORKFLOWS_REJECT_AND_GUARD.md`.

---

## 3. Weryfikacja HMAC

Nagłówki kanoniczne (`ops/OPS_NOTES.md`, ADR #16):

- `X-Twenty-Webhook-Signature` — SHA256 HMAC
- `X-Twenty-Webhook-Timestamp`
- Signed string: `{timestamp}:{raw_body}`

GCP inbound weryfikuje HMAC (lub loguje `SKIP_HMAC_NO_HEADERS` przy curl bez nagłówków).

---

## 4. Przechwyć payloady (minimum + rozszerzenia 2026-07)

Zapisz **surowy JSON** lokalnie (`integrations/fixtures/webhook-captures/` — gitignore na PII).

| # | Akcja w Twenty | Plik | Co sprawdzić |
|---|----------------|------|--------------|
| A | Nowa Opportunity ręcznie (bez idOid) | `webhook-opportunity-create.json` | `id`, `stage`, Person/email |
| B | Stage → QUALIFIED **przez workflow SQL** | `webhook-stage-qualified.json` | `stage`, `bizSqlConfirmed` |
| Bb | Drag → QUALIFIED **bez** SQL | — | brak `qualify_lead`; `SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM` |
| C | Stage → WON | `webhook-stage-won.json` | `bizValueWon` lub `bizValueDisplay` |
| D | Workflow „Odrzuć leada" | `webhook-campaign-rejected.json` | `campaignRejected`, stage **bez zmiany** |
| E | Zmiana opisu bez stage | `webhook-description-only.json` | `SKIP_NO_RELEVANT_TRANSITION` |
| F | Duplicate webhook (ten sam stan) | — | `SKIP_DUPLICATE_DELIVERY` / fingerprint |

**Dodatkowo zapisz:**

- Pole platformowe `event` (np. `opportunity.updated`) → `OPS_NOTES.md` `[D:VERIFIED]`
- Czy `Person.idOid` jest inline w Opportunity (OQ-E3)

---

## 5. Wpis do OPS_NOTES (szablon)

```markdown
### Twenty webhook sandbox (2026-07-XX) [D:VERIFIED]

| Pytanie | Odpowiedź |
|---------|-----------|
| OQ-E2: pole `event` | np. `opportunity.updated` |
| OQ-E3: Person.idOid w payloadzie Opportunity | TAK/NIE — ścieżka JSON |
| ID Opportunity | `data.id` |
| HMAC na żywym requeście | PASS |
| GCP inbound build_id | `2026-07-10-gcp-v5` |
```

---

## 6. Zmienne Stape

| Nazwa | Przeznaczenie |
|-------|---------------|
| `stape_base_url` | URL kontenera |
| `stape_store_api_key` | Stape Store API |
| `twenty_webhook_secret` | Secret z Twenty |
| `GCP_INBOUND_WEBHOOK_URL` | URL Cloud Function inbound |
| `runtime_environment` | `sandbox` |

---

## 7. Weryfikacja GCP (po deploy)

```bash
curl -X POST "$GCP_INBOUND_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Owocni-Runtime: sandbox" \
  -d '{"event":"opportunity.updated","data":{"id":"test","stage":"NEW"}}'
```

Oczekiwane: `"build_id": "2026-07-10-gcp-v5"` w odpowiedzi.

E2E: zmiana stage w Twenty → Stape log `INBOUND_TWENTY_STUB: GCP 200` → task w `task_queue` → wiersz w arkuszu sandbox.

---

## 8. Safe sink

- [ ] Taski z adaptera: `environment: sandbox`
- [ ] Robot nie wysyła prod Google/Meta przy sandbox (`ARCHITECTURE` §5.4)

---

## Checklist PASS T2

| # | Kryterium | Status |
|---|-----------|--------|
| 1 | Native webhook (nie Workflow HTTP jako transport) | ☑ |
| 2 | HMAC zweryfikowany | ☑ |
| 3 | ≥4 zapisane payloady (A–D) | ☑ |
| 4 | OQ-E2 i OQ-E3 mają odpowiedź | ☑ |
| 5 | Secret **nie** w repo | ☑ |
| 6 | GCP inbound `gcp-v5` + stub Stape | ☑ |

**Następne kroki:** [BUILD_INBOUND_TWENTY_WEBHOOK.md](./BUILD_INBOUND_TWENTY_WEBHOOK.md) (SSOT logiki) · [TWENTY_WORKFLOWS_REJECT_AND_GUARD.md](./TWENTY_WORKFLOWS_REJECT_AND_GUARD.md) · smoke matrix §6.3 w `EVENT_CONTRACT.md`.
