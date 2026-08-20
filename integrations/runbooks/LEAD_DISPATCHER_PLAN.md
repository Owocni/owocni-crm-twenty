---
doc_id: LEAD_DISPATCHER_PLAN
title: "Rozdzielanie leadów — model dyspozytora (TIME TO LEAD)"
layer: runbook
status: draft
owner: "Mariusz (biznes) / Dawid (wdrożenie)"
last_verified: 2026-08-20
related:
  - LEAD_OWNER_ROUTING_PLAN.md
  - CUTOVER_TWENTY_TEAM_PLAN.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../../owocni-crm/DATA_MODEL.md
  - RULE_CONTINUITY_IMPL_CHECKLIST.md
supersedes:
  - "/Volumes/Samsung_T5/Rozdzielanie-leadow-wstep.md (v1.3 claim/puli — ODRZUCONE)"
audience: "zespół handlowy + LLM / agent wdrożeniowy"
---

# Rozdzielanie leadów — model dyspozytora

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** jak system przydziela leady, kiedy tyka zegar przekazania, co robi przycisk „Biorę”, kiedy lead jest „obsłużony”, kiedy leci alert do managera, jak działają weekend/święta/urlop/limit 3.

**Ten plik NIE decyduje o:** cutoverze na Twenty (→ `CUTOVER_TWENTY_TEAM_PLAN.md`); szczegółach matchingu tożsamości poza regułą email/telefon (→ `IDENTITY_AND_INBOUND.md`); Fakturownia/PayU.

**Cel biznesowy:** TIME TO LEAD — jak najszybszy pierwszy kontakt, wspierany automatyzacjami (np. prewypełnione oferty).

**Model:** prosty **dyspozytor**. System sam przypisuje ownera. Nikt nie ściga się na kliknięcia w puli. Jedyny ręczny bezpiecznik przed przekazaniem = „Biorę”.

**Zasada dla LLM:** przy konflikcie reguł zawsze stosuj **kaskadę od góry do dołu** (§2) — pierwsza pasująca wygrywa. Nie wdrażaj odrzuconego modelu claim/puli/slotów (§11).

**Względem cutoveru:** obecny hard-assign (D1-7) wystarczy na start. Ten plan = większe reguły; domyślnie po cutoverze, ale wolno wcześniej, jeśli jest czas. Nie blokuje D1.

---

## 1. Jak to działa w 7 zdaniach (dla zespołu)

1. Lead pojawia się u Ciebie jako Twój — system sam przydziela.
2. Od przydziału tyka **zegar**. Jeśli nic nie zrobisz, lead przechodzi do drugiej osoby.
3. Zanim zaczniesz pisać lub dzwonić — kliknij **„Biorę”**. Zegar staje.
4. „Biorę” to Twoje **poświadczenie**, że zajmujesz się leadem — nie jest to jeszcze potwierdzony kontakt.
5. Po pierwszym kontakcie (mail / dalszy etap / odrzucenie) lead jest Twój i **już nie przechodzi** automatycznie.
6. Zegar chodzi tylko **pn–pt 8:00–18:00**. Wieczór, weekend i święta — nic nie przechodzi.
7. Max **3 leady bez pierwszego kontaktu** na osobę. Na urlopie nic nie dostajesz.

---

## 2. Kto dostaje leada (kaskada)

**Reguły działają od góry do dołu. Pierwsza pasująca wygrywa.**

| # | Warunek | Owner |
|---|---------|--------|
| 1 | Stały klient / ktoś, z kim już rozmawialiście — **ten sam email lub telefon** | Ta osoba (ostatni/znany owner) |
| 2 | Mail bezpośrednio na skrzynkę imienną handlowca | Ta osoba |
| 3 | Meta / Facebook / Instant Form **lub** marketing Strategii | **Robert** |
| 4 | Copywriting | **Maciej** |
| 5 | Reszta (formularz, `leads@`, …) | **Marta lub Gosia** — kto ma **mniej nieobsłużonych** (bez pierwszego kontaktu) |
| 6 | Ewa | **Tylko ręczne** przypisanie — zero auto |

### 2.1 Przykład konfliktu

Stały klient Marty pyta o copywriting → wygrywa **#1 Marta**, nie Maciej.  
Maciej może dostać info / wsparcie, ale **nie przejmuje** leada automatycznie.

### 2.2 Co znaczy „stały klient” (v1 — decyzja)

- **Automatycznie** uznajemy za istniejącego klienta / kontynuację **tylko** gdy jest wspólny **email** albo **telefon**.
- Brak wspólnego emaila i telefonu → **zawsze domyślnie nowy klient** (nawet ta sama firma / domena / NIP).
- Dopisywanie / łączenie leadów (np. wspólnik z innego maila) = **ręczne** — to już jest w procesie; system tego nie zgaduje.

---

## 3. Zegar przekazania

Od momentu przydziału (w oknie pracy) tyka zegar. Bez „Biorę” i bez pierwszego kontaktu lead przechodzi do drugiej osoby:

| Klasa | Czas do przekazania |
|-------|---------------------|
| **HOT DEAL** | **15 min** |
| **STANDARD** | **30 min** |
| **LOW** | **2 godz.** |

Klasę nadaje **system automatycznie** (produkt + widełki z formularza) — handlowiec tego nie ocenia ręcznie.

### 3.1 TODO — spisać reguły klasyfikacji HOT / STANDARD / LOW

**Status: OTWARTE — musi być w tym dokumencie przed pełnym wdrożeniem zegara.**

Do uzupełnienia (właściciel biznesowy):

- [ ] Jakie produkty / intencje → HOT
- [ ] Jakie widełki wartości (PLN) → HOT / STANDARD / LOW
- [ ] Co z niepełnymi danymi / samym materiałem → LOW?
- [ ] Co z Meta / Instant Form — zawsze HOT, czy zależnie od odpowiedzi?
- [ ] Domyślna klasa, gdy brak widełek

Do czasu spisania progów: **nie wdrażać automatycznego przekazania po klasie** albo używać jednej bezpiecznej klasy tymczasowej (decyzja wdrożeniowa — oznaczyć w commit/ADR).

---

## 4. Przycisk „Biorę”

- Jeden klik na leadzie = **„Zajmuję się tym”**.
- Zegar przekazania **staje**.
- Możesz spokojnie pisać ofertę / dzwonić.
- Nawyk: **zanim** zaczniesz pisać lub dzwonić — kliknij „Biorę”.

**Ważne:** „Biorę” **nie** jest potwierdzeniem kontaktu. To deklaracja handlowca.  
Dlatego obowiązkowe są **alerty managera** o leadach wziętych bez kontaktu (§7).

---

## 5. Pierwszy kontakt kończy temat przekazania

Po pierwszym kontakcie lead jest Twój — **już nigdzie nie przechodzi automatycznie**.

| Akcja | Skutek |
|-------|--------|
| Wysłany mail | System widzi sam → first contact |
| Po telefonie | Wyślij mail z podsumowaniem **albo** przesuń dalej (np. Rozeznanie / Przyjmij jako SQL) — jak dotychczas |
| Lead śmieciowy | „Odrzuć leada” — jak dotychczas |

Żadnych dodatkowych klikań poza istniejącym flow.  
Ręczne przekazanie między handlowcami **zawsze możliwe** — automat tego nie blokuje.

---

## 6. Przekazanie to nie kara

Jeśli lead przeszedł do koleżanki, bo byłaś na rozmowie — w porządku: klient dostał szybszy kontakt.  
Nikt tego nie liczy nikomu na minus.

---

## 7. Alerty do managera (obowiązkowe)

### 7.1 Kiedy alert

| Sytuacja | Cel |
|----------|-----|
| Lead **wzięty („Biorę”)** ale **długo bez kontaktu** (brak maila / braku przejścia etapu / braku odrzucenia) | Nie zostawiać „zamrożonych” leadów po kliknięciu |
| Lead **u nikogo bez kontaktu** dłużej (od ~1 h do kilku h — **zależnie od klasy**) | Eskalacja, gdy zegar/przekazania nie wystarczyły |

### 7.2 TODO — doprecyzować

- [ ] **Kto jest managerem** do alertów (osoba / rota) — **do ustalenia**
- [ ] Dokładne progi czasu per klasa dla alertu „wzięty bez kontaktu”
- [ ] Dokładne progi dla alertu „u nikogo bez kontaktu”
- [ ] Kanał alertu (mail / SMS / Twenty task)

**Bez §7 nie wdrażać samego „Biorę” zatrzymującego zegar** — inaczej łatwo kliknąć i odłożyć temat bez konsekwencji.

---

## 8. Godziny, weekend, święta

| Okres | Zegar / przekazanie / eskalacja |
|-------|----------------------------------|
| **Pn–pt 8:00–18:00** | Zegar chodzi |
| Wieczór (po 18) | Stój — lead czeka |
| **Weekend** | Stój — lead czeka |
| **Święta** | **Jak weekend** — stój |

### 8.1 Poniedziałek / pierwszy dzień po weekendzie lub święcie

- Zegar **rusza o 8:00 od zera**.
- Nikt nie zaczyna dnia ze „spalonym” terminem.
- Lead weekendowy o 8:00 jest traktowany jakby zegar dopiero wtedy wystartował (np. HOT = do 8:15).

### 8.2 Kolejność na liście

- **Osobnego priorytetu systemowego nie ma.**
- W praktyce naturalny porządek: leady weekendowe są **najstarsze**, siedzą u góry listy, ich terminy przekazania dojrzewają pierwsze → brać **od góry**.

### 8.3 TODO — lista świąt

- [ ] Spisać listę świąt PL (kalendarz systemu) na rok roboczy
- [ ] Gdzie trzymana (config / SSOT) i kto aktualizuje

---

## 9. Urlop i limit nieobsłużonych

| Reguła | Opis |
|--------|------|
| **Urlop ON/OFF** | Na urlopie nic nie dostajesz; Twoje leady **bez kontaktu** przechodzą do drugiej osoby |
| **Limit 3** | Max **3 leady bez pierwszego kontaktu** na osobę; masz trzy → nowe idą do koleżanki |
| Ręczne przekazanie | Zawsze dozwolone |

**Uwaga operacyjna (nie zmienia reguły):** limit 3 jest prosty i „płaski” — nie rozróżnia lekkich vs ciężkich leadów. Na start akceptujemy; kalibracja później, jeśli będzie boleć.

**Nieobsłużony** = bez first contact (§5), niezależnie od tego czy kliknięto „Biorę” (do doprecyzowania przy wdrożeniu licznika: czy „Biorę” liczy się do limitu 3 — **rekomendacja LLM:** tak, liczy się do limitu, bo to nadal lead bez kontaktu; potwierdzić z Mariuszem przy implementacji).

---

## 10. Powiadomienia

| Teraz | Docelowo |
|-------|----------|
| Lead pojawia się u Ciebie (bez wymogu SMS) | SMS powiadomienie **8:00–16:00** |

SMS nie blokuje wdrożenia zegara / „Biorę”.

---

## 11. Z czego rezygnujemy (odrzucony wariant v1.3)

Nie wdrażać:

- puli „możliwość przejęcia” / ścigania na kliknięcia  
- rezerwacji 3 min / atomowego claim  
- mini-shark / broadcast  
- slotów 1 HOT / 2 STANDARD / 3 LOW (max 5)  
- osobnego statusu „rozmowa trwa” + pauzy SLA  
- overflow „wsparcie sprzedażowe”  
- wag conv / close rate w przydziale  

Zastąpione przez: auto-przydział + zegar + „Biorę” + limit 3 + alerty managera.

---

## 12. Stan vs cutover

| Warstwa | Co |
|---------|-----|
| **Dziś / D1 cutover** | Hard-assign: Meta/Marketing→Robert, COPY→Maciej, reszta hash Marta/Gosia, Ewa ręcznie (`LEAD_OWNER_ROUTING_PLAN.md`, D1-7) |
| **Ten plan (dyspozytor)** | Zegar, klasy, „Biorę”, limit 3, godziny, święta, alerty managera, kaskada §2 |
| **Kiedy** | Domyślnie po cutoverze; **wolno wcześniej**, jeśli jest czas — nie must-have D1 |

---

## 13. Checklist wdrożenia (dla LLM / Dawida)

### 13.1 Przed kodem — domknięte biznesowo

- [x] Kaskada reguł (§2) — potwierdzone: działa od góry
- [x] Stały klient = tylko wspólny email/telefon; inaczej nowy; merge ręczne
- [x] Święta = weekend; zegar od zera od 8:00 po przerwie
- [x] Alerty managera o wziętych bez kontaktu — obowiązkowe
- [ ] **TODO:** progi HOT / STANDARD / LOW (§3.1)
- [ ] **TODO:** kto jest managerem + progi czasu alertów (§7.2)
- [ ] **TODO:** lista świąt (§8.3)
- [ ] Potwierdzić: czy lead z „Biorę” bez kontaktu liczy się do limitu 3 (§9)

### 13.2 Pola / orkiestracja (szkic SSOT — CRM-only)

Nie dublować zbędnie z `DATA_MODEL` claim v1.3. Minimalny zestaw pod dyspozytor:

| Potrzeba | Propozycja |
|----------|------------|
| Klasa | `bizLeadIntentClass`: HOT / STANDARD / LOW |
| Stan zegara | np. `bizDispatchState`: `TICKING` / `HELD_BIORĘ` / `FIRST_CONTACT` / `TRANSFERRED` |
| „Biorę” | `bizHeldAt`, `bizHeldByWorkspaceMemberId` |
| Deadline przekazania | `bizTransferDueAt` (liczony w minutach roboczych 8–18) |
| First contact | reuse `firstResponseAt` / stage / reject |
| Urlop | `bizVacationOn` na profilu / capacity |
| Licznik nieobsłużonych | wyliczany lub cache |

### 13.3 Kolejność techniczna (rekomendacja)

1. Utrwalić kaskadę §2 w `resolveOpportunityOwnerId` (dziś brak #1 continuity email/phone→owner).  
2. Limit 3 + „mniej nieobsłużonych” zamiast samego hash.  
3. Urlop ON/OFF.  
4. „Biorę” + `HELD`.  
5. Zegar w oknie 8–18 + lista świąt.  
6. Auto-transfer po deadline.  
7. Alerty managera (§7) — **razem z „Biorę”**, nie później.  
8. SMS 8–16.

---

## 14. Słownik

| Termin | Znaczenie |
|--------|-----------|
| Nieobsłużony | Lead bez pierwszego kontaktu (§5) |
| „Biorę” | Deklaracja „zajmuję się” — stoper zegara, nie kontakt |
| First contact | Mail wychodzący / dalszy stage / odrzucenie |
| Przekazanie | Auto zmiana ownera po deadline bez „Biorę”/kontaktu |
| Okno pracy | Pn–pt 8:00–18:00, bez świąt z listy |

---

## 15. Historia decyzji

| Data | Decyzja |
|------|---------|
| 2026-08 | Mariusz: uproszczenie — dyspozytor zamiast claim/puli |
| 2026-08-20 | Kaskada od góry; stały klient = email/telefon; święta=weekend; zegar od zera po przerwie; alerty managera obowiązkowe; progi HOT/STANDARD/LOW = TODO; limit 3 zapisany |
| 2026-08-20 | Cutover: D1 = obecny assign; dyspozytor później lub wcześniej jeśli czas |
