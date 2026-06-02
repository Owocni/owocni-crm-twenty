---
doc_id: README_SSOT
title: "owocni-crm SSOT — README (navigator)"
layer: navigator
status: active
edit_scope: structure_only
owner: "Dawid (techniczny)"
last_verified: 2026-05-31
recheck_trigger: "nowy plik kanoniczny / zmiana routingu"
default_trust: D:CORE
---

# owocni-crm — SSOT (Single Source of Truth)

Katalog kanonicznej dokumentacji migracji CRM OWOCNI.PL na **Twenty CRM** + integrację **Sortownia/Stape**. Ten plik jest **navigatorem** — kieruje do właściwego pliku. Nie jest konstytucją ani rejestrem decyzji.

## Po co tu jesteś → który plik

| Pytanie / zadanie | Primary | Secondary |
|---|---|---|
| Jakie są twarde zakazy / prawa / role / governance? | `CRM_CONSTITUTION.md` | — |
| Jaki typ/nazwę ma pole? Co jest FROZEN? | `DATA_MODEL.md` | `CRM_CONSTITUTION.md` (Prawo 3) |
| Jak zmiana w Twenty staje się eventem? LOST vs rejected? | `EVENT_CONTRACT.md` | `DATA_MODEL.md` |
| Jak rozpoznawana jest tożsamość klienta? Kanały wejścia? | `IDENTITY_AND_INBOUND.md` | `EVENT_CONTRACT.md` |
| Który system za co odpowiada? Przepływy in/out? | `ARCHITECTURE.md` | `EVENT_CONTRACT.md` |
| Co jest zdecydowane, a co blokuje cutover? | `DECISION_REGISTER.md` | `runbooks/IMPLEMENTATION_PLAN.md` |
| Jak i kiedy wdrażamy? Bramy go/no-go? | `runbooks/IMPLEMENTATION_PLAN.md` | `DECISION_REGISTER.md` |
| Jak audytować migrację danych? | `audits/AUDIT_MIGRACJA.md` | `EVENT_CONTRACT.md` |
| Fakt platformowy Twenty (HMAC, credits, R-18)? | `ops/OPS_NOTES.md` | — |
| Kod Sortowni / Robot (runtime) | [`../integrations/`](../integrations/README.md) | `EVENT_CONTRACT.md`, `IDENTITY_AND_INBOUND.md` |

## Pliki kanoniczne

```
owocni-crm/
├── CRM_CONSTITUTION.md        # INVARIANTS, 9 praw, role, governance (kompas)
├── DATA_MODEL.md              # pola krytyczne, frozen, prefiksy
├── EVENT_CONTRACT.md          # mapowanie zdarzenie→event, adapter, cold-start (wchłonął STAGE_MAPPING)
├── IDENTITY_AND_INBOUND.md    # id_oid, Resolver T1–T5, kanały, VBB
├── ARCHITECTURE.md            # granice systemów, przepływy in/out
├── DECISION_REGISTER.md       # status decyzji (ADR-light), brama cutoveru
ops/
└── OPS_NOTES.md               # fakty platformowe Twenty (dom faktu)
runbooks/
└── IMPLEMENTATION_PLAN.md     # plan wdrożenia, MUST-PASS gates, cutover/rollback
audits/
└── AUDIT_MIGRACJA.md          # protokół audytu migracji (7 kroków)
archive/
└── STAGE_MAPPING.md           # DEPRECATED (wchłonięty do EVENT_CONTRACT/DATA_MODEL)
generated/                     # eksport schematu — placeholder (NIE źródło prawdy dziś)
```

## Priorytet przy konflikcie (skrót — pełna reguła: `CRM_CONSTITUTION.md` §0a)

Rozstrzyga **typ treści**, nie liniowa hierarchia: twardy zakaz/invariant → `CRM_CONSTITUTION.md` §0; zamknięta decyzja → `DECISION_REGISTER.md`; poza tym wygrywa **plik-właściciel typu treści** (pole→DATA_MODEL, event→EVENT_CONTRACT, tożsamość→IDENTITY, granice→ARCHITECTURE); **fakt o Twenty → instancja/docs przez `ops/OPS_NOTES.md`**, nigdy sam Markdown; `archive/` nigdy nie wygrywa.

## Dla agenta LLM

Każdy plik ma sekcję **0. LLM QUICK ENTRY** (co decyduje / czego nie / co czytać razem / najgroźniejszy błąd) oraz **1. NEGATIVE RULES** (twarde zakazy). Zacznij od QUICK ENTRY pliku właściwego dla zadania. System znaczników: `[D:CORE]` / `[D:VERIFIED]` / `[D:RESEARCH]` / `[D:OPEN]` — legenda na końcu każdego pliku.

**Entry point repo:** [`../README.md`](../README.md). **Agent LLM (obowiązkowo):** [`../AGENTS.md`](../AGENTS.md). **Review dokumentacji:** [`../REVIEW_PACKAGE.md`](../REVIEW_PACKAGE.md). **NIE czytać jako SSOT:** `archive/`, `../integrations/archive/`.
