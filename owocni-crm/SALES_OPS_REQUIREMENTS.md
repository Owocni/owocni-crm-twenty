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

### Etap 2+ (nie blokuje cutover jeśli zaakceptowane)

- Wysyłka maila na wskazaną godzinę (schedule)
- Automatyczna wysyłka SMS wraz z mailem
- Wyszukiwanie po fragmencie treści maila
- Round-robin, limity nieodpisanych, urlopy
- Liczniki leadów (dzienne/tygodniowe) — sekcja 6 poniżej jako backlog raportowy

---

## 3. Parzystość z better-bitrix (bramka cutover)

Cutover dopiero gdy Twenty oferuje **co najmniej** funkcjonalność używaną dziś w better-bitrix:

- [ ] Pipeline leadów (stage’e)
- [ ] Pola produkt / źródło / odrzucenie kampanii
- [ ] Szablony maili (P0)
- [ ] Timeline / maile (po Etap 1.2 Email Sync)
- [ ] Eventy outbound (qualify, purchase, rejected) — przez Sortownię
- [ ] Backup formularzy → Sheets (bez regresji — `STRESS_TEST_PLAN` S0)

Lista uzupełniana w trakcie testów akceptacyjnych.

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

## 7. ADR #15 — otwarte (nie blokuje planu architektury)

1. Schedule mail / SMS — Etap 2?
2. AI podsumowania wątków w Twenty — 1.2 czy 2?
3. Właściciel backlogu operacyjnego sprzedaży (poza Dawidem technicznym)
