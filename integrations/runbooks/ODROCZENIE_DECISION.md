---
doc_id: ODROCZENIE_DECISION
title: "Decyzja Mariusz 3 IX — Do odpisania + odroczenie (budzik)"
layer: runbook
status: decision_closed — implementation not_started
owner: "Dawid"
audience: "Dawid + wykonawca"
last_verified: 2026-09-03
related:
  - TWENTY_FOLLOWUP_DECISION.md
  - PLAN_NAPRAWCZY_GATES.md
  - ../../owocni-crm/DATA_MODEL.md
source: "Mariusz 3.09.2026 (chat) — zamyka R-2/R-3 z planu naprawczego"
---

# Do odpisania + odroczenie

**Do:** wykonawca  
**Od:** Mariusz (przez Dawida)  
**Data:** 3.09.2026  
**Status:** semantyka i gest **zamknięte**. Kod, przycisk i job — **nie ruszamy** w G1–G5.

To **nie** jest zaplanowana wysyłka maila (wariant B z `TWENTY_FOLLOWUP_DECISION.md`). Tu tylko: flaga na karcie i lista „muszę się zająć”.

---

## Kolejka „Do odpisania”

Handlowiec otwiera **jeden** widok i widzi wszystko, czym musi się zająć:

| Sytuacja | `isFollowUp` | W widoku |
|---|---|---|
| Nowy lead, bez kontaktu (formularz, mail, FB…) | **ON** | tak |
| Klient napisał, piłka u nas | **ON** | tak |
| My odpisaliśmy | **OFF** | nie |
| Odroczenie do przyszłej daty (jeszcze nie minęła) | **OFF** | nie |
| Minął termin odroczenia, sprawa **otwarta** | **ON** | tak |
| Nowy mail od klienta w trakcie odroczenia | **ON**, data skasowana | tak od razu |
| Sprawa WON / LOST | nie budzić | nie |

**ON na nowym leadzie jest celowe.** Nie rozdzielamy kolejki na „Nowe” i „Do odpisania”. Lejek (Nowy → …) zostaje; ta lista jest osobna.

To **cofa R-3** z planu naprawczego z rana 3 IX („nowe zapytania idą do Nowych, nie tu”) i **potwierdza** wdrożenie z 31 VIII (worker: nowy → ON · IN → ON · OUT → OFF). PDF FollowUP z 31 VIII (formularz → OFF) jest w tym punkcie wycofany.

Widok już filtruje `isFollowUp = true` + moje + otwarte. Nie dokładamy drugiego filtra po dacie.

---

## Odroczenie — co klika handlowiec

Przykład: klient napisał, że zdecyduje w przyszłym tygodniu.

1. Na karcie przycisk **Odroczenie**.
2. Wybór **daty i godziny** (np. poniedziałek 9:00, `Europe/Warsaw`).
3. Zapis: `snoozeUntil` = ta chwila, `isFollowUp = false` → karta **znika** z widoku.
4. Gdy zegar dojdzie do tej chwili **i sprawa jest otwarta**: `isFollowUp = true`, `snoozeUntil` = puste → karta **wraca**.
5. Jeśli **wcześniej** wpadnie mail **przychodzący** od klienta: kasujemy odroczenie, flaga ON, karta wraca od razu. **Wysłany przez nas mail odroczenia nie kasuje.**

Pole `snoozeUntil` (etykieta dziś: „Odlozony do”) już jest. **Nikt go nie czyta** — przycisk, zapis flagi i job budzenia nie istnieją.

---

## Reguły zamknięte 3 IX (nie reinterpretować)

1. **IN kasuje snooze.** `INCOMING` → `snoozeUntil = null` oraz `isFollowUp = true` (to drugie worker już robi).  
2. **OUT nie kasuje snooze.** `OUTGOING` nadal gasi tylko flagę (`isFollowUp = false`). Data zostaje — w poniedziałek 9:00 karta wraca, nawet jeśli po odroczeniu poszła nasza wiadomość („ok, daj znać w poniedziałek”).  
3. **Gest = przycisk + data i godzina.** Nie sama kolumna w widoku i nie wpisywanie w pole „z palca” jako jedyna droga. Wzorzec jak **Biorę**: pinned MANUAL workflow na Opportunity, tu z formularzem datetime.  
4. **Budzimy tylko otwarte.** WON/LOST z minioną datą zostają wyłączone z kolejki. Job ich nie zapala.

---

## Czego nie robimy

- Twenty **Delay** / workflow „poczekaj do daty” — moment wybudzenia w kolejce Twenty jest kruchy (G8 w planie naprawczym). Budzik = **job po naszej stronie** (worker + scheduler), ten sam wzorzec co w BB (`/api/bitrix/lead/snooze`), bez wartownika `1111-11-11`.
- Liczenie odroczenia z treści maila („napisał że w czwartek”).
- Budzenie zamkniętych.
- Kasowanie daty przy naszej wysyłce.
- Wariant B (zaplanuj i wyślij mail o godzinie) — osobny epik.

---

## Budowa (nie teraz — po G4 odczyt 7)

| Element | Co |
|---|---|
| Workflow **Odroczenie** | Pinned, pojedyncza karta Opportunity. Form: data+godzina. HTTP → worker. |
| Worker: gest | `snoozeUntil` w przyszłości, `isFollowUp = false`. Data w przeszłości / pusta = błąd, nic nie gasimy. |
| Worker: IN | jak dziś ON **plus** `snoozeUntil = null`. |
| Worker: OUT | jak dziś OFF; **nie ruszać** `snoozeUntil`. |
| Job budzenia | `snoozeUntil <= now` **oraz** etap nie WON/LOST → `isFollowUp = true`, `snoozeUntil = null`. Takt co kilka minut wystarczy (nie obiecywać sekundy). Strefa: Warszawa. |
| Etykiety | przycisk **Odroczenie**; pole **Odroczenie do** (zamiast „Odlozony do”). |
| Backfill kolejki | osobno, G9: open+replay CONTACTED+ (nie `--new-only`). Nowe ON zostają. |

**PASS:** Marta (albo Gosia) na otwartej karcie: odroczenie do za 5 minut → znika z „Do odpisania” → wraca. Drugi przypadek: odroczenie na jutro, testowy mail przychodzący → wraca od razu, jutrzejszy budzik nic nie psuje. Trzeci: WON z datą w przeszłości nie wraca.

**Odwrót:** wyłączyć job + odpiąć workflow. Pole zostaje. Flaga wraca pod sam mail.

---

## Relacja do starych zapisów

| Dokument | Co się zmienia |
|---|---|
| Plan naprawczy R-3 (ranek 3 IX) | **Wycofane.** Nowe **są** w „Do odpisania”. |
| Plan naprawczy R-2 | **Doprecyzowane** tym plikiem (przycisk + datetime, nie „pole w widoku”). |
| `TWENTY_FOLLOWUP_DECISION.md` A / korekta Dawida 31 VIII | **Potwierdzone** przez właściciela 3 IX. |
| PDF FollowUP 31 VIII (formularz → OFF) | **Wycofane** w tym punkcie. |
| Braki B61 | Przestaje być „inaczej niż ustalono” — ustalenie jest to, co w tym pliku. |
| Komunikaty G0 Marta/Gosia | Nie wolno pisać „nowe zapytania są w Nowych, nie tu”. |
