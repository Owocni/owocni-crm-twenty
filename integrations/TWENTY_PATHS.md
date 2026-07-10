---
doc_id: TWENTY_PATHS
title: "TWENTY_PATHS — mapa ścieżek Twenty ↔ Sortownia ↔ Robot"
layer: reference
status: active
owner: "Dawid"
last_verified: 2026-07-10
related:
  - ../owocni-crm/ARCHITECTURE.md
  - ../owocni-crm/EVENT_CONTRACT.md
  - INTEGRATIONS_PARITY.md
---

# TWENTY_PATHS — kotwica dla LLM i implementacji

Jedna tabela „co gdzie żyje” — **bez zgadywania** ze starego CRM / archiwum.

## 1. Adaptery (nazwy kanoniczne)

| Adapter ID | Kierunek | Plik w repo | Deploy (sandbox lipiec 2026) |
|------------|----------|-------------|------------------------------|
| `inbound:twenty_webhook` | Twenty → task_queue | `cloud-functions/twenty-inbound-webhook/` | Stape Client + stub → **GCP CF** (`gcp-v5`) |
| `inbound:twenty_webhook` (legacy) | Twenty → task_queue | `INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js` | Stape HTTP tag (prod rollback) |
| `crm:twenty_create_lead` | Sortownia → Twenty | `cloud-functions/twenty-crm-worker/` | Stape stub → **GCP CF** |
| `crm:twenty_update_person` | Sortownia → Twenty | `CRM_TWENTY_UPDATE_PERSON.sGTM.js` + worker | Stape + GCP worker |
| *(platform)* | task_queue → platformy | `GoogleCloudRobot.js` | GCP Cloud Run `robot-task-monitor` |
| *(paid)* | Web GTM → Sortownia | `SORTOWNIA_V2_POPRAWIONY.js` | Stape sGTM tag |

## 2. HTTP / endpointy

| Ścieżka | Opis |
|---------|------|
| `POST /inbound/twenty_webhook` | Native webhook OUT z Twenty (HMAC) |
| `POST /crm/twenty_worker` | Worker `crm:twenty_update_person` + `crm:twenty_create_lead` (Scheduler / poll task_queue) |
| `https://<stape-container>/...` | Kontener Sortowni — URL z Stape UI, nie hardcode w SSOT |

## 3. Stape Store (kolekcje / klucze)

| Klucz / kolekcja | Zawartość |
|------------------|-----------|
| `task_queue` | Zadania dla Robota (`event_name`, `environment`, atrybucja, …) |
| `identity_map` | Profil pod `id_oid` / email / phone; mint-guard: `twenty_person_{personId}` |
| `twenty_opp_{opportunityId}` | `last_stage`, `last_campaignRejected`, `last_delivery_fingerprint` (dedup) |
| `pending_write_twenty_{opportunityId}` | TTL echo loop-prevention (NR-6) |

## 4. Przepływy (skrót)

### 4.1 Paid formularz → Twenty

```
Web GTM → Sortownia (oid_init → generate_lead) → crm:twenty_create_lead → Twenty API
```

### 4.2 Outbound CRM → platformy

```
Twenty webhook OUT → Stape POST /inbound/twenty_webhook
  → (sandbox) GCP twenty-inbound-webhook → task_queue
  → Robot → arkusze sandbox / platformy prod
```

Workflow MANUAL („Przyjmij jako SQL", „Odrzuć leada") → patrz `runbooks/TWENTY_WORKFLOWS_REJECT_AND_GUARD.md`.

### 4.3 Manual create + backfill

```
Twenty (idOid null) → inbound → generate_lead (manual) → mint idOid → crm:twenty_update_person
```

(sekwencja L-1: `srcSystem`-SKIP tylko do smoke #4 — `EVENT_CONTRACT` §6.1)

## 5. Środowiska

| `environment` | Sortownia routing | Robot |
|---------------|-------------------|-------|
| `prod` (domyślne) | Inteligentny routing → platformy | Ads / Meta / GA4 MP |
| `sandbox` | safe-sink (log/arkusz), **bez** prod API | SKIP prod API; arkusze debug OK |

Implementacja: `shared/envGuard.js` (Robot), `ENV_GUARD.sGTM.js` (Stape copy-paste).

## 6. Event names (kanon)

`generate_lead` · `qualify_lead` · `purchase` · `rejected_lead` · `consent_update` · `oid_init`

Zakaz jako `event_name`: `lead_won`, `closed_won` (aliasy legacy tylko na wejściu).

## 7. Co NIE jest w tym repo (świadomie)

- Sekrety Twenty / Stape / GCP
- Finalne ścieżki JSON pól webhooka (→ preflight sandbox, `fixtures/webhook-captures/`)
- Pełny Identity Resolver T1–T5 (osobny tag Stape)

Patrz: `runbooks/WHY_NOT_FULL_RUNTIME_YET.md`
