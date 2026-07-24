# integrations/ — kod wykonawczy Sortownia + Robot (+ Twenty)

**Status:** kanoniczna lokalizacja w repo `owocni-crm-github`  
**Last updated:** 2026-07-21

## LLM START (60 sek)

0. **Obowiązkowy protokół:** [`../AGENTS.md`](../AGENTS.md) — przeczytaj przed jakąkolwiek edycją.
1. **Plan wdrożenia Twenty (T1→smoke):** [`runbooks/TWENTY_ROLLOUT_MASTER.md`](runbooks/TWENTY_ROLLOUT_MASTER.md)
2. **Mapa ścieżek Twenty:** [`TWENTY_PATHS.md`](TWENTY_PATHS.md)
3. **Parity docs ↔ kod:** [`INTEGRATIONS_PARITY.md`](INTEGRATIONS_PARITY.md)
4. **Kolejność faz (po Etap 1.1):** [`runbooks/NEXT_STEPS.md`](runbooks/NEXT_STEPS.md) → **G-PAR** + kanał telefon + merge
5. **Kanał telefon (Play → n8n → Twenty):** [`runbooks/CALL_INGEST_N8N.contract.md`](runbooks/CALL_INGEST_N8N.contract.md) · schema [`BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md`](runbooks/BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md)
6. **Nieodebrane (Play CDR MISSED):** [`runbooks/MISSED_CALLS_PLAY.contract.md`](runbooks/MISSED_CALLS_PLAY.contract.md)
7. **Scalanie leadów:** [`runbooks/MERGE_LEADS.md`](runbooks/MERGE_LEADS.md) (polityka: `../owocni-crm/IDENTITY_AND_INBOUND.md` §5.9)
8. **Anti-wpadki:** [`runbooks/LLM_ANTI_WPADKI_GO_NO_GO.md`](runbooks/LLM_ANTI_WPADKI_GO_NO_GO.md)
9. **Dlaczego nie 100% runtime:** [`runbooks/WHY_NOT_FULL_RUNTIME_YET.md`](runbooks/WHY_NOT_FULL_RUNTIME_YET.md)
10. **SSOT semantyka:** `../owocni-crm/EVENT_CONTRACT.md`
11. **Workflowy SQL / odrzucenie:** [`runbooks/TWENTY_WORKFLOWS_REJECT_AND_GUARD.md`](runbooks/TWENTY_WORKFLOWS_REJECT_AND_GUARD.md)
12. **Migracja GCP:** [`runbooks/MIGRATE_TWENTY_CRM_TO_GCP.md`](runbooks/MIGRATE_TWENTY_CRM_TO_GCP.md)

**NIE czytaj jako SSOT:** `archive/**`

## Pliki runtime (kanon)

| Plik | Rola | Runtime |
|------|------|---------|
| `SORTOWNIA_V2_POPRAWIONY.js` | Paid: oid_init, generate_lead, identity_map, task_queue | Stape sGTM |
| `GoogleCloudRobot.js` | task_queue → platformy + env-guard + `enrichPurchaseBizValues` | GCP Cloud Run `robot-task-monitor` |
| `INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js` | Proxy: odbiór webhooka Twenty, forward do GCP | Stape Client |
| `INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js` | Stub: forward body do GCP inbound URL | Stape HTTP tag |
| `INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js` | Pełna logika inbound (rollback / prod legacy) | Stape HTTP tag |
| `INBOUND_TWENTY_WEBHOOK.js` | Skrócona wersja / referencja | Stape (legacy) |
| `cloud-functions/twenty-inbound-webhook/` | Adapter Twenty → business event → `task_queue` | GCP Cloud Function (sandbox: **gcp-v5**) |
| `CRM_TWENTY_CREATE_LEAD.sGTM.js` | Sortownia → Twenty (create lead) | Stape stub → `cloud-functions/twenty-crm-worker/` |
| `CRM_TWENTY_CREATE_LEAD.gcp-stub.sGTM.js` | Stub po migracji GCP (~435 B) | Stape |
| `cloud-functions/twenty-crm-worker/` | create_lead, update_person, email_contact_sync, **call_transcript_ingest / link / create_lead_from_call**, **merge_leads** | GCP Cloud Function (sandbox) |
| `cloud-functions/robot-task-monitor/` | Deploy wrapper dla `GoogleCloudRobot.js` | GCP Cloud Run |
| `ENV_GUARD.sGTM.js` | Fragment env sandbox/prod (copy-paste) | Stape |
| `shared/envGuard.js` | env-guard dla Robota | Node |
| `shared/ssotPaths.js` | Stałe adapterów/kolekcji | Node (+ ref) |
| `tools/deploy_workflow_create_lead_from_call.py` | Spec workflow MANUAL „Utwórz lead z rozmowy” | Twenty MCP |
| `tools/deploy_workflow_merge_leads.py` | Spec workflow MANUAL „Scal z leadem” (RECORD picker) | Twenty MCP |

**Play PBX (poza tym repo):** katalog `telefony/` obok — cron `run.js` → STT → webhook n8n `Play PBX → GCP CallTranscript`. Kontrakt: `runbooks/CALL_INGEST_N8N.contract.md`.

## SSOT alignment (2026-07-21)

- Kanoniczne `event_name`: `generate_lead`, `qualify_lead`, `purchase`, `rejected_lead`, `consent_update`, `oid_init`.
- Legacy `lead_won` / `lead_rejected` → normalizacja na wejściu (Robot + Sortownia + inbound).
- `qualify_lead` wymaga `bizSqlConfirmed=true` (workflow „Przyjmij jako SQL").
- `campaignRejected=true` blokuje SQL/purchase (`SKIP_CAMPAIGN_REJECTED`); odrzucenie = workflow MANUAL „Odrzuć leada".
- `biz_value` dla `purchase`: łańcuch pól Twenty + fallback cennika — `EVENT_CONTRACT.md` §5.7.
- `environment: sandbox` → Robot **nie** wysyła prod Google Ads / GA4 MP; arkusze debug OK.
- **Sandbox inbound:** GCP `twenty-inbound-webhook` (build `2026-07-10-gcp-v5`); Stape = edge proxy tylko.
- **Kanał telefon (MVP 2026-07-21):** Play → n8n → `enqueue_call_transcript` → worker → `CallTranscript`; parking **Rozmowy → Do przypięcia**; UX: wybór Szansy (webhook) / „Utwórz lead z rozmowy”.
- **Merge leadów (MVP 2026-07-21):** workflow „Scal z leadem” → `merge_leads` (Opportunity LOST/DUPLICATE, CallTranscript + MessageParticipant + Stape `canonical_oid`).

## Mirror w repo `owocni strona/owocni/`

Symlinki do tego katalogu. Przy clone samego `AdrianKrauza/owocni` — użyj plików stąd.

## Dla agenta LLM

| Czytaj | Nie czytaj |
|--------|------------|
| Ten README, `TWENTY_PATHS.md`, `INTEGRATIONS_PARITY.md` | `archive/**` |
| `*.js` poza `archive/` | — |
| `owocni-crm/*.md` | Stary kod Bitrix w archiwum |

Przy konflikcie: `owocni-crm/EVENT_CONTRACT.md` wygrywa nad kodem; kod ma dogonić SSOT (ADR #14).
