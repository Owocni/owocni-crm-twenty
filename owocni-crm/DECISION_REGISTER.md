---
doc_id: DECISION_REGISTER
title: "DECISION_REGISTER — rejestr decyzji (ADR-light), brama cutoveru"
layer: core_ssot
status: active
edit_scope: content_and_structure
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-07-09
recheck_trigger: "nowa decyzja / zmiana statusu decyzji / zamknięcie blokera cutoveru"
default_trust: D:CORE
related:
  - CRM_CONSTITUTION
  - EVENT_CONTRACT
  - IDENTITY_AND_INBOUND
  - runbooks/IMPLEMENTATION_PLAN
---

# DECISION_REGISTER — rejestr decyzji i brama cutoveru

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** statusie decyzji architektonicznych (ADR-light inline); które decyzje są otwartymi blokerami cutoveru; indeksie decyzji zamkniętych z dowodem; bramie cutoveru. Rozróżnia `decision_status` (czy zdecydowano) od `implementation_status` (czy wdrożono).

**Ten plik NIE decyduje o:** zadaniach wykonawczych (→ `runbooks/IMPLEMENTATION_PLAN.md`); mechanice domenowej (→ pliki domenowe).

**Zawsze czytaj razem z:** `runbooks/IMPLEMENTATION_PLAN.md` (MUST-PASS gates), pliki domenowe wskazane w evidence_source.

**Najgroźniejszy błąd:** oznaczyć decyzję jako closed bez `evidence_source` (= NOT closed); albo pomylić „zdecydowano" z „wdrożono"; albo naruszyć legendę 3 osi faz.

**Przy konflikcie:** status decyzji — ten plik (bije pliki domenowe co do tego, CZY rzecz jest rozstrzygnięta). Mechanika rzeczy → plik domenowy.

**Zmiana wymaga:** zgody właściciela; reopen decyzji closed wymaga jawnej REWIZJI z powodem.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie |
|---|---|---|---|---|---|
| NR-1 | **Decyzja `closed` BEZ `evidence_source` (source_file + section + verified_by + date) = NIE jest closed.** | „Zamknięte" bez dowodu = domysł udający fakt. | Cutover na niezweryfikowanej decyzji. | — | §5.4 |
| NR-2 | **NIE mylić `decision_status` z `implementation_status`.** Zdecydowano ≠ wdrożono. | Zlanie = „gotowe" gdy tylko zaplanowane. | Fałszywy obraz gotowości cutoveru. | — | §4 |
| NR-3 | **NIE naruszać legendy 3 osi faz** (numeryczne 1–9 / A-B-C / Etap 1.1–1.2–2+) — kotwica 1:1. | Trzy różne osie fazowania mylone w jedną = chaos planистyczny. | Błędne przypisanie „kiedy". | Właściciel + ADR | §4 legenda |
| NR-4 | **NIE awansować #5/#11/#6/#7 z `closed` do `open`** bez jawnej REWIZJI + powodu. | Zamknięte decyzje „odmykają się" przy zmęczeniu kontekstu. | Re-litygacja rozstrzygniętego. | Właściciel + REWIZJA | §5.3 |
| NR-5 | **Decyzja z `blocks: cutover` w stanie `open` → cutover NIE startuje.** | Otwarty bloker = nierozstrzygnięte ryzyko nieodwracalne. | Cutover na otwartym ryzyku. | Właściciel + zamknięcie | §5.2 |

---

## 2. PURPOSE

Jedno miejsce statusu decyzji architektonicznych (ADR-light) i brama cutoveru. Mówi CZY rzecz jest rozstrzygnięta i czym to udowodniono — nie powtarza mechaniki (ta żyje w plikach domenowych). Status: przed cutoverem.

---

## 3. SCOPE

### Pokrywa
- Status decyzji (open/closed), otwarte blokery cutoveru, indeks zamkniętych z dowodem, decyzje szczegółowo (ADR-light), przeniesione zadania, future `adr/`.

### Nie pokrywa
- Zadań wykonawczych (→ `runbooks/IMPLEMENTATION_PLAN.md`), mechaniki domenowej (→ pliki domenowe).

---

## 4. CANONICAL DEFINITIONS

- **`decision_status`** = czy decyzja zapadła (`open` / `closed`).
- **`implementation_status`** = czy wdrożono (`not_started` / `in_progress` / `done`). Niezależne od `decision_status` (NR-2).
- **`evidence_source`** (wymagane przy `closed`) = `source_file` + `section` + `verified_by` + `date`.
- **`blocks`** = `cutover` (otwarty = stop, NR-5) / `none`.

### Legenda 3 osi faz (KOTWICA 1:1 — nienaruszalna, NR-3)

System ma **trzy niezależne osie fazowania** — NIE mieszać:

| Oś | Wartości | Co oznacza |
|---|---|---|
| **Oś decyzji (ADR)** | numeryczne **1–9** (#1…#15 jako ID) | Identyfikator decyzji architektonicznej; kolejność historyczna, NIE faza wdrożenia |
| **Oś pewności / klasy** | **A / B / C** | Klasa/priorytet w grupowaniu (np. blokery A vs non-blocking C); NIE etap czasowy |
| **Oś wdrożenia** | **Etap 1.1 / 1.2 / 2+** | Faza czasowa wdrożenia (rdzeń / mail / poza MVP) |

Numer ADR (#13) ≠ klasa (C) ≠ Etap (1.2). Te trzy współrzędne są ortogonalne. Odwołanie „faza" bez wskazania osi jest niejednoznaczne.

---

## 5. BODY

### 5.1 CUTOVER GATE

**Cutover startuje wtedy i tylko wtedy, gdy:**
1. Wszystkie decyzje `blocks: cutover` są `closed` (z `evidence_source`).
2. Wszystkie MUST-PASS GATES G1–G8 + G-PAR = PASS (`runbooks/IMPLEMENTATION_PLAN.md` §5.4).

Dziś: **NIE** — otwarte blokery §5.2.

### 5.2 OPEN CUTOVER BLOCKERS (`blocks: cutover`, `decision_status: open`)

| ADR | Decyzja | Dlaczego bloker | Powiązana brama | Rozstrzygnąć |
|---|---|---|---|---|
| **#12** | Inbound — kanały i `kontakt@` (które skrzynki → Twenty, które poza) | Niejasny zakres wejścia = ryzyko leadów-sierot / fałszywego ingestu | G7 identity-safety | **Kierunek zamknięty (2026-06-02):** opcja A (`kontakt@` poza CRM). Do zamknięcia ADR pozostaje evidence z testów operacyjnych. |
| **#13** | Email Sync + Resolver muszą działać PRZED wyłączeniem julia362 | Wyłączenie legacy bez następcy = utrata kanału leadów | G7 / G-PAR | **Kierunek zamknięty (2026-06-02):** opcja A (wyłączenie dopiero po pełnych testach + przejściu handlowców). ADR zamknąć po PASS dowodach. |
| **#14** | Cleanup zakazanych nazw eventów (`lead_won`→`purchase`) w kodzie Robot + docs orkiestracji | Stary `event_name` w kodzie = niezgodność z kanonem SSOT | G1 event-semantics | **Kierunek zamknięty (2026-06-02):** opcja A (pełny cleanup przed cutover). Do zamknięcia ADR: commit/evidence. |
| **L-1** (TRANSITION EXCEPTION) | Usunięcie `srcSystem`-SKIP dopiero po smoke #4 PASS | Przedwczesne usunięcie = drugi mint idOid (rozdwojenie) | G4 loop-prevention | Dawid (`EVENT_CONTRACT.md` §6.1) — **Evidence 2026-06-15:** smoke #4 PASS, pending-write OK (`runbooks/SMOKE_MATRIX_EVIDENCE_2026-06-15.md`). Kroki L-1 (1)(2) done. Krok (3): w inbound brak `srcSystem`-SKIP do usunięcia. |
| **MERGE** (3 bramki techn.) | Webhook-oba-ID / nieodwracalność / T5 dwa paid | Nieznane zachowanie merge = nieodwracalne sklejenie wskaźników | G8 merge-safety | **Polityka biznesowa zamknięta (2026-06-08):** propozycje merge po corporate domain; **nigdy auto**; free-mail wyłączone (waterfall §5.8.2). ADR zamknąć po preflight G8 + SOP szkolenia. |

### 5.3 OPEN NON-BLOCKING (`decision_status: open`, `blocks: none`)

| ADR | Decyzja | Uwaga |
|---|---|---|
| #15 | Email Sync: zakres podsumowań/zadań w Twenty — Etap 1 vs 2 | **Kierunek zamknięty (2026-06-02):** opcja A (zostaje w CONSTITUTION do czasu przekroczenia progu wydzielenia). Szczegóły AI-podsumowań → Etap 2 |
| **#21** | Continuity / Account Owner przy SQL (powracający klient → sprzedawca SQL) | **Nieblokujące cutoveru.** Kill-switch `CONTINUITY_ROUTING_ENABLED` (default false). Kontrakt: `/Volumes/Samsung_T5/RULE_CONTINUITY_IMPLEMENTATION_CONTRACT.md`. Runbook: `integrations/runbooks/RULE_CONTINUITY_IMPL_CHECKLIST.md`. |
| FIX-2 | Format `time_occurred` (ISO vs epoch ms) | Decyzja: epoch ms; wdrożenie w backlogu |
| OQ (glosariusz) | Kanon glosariusza w CONSTITUTION vs osobny GLOSSARY.md | Próg powstania pliku (CONSTITUTION §5.6) |

### 5.4 CLOSED INDEX (każda z `evidence_source`)

| ADR | Decyzja (skrót) | source_file → section | verified_by | date |
|---|---|---|---|---|
| #1 | Natywne obiekty Twenty (Opportunity, nie custom Deal) | `CRM_CONSTITUTION.md` → Prawo 3a; `DATA_MODEL.md` → §5.3 | docs.twenty.com + decyzja właściciela | 2026-05-28 |
| #2 | Outbound = native webhook → adapter Sortowni (nie workflow HTTP) | `ARCHITECTURE.md` → §5.4; `EVENT_CONTRACT.md` → §5.1 | POC + credit budget | 2026-05-28 |
| #5 | SQL ≡ QUALIFIED (jeden stage, różnica językowa) | `EVENT_CONTRACT.md` → §4 | decyzja właściciela | 2026-05-29 |
| #6 | Granica CRM↔orkiestracja widoczna w prefiksach pól | `CRM_CONSTITUTION.md` → Prawo 6b; `DATA_MODEL.md` → §5.6 | decyzja właściciela | 2026-05-28 |
| #7 | Manual create rozpoznawany przez brak tożsamości (`idOid IS NULL`), nie `_operation` | `EVENT_CONTRACT.md` → §5.4 | instancja (payload bez `_operation`) | 2026-05-29 |
| #11 | Native webhook nie niesie before/after — payload = stan aktualny | `EVENT_CONTRACT.md` → §5.4 (NR-2) | docs webhooks v2.8.0 | 2026-05-29 |
| **#16** | HMAC: `X-Twenty-Webhook-Signature` SHA256 + `X-Twenty-Webhook-Timestamp`; signed string `{timestamp}:{payload}` | `ops/OPS_NOTES.md` → Twenty Verified Facts | docs.twenty.com | 2026-05-31 |
| **#17** | Szablony maili: SSOT Supabase BB; Faza 0 dual compose; cutover wymaga Sidecar MVP lub Twenty native | `integrations/runbooks/E12_3_EMAIL_TEMPLATE_STRATEGY.md` | Dawid + właściciel (pending) | 2026-06-16 |
| **#18** | Analytics: metryki M1–M9 + pola CRM-only + dashboardy KPI (sandbox D2) | `owocni-crm/METRICS.md` → §5; `statystyki/IMPLEMENTATION-STATUS.md` → Zamknięcie ADR #18 | Dawid + właściciel | 2026-07-09 |
| **#19** | Message.direction = perspektywa firmy (OUTGOING jeśli jakakolwiek MCMA OUTGOING) | `integrations/runbooks/E12_5_MAIL_DIRECTION_VIEWS.md` → §5.2; `DATA_MODEL.md` → Message | właściciel (2026-07-16) + wdrożenie 2026-07-28 | 2026-07-28 |
| **#20** | Migracja Pipedrive: `srcSystem+=PIPEDRIVE_LEGACY`, `bizSource+=PIPEDRIVE_IMPORT`, `pipedriveId` ×3, legacy fields | `DATA_MODEL.md` → §5.1–5.3; `integrations/runbooks/PIPEDRIVE_MIGRATION_CHECKLIST.md` | właściciel 2026-07-31 + Metadata deploy | 2026-07-31 |

> **#5/#11/#6/#7/#1/#2 pozostają `closed`** — NIE re-litygować bez REWIZJI (NR-4).

### 5.5 DECISION DETAILS (ADR-light — inline, tylko dla nieoczywistych)

**ADR #16 (HMAC) — closed 2026-05-31.**
Kontekst: jedno źródło podawało błędną nazwę nagłówka (`x-twenty-signature`). Decyzja: nazwa kanoniczna = `X-Twenty-Webhook-Signature` (+ `X-Twenty-Webhook-Timestamp`), signed string = `{timestamp}:{payload}` (nie sam payload). Dowód: docs.twenty.com (fakt publiczny, nie sprzeczność dla instancji). Dom faktu: `ops/OPS_NOTES.md`. Konsekwencja: `CRM_CONSTITUTION.md` Prawo 7g poprawione; `EVENT_CONTRACT.md` §5.1 cross-ref do OPS. Bez wiersza „recheck na instancji" — zamknięte z docs.

**ADR #14 (cleanup nazw eventów) — open, blocks cutover.**
Kontekst: kod Robot / docs orkiestracji mogą zawierać stare `lead_won`. Decyzja docelowa: wszystkie `event_name` zgodne z kanonem `EVENT_CONTRACT.md` §5.2. Wdrożenie: Dawid, przed G1 PASS.

**ADR #17 (szablony maili) — open, blocks cutover mailowy (G-PAR PAR-5).**
Kontekst: Twenty Cloud nie ma Message Templates w UI/API (docs Mintlify nieaktualne). Spike Notes odrzucony 2026-06-16. Decyzja: (1) SSOT = `email_template` Supabase BB; (2) Faza 0 = dual compose (BB picker + Twenty lejek, sync IMAP); (3) przed cutoverem mailowym = **Owocni Template Sidecar** MVP (picker + clipboard → Twenty composer) **lub** natywne Twenty Templates jeśli platforma dostarczy. AI draft = Faza 3 Sidecar. Plan: `integrations/runbooks/E12_3_EMAIL_TEMPLATE_STRATEGY.md`. Zamknięcie ADR: PASS PAR-5.2 po Sidecar MVP lub Twenty native.

**ADR #18 (Analytics — metryki sprzedażowe) — closed 2026-07-09, `blocks: none`, `implementation_status: done` (sandbox D2).**
Kontekst: tablica KPI per produkt × handlowiec × czas (M1–M9); plan zaakceptowany przez właściciela 2026-07-09 (`statystyki/REVIEW-DLA-WLASCICIELA.md`).
Decyzja (3 warstwy): (1) pola CRM-only na Opportunity + `bizProduct` / `bizSource`; (2) Track Stage Time v3 (Twenty) + M2 w GCP `advanceNewToContacted.js`; (3) dashboardy EA „Sprzedaż — Oceny" + „Sprzedaż — Zespół". Kanon formuł = `owocni-crm/METRICS.md`.
Evidence: pola w Twenty + `DATA_MODEL.md` §5.1.1; workflow v3 ACTIVE; PF-4/5 PASS; smoke Leads@ `DIRECT_EMAIL`; funnel test7858; dashboardy zaakceptowane wstępnie przez właściciela 2026-07-09. Backlog poza ADR: PF-7 legacy import, PF-6 kredyty, pełna próba M4 ≥20 rekordów po imporcie.
Status wdrożenia: `statystyki/IMPLEMENTATION-STATUS.md`.

**ADR #19 (Message.direction — perspektywa firmy) — closed 2026-07-28, `blocks: none`, `implementation_status: done` (sandbox).**
Kontekst: kierunek żyje na `MessageChannelMessageAssociation` (per kanał); widoki Messages nie filtrują ONE_TO_MANY → trzeba zmaterializować jedno pole na Message. Wariant „perspektywa użytkownika" niewykonalny (`connectedAccount` poza Core API).
Decyzja właściciela 2026-07-16: `OUTGOING` jeśli **jakakolwiek** MCMA ma `OUTGOING`, inaczej `INCOMING`. Cel = backstop Kanbana (Z1/Z2), nie klient poczty; Z3 = natywny `Text → Contains`.
Evidence: pole + backfill + widoki 📥/📤/🔧 + folder Poczta; live = GCP `messageDirectionEnrich` (workflowy DEACTIVATED — Message nieedytowalny przez automation); runbook `E12_5_MAIL_DIRECTION_VIEWS.md`; `DATA_MODEL.md` Message.direction; `OPS_NOTES` §5.1/§5.3.
Otwarte operacyjnie (nie blokują ADR): OQ-7 visibility/Sent per skrzynka; OQ-10 właściciel czujki 🔧.

**ADR #20 (Pipedrive → Twenty migracja pól) — closed 2026-07-31, `blocks: none`, `implementation_status: in_progress` (Metadata done; load później).**
Kontekst: import handlowców z Pipedrive wymaga proweniencji na FROZEN `srcSystem`, kluczy rollback oraz stałego `bizSource`. Decyzje biznesowe: `integrations/runbooks/PIPEDRIVE_MIGRATION_CHECKLIST.md`.
Decyzja: (1) `srcSystem` += `PIPEDRIVE_LEGACY`; (2) `bizSource` += `PIPEDRIVE_IMPORT`; (3) `pipedriveId` TEXT na Opportunity/Person/Company; (4) `legacyCreatedAt` + `legacyPipedriveStageName` na Opportunity; (5) metryki czasowe wykluczają `PIPEDRIVE_LEGACY` (patch `verify_metrics_pf5.py` — osobny krok); (6) rollback = DELETE po `pipedriveId` / `srcSystem=PIPEDRIVE_LEGACY` **przed** IMAP.
Evidence: akceptacja właściciela 2026-07-31; deploy Metadata `integrations/tools/deploy_pipedrive_migration_fields.py`; `DATA_MODEL.md` §5.1–5.3.

**ADR #21 (Continuity / Account Owner) — open, `blocks: none`, `implementation_status: code_ready` (2026-08-20).**
Zasada: powracający klient wraca do pracownika, który doprowadził relację do SQL. Ewa nie jest w puli continuity. Stempel: workflow „Opp · SQL → Account Owner gdy pusty” (nie nadpisuje). Routing: `resolveContinuityOwner` w GCP `createLead.js` **przed** FACEBOOK/MARKETING/COPY/hash; flaga `CONTINUITY_ROUTING_ENABLED` default false.
Zakazy: brak auto Company / domain link / backfill / zmian Resolvera / AO=Ewa.
Evidence (kod+unit): `shared/resolveContinuityOwner.js`, T1–T3/T5 PASS; kontrakt `RULE_CONTINUITY_IMPLEMENTATION_CONTRACT.md`; checklista `RULE_CONTINUITY_IMPL_CHECKLIST.md`. Do zamknięcia ADR: deploy CF + smoke T4 + flaga ON na pierwszym live trafieniu.

### 5.8 USTALENIA WŁAŚCICIELA — **potwierdzone 2026-06-08 (review PASS)**

Wszystkie punkty §3 `REVIEW_PACKAGE.md` = **TAK**. SSOT zatwierdzony do **fazy preflight / wdrożenia sandbox Twenty** (nie cutover).

- **L-1 / smoke #4:** TAK — usuwanie `srcSystem`-SKIP dopiero po PASS smoke #4.
- **MERGE (2026-06-08):** TAK — nigdy auto; propozycje po `company_domain_key`; free-mail wyłączone; merge ręczny w Twenty.
- **Cutover date:** TAK — bez daty z góry; okno po PASS G1–G8 + G-PAR.
- **Webhook naming/payload:** TAK — potwierdzać sandboxem.
- **#12 kontakt@:** TAK — poza CRM (kierunek A).
- **#13 julia362:** TAK — wyłączenie po testach + przejściu handlowców.
- **#14 lead_won→purchase:** TAK — pełny cleanup przed cutover.

### 5.6 TASKS MOVED OUT

Zadania wykonawcze (etapy, backlog FIX/ADD, harmonogram, szkolenie) **nie żyją tutaj** → `runbooks/IMPLEMENTATION_PLAN.md`. Ten rejestr trzyma decyzje i ich status, nie listę zadań.

### 5.7 FUTURE — `adr/` EXTRACTION

Gdy liczba decyzji wymagających pełnego ADR (kontekst / opcje / konsekwencje) przekroczy próg czytelności inline, wydzielić katalog `adr/` (jeden plik per decyzja). Do tego czasu ADR-light inline (§5.5). Powstanie `adr/` = decyzja `[D:CORE]` (CONSTITUTION §5.6 reguła powstawania pliku).

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| MUST-PASS gates G1–G8, zadania, backlog, harmonogram | `runbooks/IMPLEMENTATION_PLAN.md` |
| HMAC fakt (dom) | `ops/OPS_NOTES.md` |
| Mechanika eventów / manual-create / before-after | `EVENT_CONTRACT.md` |
| Merge / tożsamość / kanały | `IDENTITY_AND_INBOUND.md` |
| Reguła powstawania pliku / invarianty | `CRM_CONSTITUTION.md` |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

(Otwarte decyzje są w §5.2 / §5.3 — ta sekcja zostaje pusta celowo, by nie dublować rejestru.)

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Każda decyzja `closed` ma komplet `evidence_source` | Przy każdej zmianie | Dawid | ten plik §5.4 |
| Żaden `blocks: cutover` nie jest `open` przed startem | Przed cutover | Właściciel | §5.2 pusta |
| #12/#13/#14/L-1/MERGE zamknięte z dowodem | Przed cutover | Dawid | source_file |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-07-31 | **#20 Pipedrive migracja pól → closed** (Metadata deployed; load później) | właściciel + Composer | import PD → Twenty |
| 2026-07-28 | **#19 Message.direction (perspektywa firmy) → closed** + wdrożenie sandbox E12.5 | właściciel + Composer | backstop poczty / widoki Otrzymane·Wysłane |
| 2026-07-09 | **#18 Analytics → closed** (sandbox D2, `owocni-crm/METRICS.md` SSOT) | Dawid + właściciel | dashboardy + testy PASS |
| 2026-07-09 | #18 Analytics (metryki + dashboardy) → open, `blocks: none`, wdrożenie `in_progress` | właściciel + Dawid | akceptacja planu `statystyki/` |
| 2026-05-31 | #16 (HMAC) → closed z evidence (docs.twenty.com) | właściciel | błąd źródła rozstrzygnięty docs |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:CORE`. Inline = odchylenie.
