# POC_MAPPING — co z POC zostaje, co przepisać

**POC:** 25–26.05.2026, workspace `zany-maroon-panther.twenty.com`  
**SSOT docelowy:** `owocni-crm/` (2026-05-28)

---

## Werdykt ogólny

POC **udowodnił**, że Twenty API i model danych działają (Faza 1 sandbox).  
POC **nie jest** architekturą produkcyjną outbound/inbound — wymaga przepisania zgodnie z `EVENT_CONTRACT.md` i `CRM_ARCHITECTURE_CURRENT.md`.

---

## Zachowujemy (bez zmian koncepcyjnych)

| Element POC | SSOT / Faza |
|-------------|-------------|
| 6 stages na Opportunity | `DATA_MODEL.md` |
| Pola: idOid, bizProduct, bizSource, campaignRejected, … | `DATA_MODEL.md` |
| Import próbki Supabase → Twenty | Faza 3 (+ ledger) |
| Inbound API: Person → Opportunity → Note | Adapter `crm:twenty_create_lead` w Sortowni |
| Rozdział: campaignRejected ≠ LOST | `EVENT_CONTRACT.md` §2 |
| Snapshoty `twenty/snapshots/` | Dowód historyczny, nie SSOT |

---

## Przepisujemy (POC ≠ produkcja)

| POC | Docelowo | Działanie |
|-----|----------|-----------|
| 2× Workflow: Code + HTTP → webhook.site | Native webhook OUT → Sortowni | Wyłączyć / zastąpić przed Fazą 4 |
| Event `lead_won` | `purchase` | Zmiana nazwy w adapterze Sortowni |
| Event `lead_lost` (stage LOST) | brak eventu | Usunąć emisję |
| Event `lead_rejected` | `rejected_lead` | Rename w kontrakcie |
| Embedded GraphQL w Code (race 3s) | Webhook adapter + opcjonalnie Stape Store | Nie potrzebne przy native webhook |
| julia362 → better-bitrix jako ingress | Sortownia → Twenty | Cutover: wyłączyć julia362 |

---

## Artefakty POC — status

| Plik | Status |
|------|--------|
| `009-final-poc-snapshot.json` | Archiwum — odniesienie |
| `004-workflow-outbound-event.json` | Legacy blueprint — mapowanie LOST→lead_rejected **nieaktualne** |
| `008-inbound-adapter-spec.json` | Spec API — nadal aktualny jako input do adaptera Sortowni |
| `scripts/test-inbound-create-lead.sh` | Test dev — nie ścieżka produkcyjna |

---

## Checklist przed Fazą 4

- [ ] Native webhook skonfigurowany w Twenty
- [ ] Adapter `inbound:twenty_webhook` w Sortowni
- [ ] Workflow POC dezaktywowane lub usunięte
- [ ] Smoke testy §7 `EVENT_CONTRACT.md` — 5/5 PASS
- [ ] `EVENT_CONTRACT_OWOCNI.md` oznaczony legacy w README
