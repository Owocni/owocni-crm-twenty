# OWOCNI CRM + Twenty (GitHub package)

Pakiet dokumentacji migracji CRM OWOCNI.PL → **Twenty CRM** + integracja ze **Sortownią (Stape)**.

**Status:** Pre-cutover — dokumentacja SSOT aktywna (parzystość BB, tożsamość, prefiksy pól); cutover wstrzymany do domknięcia ADR #12–#14 + testy.  
**Last updated:** 2026-05-29

---

## Start here (człowiek)

1. **`owocni-crm/README.md`** — szczegółowy routing zadań → plików.
2. **`owocni-crm/CHECKLIST_REVIEW.html`** — interaktywny review go/no-go (~30 min).
3. **`owocni-crm/DECISION_REGISTER.md`** — co jest jeszcze otwarte (ADR).

---

## Instrukcja dla LLM / agentów AI

**Zasada:** Czerp **wyłącznie** z katalogu `owocni-crm/` jako SSOT. Folder `twenty/` = archiwum POC i analizy — **nie traktuj jako prawdy produkcyjnej**.

### Kolejność czytania (obowiązkowa)

| Krok | Plik | Kiedy |
|------|------|-------|
| 1 | `owocni-crm/README.md` | Routing zadania → dokument |
| 2 | `owocni-crm/CRM_CONSTITUTION.md` | Reguły, role, 9 praw, governance |
| 3 | `owocni-crm/CRM_ARCHITECTURE_CURRENT.md` | Granice systemów, przepływy inbound/outbound |
| 4 | `owocni-crm/IDENTITY_AND_INBOUND.md` | **id_oid**, kanały wejścia, Identity Resolver T1–T5 |
| 5 | `owocni-crm/DATA_MODEL.md` | Pola Opportunity/Person, campaignRejected |
| 6 | `owocni-crm/EVENT_CONTRACT.md` | Eventy: `qualify_lead`, `purchase`, `rejected_lead`, `generate_lead` |
| 7 | `owocni-crm/DECISION_REGISTER.md` | ADR otwarte — nie zakładaj domkniętych decyzji |
| 8 | `owocni-crm/STAGE_MAPPING.md` | Mapowanie stage ↔ event_name (zakaz `lead_won`) |

### Routing temat → plik (skrót)

| Temat | Primary SSOT | Uwaga |
|-------|--------------|-------|
| Tożsamość, deduplikacja, merge, inbound mail/telefon | `IDENTITY_AND_INBOUND.md` | Nie Sortownia paid merge engine |
| Eventy Twenty → Sortownia | `EVENT_CONTRACT.md` | Native webhook, nie workflow HTTP |
| Pola CRM | `DATA_MODEL.md` | |
| Cutover / rollback | `CUTOVER_RUNBOOK.md` | |
| Import historyczny | `migration/README.md` | |
| Stres-testy przed cutoverem | `STRESS_TEST_PLAN.md` | |
| Audyt spójności SSOT | `AUDIT_AKK.md` | Fault-only; pusty wynik ≠ green light |
| Audyt przed importem | `AUDIT_MIGRACJA.md` | |
| POC vs produkcja | `POC_MAPPING.md` | |
| Wymagania sprzedaży (MVP vs później) | `SALES_OPS_REQUIREMENTS.md` | |
| Fakty platformowe Twenty | `ops/OPS_NOTES.md` | |
| Pełny kontrakt eventów, adaptery, task queue | [Dokumentacja orkiestracji (Google Docs)](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an) | Ten pakiet = warstwa CRM |
| Kod Sortowni (paid, sGTM) | [`integrations/SORTOWNIA_V2_POPRAWIONY.js`](integrations/SORTOWNIA_V2_POPRAWIONY.js) | Resolve, multi-key write, generate_lead |
| Kod Robota (GCP, adaptery) | [`integrations/GoogleCloudRobot.js`](integrations/GoogleCloudRobot.js) | task_queue, adaptery platform, retry |

### NIE używać jako SSOT (legacy / archiwum)

| Źródło | Dlaczego |
|--------|----------|
| `twenty/snapshots/*.json` | POC 25–26.05 — eventy `lead_won`, `lead_lost`, workflow HTTP |
| `twenty/analiza-*.html`, `twenty-smaczki-v2.html` | Analizy robocze — część treści przed rekonsyliacją |
| `twenty/OWOCNI_CRM_fundamenty (1).md`, `pakiet_plikow (1).md` | Materiał źródłowy szefa — rekonsyliować z `owocni-crm/` |
| Usunięte pliki mailowe (`EVENT_CONTRACT_OWOCNI*.md`) | **Nie istnieją w repo** — zastąpione przez `owocni-crm/EVENT_CONTRACT.md` |
| Nazwy `lead_won`, `lead_rejected`, `lead_lost` | **Przestarzałe** — SSOT: `purchase`, `rejected_lead`, LOST bez eventu |

### Kanoniczne nazwy eventów (nie negocjować w kodzie CRM)

| Zmiana w Twenty | Event SSOT |
|-----------------|------------|
| stage → QUALIFIED | `qualify_lead` |
| stage → WON | `purchase` |
| campaignRejected → true | `rejected_lead` |
| stage → LOST | **brak eventu** |
| ręczne create bez idOid | `generate_lead` (manual) |

Szczegóły: `owocni-crm/EVENT_CONTRACT.md`, `owocni-crm/STAGE_MAPPING.md`.

### Blokery cutover (LLM: nie proponuj go-live bez tego)

- **ADR #12** — pełna inwentaryzacja kanałów inbound (mail poza paid, kontakt@, skrzynki zespołu)
- **ADR #13** — Identity Resolver T1–T5, właściciel `id_oid` w Stape
- **ADR #14** — rekonsyliacja nazw eventów z dokumentacją orkiestracji

Źródło: `owocni-crm/DECISION_REGISTER.md`, `owocni-crm/CHECKLIST_REVIEW.html`.

---

## Struktura repo

```
owocni-crm-github/
├── README.md                 ← ten plik (entry point + instrukcja LLM)
├── integrations/             ← kod Sortowni + Robot (kanoniczny)
├── owocni-crm/               ← SSOT — JEDYNE źródło prawdy produkcyjnej
│   ├── README.md             ← routing zadań
│   ├── IDENTITY_AND_INBOUND.md
│   ├── EVENT_CONTRACT.md
│   ├── CRM_CONSTITUTION.md
│   ├── CRM_ARCHITECTURE_CURRENT.md
│   ├── DATA_MODEL.md
│   ├── DECISION_REGISTER.md
│   ├── CUTOVER_RUNBOOK.md
│   ├── CHECKLIST_REVIEW.html
│   ├── AUDIT_AKK.md
│   ├── AUDIT_MIGRACJA.md
│   ├── POC_MAPPING.md
│   ├── STAGE_MAPPING.md
│   ├── STRESS_TEST_PLAN.md
│   ├── SALES_OPS_REQUIREMENTS.md
│   ├── PLAN_DZIALAN.md
│   ├── migration/
│   └── ops/
└── twenty/                   ← archiwum POC + analizy (NIE SSOT)
    ├── snapshots/            ← dowód POC — patrz snapshots/README.md
    └── analiza-*.html
```

---

## Kluczowe dokumenty SSOT (`owocni-crm/`)

| Plik | Odpowiada na |
|------|----------------|
| `CRM_CONSTITUTION.md` | Kim decyduje, 9 praw, AI governance |
| `CRM_ARCHITECTURE_CURRENT.md` | Jak płyną dane dziś → docelowo |
| `IDENTITY_AND_INBOUND.md` | id_oid, kanały, resolver T1–T5, julia362 vs Email Sync |
| `DATA_MODEL.md` | Pola, stage, campaignRejected |
| `EVENT_CONTRACT.md` | Twenty native webhook ↔ Sortownia |
| `DECISION_REGISTER.md` | ADR otwarte i zamknięte |
| `CUTOVER_RUNBOOK.md` | Dzień cutover + rollback |
| `CHECKLIST_REVIEW.html` | Review interaktywny |
| `AUDIT_AKK.md` | Auto-audyt spójności dokumentacji |
| `AUDIT_MIGRACJA.md` | Audyt przed importem danych |
| `POC_MAPPING.md` | Co z POC zostaje / co przepisać |

Pełna lista i tabela zadań: **`owocni-crm/README.md`**.

---

## Materiały referencyjne (`twenty/`) — nie SSOT

| Plik / folder | Rola |
|---------------|------|
| `twenty/snapshots/` | Dowód POC Fazy 1 — **przestarzałe nazwy eventów** |
| `twenty/analiza-migracja-twenty.html` | Analiza operacyjna (z bannerem rekonsyliacji) |
| `twenty/analiza-helpdesk-twenty.html` | Eksploracja helpdesk (poza MVP) |
| `twenty/twenty-smaczki-v2.html` | Notatki Twenty API |
| `twenty/OWOCNI_CRM_fundamenty (1).md` | Fundamenty od szefa — materiał źródłowy |
| `twenty/OWOCNI_CRM_pakiet_plikow (1).md` | Pakiet plików od szefa — materiał źródłowy |

**Usunięte z repo (nie szukać):** `EVENT_CONTRACT_OWOCNI.md`, wersje mailowe kontraktu z 2026-05-04. Obowiązuje **`owocni-crm/EVENT_CONTRACT.md`**.

---

## Zewnętrzne SSOT (poza tym repo)

| Zasób | Link | Rola |
|-------|------|------|
| **Dokumentacja orkiestracji** | [Google Docs — Orkiestracja (konfiguracja techniczna)](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an) | Pełne definicje eventów, adaptery, routing, konfiguracja Stape/Robot |
| **Sortownia (paid, sGTM)** | [`integrations/SORTOWNIA_V2_POPRAWIONY.js`](integrations/SORTOWNIA_V2_POPRAWIONY.js) | Etap A: oid_init, generate_lead, waterfall resolve, multi-key write |
| **Robot (GCP)** | [`integrations/GoogleCloudRobot.js`](integrations/GoogleCloudRobot.js) | Wykonanie tasków z kolejki Sortowni → adaptery (Google/Meta/CRM itd.) |
| **Twenty natywne API** | [docs.twenty.com](https://docs.twenty.com) | Terminologia platformy, GraphQL, webhooki natywne |

**Dla LLM:** warstwa CRM = ten repo (`owocni-crm/`). Warstwa orkiestracji (eventy JSON, adaptery, Robot) = Google Docs + kod w [`integrations/`](integrations/README.md). Przy konflikcie nazw eventów: `owocni-crm/EVENT_CONTRACT.md` wygrywa dla CRM; rekonsyliacja z docs orkiestracji = ADR #14.
