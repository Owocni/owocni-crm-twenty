# Snapshots POC — archiwum (NIE SSOT)

**POC:** 25–26.05.2026, workspace Twenty sandbox  
**Status:** Dowód historyczny Fazy 1 — **nie używać jako specyfikacji produkcyjnej**

---

## Dla LLM

**Nie czytaj tych plików jako prawdy o eventach ani outbound.**

Kanoniczne SSOT:

- `../../owocni-crm/EVENT_CONTRACT.md` — eventy i webhook
- `../../owocni-crm/POC_MAPPING.md` — mapowanie POC → docelowo
- `../../owocni-crm/IDENTITY_AND_INBOUND.md` — tożsamość i inbound

---

## Przestarzałe elementy w snapshotach

| W POC (snapshots) | SSOT docelowy (2026-05-28) |
|-------------------|----------------------------|
| `lead_won` | `purchase` |
| `lead_lost` (stage LOST) | brak eventu |
| `lead_rejected` | `rejected_lead` |
| Workflow Code + HTTP → webhook.site | Twenty **native webhook OUT** → Sortownia |
| LOST → event reklamowy | LOST = tylko CRM, bez outbound |

---

## Pliki

| Plik | Opis |
|------|------|
| `001-initial-schema.json` | Schema POC |
| `004-workflow-outbound-event.json` | Legacy blueprint workflow — **nieaktualne mapowanie LOST** |
| `006-workflow-live-verified.json` | Weryfikacja workflow POC |
| `007-all-events-verified.json` | Eventy POC (`lead_won` itd.) |
| `008-inbound-adapter-spec.json` | Spec API inbound — nadal użyteczny jako input do adaptera |
| `009-final-poc-snapshot.json` | Podsumowanie POC |

Skrypt testowy: `../scripts/test-inbound-create-lead.sh` — dev only, nie ścieżka prod.
