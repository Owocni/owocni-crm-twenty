---
doc_id: TWENTY_FOLLOWUP_DECISION
title: "Decyzja Mariusz — Do odpisania + zaplanowany follow-up (oba warianty)"
layer: runbook
status: wariant_A_wdrozone — NEW → Do odpisania ON (backfill 31.08); open+replay CONTACTED+ czeka; wariant B nie ruszany; odroczenie = ODROCZENIE_DECISION.md (3.09, decision_closed)
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-09-03
related:
  - KANBAN_CARD_SPEC.md
  - G_PAR_BETTER_BITRIX_PARITY.md
  - E12_5_MAIL_DIRECTION_VIEWS.md
  - CUTOVER_TWENTY_TEAM_PLAN.md
  - ODROCZENIE_DECISION.md
source: "skarga Gosi + audyt Twenty 28.08.2026"
decision_source: "załącznik Mariusz FollowUP.pdf 31.08.2026 — Sprawa 2, oba warianty"
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
5. **Kolejka „Do odpisania”** = wszystko, co czeka na ruch handlowca: nowy lead **albo** mail od klienta bez naszej odpowiedzi. Po naszym ruchu sprawa **znika** z tej listy (z lejka nie znika).

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

„Do odpisania” = **kolejka akcji handlowca**, nie „gonienie klienta”.

| Co się dzieje | Do odpisania | Co widzi Gosia |
|---|---|---|
| Nowy lead (formularz, mail, FB…) | **włączony** | sprawa **wchodzi** — czeka na pierwszy ruch |
| Mail od klienta (kolejna wiadomość) | włączony | sprawa **wchodzi** (albo zostaje) |
| Nasza odpowiedź (Twenty, Outlook, Sent) | wyłączony | sprawa **znika z listy**; na lejku zostaje w swoim etapie |
| Ręcznie na karcie leada | checkbox | awaryjnie |

Lejek (Nowy → Rozeznanie → SQL…) zostaje jak jest. „Do odpisania” to **osobna lista „muszę coś zrobić”**, nie nowy etap sprzedaży. Po odpowiedzi sprawa nadal jest na kanbanie — tylko nie zaśmieca kolejki.

---

## Opcje

### Opcja A — wdrażamy (rekomendowane)

| | |
|---|---|
| **Co** | Nowy lead i mail od klienta → ON; nasza odpowiedź → OFF. Widok „Do odpisania” (moje, otwarte, flaga ON). Jednorazowe posprzątanie otwartych spraw. |
| **Efekt dla Gosi** | jedna lista akcji; po odpowiedzi lead znika z niej (na lejku zostaje) |
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

## Decyzja (31.08.2026 — Mariusz, załącznik FollowUP.pdf)

```
Sprawa 2 — OBA warianty
Formalnie „follow-up" = wariant B (zaplanowana wysyłka)
Wariant A = kolejka „Do odpisania" (skarga Gosi)
```

**Wspólny fundament (zawsze):**

- kierunek maila już działa — oba warianty na nim stoją
- guard w workerze: `receivedAt < cutoverAt` → projekcje techniczne TAK, skutki biznesowe NIE (flagi, zadania, powiadomienia, przydziały); brak `receivedAt` = fail-closed
- jedna stała `cutoverAt` dla guarda i backfillu
- masowe operacje: batchami, `no_emit` (INV-6)
- nazwy: **„follow-up"** tylko na zaplanowaną wysyłkę · kolejka = **„Do odpisania"** · odwrotny widok później = **„Do ponowienia kontaktu"**

**A — Do odpisania (wdrożone 31.08):** worker: nowy lead → ON · IN→ON · OUT→OFF + guard `CUTOVER_AT`; pole etykieta „Do odpisania” (`defaultValue: true`); widok `70f01c16-…` moje + otwarte + ON. **Backfill NEW 31.08:** 398 rekordów Nowy (null/false → true), `toChange` po = 0; Gosia NEW ON = 80. Skrypt: `backfill_do_odpisania.py --new-only --apply`. Pełny open+replay (CONTACTED+) nadal czeka na `--apply` bez `--new-only`. Deploy workera: build `2026-08-31-gcp-v17-do-odpisania`.

**Poprawka Dawid 31.08 (vs PDF):** w PDF nowe z formularza miały być OFF i zostać tylko w „Nowych”. To rozbija kolejkę na dwa miejsca. **Wdrożenie: nowe też ON** — lista = wszystko, co czeka na ruch handlowca. Z lejka i tak nie znikają.

**Rewizja Mariusz 3.09.2026:** korekta Dawida jest obowiązująca. Nowe **mają** być w „Do odpisania”. PDF (formularz → OFF) w tym punkcie wycofany. Odroczenie (przycisk + budzik) — osobny plik `ODROCZENIE_DECISION.md`; automatyczne odkładanie „włączymy filtr gdy ktoś wpisze datę” z sekcji „świadomie pomijamy” **nie obowiązuje**.

**B — Zaplanuj follow-up (osobno, po A):** workflow per osoba (Gosia / Marta / Mariusz): Form (data + temat + treść) → Delay Scheduled Date → Send Email ze swojej skrzynki → notatka. Wysłany mail = zwykły OUTGOING → A samo zgasi „Do odpisania". Przed ogłoszeniem smoke 30–60 min na workflow Gosi.

**Świadome braki B v1:** nowy mail (nie wątek; łagodzenie `Re:`); brak auto-cancel gdy klient odpisze wcześniej; podgląd tylko w Workflow Runs.
