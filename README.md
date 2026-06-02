---
doc_id: README_ROOT
title: "owocni-crm-github — README (repo root)"
layer: navigator_root
status: active
edit_scope: structure_only
owner: "Dawid (techniczny)"
last_verified: 2026-06-02
recheck_trigger: "zmiana topologii repo"
default_trust: D:CORE
---

# owocni-crm-github (repo root)

Kanoniczna dokumentacja (SSOT) migracji CRM OWOCNI.PL na **Twenty CRM** + integracja **Sortownia/Stape** + kod wykonawczy w `integrations/`.

## Topologia repo (produkcyjna)

```
owocni-crm-github/
├── AGENTS.md                 ← OBOWIĄZKOWY protokół pracy LLM
├── .cursor/rules/            ← Cursor Agent (alwaysApply → AGENTS.md)
├── README.md                 ← TEN plik
├── REVIEW_PACKAGE.md         ← pakiet do weryfikacji docs
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

## Co jest SSOT

| Ścieżka | Rola |
|---------|------|
| `owocni-crm/` | Jedyny kanoniczny SSOT Markdown |
| `integrations/` | Kod wykonawczy (semantyka w `owocni-crm/`) |

## Start here (człowiek)

**Przekazanie do weryfikacji dokumentacji:** [`REVIEW_PACKAGE.md`](REVIEW_PACKAGE.md) (1 strona + lista pytań dla recenzenta).

1. [`owocni-crm/README.md`](owocni-crm/README.md) — routing temat → plik  
2. [`owocni-crm/CRM_CONSTITUTION.md`](owocni-crm/CRM_CONSTITUTION.md) — prawa i INVARIANTS  
3. [`owocni-crm/DECISION_REGISTER.md`](owocni-crm/DECISION_REGISTER.md) — blokery cutover  

## Dla agenta LLM

**Zacznij od:** [`AGENTS.md`](AGENTS.md) — protokół obowiązkowy (w Cursorze ładuje też [`.cursor/rules/`](.cursor/rules/)). Często wskazujesz `@owocni-crm` — to wejście SSOT; kod → `integrations/`.

- **SSOT:** `owocni-crm/` + `integrations/*.js` (bez `integrations/archive/`)  
- **Kod / Twenty paths:** `integrations/README.md` → `TWENTY_PATHS.md`  
- **Routing / konflikty:** `owocni-crm/README.md` + `CRM_CONSTITUTION.md` §0a  
- **Anti-wpadki / deploy:** `integrations/runbooks/LLM_ANTI_WPADKI_GO_NO_GO.md`  
- **NIE czytać jako SSOT:** `integrations/archive/`, `owocni-crm/archive/`

Zewnętrznie: [dokumentacja orkiestracji (Google Docs)](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an) · [docs.twenty.com](https://docs.twenty.com)
