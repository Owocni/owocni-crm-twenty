# integrations/ — kod wykonawczy Sortownia + Robot

**Status:** kanoniczna lokalizacja w repo `owocni-crm-github`  
**Last updated:** 2026-06-02

## Pliki

| Plik | Rola | SSOT dokumentacji |
|------|------|-------------------|
| `SORTOWNIA_V2_POPRAWIONY.js` | Sortownia (paid, sGTM/Stape) — resolve, multi-key write, `generate_lead`, oid_init | `owocni-crm/IDENTITY_AND_INBOUND.md`, `owocni-crm/EVENT_CONTRACT.md` |
| `GoogleCloudRobot.js` | Robot (GCP) — task_queue, adaptery platform (Google/Meta/CRM), retry | `owocni-crm/ARCHITECTURE.md`, ADR #14 w `DECISION_REGISTER.md` |
| `INTEGRATIONS_PARITY.md` | Checklista zgodności docs ↔ kod, luki (np. brak `inbound:twenty_webhook` w repo) | `owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` |
| `archive/` | Snapshot kodu **przed** wyrównaniem SSOT — **NIE czytać jako SSOT** | `archive/README.md` |

## SSOT alignment (2026-06-02)

- Kanoniczne `event_name`: `generate_lead`, `qualify_lead`, `purchase`, `rejected_lead`, `consent_update`, `oid_init` — patrz `owocni-crm/EVENT_CONTRACT.md` §5.2.
- **Zakaz** `lead_won` jako `event_name` w nowym kodzie; w Robot/Sortownia legacy aliasy są normalizowane na wejściu.
- Adapter **`inbound:twenty_webhook`** jest opisany w SSOT, ale **nie ma jeszcze pliku w tym repo** — implementacja w Stape; śledź w `INTEGRATIONS_PARITY.md` (P3–P5).

## Mirror w repo `owocni strona/owocni/`

W poprzedniej lokalizacji (`owocni strona/owocni/`) pliki są **symlinkami** do tego katalogu — dla kompatybilności lokalnej i istniejących ścieżek deploy. Kopie zapasowe sprzed migracji: `*.bak-before-mirror`.

**Przy clone samego repo `AdrianKrauza/owocni`:** symlinki nie działają — użyj plików stąd (`integrations/`) jako źródła prawdy.

**Stara dokumentacja i POC:** `_DO_USUNIECIA/legacy-stara-dokumentacja/` (nie SSOT) — docelowo usunąć cały `_DO_USUNIECIA/`.

## Dla agenta LLM

| Czytaj | Nie czytaj |
|--------|------------|
| `integrations/README.md`, `INTEGRATIONS_PARITY.md` | `integrations/archive/**` |
| `owocni-crm/*.md` (SSOT) | `_DO_USUNIECIA/**` (tryb produkcyjny) |

- Semantyka eventów i tożsamości → `owocni-crm/` (SSOT Markdown).
- Implementacja runtime → ten katalog (pliki `.js` poza `archive/`).
- Przy konflikcie nazw eventów: `owocni-crm/EVENT_CONTRACT.md` wygrywa; rekonsyliacja kodu = ADR #14 + `INTEGRATIONS_PARITY.md`.
