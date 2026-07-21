---
doc_id: TWENTY_PATHS
title: "TWENTY_PATHS — mapa ścieżek Twenty ↔ Sortownia ↔ Robot"
layer: reference
status: active
owner: "Dawid"
last_verified: 2026-07-21
related:
  - ../owocni-crm/ARCHITECTURE.md
  - ../owocni-crm/EVENT_CONTRACT.md
  - INTEGRATIONS_PARITY.md
  - runbooks/CALL_INGEST_N8N.contract.md
  - runbooks/MERGE_LEADS.md
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
| `crm:call_transcript_ingest` | Play/n8n → Twenty | `workers/callTranscriptIngest.js` | GCP CF + Scheduler |
| `crm:call_transcript_link` | Twenty UI / webhook → sync | `workers/callTranscriptLink.js` | GCP CF (HTTP actions) |
| `crm:merge_leads` | Twenty UI → scalenie | `workers/mergeLeads.js` | GCP CF (HTTP action) |
| *(platform)* | task_queue → platformy | `GoogleCloudRobot.js` | GCP Cloud Run `robot-task-monitor` |
| *(paid)* | Web GTM → Sortownia | `SORTOWNIA_V2_POPRAWIONY.js` | Stape sGTM tag |

## 2. HTTP / endpointy

| Ścieżka | Opis |
|---------|------|
| `POST /inbound/twenty_webhook` | Native webhook OUT z Twenty (HMAC) → Stape |
| GCP `twenty-crm-worker-sandbox` (HTTP) | Poll workers **or** actions: `enqueue_call_transcript`, `link_call_transcript`, `create_lead_from_call`, `merge_leads`; webhooks `messageChannelMessageAssociation.*`, `callTranscript.updated` |
| `POST /crm/twenty_worker` | Legacy client Stape → ten sam worker |
| n8n `Play PBX → GCP CallTranscript` | Webhook `play-pbx-ingest` → filtr → enqueue GCP |

## 3. Stape Store (kolekcje / klucze)

| Klucz / kolekcja | Zawartość |
|------------------|-----------|
| `task_queue` | Zadania Robot + CRM (`crm:twenty_create_lead`, `crm:call_transcript_ingest`, …) |
| `identity_map` | Profil pod `id_oid` / email / phone; po merge: `canonical_oid` |
| `twenty_opp_{opportunityId}` | `last_stage`, `last_campaignRejected`, `last_delivery_fingerprint` (dedup) |
| `pending_write_twenty_{opportunityId}` | TTL echo loop-prevention (NR-6) |
| `twenty_state/merge_{loser}_{survivor}` | Audyt scalenia leadów |
| `twenty_state/call_transcript_processed_*` | Idempotencja ingest rozmów |

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

### 4.4 Telefon (Play PBX) → Twenty

```
Play cron (telefony/run.js) → STT → n8n (filtr poczty) → enqueue_call_transcript
  → task_queue → worker ingest → CallTranscript (+ Participant)
  → match Person/Opportunity LUB parking „Do przypięcia”
```

- Dopisz do leada: pole **Szansa** → webhook `callTranscript.updated` → `link_call_transcript`
- Nowy lead: workflow **Rozmowa · Utwórz lead v2** → `create_lead_from_call`
- Runbooki: `CALL_INGEST_N8N.contract.md`, `BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md`

### 4.5 Scalanie leadów

```
Opportunity B (loser) → MANUAL „Scal z leadem” (picker Opportunity A)
  → merge_leads → CallTranscript + MessageParticipant + Person contacts + Stape alias
  → B = LOST / DUPLICATE
```

Runbook: `MERGE_LEADS.md` · polityka: `IDENTITY_AND_INBOUND.md` §5.9 (NR-5, nigdy auto).

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
- Kod Play PBX (`telefony/` — sibling workspace; kontrakt w runbookach)

Patrz: `runbooks/WHY_NOT_FULL_RUNTIME_YET.md`
