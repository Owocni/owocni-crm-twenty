---
doc_id: REVIEW_PACKAGE
title: "REVIEW_PACKAGE — pakiet do weryfikacji dokumentacji SSOT"
layer: navigator
status: active
owner: "Dawid"
last_verified: 2026-06-08
recheck_trigger: "zamknięcie review / zmiana blokera cutover"
default_trust: D:CORE
---

# Pakiet do weryfikacji — migracja CRM OWOCNI → Twenty + Sortownia

**Cel review:** potwierdzić spójność dokumentacji SSOT i kierunków decyzyjnych, wskazać sprzeczności i luki — **bez** oczekiwania gotowości cutover ani działającego deployu integracji.

**Repo:** https://github.com/Owocni/owocni-crm-twenty.git · branch `main`  
**Ostatni istotny commit integracji/prep:** `be6f57c` (Twenty paths, env-guard, adaptery prep)

---

## 1. Co prosimy o sprawdzenie (zakres review)

| # | Obszar | Plik(i) | Pytanie do recenzenta |
|---|--------|---------|------------------------|
| R1 | Konstytucja i zakazy | `owocni-crm/CRM_CONSTITUTION.md` | Czy INVARIANTS i 9 praw są spójne z resztą pakietu? |
| R2 | Model danych | `owocni-crm/DATA_MODEL.md` | Czy pola FROZEN i prefiksy są wystarczające na Etap 1? |
| R3 | Eventy i adapter | `owocni-crm/EVENT_CONTRACT.md` | Czy mapowanie stage/rejected/manual-create jest jednoznaczne? LOST ≠ rejected? |
| R4 | Tożsamość i kanały | `owocni-crm/IDENTITY_AND_INBOUND.md` | Czy Resolver T1–T5 i kanały (w tym `kontakt@`) są akceptowalne? |
| R5 | Architektura | `owocni-crm/ARCHITECTURE.md` | Czy granice Twenty / Sortownia / Robot / strona www są jasne? |
| R6 | Decyzje i cutover | `owocni-crm/DECISION_REGISTER.md` §5.2, §5.8 | Czy kierunki A (2026-06-02) są poprawne? Co jeszcze blokuje cutover? |
| R7 | Plan i bramy | `owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` §5.4 | Czy G1–G8 + G-PAR jako MUST-PASS są kompletne? |
| R8 | Integracje (prep) | `integrations/TWENTY_PATHS.md`, `INTEGRATIONS_PARITY.md` | Czy opis ścieżek Twenty w kodzie prep odpowiada SSOT? |
| R9 | Świadome OPEN | `owocni-crm/ops/OPS_NOTES.md` | Czy lista `platform_recheck_needed` jest sensowna przed sandboxem? |

**Poza zakresem tego review:** konfiguracja Stape/GCP, testy smoke na żywo, data cutover.

---

## 2. Kolejność czytania (≈ 60–90 min)

1. [`README.md`](README.md) (root) — topologia repo  
2. [`owocni-crm/README.md`](owocni-crm/README.md) — navigator SSOT  
3. [`owocni-crm/CRM_CONSTITUTION.md`](owocni-crm/CRM_CONSTITUTION.md) — §0, §0a (skrót)  
4. [`owocni-crm/DECISION_REGISTER.md`](owocni-crm/DECISION_REGISTER.md) — §5.1–5.3, **§5.8**  
5. [`owocni-crm/EVENT_CONTRACT.md`](owocni-crm/EVENT_CONTRACT.md) — §5.2–5.4, §6.1, §6.3  
6. [`owocni-crm/ARCHITECTURE.md`](owocni-crm/ARCHITECTURE.md) — §5.3–5.5  
7. [`integrations/README.md`](integrations/README.md) → [`integrations/TWENTY_PATHS.md`](integrations/TWENTY_PATHS.md) → [`integrations/INTEGRATIONS_PARITY.md`](integrations/INTEGRATIONS_PARITY.md)

Opcjonalnie głębiej: `IDENTITY_AND_INBOUND.md`, `DATA_MODEL.md`, `audits/AUDIT_MIGRACJA.md`.

---

## 3. Ustalenia właściciela — **POTWIERDZONE (2026-06-08)**

Źródło: `DECISION_REGISTER.md` §5.8 · recenzent: **właściciel (Dawid)** · werdykt: **TAK na wszystkie**

- [x] **L-1:** `srcSystem`-SKIP usuwamy dopiero po PASS smoke #4 (manual create + backfill).  
- [x] **MERGE:** **nigdy auto** — system **proponuje** merge po corporate domain (`company_domain_key`); handlowiec scala ręcznie; **free-mail** wyłączone (`IDENTITY` §5.8.2, §5.9).
- [x] **Cutover:** bez daty z góry — okno po PASS G1–G8 + G-PAR.  
- [x] **Webhook:** nazwy/payload Twenty potwierdzamy sandboxem, nie zgadujemy z docs.  
- [x] **#12:** `kontakt@` poza CRM (kierunek A).  
- [x] **#13:** wyłączenie julia362 dopiero po testach + przejściu handlowców.  
- [x] **#14:** pełny cleanup `lead_won` → `purchase` w kodzie/docs przed cutover.

---

## 4. Niespójności znane (nie traktować jako błąd review)

| Temat | Stan | Po review |
|-------|------|-----------|
| ADR #14 w rejestrze = `open` | Kod prep (`purchase`/`rejected_lead`) jest w `integrations/` | Zamknąć ADR z evidence (commit + ewent. Google Docs) |
| Payload webhooka Twenty | OQ-E2, OQ-E3 otwarte | Preflight sandbox → `OPS_NOTES` `[D:VERIFIED]` |
| `generated/` schemy | Placeholder | Eksport po utworzeniu pól w Twenty |
| Deploy Stape/GCP | Celowo brak | Po akceptacji docs → Faza 2 preflight |

---

## 5. Formularz wyniku review (do wypełnienia)

**Recenzent:** Dawid (właściciel)  
**Data:** 2026-06-08

| Wynik | ☑ **Zatwierdzam SSOT do fazy preflight/testów**  ☐ Wymagane poprawki  ☐ Blokujące sprzeczności |
|-------|---|

**Uwagi:** brak — wszystkie punkty §3 TAK. MERGE zrewidowany 2026-06-08 (propozycje corporate, nie auto).

**Blokery przed startem preflight Twenty:** brak na poziomie dokumentacji. Start wdrożenia sandbox **TAK**; cutover nadal po PASS bram + zamknięciu ADR z dowodem.

**Zalecana kolejność po review (dla zespołu):**

1. Poprawki docs z uwag review (jeśli są).  
2. Preflight Twenty: `integrations/runbooks/PREFLIGHT_TWENTY_WEBHOOK.md`.  
3. Pola FROZEN w sandbox Twenty + snapshot schemy.  
4. Dopasowanie `INBOUND_TWENTY_WEBHOOK.js` do payloadów (commit, bez prod deploy).

---

## 6. Czego review NIE zatwierdza

- Gotowości cutover ani daty przełączenia.  
- PASS bram G1–G8 / G-PAR.  
- Działania produkcyjnego Stape/GCP.  
- Parzystości 1:1 z Better-Bitrix bez osobnej checklisty G-PAR.

Cutover startuje wyłącznie wg `DECISION_REGISTER.md` §5.1 (wszystkie blockers `closed` + gates PASS).

---

## 7. Szybkie linki

| Temat | Plik |
|-------|------|
| Protokół pracy LLM (obowiązkowy) | `AGENTS.md` |
| Anti-wpadki (LLM / zespół) | `integrations/runbooks/LLM_ANTI_WPADKI_GO_NO_GO.md` |
| Dlaczego runtime nie jest 100% | `integrations/runbooks/WHY_NOT_FULL_RUNTIME_YET.md` |
| Kolejność prac po review | `integrations/runbooks/NEXT_STEPS.md` |
