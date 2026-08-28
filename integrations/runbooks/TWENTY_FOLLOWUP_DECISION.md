---
doc_id: TWENTY_FOLLOWUP_DECISION
title: "Decyzja Mariusz — widok Follow-up w Twenty (Gosia: za dużo leadów)"
layer: runbook
status: awaiting_decision
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-08-28
related:
  - KANBAN_CARD_SPEC.md
  - G_PAR_BETTER_BITRIX_PARITY.md
  - E12_5_MAIL_DIRECTION_VIEWS.md
  - CUTOVER_TWENTY_TEAM_PLAN.md
source: "skarga Gosi + audyt Twenty 28.08.2026"
---

# Follow-up w Twenty — prośba o decyzję

**Do:** Mariusz  
**Od:** Dawid  
**Data:** 28.08.2026 (piątek)  
**Pytanie:** czy wdrażamy widok Follow-up tak, żeby po naszej odpowiedzi lead znikał (Gosia nie widzi „czekam na klienta”).

---

## W skrócie

1. Gosia skarży się, że w follow-up widzi **za dużo leadów** — w tym te, na które **już odpisała** i czeka na klienta.
2. W Twenty pole „Follow-up” **już istnieje**, ale jest puste na wszystkich sprawach. Nie ma widoku. Mail przychodzący/wychodzący **nie przełącza** tej flagi.
3. Dlatego dziś Gosia na lejku widzi wszystko naraz: do odpisania **i** czekające na odpowiedź.
4. **Nie trzeba nowego systemu.** Kierunek maila już znamy. Brakuje: reguły + widoku + jednorazowego posprzątania starych spraw.
5. **Propozycja:** follow-up = *klient napisał, my jesteśmy dłużni odpowiedź*. Po naszej odpowiedzi sprawa **znika** z tego widoku.

---

## Problem (Gosia)

W Better Bitrix follow-up to osobna tablica: „tu mam pracę do zrobienia”.

W Twenty na razie jest jeden lejek. Gosia ma **~283 otwarte** sprawy. Na liście widać zarówno:

- lead, na którego **musi odpisać** (ostatni mail od klienta),
- lead, na którego **już odpisała** i czeka.

To drugie nie powinno być w follow-up.

**Oczekiwanie Gosi:** jeśli odpowiedź poszła — sprawa znika z follow-up.

---

## Co już mamy / czego brakuje

| Element | Stan |
|---|---|
| Pole „Follow-up” na leadzie | jest, ale **puste** na wszystkich (~4005) sprawach |
| Pole „Odłożony do” (snooze) | jest, nieużywane w widoku |
| Rozpoznawanie maila przychodzący / wychodzący | **działa** (worker + skrzynki) |
| Automatyczne włączanie/wyłączanie Follow-up po mailu | **brak** |
| Widok „Follow-up” (tylko do odpisania, Owner = ja) | **brak** |
| Posprzątanie starych spraw (backfill) | **brak** |

Bez tych trzech ostatnich Gosia dalej będzie widzieć za dużo.

---

## Proponowana reguła

Follow-up = **do odpisania**, nie „gonienie klienta”.

| Co się dzieje | Follow-up | Co widzi Gosia |
|---|---|---|
| Mail od klienta | włączony | sprawa **wchodzi** do follow-up |
| Nasza odpowiedź (Twenty, Outlook, Sent) | wyłączony | sprawa **znika** |
| Nowy lead z formularza (etap Nowy) | wyłączony | zostaje na lejku w „Nowych”, nie w follow-up |
| Ręcznie na karcie leada | checkbox | bez zmian — awaryjnie można kliknąć |

Lejek (Nowy → Rozeznanie → SQL…) zostaje jak jest. Follow-up to **osobna lista „muszę odpisać”**, nie nowy etap sprzedaży.

---

## Opcje

### Opcja A — wdrażamy (rekomendowane)

| | |
|---|---|
| **Co** | Worker: mail od klienta → Follow-up ON; nasza odpowiedź → OFF. Widok „Follow-up” (moje, otwarte, flaga ON). Jednorazowe posprzątanie otwartych spraw po ostatnim mailu. |
| **Efekt dla Gosi** | po odpowiedzi lead znika; zostają tylko te, które czekają na **nią** |
| **Czas** | **pół dnia** (kod + widok + backfill + smoke na 2–3 sprawach Gosi) |
| **Ryzyko** | niskie — pole już jest; nie ruszamy lejka, reklam ani Sortowni |
| **Cutover** | nie blokuje; można zrobić **przed lub tuż po** starcie pracy w Twenty |

### Opcja B — na razie nic, Gosia filtruje ręcznie

| | |
|---|---|
| **Co** | zostawiamy lejek jak jest; Gosia sama szuka „co czeka na mnie” |
| **Efekt** | skarga zostaje; ~283 otwartych spraw bez podziału |
| **Czas** | 0 |
| **Ryzyko** | Gosia wraca do BB albo gubi odpowiedzi |

### Opcja C — follow-up = „czekam na klienta” (odwrotnie)

| | |
|---|---|
| **Co** | lista spraw, na które **my** napisaliśmy i cisza od klienta |
| **Efekt** | **nie** rozwiązuje skargi Gosi (właśnie tego nie chce widzieć w follow-up) |
| **Kiedy** | osobny widok „Do gonienia” **później**, jeśli zespół o to poprosi |

---

## Co świadomie pomijamy (w opcji A)

- nowy obiekt / nowy etap lejka,
- zmiana Sortowni, reklam, webhooków,
- ciągły sync z Better Bitrix (flaga w Twenty żyje od maili Twenty),
- widok „Do gonienia klienta” (opcja C — nie teraz),
- automatyczne odkładanie (snooze) — pole jest, włączymy filtr gdy ktoś zacznie z niego korzystać.

---

## Decyzja (do uzupełnienia)

```
Opcja: A / B / C
Follow-up = do odpisania (ON po mailu klienta, OFF po naszej odpowiedzi): TAK / NIE
Backfill starych otwartych spraw: TAK / NIE
Kiedy: …………
```
