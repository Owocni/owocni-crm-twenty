---
doc_id: README_ROOT
title: "owocni-crm-github — README (repo root)"
layer: navigator_root
status: active
edit_scope: structure_only
owner: "Dawid (techniczny)"
last_verified: 2026-06-01
recheck_trigger: "zmiana topologii repo / usunięcie _DO_USUNIECIA/"
default_trust: D:CORE
---

# owocni-crm-github (repo root)

Kanoniczna dokumentacja (SSOT) migracji CRM OWOCNI.PL na **Twenty CRM** + integracja **Sortownia/Stape** + kod wykonawczy w `integrations/`.

## Topologia repo (produkcyjna)

```
owocni-crm-github/
├── README.md                 ← TEN plik
├── integrations/             ← kod Sortowni + Robot
└── owocni-crm/               ← SSOT — dokumentacja kanoniczna
    ├── README.md
    ├── CRM_CONSTITUTION.md
    ├── ARCHITECTURE.md
    ├── IDENTITY_AND_INBOUND.md
    ├── DATA_MODEL.md
    ├── EVENT_CONTRACT.md
    ├── DECISION_REGISTER.md
    ├── ops/OPS_NOTES.md
    ├── runbooks/IMPLEMENTATION_PLAN.md
    ├── audits/AUDIT_MIGRACJA.md
    ├── archive/              ← deprecated stubs
    └── generated/            ← scaffold — NIE źródło prawdy dziś
```

## Tymczasowe — docelowo usunąć

```
_DO_USUNIECIA/                  ← CAŁY katalog skasować po zakończeniu review
├── README.md
├── legacy-stara-dokumentacja/  ← stary owocni-crm + twenty POC
├── proces-refaktoryzacji/      ← agenda, handoff, notatki
└── meta-proces-refaktoryzacji/ ← SZKIELET, STRUKTURA_I_ROLE (faza projektowa)
```

Szczegóły: [`_DO_USUNIECIA/README.md`](_DO_USUNIECIA/README.md).

## Co jest SSOT

| Ścieżka | Rola |
|---------|------|
| `owocni-crm/` | Jedyny kanoniczny SSOT Markdown |
| `integrations/` | Kod wykonawczy (semantyka w `owocni-crm/`) |
| `_DO_USUNIECIA/` | **NIE SSOT** — porównania i proces refaktoryzacji |

## Start here (człowiek)

1. [`owocni-crm/README.md`](owocni-crm/README.md) — routing temat → plik  
2. [`owocni-crm/CRM_CONSTITUTION.md`](owocni-crm/CRM_CONSTITUTION.md) — prawa i INVARIANTS  
3. [`owocni-crm/DECISION_REGISTER.md`](owocni-crm/DECISION_REGISTER.md) — blokery cutover  

Proces / rozmowa z Mariuszem: [`_DO_USUNIECIA/proces-refaktoryzacji/AGENDA_ROZMOWA_Z_MARIUSZEM.md`](_DO_USUNIECIA/proces-refaktoryzacji/AGENDA_ROZMOWA_Z_MARIUSZEM.md)

## Dla agenta LLM

- **SSOT:** `owocni-crm/` + `integrations/` (kod)  
- **Routing / konflikty:** `owocni-crm/README.md` + `CRM_CONSTITUTION.md` §0a  
- **NIE czytać:** `_DO_USUNIECIA/` (chyba że explicit porównanie ze starą dokumentacją)

Zewnętrznie: [dokumentacja orkiestracji (Google Docs)](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an) · [docs.twenty.com](https://docs.twenty.com)
