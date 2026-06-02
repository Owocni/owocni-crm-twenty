---
doc_id: INTEGRATIONS_ARCHIVE_README
title: "integrations/archive — archiwum kodu (NIE SSOT)"
layer: archive
status: deprecated
edit_scope: frozen
owner: "Dawid (techniczny)"
last_verified: 2026-06-02
recheck_trigger: "nigdy (archiwum)"
default_trust: D:CORE
superseded_by:
  - ../README.md
  - ../INTEGRATIONS_PARITY.md
  - ../../owocni-crm/EVENT_CONTRACT.md
deprecated_on: 2026-06-02
---

# integrations/archive — NIE używać jako SSOT

> **Ten katalog jest archiwum historycznym.**  
> **Agent LLM i cutover:** nie czytać, nie cytować, nie implementować na podstawie tych plików.

## Po co istnieje

Przed wyrównaniem kodu `integrations/` do kanonicznego SSOT (`owocni-crm/`) zapisujemy **snapshot stanu sprzed zmian**, żeby:

- móc porównać diff (co się zmieniło),
- nie zgubić starej logiki przy refaktorze,
- mieć dowód „stan przed” bez mieszania z kodem docelowym.

## Co jest w środku

| Folder / plik | Zawartość |
|---|---|
| `pre-ssot-alignment-2026-06-02/` | Kopia `SORTOWNIA_V2_POPRAWIONY.js` + `GoogleCloudRobot.js` z 2026-06-02 (przed ADR #14 / parity) |

## Gdzie jest prawda (kanon)

| Temat | Plik |
|---|---|
| Semantyka eventów, loop-prevention, manual-create | `owocni-crm/EVENT_CONTRACT.md` |
| Tożsamość, Resolver, VBB | `owocni-crm/IDENTITY_AND_INBOUND.md` |
| Pola Twenty (`idOid`, `stage`, …) | `owocni-crm/DATA_MODEL.md` |
| Status decyzji / cutover blockers | `owocni-crm/DECISION_REGISTER.md` |
| Checklista zgodności docs ↔ kod | `integrations/INTEGRATIONS_PARITY.md` |
| Kod wykonawczy (docelowy) | `integrations/*.js` (poza `archive/`) |

## Zasada dla agenta

- **DO:** czytaj `integrations/README.md`, `integrations/INTEGRATIONS_PARITY.md`, pliki w `owocni-crm/`.
- **NIE:** `integrations/archive/**`.
