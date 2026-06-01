---
doc_id: IMPLEMENTATION_PLAN
title: "IMPLEMENTATION_PLAN — plan wdrożenia, MUST-PASS gates, cutover/rollback"
layer: runbook
status: active
edit_scope: content_and_structure
owner: "Dawid (wykonawca techniczny)"
last_verified: 2026-05-31
recheck_trigger: "zmiana zakresu Etapu 1 / zmiana harmonogramu cutoveru / nowa brama"
default_trust: D:CORE
related:
  - DECISION_REGISTER
  - EVENT_CONTRACT
  - IDENTITY_AND_INBOUND
  - audits/AUDIT_MIGRACJA
---

# IMPLEMENTATION_PLAN — wdrożenie, gates, cutover

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** kolejności wdrożenia (Etap 1.1 → 1.2); MUST-PASS GATES przed cutoverem (8 bram systemowych — go/no-go); planie cutover i rollback; backlogu kodu Sortowni (FIX/ADD); parzystości z Better-Bitrix jako bramie go-live; materiałach wdrożeniowych (szablony maili, szkolenie).

**Ten plik NIE decyduje o:** semantyce eventów (→ `EVENT_CONTRACT.md`); regułach tożsamości (→ `IDENTITY_AND_INBOUND.md`); statusie decyzji/ADR (→ `DECISION_REGISTER.md`); krokach audytu migracji (→ `audits/AUDIT_MIGRACJA.md`).

**Zawsze czytaj razem z:** `DECISION_REGISTER.md` (które bramy są otwartymi blokerami), `EVENT_CONTRACT.md` §6.3 (test matrix), `audits/AUDIT_MIGRACJA.md` (preflight importu).

**Najgroźniejszy błąd:** start cutoveru z otwartą MUST-PASS GATE; albo wpisanie zadań technicznych Mariuszowi/Krzysztofowi (są przełożonymi, nie wykonawcami).

**Przy konflikcie:** kolejność/harmonogram — ten plik. Semantyka bramy → plik domenowy, do którego brama się odwołuje.

**Zmiana wymaga:** zgody właściciela dla zakresu Etapu 1; bramy MUST-PASS zmienia tylko ADR.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | **NIE startować cutoveru z otwartą MUST-PASS GATE (§5.4).** | Każda brama chroni nieodwracalny skutek (sygnał reklamowy / tożsamość / dane). | Nieodwracalna szkoda w produkcji. | Właściciel + ADR | §5.4 |
| NR-2 | **NIE przypisywać zadań technicznych Mariuszowi/Krzysztofowi** — to przełożeni, nie wykonawcy. Wykonawca = Dawid. | Błędny model ról. | Zadania bez właściciela wykonawczego. | — | §5.5 |
| NR-3 | Szablony maili + szkolenie handlowców = **must-have przed go-live**, nie nice-to-have. | Cutover bez przeszkolenia = błędy merge/stage = nieodwracalne. | Zatrucie danych przez nieświadomych użytkowników. | Właściciel | §5.6 |
| NR-4 | Parzystość z Better-Bitrix = **bramka go-live**, nie cel aspiracyjny. | Regres funkcjonalny względem legacy = utrata zdolności sprzedaży. | Sprzedaż traci funkcje, presja na rollback. | Właściciel | §5.4 G-PAR |

---

## 2. PURPOSE

Plan wykonawczy migracji na Twenty (Etap 1) + brama go-live. Definiuje kolejność, testy, cutover, rollback i MUST-PASS gates. Status: przed cutoverem.

---

## 3. SCOPE

### Pokrywa
- Etapy 1.1 / 1.2, plan testów, cutover, rollback, backlog kodu Sortowni, MUST-PASS GATES, materiały wdrożeniowe.

### Nie pokrywa
- Semantyki eventów / tożsamości / pól (→ pliki domenowe), statusu ADR (→ `DECISION_REGISTER.md`).
- **3 bram refaktoru dokumentacji** (traceability / no-regression / clean-room) — to proces porządkowania docs, NIE należy do repo produktu (patrz nota §5.4).

---

## 4. CANONICAL DEFINITIONS

- **MUST-PASS GATE** = brama systemowa, której PASS jest warunkiem koniecznym cutoveru (go/no-go). Otwarta brama = cutover nie startuje (NR-1).
- **Parzystość BB** = zestaw funkcji Better-Bitrix, które Twenty musi pokrywać przed go-live (regres = blok).
- **Etap 1.1 / 1.2** = rdzeń (schema, paid inbound, webhook OUT) / warstwa mailowa (Email Sync, parzystość kanałów).

---

## 5. BODY

### 5.1 Etap 1.1 — rdzeń

| Krok | Zadanie | Owner | Zależność |
|---|---|---|---|
| 1.1.1 | Schema Twenty: pola krytyczne (`DATA_MODEL.md`), opisy w Settings, snapshot git | Dawid | DATA_MODEL preflight |
| 1.1.2 | Paid inbound: adapter `crm:twenty_create_lead` (Sortownia → Twenty) | Dawid | Sortownia Etap A |
| 1.1.3 | Native webhook OUT (HMAC, target Sortownia, obiekty Opportunity/Person) | Dawid | `ops/OPS_NOTES.md` HMAC |
| 1.1.4 | Adapter `inbound:twenty_webhook` (mapowanie, cold-start, loop-prevention, reason codes) | Dawid | `EVENT_CONTRACT.md` |
| 1.1.5 | Stape Store: pamięć `last_stage`/`last_campaignRejected` + pending-write | Dawid | EVENT_CONTRACT §5.6 |

### 5.2 Etap 1.2 — warstwa mailowa

| Krok | Zadanie | Owner | Zależność |
|---|---|---|---|
| 1.2.1 | Twenty Email Sync: skrzynki sprzedawców + `leads@` + `studio@` (bez `kontakt@`) | Dawid | `IDENTITY_AND_INBOUND.md` §5.5 |
| 1.2.2 | Identity Resolver T1–T5 (handler Stape) | Dawid | IDENTITY §5.2 |
| 1.2.3 | Rozdział wątków `leads@` → Opportunity owner (reguły/proces) | Dawid | parzystość BB C13 |
| 1.2.4 | Reconciliation 1×/dobę (Twenty PII vs Stape wskaźniki) | Dawid | IDENTITY §5.8 |

### 5.3 Plan testów

- **Smoke matrix eventów** (8 scenariuszy go/no-go) → `EVENT_CONTRACT.md` §6.3. PASS wymagany.
- **Smoke #4** (manual create → backfill, brak drugiego `generate_lead`) — warunek usunięcia `srcSystem`-SKIP (EVENT_CONTRACT §6.1).
- **Cross-channel tożsamość** (T1–T5, scenariusz 3-dniowy) → `IDENTITY_AND_INBOUND.md` §8.
- **Preflight importu** (surjekcja, side-effect guard, no_emit) → `audits/AUDIT_MIGRACJA.md`.
- **Backup inbound** (formularz → Make → Sheets niezależnie od CRM) → `ARCHITECTURE.md` §5.3.1.

### 5.4 MUST-PASS GATES BEFORE CUTOVER (8 bram systemowych — go/no-go)

> Każda brama = PASS wymagany. Otwarta brama = **cutover nie startuje** (NR-1). Bramy ze statusem decyzji → `DECISION_REGISTER.md`.

| # | Brama | Warunek PASS | Źródło prawdy | Status |
|---|---|---|---|---|
| **G1** | **event-semantics** | `qualify_lead`/`purchase`/`rejected_lead` mapują się zgodnie z kanonem; zakaz `lead_won`; LOST≠rejected | `EVENT_CONTRACT.md` §4–5.3 | do testu |
| **G2** | **webhook-truth** | Webhook = stan aktualny, BEZ before/after; detekcja przejść z Stape Store; HMAC zweryfikowany | `EVENT_CONTRACT.md` §5.1/5.4 + `ops/OPS_NOTES.md` | do testu |
| **G3** | **manual-create** | Rozpoznanie przez `idOid IS NULL` (create LUB update); generate_lead manual; backfill | `EVENT_CONTRACT.md` §5.4 | do testu |
| **G4** | **loop-prevention + transition-exception** | Pending-write Stape działa; `srcSystem`-SKIP usunięty DOPIERO po smoke #4 PASS (sekwencja 1-2-3) | `EVENT_CONTRACT.md` §6.1 | **OPEN (L-1)** |
| **G5** | **data-model** | Pola FROZEN utworzone z właściwym typem/API name; `idOid` unique + null-test; opisy w Settings | `DATA_MODEL.md` §8 | do testu |
| **G6** | **import-safety** | Import/backfill/replay → `no_emit`; brak workflow HTTP odpalającego się przy imporcie; import nie mintuje idOid | `audits/AUDIT_MIGRACJA.md` + `EVENT_CONTRACT.md` §5.4 cold-start | do testu |
| **G7** | **identity-safety** | Stape down → fail-closed (nie mintuj); T4/T5 nie wysyła VBB; concurrency mint-guard | `IDENTITY_AND_INBOUND.md` §5.2/5.10 | do testu |
| **G8** | **merge-safety** | Webhook przy merge — zachowanie znane (oba ID?); merge nieodwracalny obsłużony; T5 dwa paid → admin | `IDENTITY_AND_INBOUND.md` §5.9 | **OPEN (3 bramki merge)** |
| **G-PAR** | **parzystość Better-Bitrix** | Funkcje BB pokryte w Twenty (kanban, won/lost/rejected, rozdział `leads@`, skrzynki handlowców) | §5.2 + this | **bramka go-live** |

> **NIE mylić z 3 bramami refaktoru dokumentacji** (traceability / no-regression / clean-room) — te dotyczą procesu porządkowania docs i **NIE są częścią produktu ani tego repo**. Tu liczą się wyłącznie bramy systemowe G1–G8 + G-PAR.

### 5.5 Cutover (minimum — brak osobnego CUTOVER_RUNBOOK)

1. **Pre-cutover:** wszystkie G1–G8 + G-PAR = PASS; snapshot schemy w git; reconciliation czysta; szkolenie zrobione (§5.6).
2. **Cutover window:** wyłącz workflowy create/update na czas importu (G6); import aktywnych leadów z ledgerem (`audits/AUDIT_MIGRACJA.md`); włącz native webhook OUT; włącz adapter inbound.
3. **Cold-start:** pierwszy webhook każdego rekordu zapisuje stan początkowy bez emisji (EVENT_CONTRACT §5.4).
4. **julia362 OFF** dopiero gdy Email Sync + Resolver + reguły kanałów działają (ADR #12/#13).
5. **Post-cutover:** monitor reason codes (EMITTED vs SKIP_*); reconciliation 1×/dobę; backup inbound (Sheets) nietknięty.

**Role:** wszystkie kroki techniczne — **Dawid** (uzgodnienia z Mariuszem/Krzysztofem jako przełożonymi). Mariusz/Krzysztof nie mają zadań wykonawczych (NR-2).

### 5.5.1 Rollback (minimum)

1. Wyłącz native webhook OUT (stop emisji) + adapter inbound.
2. Reaktywuj julia362 / better-bitrix (legacy nadal sprawne do potwierdzenia stabilności).
3. Backup inbound (Sheets) zapewnia ciągłość zapisu leadów niezależnie od stanu CRM.
4. Rekonsyliacja: leady utworzone w oknie cutoveru → ręczny przegląd przed ponowną próbą.
5. Warunek rollbacku: naruszenie którejkolwiek G1–G8 wykryte w produkcji.

### 5.6 Materiały wdrożeniowe (must-have przed go-live — NR-3)

| Materiał | Zawartość | Owner |
|---|---|---|
| Szablony maili | Odpowiedzi handlowców w Twenty (spójne z timeline) | Dawid + sprzedaż |
| Szkolenie handlowców | Stage/`campaignRejected` („Odrzuć leada" ≠ LOST), merge (nieodwracalny — kiedy NIE), T4 „Tożsamość do rozstrzygnięcia" | Dawid |
| SOP handoff WON → Bitrix24 | Manual (MVP); `bitrixDealId` wpisywany ręcznie | sprzedaż |

### 5.7 Backlog kodu Sortowni (przeniesiony z IDENTITY §8.4)

| ID | Element | Priorytet | Uwaga |
|---|---|---|---|
| FIX-1 | `assist` — **Opcja A** (pierwszy pomocniczy kanał jako assist; semantyka first-touch `owner` + assist) | P0 | spójność reguł 90 dni / VBB |
| FIX-2 | `time_occurred` — **epoch ms** (ujednolicić format znacznika czasu) | P0 | nie mieszać ISO vs epoch (IDENTITY OQ-I5) |
| ADD-1 | concurrency mint-guard (dwa maile nadawcy → jeden id_oid) | P1 | IDENTITY NR-3 |
| ADD-2 | wskaźniki `by_email`/`by_phone`/`by_ga`/`by_crm` → migracja z multi-key write | P1 | IDENTITY §5.8 |
| ADD-3 | reconciliation job (Twenty PII vs Stape) 1×/dobę | P2 | IDENTITY §5.8 |

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| Semantyka eventów, test matrix, cold-start, TRANSITION EXCEPTION | `EVENT_CONTRACT.md` |
| Reguły tożsamości, T1–T5, merge, VBB | `IDENTITY_AND_INBOUND.md` |
| Status decyzji / które bramy = otwarte blokery ADR | `DECISION_REGISTER.md` |
| Preflight importu, side-effect guard | `audits/AUDIT_MIGRACJA.md` |
| Pola FROZEN, preflight schemy | `DATA_MODEL.md` |
| Backup inbound, granice | `ARCHITECTURE.md` |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-P1 | Data wyłączenia julia362 (zależna od Email Sync + Resolver) | Dawid | cutover | po G7/G8 |
| OQ-P2 | Harmonogram okna cutoveru | Dawid + właściciel | cutover | po G1–G8 PASS |

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Wszystkie G1–G8 + G-PAR = PASS | Przed cutover | Dawid | macierz bram |
| Szkolenie + szablony gotowe | Przed go-live | Dawid | materiały |
| Rollback przećwiczony (legacy reaktywowalne) | Przed cutover | Dawid | test |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:CORE`. Inline = odchylenie.
