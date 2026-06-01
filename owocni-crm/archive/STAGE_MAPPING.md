---
doc_id: STAGE_MAPPING
title: "STAGE_MAPPING (ARCHIWUM — deprecated)"
layer: archive
status: deprecated
edit_scope: frozen
owner: "—"
last_verified: 2026-05-31
recheck_trigger: "nigdy (archiwum)"
default_trust: D:CORE
superseded_by:
  - EVENT_CONTRACT
  - DATA_MODEL
deprecated_on: 2026-05-31
---

# STAGE_MAPPING — ARCHIWUM (deprecated)

> ⚠️ **TEN PLIK JEST ARCHIWALNY — NIE JEST PRODUKCYJNYM SSOT.**
> Treść została przeniesiona (split-move) do plików kanonicznych. Nie edytować, nie cytować jako źródła prawdy, nie wskrzeszać mechaniki.

## Dlaczego zarchiwizowany

STAGE_MAPPING był osobnym plikiem mapowania stage'ów na eventy. W refaktoryzacji dokumentacji jego treść została w całości wchłonięta przez pliki o właściwym domu treści — utrzymywanie osobnego pliku dawało dwa miejsca prawdy dla jednego tematu.

## Gdzie teraz jest prawda (target sections)

| Co było w STAGE_MAPPING | Gdzie jest teraz |
|---|---|
| Zasada WON=stage / purchase=event; zakaz `lead_won`/`closed_won`/`WON` jako event_name | `../owocni-crm/EVENT_CONTRACT.md` §4, §5.2 |
| Mapowanie kanoniczne (język handlowy → stage → event) | `../owocni-crm/EVENT_CONTRACT.md` §5.3 |
| SQL ≡ QUALIFIED | `../owocni-crm/EVENT_CONTRACT.md` §4 (ADR #5 closed) |
| Tabela decyzyjna LOST vs `rejected_lead` | `../owocni-crm/EVENT_CONTRACT.md` §5.3 |
| Zakazane nazwy eventów (lista do cleanup, ADR #14) | `../owocni-crm/EVENT_CONTRACT.md` §5.2 + `../owocni-crm/DECISION_REGISTER.md` §5.2 |
| Wartości stage (`NEW/CONTACTED/QUALIFIED/PROPOSAL/WON/LOST`) | `../owocni-crm/DATA_MODEL.md` §5.1 (pole `stage`) |

## Data migracji

- **Deprecated:** 2026-05-31
- **Powód:** konsolidacja do domu treści (mapowanie → EVENT_CONTRACT; enum stage → DATA_MODEL).
- **Zakaz:** nie przywracać tego pliku jako źródła; zmiany mapowania idą do `EVENT_CONTRACT.md`.
