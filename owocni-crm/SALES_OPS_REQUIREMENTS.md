# SALES_OPS_REQUIREMENTS — wymagania operacyjne sprzedaży

**Status:** Zaktualizowano 2026-05-28 (scope cutover)  
**Powiązane decyzje:** `DECISION_REGISTER.md` #15  
**Owner techniczny:** Dawid

---

## 1. Stage naming (język handlowy)

Handlowcy **już znają** obecną logikę stage’ów i różnicę przegrany / odrzucony w kampanii (Bitrix/better-bitrix).

**Przed cutoverem na Twenty:** zaplanować **szkolenie Twenty** (UI, pipeline, pole „Odrzuć leada”, praca na mailu w Twenty) — patrz `PLAN_DZIALAN.md`.

Mapowanie techniczne: `STAGE_MAPPING.md`.

---

## 2. Must-have na start (przed cutover / przed odejściem od better-bitrix)

| # | Wymaganie | Priorytet | Uwagi |
|---|-----------|-----------|--------|
| 1 | **Szablony email** przeniesione z better-bitrix → Twenty | **P0 — must-have** | Bez tego nie wychodzimy z better-bitrix |
| 2 | Wyszukiwarka klienta po email | P0 | Twenty native |
| 3 | Odpowiedzi mailowe przez Twenty (Email Sync Etap 1.2) | P0 | `leads@`, `studio@`, skrzynki handlowców |
| 4 | Szkolenie handlowców (Twenty) | P0 | Zaplanować przed T-0 |

### Etap 2+ (po uruchomieniu — better-bitrix tego dziś nie ma → nie blokuje cutover)

- Wysyłka maila na wskazaną godzinę (schedule)
- Automatyczna wysyłka SMS wraz z mailem
- AI podsumowania wątków mailowych
- Wyszukiwanie po fragmencie treści maila
- Round-robin, limity nieodpisanych, urlopy
- Liczniki leadów (dzienne/tygodniowe)

---

## 3. Parzystość z better-bitrix (bramka cutover)

**Źródło:** potwierdzenie Dawida 2026-05-28.  
**Zasada:** wszystko z sekcji A–D i E18 **musi** być w Twenty przed cutover. F21–F23 i E19–E20 — **nie** na start.

### A. Pipeline i lead — **wszystko TAK (P0)**

| # | Wymaganie BB dziś | Twenty przed cutover |
|---|-------------------|----------------------|
| A1 | Kanban / lista ze stage’ami | TAK |
| A2 | Ręczne dodawanie leada | TAK |
| A3 | Przypisanie do handlowca | TAK |
| A4 | Pole produkt | TAK (`bizProduct`) |
| A5 | Pole źródło | TAK (`bizSource`) |
| A6 | Notatki przy leadzie | TAK (Note / timeline) |

### B. Akcje na leadzie — **wszystko TAK (P0)**

| # | Wymaganie BB dziś | Twenty przed cutover |
|---|-------------------|----------------------|
| B7 | Wygrana (WON) + wartość | TAK (`stage` WON, `bizValueWon`) |
| B8 | Przegrana (LOST) | TAK (bez eventu reklamowego — SSOT) |
| B9 | Odrzuć w kampanii (≠ LOST) | TAK (`campaignRejected` → UI „Odrzuć leada”) |
| B10 | Powód odrzucenia | TAK (`rejectionReason`) |

### C. Mail — **P0 z doprecyzowaniem skrzynek**

| # | Wymaganie | Przed cutover | Uwagi |
|---|-----------|---------------|--------|
| C11 | Wysyłka maila do klienta z CRM | **TAK** | Twenty Email Sync + compose |
| C12 | Szablony maili | **TAK** | ~kilkanaście szt., daily-use; migracja z BB |
| C13 | Wątki / historia maili | **TAK** (Etap 1.2) | Każdy handlowiec: **własna skrzynka** w Twenty + **skrzynka ogólna** (`leads@` lub równoważna), która **rozdziela wątki** do leadów przypisanych do konkretnych handlowców |
| C14 | Odbieranie i odpisywanie z CRM | **TAK** (Etap 1.2) | Nie tylko podgląd — pełna obsługa z Twenty |

**Model skrzynek (C13):** patrz `IDENTITY_AND_INBOUND.md` §5.1 — Email Sync na skrzynkach handlowców + `leads@` / `studio@`; reguły przypisania wątku → Opportunity owner w Twenty (proces lub automatyzacja — do doprecyzowania przy wdrożeniu 1.2).

### D. Wyszukiwanie i widoki

| # | Wymaganie | Przed cutover |
|---|-----------|---------------|
| D15 | Szukanie po emailu | **TAK** |
| D16 | Filtry | **TAK** — podstawowe wystarczą |
| D17 | Sortowanie | **TAK** — podstawowe wystarczy |

### E. Integracje

| # | Wymaganie | Przed cutover | Uwagi |
|---|-----------|---------------|--------|
| E18 | Eventy do Sortowni/reklam | **TAK** — automatycznie | **SQL** → `qualify_lead`; **WON** → `purchase`; **Rejected** → `rejected_lead` (native webhook OUT) |
| E19 | GPT / auto-opis przy leadzie z maila | **NIE** | Etap późniejszy |
| E20 | Helpdesk / tickety w tym samym CRM | **NIE** | Całkowicie później (osobny projekt) |

### F. Świadomie poza startem (zgodne z ADR #15)

| # | Funkcja | Na start w Twenty |
|---|---------|-------------------|
| F21 | Planowana wysyłka maila | NIE |
| F22 | SMS z mailem | NIE |
| F23 | AI podsumowania wątku | NIE |

### Inne bramki cutover

- [ ] Backup formularzy → Sheets (`STRESS_TEST_PLAN` S0)
- [ ] Testy akceptacyjne: każdy wiersz P0 powyżej = PASS w sandbox/prod

**Werdykt planowy:** lista parzystości **zamknięta** — pozostaje egzekucja i testy PASS.

---

## 4. Tagowanie i widoczność źródła

- `bizProduct`, `bizSource` widoczne w Twenty (`DATA_MODEL.md`)
- Nie tylko w treści wiadomości

---

## 5. Liczniki leadów (raportowanie)

**Status:** Etap 2+ (nie blokuje cutover MVP jeśli zaakceptowane przez właściciela).

Dzienne/tygodniowe kolumny kategoria × źródło — backlog operacyjny.

---

## 6. Zakres etapów

### Etap 1.1 (rdzeń)

- Schema Twenty, paid inbound, webhook OUT, szablony maili, szkolenie zaplanowane
- julia362 nadal dla maili

### Etap 1.2 (mail w Twenty)

- Email Sync (bez `kontakt@`)
- Identity Resolver
- Odpowiedzi i wątek w Twenty

### Cutover

- Data po testach S0–S5 i parzycie z better-bitrix
- Wyłączenie julia362

### Etap 2+

- Transkrypty telefonów, enrichment NIP, zaawansowany routing leadów, liczniki

---

## 7. ADR #15 — zamknięte (2026-05-28)

Schedule mail, SMS, AI podsumowania, GPT przy leadzie, helpdesk — **Etap 2+** (patrz §2 i §3.F).
