---
doc_id: MIGRATE_TWENTY_CRM_TO_GCP
title: "Migracja crm:twenty_* ze sGTM do Cloud Function"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-07-07
related:
  - ../cloud-functions/twenty-crm-worker/index.js
  - ../cloud-functions/twenty-inbound-webhook/index.js
  - ../CRM_TWENTY_CREATE_LEAD.gcp-stub.sGTM.js
  - ../CRM_TWENTY_UPDATE_PERSON.gcp-stub.sGTM.js
  - ../INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js
  - BUILD_CRM_TWENTY_CREATE_LEAD.md
---

# Migracja Twenty CRM worker → GCP

**Cel:** zwolnić ~60 KB w kontenerze sGTM (`crm_twenty_create_lead` + `crm_twenty_update_person`) przenosząc logikę do Cloud Function.

**Kod:** `integrations/cloud-functions/twenty-crm-worker/`

**Kontener sGTM:** `GTM-5ZM8KQ5S` · `https://uinpcbwf.eug.stape.io`

---

## Co się zmienia

| Było | Będzie |
|------|--------|
| Scheduler → `POST /crm/twenty_worker` → tagi sGTM | Scheduler → **URL Cloud Function** |
| `CRM_TWENTY_CREATE_LEAD.sGTM.js` (~48 KB) | stub ~15 linii |
| `CRM_TWENTY_UPDATE_PERSON.sGTM.js` (~12 KB) | stub ~15 linii |
| Sortownia | **bez zmian** (dalej enqueue do `task_queue`) |
| `INBOUND_TWENTY_WEBHOOK.sGTM.js` (~44 KB) | stub sandbox → GCP (Faza 2) |

---

# CZĘŚĆ A — Google Cloud Functions

## A1. Wymagania

- [ ] Dostęp do tego samego projektu GCP co `GoogleCloudRobot.js`
- [ ] `gcloud` CLI ([instalacja](https://cloud.google.com/sdk/docs/install))
- [ ] Wartości env: `STAPE_API_KEY`, `TWENTY_API_KEY` (z `.env.local` lub Secret Manager Robota)

## A2. Sekrety w GCP (jednorazowo)

**Opcja 1 — Secret Manager (zalecane):**

```bash
gcloud secrets create STAPE_API_KEY --replication-policy=automatic
echo -n "TWÓJ_KLUCZ" | gcloud secrets versions add STAPE_API_KEY --data-file=-

gcloud secrets create TWENTY_API_KEY --replication-policy=automatic
echo -n "TWÓJ_KLUCZ" | gcloud secrets versions add TWENTY_API_KEY --data-file=-
```

**Opcja 2 — bez Secret Manager:** edytuj `deploy.sh` i przenieś klucze do `--set-env-vars` (mniej bezpieczne, szybsze na sandbox).

## A3. Konfiguracja deploy

```bash
cd integrations/cloud-functions/twenty-crm-worker
cp .env.deploy.example .env.deploy
# Uzupełnij GCP_PROJECT, GCP_REGION, klucze API
chmod +x deploy.sh
npm install
```

## A4. Deploy funkcji

```bash
./deploy.sh
```

Po deploy zapisz **URL funkcji** z outputu, np.:

`https://europe-central2-PROJEKT.cloudfunctions.net/twenty-crm-worker-sandbox`

## A5. Test ręczny (przed przełączeniem Schedulera)

```bash
curl -X POST "https://REGION-PROJEKT.cloudfunctions.net/twenty-crm-worker-sandbox"
```

Oczekiwane:

```json
{
  "ok": true,
  "build_id": "2026-07-07-gcp-v1",
  "update_person": { "processed": 0, "failed": 0 },
  "create_lead": { "processed": 0, "failed": 0 }
}
```

Logi: GCP Console → Cloud Functions → `twenty-crm-worker-sandbox` → Logs.

## A6. Przełączenie Cloud Scheduler

1. GCP Console → **Cloud Scheduler**
2. Znajdź job **`twenty-crm-worker-sandbox`** (co ~2 min)
3. **Edit** → zmień URL:
   - **Było:** `https://uinpcbwf.eug.stape.io/crm/twenty_worker`
   - **Ma być:** URL z A4 (POST)
4. Method: **POST**, body puste OK
5. **Save** — **NIE uruchamiaj jeszcze** jeśli Stape nadal ma pełne tagi (duplikacja). Najpierw zrób Część B, potem włącz scheduler.

## A7. Weryfikacja po przełączeniu

1. Wyślij testowy formularz (sandbox email `@fastman.eu`)
2. Stape Store → `task_queue` → dokument `…_crm_twenty_create_lead`, `status: pending`
3. Poczekaj ~2 min (scheduler)
4. Task → `status: done`, `create_lead_runtime: gcp`, `create_lead_build_id: 2026-07-07-gcp-v1`
5. Twenty → nowy Person + Opportunity

**Rollback Schedulera:** przywróć URL `/crm/twenty_worker` i pełne tagi sGTM z repo.

---

# CZĘŚĆ B — Google Tag Manager (sGTM)

> **Kolejność:** najpierw deploy GCP (A) + test curl (A5). Potem odchudź Stape (B). Na końcu przełącz Scheduler (A6).

## B1. Tag `crm_twenty_create_lead`

1. sGTM → **Templates** → **Tag Templates** → otwórz szablon `crm_twenty_create_lead`
2. **Zastąp cały kod** zawartością pliku:
   `integrations/CRM_TWENTY_CREATE_LEAD.gcp-stub.sGTM.js`
3. **Save** szablonu

> Tag + trigger `crm_twenty_create_lead` **zostaw** — stub musi się wykonać jeśli ktoś jeszcze woła `/crm/twenty_worker`.

## B2. Tag `crm_twenty_update_person`

1. Otwórz szablon tagu `crm_twenty_update_person`
2. **Zastąp kod** plikiem:
   `integrations/CRM_TWENTY_UPDATE_PERSON.gcp-stub.sGTM.js`
3. **Save**

## B3. Client `TWENTY_CRM_WORKER_CLIENT` — opcjonalnie

**Nie musisz zmieniać** — po przełączeniu Schedulera na GCP client nie będzie wołany.

Jeśli chcesz dodatkowo odchudzić kontener:
- możesz usunąć trigger z clienta `/crm/twenty_worker` (ostrożnie — rollback trudniejszy)

## B4. Publish kontenera

1. **Submit** → opis: `Migrate CRM workers to GCP — stubs only`
2. **Publish**

Po publish sprawdź rozmiar kontenera — powinno spaść ~60 KB.

## B5. Czego NIE ruszać w GTM

| Element | Dlaczego |
|---------|----------|
| `SORTOWNIA_V2_POPRAWIONY.js` | Dalej enqueue `crm:twenty_create_lead` |
| `INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js` | Tylko prod / rollback (pełna logika w Stape) |
| `GoogleCloudRobot` (osobna CF) | GA4 / Meta / Google Ads — bez zmian |

---

# CZĘŚĆ C — Checklist końcowy

| # | Krok | Kto | ✓ |
|---|------|-----|---|
| 1 | Deploy `twenty-crm-worker-sandbox` | GCP | ☐ |
| 2 | `curl POST` → HTTP 200 | GCP | ☐ |
| 3 | Stuby w obu tagach CRM | Stape | ☐ |
| 4 | Publish sGTM | Stape | ☐ |
| 5 | Scheduler → URL Cloud Function | GCP | ☐ |
| 6 | Test formularz → Opp w Twenty | E2E | ☐ |
| 7 | Log GCP: `build_id: 2026-07-07-gcp-v1` | GCP | ☐ |

---

# Lokalny dev (opcjonalnie)

```bash
cd integrations/cloud-functions/twenty-crm-worker
export STAPE_API_KEY=...
export TWENTY_API_KEY=...
export STAPE_API_BASE=https://uinpcbwf.eug.stape.io/stape-api
npm start
curl -X POST http://localhost:8080
```

---

# FAQ

**Czy Sortownia wymaga zmian?**  
Nie. Dalej zapisuje taski `job_type: crm:twenty_create_lead` — worker GCP je czyta.

**Co jeśli oba workery (Stape + GCP) działają równolegle?**  
Idempotencja po `idOid` — drugi run da `already_exists`. Unikaj tego; przełącz Scheduler dopiero po stubach.

**Faza 2 (inbound webhook)?**  
Patrz sekcja poniżej — `integrations/cloud-functions/twenty-inbound-webhook/`.

---

# FAZA 2 — Inbound Twenty webhook → GCP

**Cel:** zwolnić ~44 KB w kontenerze sGTM (`INBOUND_TWENTY_WEBHOOK`) przenosząc logikę do Cloud Function. Sandbox proxy przez cienki stub; prod może zostać na legacy w Stape do czasu osobnego deploy prod.

**Kod:** `integrations/cloud-functions/twenty-inbound-webhook/`

---

## P2.1. Wymagania

- [ ] Faza 1 (CRM worker) wdrożona i stabilna
- [ ] `gcloud` CLI, ten sam projekt GCP co worker
- [ ] `STAPE_API_KEY`, `TWENTY_API_KEY` (jak w `.env.deploy` workera)

## P2.2. Konfiguracja deploy

```bash
cd integrations/cloud-functions/twenty-inbound-webhook
cp .env.deploy.example .env.deploy
# Uzupełnij GCP_PROJECT, GCP_REGION, klucze API
chmod +x deploy.sh
npm install
```

## P2.3. Deploy funkcji

```bash
./deploy.sh
```

Po deploy zapisz **URL funkcji**, np.:

`https://europe-central2-PROJEKT.cloudfunctions.net/twenty-inbound-webhook-sandbox`

## P2.4. Test ręczny (przed stubem w Stape)

```bash
curl -X POST "https://REGION-PROJEKT.cloudfunctions.net/twenty-inbound-webhook-sandbox" \
  -H "Content-Type: application/json" \
  -H "X-Owocni-Runtime: sandbox" \
  -d '{"event":"opportunity.updated","data":{"id":"test-opp-id","stage":"NEW"}}'
```

Oczekiwane:

```json
{
  "ok": true,
  "build_id": "2026-07-07-gcp-v1",
  "result": { "status": "skipped", "reason": "..." }
}
```

Logi: GCP Console → Cloud Functions → `twenty-inbound-webhook-sandbox` → Logs.

## P2.5. Stape — Constant Variable

1. sGTM → **Variables** → **Constants** → nowa: `GCP_INBOUND_WEBHOOK_URL`
2. Wartość: URL z P2.3

## P2.6. Stape — tag inbound webhook (sandbox)

1. **Templates** → **Tag Templates** → szablon inbound Twenty webhook
2. **Zastąp kod** plikiem `integrations/INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js`
3. W stubie ustaw `GCP_INBOUND_WEBHOOK_URL` (lub podłącz Constant Variable)
4. **Save** → **Publish** kontenera

> **Prod:** stub loguje `prod inbound still on legacy` i kończy sukcesem (no-op). Prod nadal wymaga pełnego tagu z `INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js` albo osobnego deploy `twenty-inbound-webhook-prod`.

## P2.7. Twenty — webhook URL

Webhook Twenty **nadal wskazuje na Stape** (client `/twenty_webhook`). Stub przekazuje body + nagłówki HMAC do GCP.

Nie zmieniaj URL webhooka w Twenty — zmienia się tylko tag w sGTM.

## P2.8. Weryfikacja E2E (sandbox)

| # | Krok | ✓ |
|---|------|---|
| 1 | Zmiana stage Opp w Twenty (sandbox) | ☐ |
| 2 | Stape log: `INBOUND_TWENTY_STUB: GCP 200` | ☐ |
| 3 | GCP log: `build_id: 2026-07-07-gcp-v1` | ☐ |
| 4 | Stape Store `task_queue` — nowy task `analytics:ga4_mp` lub `crm:twenty_update_person` | ☐ |
| 5 | Person webhook → identity_map + opcjonalnie `leads@` create_lead task | ☐ |

**Rollback:** przywróć pełny tag z `INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js` (z Constant Variables na klucze).

## P2.9. Checklist Faza 2

| # | Krok | Kto | ✓ |
|---|------|-----|---|
| 1 | Deploy `twenty-inbound-webhook-sandbox` | GCP | ☐ |
| 2 | `curl POST` → HTTP 200 + `build_id` | GCP | ☐ |
| 3 | Constant `GCP_INBOUND_WEBHOOK_URL` | Stape | ☐ |
| 4 | Stub w tagu inbound | Stape | ☐ |
| 5 | Publish sGTM | Stape | ☐ |
| 6 | Test Opp stage → task_queue | E2E | ☐ |
| 7 | Test Person → identity resolver | E2E | ☐ |
