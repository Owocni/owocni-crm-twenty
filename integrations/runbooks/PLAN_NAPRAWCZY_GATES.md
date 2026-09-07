---
doc_id: PLAN_NAPRAWCZY_GATES
title: "Plan naprawczy Twenty — kolejność bramek (wykonanie)"
layer: runbook
status: active
owner: "Dawid"
audience: "Dawid + Mariusz"
last_verified: 2026-09-03
related:
  - STUDIO_AT_AUTO_LEAD_DECISION.md
  - E12_3_EMAIL_SIGNATURES_DECISION.md
  - TWENTY_FOLLOWUP_DECISION.md
  - ODROCZENIE_DECISION.md
  - CUTOVER_MAIL_HISTORY_DECISION.md
  - BB_MAIL_IMPORT_RISKS_DECISION.md
  - WEEKEND_CDELTA_MAIL_IMPORT.md
  - LEAD_DISPATCHER_PLAN.md
source: "PlanNaprawczyTwenty-2026-09-03-OSTATECZNY + brakiwobecustalen + Docs STARE + mail Mariusz 3 IX"
---

# Plan naprawczy — jedna bramka naraz

Zasada: **nie jedziemy ciągiem 40 zgłoszeń.** Jedna bramka = jedna decyzja, albo jeden odczyt, albo jedna powierzchnia. Bez PASS nie ruszamy następnej. Odbiór robi zgłaszający, nie autor apki.

Przy każdej naprawie, zanim wejdzie do roboty:

1. Kto zgłosił i jakimi słowami?
2. Co ta osoba zobaczy inaczej — jej słowami?
3. Czy test, gdy przejdzie, znaczy, że ona przestanie to zgłaszać?

Pozycja bez odpowiedzi na (2) nie ma zgłaszającego — inny mandat albo wypada.

**Przyklepane (nie otwierać):** R-1 skrzynki/podglądy · R-2 odroczenie = przycisk + data/godzina, spec `ODROCZENIE_DECISION.md` · R-3 „Do odpisania” = kolejka roboty (nowe **i** piłka u nas) — **rewizja wieczór 3 IX, poranny zapis „nowe tylko w Nowych” wycofany** · R-4 przeliczenie po ostatniej wiadomości otwartej sprawy · R-5 scalanie bez ceremonii · R-6 historia od 1.01.2023 · ~~R-7 Biorę / zegar~~ **R-7 wycofane 4 IX — bez Biorę, jeden przydział GCP (COPY→Maciej, parzysty idOid→Gosia, nieparzysty→Marta)** · R-8 Maciek w puli gdy Marta+Gosia zapchane · R-9 D-2 bez okna szkody.

**Zamrożenie miękkie (do PASS G4):** nie dociągamy ręcznie *historycznych* przykładów Gosi/Marty/Maćka (kasuje dowód). Wyjątek: żywy lead, który **dziś** blokuje odpowiedź — można odblokować, ale zapisujemy który i dlaczego.

**G0 — stan 3 IX, po Dawidzie:** Biorę opisane w Docs. `leads@` zdjęte z widoków 📥/📤 Marty i Gosi (filtry ourMailboxes). Maciek **nie** na BB — Thunderbird z `copywriting@` przy awarii. Gosia G1/G3 = pusty `API_KEY` w sGTM, naprawa środa rano. Pakiet wysyłki: `komunikaty-2026-09-03/`.

---

## Mapa

| Bramka | Co | Blokuje jeśli SKIP |
|---|---|---|
| **G0** | Komunikaty + zamrożenie | Maćkowi zostaje stary model; ręczna naprawa kasuje dowód |
| **G1** | Odczyt: produkcja poczty = repo? | Cała apka pocztowa (P1), D-2, stopka |
| **G2** | Odczyt + podpięcie `copywriting@` | Cztery zgłoszenia Maćka |
| **G3** | Rotacja dwóch tokenów | Dług techniczny z 4 VIII, każdy kolejny commit |
| **G4** | Reszta odczytów (2–7, 9–11) | G2/G4/G5/widoki/kolejka — lekarstwo na złą chorobę |
| **G5** | D-2 wątkowanie + stopka (jedno okno) | Szkoda u klienta; Marta F5 |
| **G6** | Widoki i podglądy (P4) | Marta F6+F7, Maciek rano, „do wzięcia” |
| **G7** | Worker (P2) — jedna rewizja | Kolejka, studio@ karta, kierunek, atrapa |
| **G8** | Biorę / zegar — **RETIRED 4 IX** | Hash GCP only; przycisk i widok zdjęte |
| **G9** | Operacje na danych (P5) — pojedynczo | Historia poczty, przeliczenie kolejki |
| **G10** | Otwarte (O-1…O-6) — decyzje, nie kod | BB, skrzynki imienne, lista braków, „do wzięcia”, zakaz emisji, taryfa |

G0, G2 (odczyt), G3 i G4 **nie kolidują ze sobą** — po G0 można je robić równolegle. G5 czeka na G1. G6 czeka na G4 (odczyty 4 i 6). G8 czeka na G0. G9.historia czeka na O-5.

---

## G0 — komunikaty (zero kodu)

**Cel:** zespół wie jak ma działać *zanim* skończymy naprawy. To jest polecenie Mariusza, nie opcjonalny mail.

### Decyzje do odhaczenia

- [x] G1/G3 Gosia = pusty `API_KEY` w sGTM; naprawa środa rano; nowe leady wpadają. Zamrożenie ręczne zostaje tylko dla *niewyjaśnionej* historii
- [x] Mechanizm Biorę opisany Maćkowi (Docs)
- [x] `leads@` zdjęte z widoków Marty i Gosi (3 IX, filtry Twenty)
- [x] Karta A/B/C `studio@` czeka. Dokument: `STUDIO_AT_AUTO_LEAD_DECISION.md` + `komunikaty-2026-09-03/KOMUNIKAT_MARIUSZ.md`
- [x] Maciek **nie** pracuje na BB. Zapas = Thunderbird z `copywriting@`. Tekst: `komunikaty-2026-09-03/KOMUNIKAT_MACIEJ.md`

### Tekst do Maćka (0-C)

Nikt niczego nie „bierze” i nie ściga się na kliknięcia — system przypisuje sam, w chwili powstania leada. Przycisk „Biorę” mówi tylko „zajmuję się tym” i zatrzymuje zegar przekazania. Nie zatrzymuje eskalacji — ta liczy dalej, także po kliknięciu. Limit trzech leadów bez pierwszego kontaktu obowiązuje również z „Biorę”. Przekazanie nie jest karą.

Na dziś: praca na Twenty, nie na Better Bitrix. Odpowiedź z BB nie ląduje na serwerze pocztowym — Twenty jej nie zobaczy, zegar uzna że nie było kontaktu i po włączeniu może przekazać kartę. Skrzynkę `copywriting@` podpinamy pod Twoje konto; bez tego „Odpowiedz” nie wyśle. Awaria wysyłki → Thunderbird z `copywriting@`, nie BB.

Lejek pokazuje otwarte sprawy z okna ok. 30 dni, nie całe archiwum z BB. To nie jest wyzerowanie konta.

### Tekst do Marty i Gosi

`studio@` to podgląd tego, co dzieje się na studiu — na razie w tym samym widoku co Twoja skrzynka. `leads@` z Twojej poczty zszedł: leady z tej skrzynki i tak trafiają na lejek.

„Do odpisania” = wszystko, czym musisz się zająć: nowe bez kontaktu **i** te, na które klient odpisał. Odroczenie to przycisk z datą i godziną — do tej chwili karta znika z listy, wraca o czasie albo wcześniej, gdy klient napisze. Przycisku jeszcze nie ma.

Na razie nie dociągamy ręcznie pojedynczych maili. Zbieramy przykłady, żeby złapać dziurę, a nie zamazać ją.

**PASS:** oba teksty poszły. Nie czekamy na potwierdzenie przeczytania, żeby ruszyć G1.

---

## G1 — odczyt produkcji poczty (pierwszy techniczny)

**Pytanie:** czy build Owocni Mail na produkcji jest odtwarzalny z repo?

**PASS 2026-09-03 — werdykt: produkcja ≠ git sprzed commita 0.1.60.** Po wciągnięciu `mailSignature.ts` + bumpie wersji git = live. Deploy ze starego HEAD (0.1.57) nadal nadpisałby stopkę.

| Warstwa | Wersja | Stopka w źródle | checksum `package.json` (md5) |
|---|---|---|---|
| Live Twenty (`zany-maroon-panther`, app `7e0eb364-…`) | **0.1.60** | n/d (zdeployowane) | `3c884fceac6604d4326189e019428ef0` |
| Ten commit | **0.1.60** | `mailSignature.ts` | **ten sam** `3c884fce…` |
| Git przed tym commitem | **0.1.57** | brak | `ee9a3a69e886c937ce03cd5a2279bb06` |
| Dokument stopek (stary status) | 0.1.58 | numer-widmo, nigdy w git | — |

Odczyt live: `findOneApplication` po odświeżeniu OAuth CLI. W tej bramce nie było deployu.

**Gałąź W2 zamknięta commitem:** źródło ma to, co produkcja. G5 (wątkowanie) może iść z tego drzewa, jednym oknem, bez reszty P1.

---

## G2 — `copywriting@` u Maćka

**PASS 2026-09-03 (Dawid):** skrzynka jest podpięta pod jego konto. Zostaje odbiór: Maciek wysyła jeden mail przyciskiem Odpowiedz (on, nie my). Bez tej wysyłki G2 jest deklaracją, nie testem.

---

## G3 — rotacja dwóch tokenów

**3 IX:** literały wycięte z gita (`verify_identity_e2e.py` czyta `TWENTY_API_KEY` z env; `vitest.config.ts` bez JWT). Instrukcja: `G3_TOKEN_ROTATION.md`.

Dawid: rotacja w panelu była wcześniej. Żywy klucz workera nadal jest w gitignorowanym `.env.deploy` — nie commitujemy go.

---

## G4 — jedenaście odczytów (nic nie zmieniamy)

G1 i G2 już zużyły odczyty 1 i 8. Zostaje:

| # | Odczyt | Blokuje |
|---|---|---|
| 2 | Inwentarz formularzy i torów (ogólny vs paid/organic) | G2 Gosia, A3+F3 |
| 3 | Polityka tworzenia kontaktów per kanał (domyślnie „tylko wysłane”) | G2, G4 Gosia |
| 4 | Czym jest byt „do wzięcia” | O-4, widoki, K17 |
| 5 | Widoczność treści — który kanał ma pełną | G5 Gosia, model skrzynek |
| 6 | Przynależność maila: uczestnicy czy kanał | F6+F7, P4 |
| 7 | Etykiety pól w instancji vs plan | A6, R-2, R-3 — po rewizji: pole `snoozeUntil` ma dostać etykietę „Odroczenie do”; opis `isFollowUp` ma mówić o kolejce roboty, nie o „tylko klient napisał” |
| 9 | Liczba kart per owner Twenty vs Bitrix | K1–K2 Maćka |
| 10 | Czy treść maili jest w globalnej wyszukiwarce | K16, O-3 |
| 11 | Sufity kierunku + flagi po ostatnim deployu workera | cała P2 i P5 |

**PASS:** każda komórka ma wynik, nie domysł. Po tym schodzi zamrożenie miękkie *tylko* tam, gdzie odczyt rozstrzygnął przyczynę.

---

## G5 — D-2 + stopka (jedno okno, jedna wersja)

**Naprawa 3 IX, wersja 0.1.61.** Zrobione: (1) panel nie nadpisuje message-id z workspace-latest, (2) temat z kontekstu karty jak wcześniej, (4) brak kontekstu / niespełniona walidacja ⇒ bez `In-Reply-To`, (5) serwer: odbiorca musi być uczestnikiem wiadomości. Punkt 3 (zawężenie recents do skrzynek zalogowanego) nie jest potrzebny do bezpieczeństwa wątku — recents nie niosą już id do wątkowania.

Część odpowiedzi u klienta będzie nową wiadomością zamiast wpinki w cudzy wątek. To cel.

**PASS:** test u odbiorcy (odpowiedź na leada ≠ cudza rozmowa) + Marta potwierdza stopkę przy *odpowiedzi*.

---

## G6 — widoki i podglądy (P4)

Jedno okno, jedno ogłoszenie, odbiór przez Martę, Gosię i Maćka.

- `leads@` zdjęte z podglądów Marty, Gosi i Ewy (zrobione 3 IX). Robert nie miał LEADS.
- `studio@` **zostaje w tym samym widoku** co własna skrzynka (Dawid, 3 IX, potwierdzone). Osobnej zakładki nie robimy.
- Przestawić kryterium przynależności z uczestników na kanał — bez tego Marta nadal „jest przypisywana do wiadomości ze studio@”.
- Test wycieku treści: adres podglądowy w kopii nie może odsłonić korespondencji handlowej całej firmie.
- Byt „do wzięcia” **usunięty 4 IX** (widok `fc2d2e30-…`). Kart nie zerowano. Przycisk Biorę DEACTIVATED.

**PASS:** Marta/Gosia/Ewa widzą własną + studio, `leads@` nigdzie. Maciek — `copywriting@` + studio, bez cudzych leadów w „moich”.

---

## G7 — worker (P2)

Jedna funkcja, jedna rewizja. Każdy redeploy unieważnia odczyt flag (odczyt 11).

Wchodzi tu m.in. wejście leada, ponowienia, kolejka, dyspozytor, kierunek, notatka, scalanie. Sitko `studio@` **tylko** jeśli Mariusz odhaczył A/B/C.

**Odroczenie** (przycisk + budzik): decyzja zamknięta, `ODROCZENIE_DECISION.md`. Nie w tym oknie, dopóki G4 odczyt 7 nie padnie. Potem: pinned workflow jak Biorę (form datetime) + worker IN kasuje `snoozeUntil` + job budzenia tylko otwartych. OUT daty nie rusza.

Nie w tym oknie: operacje masowe na historii (G9).

**PASS:** smoke na Godlewskim (albo świadomy wyjątek z karty) + jeden nowy mail na `leads@` + regresja „istniejąca otwarta sprawa nie robi drugiej karty”.

---

## G8 — przycisk Biorę / zegar (P3) — RETIRED 4 IX

**4 IX:** mechanizm Biorę wycofany w całości. Workflow DEACTIVATED, widok „Do wzięcia” usunięty, sweep no-op, `LEAD_DISPATCHER_ENABLED` zawsze false. Istniejące ownery nietknięte. Nowy przydział tylko hash GCP.

Build workera: `2026-09-04-retire-biore`.

---

## G9 — operacje na danych (P5)

Każda pojedynczo, ze snapshotem i przebiegiem próbnym. Nigdy w parze.

Kolejność robocza (do potwierdzenia po G4):

1. Korekta kierunku (sufity z odczytu 11).
2. Przeliczenie kolejki „Do odpisania” wg R-3 (kolejka roboty, nowe zostają ON) i R-4 — nie `--new-only`; nie gasić NEW.
3. Historia poczty od 2023 — **zablokowane przez O-5** (zakaz emisji przy masowych nie ma implementacji).
4. Import IMAP z BB (B62) — **pt 4.09 rano: test 10 szt.**; weekend C-Δ same-mailbox po PASS ([`WEEKEND_CDELTA_MAIL_IMPORT.md`](./WEEKEND_CDELTA_MAIL_IMPORT.md)). C2/R-6 nie w tym oknie.

**PASS:** per operacja: liczby przed/po + jedna osoba z zespołu na swojej skrzynce.

---

## G10 — otwarte decyzje (nie kod)

| ID | Pytanie | Kto | Rekomendacja na dziś |
|---|---|---|---|
| O-1 | BB tylko odczyt czy zapas? | Dawid 3 IX | **Nie zapas.** Maciek na Twenty. Awaria wysyłki → Thunderbird z `copywriting@`. BB nie pisze Sent na IMAP — to dziura, nie backup. |
| O-2 | Auto-karta na `studio@` / `gosia@` / `marta@`? | Mariusz (karta A/B/C) | Imienne: nie. Studio: czeka |
| O-3 | Pisemna lista czego system nie robi | Dawid, 1 strona | Najtańsza; dodać wyszukiwarkę treści i granicę formatowania IN |
| O-4 | Czym jest „do wzięcia”? | **Odpowiedź 3 IX:** widok tabeli Opportunity `fc2d2e30-…`, nie etap. Biorę Twenty nie schowa po kliknięciu. Szczegóły: `O4_DO_WZIECIA.md` | Widok można ukryć bez zerowania kart. |
| O-5 | Zakaz emisji przy masowych | Dawid + Mariusz | Karta do akceptacji: `BB_MAIL_IMPORT_RISKS_DECISION.md` (zawężenie `no_emit` z konstrukcji vs czekanie na kill-switch). Bez tej decyzji G9.historia stoi. |
| O-6 | Uprawnienia rekordowe (taryfa) | Mariusz | Nie. Koliduje z „widzisz ≠ jesteś właścicielem” |

---

## Czego ten plan świadomie nie robi w pierwszym przebiegu

- SMS + mail (B02) — brak w G-PAR, osobny epik.
- Open Archiver (B22).
- Włączenie pełnego dyspozytora „przy okazji” G8.
- Walka z Maćkiem o porzucenie BB przed G2 i G5.
- Jedno wielkie okno „naprawiamy pocztę”.
