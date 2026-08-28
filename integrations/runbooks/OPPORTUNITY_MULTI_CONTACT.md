---
doc_id: OPPORTUNITY_MULTI_CONTACT
title: "Lead — wiele emaili/telefonów (komitet zakupowy + merge)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-08-28
related:
  - MERGE_LEADS.md
  - KANBAN_CARD_SPEC.md
  - ../../owocni-crm/DATA_MODEL.md
  - E12_3_EMAIL_TEMPLATES_AND_TRAINING.md
source: "Robert 2026-08-28 — komitet 2–3 osoby; scalanie leadów"
---

# Wiele kontaktów na leadzie (Opportunity)

## Cel

Handlowiec może zapisać **kilka osób z komitetu zakupowego** przy **jednym** leadzie, bez scalania duplikatów.

## Pola (sandbox live 2026-08-28)

| UI | API | Typ | Max |
|---|---|---|---|
| Email | `bizCardEmail` | TEXT | 1 — główny z formularza / Kanban |
| Telefon | `bizCardPhone` | TEXT | 1 — główny z formularza / Kanban |
| **Dodatkowe emaile** | `bizAdditionalEmails` | EMAILS | 5 |
| **Dodatkowe telefony** | `bizAdditionalPhones` | PHONES | 5 |
| Kontakt | `pointOfContact` | Person | 1 relacja |

**Person:** `emails` / `phones` — max **5** wartości każde (wcześniej 1).

Kolejność na karcie leada (Record Page): Kontakt → Telefon → Email → **Dodatkowe telefony** → **Dodatkowe emaile** → Firma…

Metadata wdrożone przez GraphQL API (OAuth); **nie** przez `yarn twenty apply` (drift schematu Owocni Mail).

## Kiedy co robić

| Sytuacja | Akcja |
|---|---|
| **1 lead**, komitet 2–3 osoby | **Dodatkowe emaile / telefony** na dealu (+) |
| **2 leady** na tę samą sprawę (duplikat) | **Scal z leadem** — worker dopisuje kontakty z B na A |
| Duplikat tożsamości (ta sama osoba, 2 rekordy) | **Scal** (Person contacts → additional) + merge leadów |

## Scalanie leadów (`merge_leads`)

Po **Scal z leadem** (survivor A, loser B → LOST/DUPLICATE):

1. Maile / rozmowy / uczestnicy → lead A (jak dotąd).
2. Person B → additional email/phone na Person A (jak dotąd).
3. **Nowe (2026-08-28):** email/telefon z leada B → **`bizAdditionalEmails` / `bizAdditionalPhones`** na leadzie A (pomijając główny Email/Telefon na karcie A).

Kod: `integrations/cloud-functions/twenty-crm-worker/workers/mergeLeads.js` · test: `mergeLeads.contacts.test.js`.

**Deploy:** po zmianie kodu — `twenty-crm-worker/deploy.sh` (GCP Cloud Function).

## Automatyczne dopasowanie (lookup) — stan

| Źródło | Szuka |
|---|---|
| create_lead dedupe | Person **główny** email/telefon → otwarty lead po `pointOfContact` |
| call / mail link | **`bizCardEmail`** / Person główny email |
| **Dodatkowe emaile/telefony na dealu** | **NIE** (backlog integracji) |

Kontakt z komitetu, który **regularnie** pisze/dzwoni i ma trafiać automatycznie → na razie główny Email na dealu albo osobny Person z głównym emailem.

## Owocni Mail (Gosia)

- **Odpowiedz** (⌘K → Owocni Mail) — scroll + podgląd wątku: **PASS** od wersji **0.1.54**.
- **Natywny Reply Twenty** w wątku maila — znany problem przewijania; **nie** naprawialny z poziomu Owocni Mail. SOP: odpowiadać przez **Odpowiedz** (Owocni), nie natywny Reply.

Deploy Owocni Mail gdy `yarn twenty apply` pada na drift metadata:

```bash
python3 integrations/tools/deploy_owocni_mail_patched.py
```

## Smoke

1. Lead A: Email `boss@firma.pl`; Dodatkowe: `asystent@firma.pl`.
2. Lead B (duplikat): Email `biuro@firma.pl`, Person z `extra@firma.pl`.
3. **Scal z leadem** B → A.
4. Sprawdź A: Dodatkowe emaile zawierają `biuro@`, `extra@`, `asystent@` (bez duplikatu `boss@`).
