# `_DO_USUNIECIA/` — tymczasowe, docelowo skasować cały katalog

**Status:** NIE jest częścią SSOT produkcyjnego ani runtime agenta.  
**Utworzono:** 2026-06-01

## Zasada

Wszystko poniżej służy **opracowaniu / porównaniu / procesowi refaktoryzacji** albo jest **zastąpione** przez `owocni-crm/` (kanon Mariusza). Po zamknięciu review i ledgerze pokrycia — **usuń ten folder w całości** z repozytorium.

## Zawartość

| Podkatalog | Co to jest |
|------------|------------|
| `legacy-stara-dokumentacja/` | Poprzedni `owocni-crm/` (Dawid ~2026-05-29) + `twenty/` (POC, analizy, snapshoty) |
| `proces-refaktoryzacji/` | Agenda z Mariuszem, handoff, manifest, notatki reorganizacji |
| `meta-proces-refaktoryzacji/` | `SZKIELET.md`, `STRUKTURA_I_ROLE_PLIKOW.md` — kontrakt formatu/pojemników z fazy projektowej (reguły rdzeniowe muszą żyć w plikach kanonicznych) |

## Co jest SSOT (poza tym folderem)

```
owocni-crm-github/
├── README.md
├── integrations/
└── owocni-crm/          ← jedyny kanoniczny SSOT Markdown
```

Agent LLM: **nie czyta** `_DO_USUNIECIA/` przy pracy produkcyjnej (wyjątek: explicit zadanie porównawcze).
