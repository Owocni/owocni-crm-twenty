# integrations/ — kod wykonawczy Sortownia + Robot

**Status:** kanoniczna lokalizacja w repo `owocni-crm-github`  
**Last updated:** 2026-06-01

## Pliki

| Plik | Rola | SSOT dokumentacji |
|------|------|-------------------|
| `SORTOWNIA_V2_POPRAWIONY.js` | Sortownia (paid, sGTM/Stape) — resolve, multi-key write, `generate_lead`, adapter Twenty | `owocni-crm/IDENTITY_AND_INBOUND.md`, `owocni-crm/EVENT_CONTRACT.md` |
| `GoogleCloudRobot.js` | Robot (GCP) — task_queue, adaptery platform (Google/Meta/CRM), retry | `owocni-crm/ARCHITECTURE.md`, ADR #14 w `DECISION_REGISTER.md` |

## Mirror w repo `owocni strona/owocni/`

W poprzedniej lokalizacji (`owocni strona/owocni/`) pliki są **symlinkami** do tego katalogu — dla kompatybilności lokalnej i istniejących ścieżek deploy. Kopie zapasowe sprzed migracji: `*.bak-before-mirror`.

**Przy clone samego repo `AdrianKrauza/owocni`:** symlinki nie działają — użyj plików stąd (`integrations/`) jako źródła prawdy.

**Stara dokumentacja i POC:** `_DO_USUNIECIA/legacy-stara-dokumentacja/` (nie SSOT) — docelowo usunąć cały `_DO_USUNIECIA/`.

## Dla agenta LLM

- Semantyka eventów i tożsamości → `owocni-crm/` (SSOT Markdown).
- Implementacja runtime → ten katalog + [dokumentacja orkiestracji (Google Docs)](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an).
- Przy konflikcie nazw eventów: `owocni-crm/EVENT_CONTRACT.md` wygrywa dla CRM; rekonsyliacja kodu = ADR #14.
