# integrations/ — kod wykonawczy Sortownia + Robot (+ Twenty)

**Status:** kanoniczna lokalizacja w repo `owocni-crm-github`  
**Last updated:** 2026-06-02

## LLM START (60 sek)

1. **Mapa ścieżek Twenty:** [`TWENTY_PATHS.md`](TWENTY_PATHS.md)
2. **Parity docs ↔ kod:** [`INTEGRATIONS_PARITY.md`](INTEGRATIONS_PARITY.md)
3. **Kolejność wdrożenia:** [`runbooks/NEXT_STEPS.md`](runbooks/NEXT_STEPS.md)
4. **Anti-wpadki:** [`runbooks/LLM_ANTI_WPADKI_GO_NO_GO.md`](runbooks/LLM_ANTI_WPADKI_GO_NO_GO.md)
5. **Dlaczego nie 100% runtime:** [`runbooks/WHY_NOT_FULL_RUNTIME_YET.md`](runbooks/WHY_NOT_FULL_RUNTIME_YET.md)
6. **SSOT semantyka:** `../owocni-crm/EVENT_CONTRACT.md`

**NIE czytaj:** `archive/**`, `_DO_USUNIECIA/**`

## Pliki runtime (kanon)

| Plik | Rola | Runtime |
|------|------|---------|
| `SORTOWNIA_V2_POPRAWIONY.js` | Paid: oid_init, generate_lead, identity_map, task_queue | Stape sGTM |
| `GoogleCloudRobot.js` | task_queue → platformy + env-guard | GCP Node |
| `INBOUND_TWENTY_WEBHOOK.js` | Twenty webhook → business event → task_queue | Stape HTTP tag |
| `CRM_TWENTY_CREATE_LEAD.stub.js` | Sortownia → Twenty (create lead) | Stape tag |
| `CRM_TWENTY_UPDATE_PERSON.stub.js` | Backfill idOid + pending-write | Stape tag |
| `ENV_GUARD.sGTM.js` | Fragment env sandbox/prod (copy-paste) | Stape |
| `shared/envGuard.js` | env-guard dla Robota | Node |
| `shared/ssotPaths.js` | Stałe adapterów/kolekcji | Node (+ ref) |

## SSOT alignment (2026-06-02)

- Kanoniczne `event_name`: `generate_lead`, `qualify_lead`, `purchase`, `rejected_lead`, `consent_update`, `oid_init`.
- Legacy `lead_won` / `lead_rejected` → normalizacja na wejściu (Robot + Sortownia + inbound).
- `environment: sandbox` → Robot **nie** wysyła prod Google Ads / GA4 MP; arkusze debug OK.
- Adaptery Twenty są **w repo jako kod przygotowawczy** — deploy Stape wymaga preflight payloadów (bez zgadywania JSON).

## Mirror w repo `owocni strona/owocni/`

Symlinki do tego katalogu. Przy clone samego `AdrianKrauza/owocni` — użyj plików stąd.

## Dla agenta LLM

| Czytaj | Nie czytaj |
|--------|------------|
| Ten README, `TWENTY_PATHS.md`, `INTEGRATIONS_PARITY.md` | `archive/**` |
| `*.js` poza `archive/` | `_DO_USUNIECIA/**` |
| `owocni-crm/*.md` | Stary kod Bitrix w archiwum |

Przy konflikcie: `owocni-crm/EVENT_CONTRACT.md` wygrywa nad kodem; kod ma dogonić SSOT (ADR #14).
