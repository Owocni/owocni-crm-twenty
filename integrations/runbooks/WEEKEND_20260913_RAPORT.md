---
doc_id: WEEKEND_20260913_RAPORT
title: "Raport piątek–niedziela 11–13 IX — kolejka, composer, puste maile"
audience: "Mariusz"
owner: "Dawid"
status: ready_to_send
last_verified: 2026-09-13
related:
  - QUEUE_TRIAGE_20260912.md
  - QUEUE_TRIAGE_T1_CHAT_20260912.md
  - COMPOSER_V2_20260912.md
  - MAIL_EDITOR_REBUILD_20260912.md
source: "Mail Mariusz 12.09 + WSTEPNY-DOKUMENT_WYKONAWCZY_QUEUE_AND_KANBAN rev 3.1 + Plan-przebudowy-edytora-maili"
---

# Raport 11–13 IX 2026

Dwa tory, równolegle:

| Tor                                    | Co                                                     | Stan niedziela rano                                |
| -------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Dane (kolejka, owner, etap, flaga, BB) | Weekendowy triage z Twojego dokumentu, nie pełne W0–W7 | Zrobione to, co blokowało poniedziałek             |
| Owocni Mail                            | Composer v2 wg Twojego planu przebudowy                | Live **0.1.143** — bez przycisku starego composera |

Widoków / filtrów / „PODGLĄDY KANBAN”, które ruszałeś w Twenty, **nie nadpisywaliśmy**.

Inbound Twenty = prod Ads. Etapu na QUALIFIED/WON **nie** ruszaliśmy hurtem (sygnał reklamowy).

---

## 1. Kolejka i synchronizacja

Twój dokument wykonawczy (rev 3.1) opisuje pełny pakiet W0–W7. Weekend **nie** zamyka tego pakietu. Zrobiliśmy operacyjny wycinek: A/B/C, kolejka „Do odpisania”, holding Sortowni, etapy i flaga vs Better Bitrix na kartach, które już są w Twenty.

### 1.1 Piątek 11 IX (przed weekendem)

- Twenty z powrotem na prod Ads; BB zostaje archiwum / awaria, nie drugim CRM sprzedaży.
- Sync BB→Twenty: **78 PATCH** etapów na istniejących kartach, **0 create** (33 dziury świadomie pominięte).

### 1.2 Sobota–niedziela — Twoje A/B/C i kolejka

| Punkt z dokumentu                                            | Co zrobione                                                                                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** `53081308-…` (Gosia, tylko IN; druga karta Roberta)    | Zdjęta z „Do odpisania” (`isFollowUp=false`). Merge z kartą Roberta **nie** ruszany.                                                          |
| **B** `2cb65973-…` (pusta karta)                             | Zdjęta z kolejki. **Nie** LOST. Notatka „do decyzji”.                                                                                         |
| **C** `67e969b4-…` (copywriting u Gosi)                      | `bizProduct=COPYWRITING`, owner **Maciej**. Etapu na QUALIFIED nie zmienialiśmy.                                                              |
| Stare NEW w „Do odpisania”                                   | **80** kart Gosi/Marty (lipiec–sierpień, Sortownia) — flaga zdjęta. Etap nietknięty.                                                          |
| Holding `owocni@gmail.com` — 14 formularzy z tygodnia testów | Marta 11 / Gosia 3 (stempel parku sample-week).                                                                                               |
| Testy / śmieci                                               | Usunięte **8** Opportunity (7 testów + Fakturownia DEMO). Zostawiony `test9959058@fastman.eu` do testów poczty.                               |
| Inkflow                                                      | Scalony z WON Roberta (PD 6819).                                                                                                              |
| Dump formularzy ~26 VI–3 VII                                 | **28** kart. BB miało **20** — **17** dostało ownera z BB (Marta 14 / Maciej 2 / Gosia 1). **8 miss** + invitely **nie** rozdane dziewczynom. |

### 1.3 Better Bitrix ↔ Twenty (etap i flaga)

- Etapy na spiętych kartach: PATCH (okno 30 dni, potem 90 dni). QUALIFIED/WON z Ads nie szły hurtem. Osobno: Paulina WON z `no_emit` (bez `purchase` na Ads).
- Flaga „Do odpisania” w Twenty = **nasza tura**. W BB `is_follow_up=true` = czekamy na klienta — to **odwrotność**. Po alignie z żywym BB: Marta i Gosia zgadzają się z kolejką BB.
- Wieczorny błąd sitka: czytana była zmaterializowana tabela BB (bez świeżych formularzy). Poprawione na live view; trzy dzisiejsze (m.in. `malaga82@`, `afis@onet.pl`) wróciły na kolejkę.
- `gdyniasy`: Sent Marty sklejony na właściwy wątek IMAP.
- BB bez karty Twenty: **96** prawdziwych dziur, **wszystkie Maciej**, **0 z ostatnich 30 dni**. **Nie tworzyliśmy** kart — to wsypałoby mu poniedziałek.

Część wychodzących z BB weszła do folderu **BB Archive** (nie do `leads@` / `studio@`). Pełna historia maili (~7 tys.) **nie** była w tym weekendzie.

**Model od poniedziałku:** praca w Twenty. BB = archiwum, gdy na karcie brakuje naszego Sent. Flagi **nie** synchronizujemy dalej z klików w BB — nadpisałyby Twenty.

### 1.4 Czego weekend świadomie nie ruszał

- Pełny W0–W7 (inwentaryzacja wszystkich kart, widoki W5, odbiór W7).
- **62 PAYING** na koncie Owocni (park 4 IX).
- Import Pipedrive Roberta/Ewy bez ownera / na holdingu.
- 12 pozostałych dumpów Sortowni bez BB.
- 96 starych leadów Maćka bez karty.
- Tworzenie 33 kart z piątkowej dziury.
- Nadpisywanie Twoich widoków.

### 1.5 Konto `owocni@gmail.com` i karty bez ownera

Odczyt niedziela 13 IX ~07:00 CEST. To **nie** jest nabór z weekendu ani „niczyje zapytania z tego tygodnia”.

| Worek                           | Łącznie | Otwarte | Po wycięciu importu PD (Robert/Ewa) |
| ------------------------------- | ------: | ------: | ----------------------------------: |
| Bez ownera (`ownerId` pusty)    | **401** | **367** |                              **12** |
| Konto Owocni `owocni@gmail.com` | **360** |  **87** |                               **2** |

**Skąd taka ilość**

1. **Import Pipedrive** (Robert / Ewa / Krzych). Większość sterty. Owner się nie zmapował albo karta wylądowała na koncie firmy.
   - Bez ownera, otwarte: **355** PD (głównie PROPOSAL, 2023–2026).
   - Na Owocni, otwarte: **85** PD — w tym **62 PAYING** zaparkowane 4 IX stemplem `PARKED-SAMPLE-WEEK-CLEAN:paying-unassigned` (restore 11 IX ich **nie** wrócił).
   - Na Owocni, zamknięte: **267** LOST, też PD.
2. **Tydzień testów 4–11 IX.** Quota 2 nowe/dzień na Martę/Gosię/Maćka; nadwyżka na `owocni@`. Potem **557** otwartych kart zaparkowanych na Owocni i przywróconych 11 IX — **oprócz** PAYING i resztek Sortowni. 14 Sortowni z holdingu rozdane w sobotę (Marta 11 / Gosia 3). Dlatego Owocni **nie** ma już tych 14 w otwartych.

**Reszta po wycięciu PD — 14 otwartych, nie PD:**

|    Ile | Gdzie      | Co to jest                                                                                                                                                                                                                                               |
| -----: | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **12** | bez ownera | Dump Sortowni ~26 VI–3 VII (`OWOCNI_SORTOWNIA`), bez sprawy w BB. W tym test poczty `test9959058@` (zostawić) i 2× `info@invitely.in` (nie kasować). Reszta: puste `Lead · Strona/INNE` i kilka maili z formularza/Ads. **Nie** na tablicę poniedziałku. |
|  **2** | Owocni     | Bez `srcSystem`, wrzesień: pusta `CONTRACT_SENT` (7 IX) i „test niepoprawny adres email” (10 IX). Ręczne/testowe, nie sprzedaż.                                                                                                                          |

Konto Owocni **nie** jest kolejką sprzedaży. Rozdanie 355+85 PD Gosi/Marcie zepsułoby poniedziałek.

---

## 2. Composer v2 (plan przebudowy edytora)

Live **Owocni Mail 0.1.143**. Domyślnie nowy composer. Przycisku „Stary composer” nie ma.

W ramce: treść, **Wyślij**, Do, DW/UDW (po kliku), temat, spinacz.

Awaria dla zespołu = **Thunderbird** (zgodnie z Twoim §13). Kod starego composera zostaje; przywraca go tylko programista, dopisując do URL Twenty `?owocniMailV2=0` (sesja karty). Zespół tego nie widzi i nie klika.

Świadome braki vs pełny plan:

- wybór skrzynki **Od** nadal poza ramką,
- wyszukiwarka leadów poza ramką,
- token OAuth na starcie w `srcDoc` (rotacja biletem),
- brak pola `MailDraft.revision` w Twenty (lock przez `attemptId`).

Nie wracamy do wersji 0.1.123 / 0.1.131.

---

## 3. Puste maile w piątek (~10:20–~13:00) i cache

Do **~10:17** (wersja **0.1.121**) działało: ramka z tokenem, szkic, Wyślij brał treść z edytora.

O **~10:20** weszło **0.1.122** („nie przebudowuj iframe przy tokenie”). W oknie **widać** wpisany tekst, ale wysyłka go **nie widzi** — na serwer idzie szablon albo sama stopka. To są suche / puste maile do klientów.

Około **13:00** serwer był już po interwencji; **~13:26** (**0.1.126**) znowu szła ścieżka z rana.

**Handlowcy dalej wysyłali ze złej wersji**, bo front to plik JS trzymany przez przeglądarkę na checksum. Zwykłe F5 albo karta otwarta od rana **nie bierze** nowego bundla. Bez **Cmd+Shift+R** (Windows: **Ctrl+Shift+R**) ktoś do popołudnia jechał na **0.1.122**, mimo że serwer był już po rollbacku.

Potem **0.1.127** znowu zepsuło ramkę; **0.1.128** wróciło do zachowania z 10:17. Sobota: kolejne łatki (filtry „pusta treść”) — stąd decyzja, żeby nie łatać 0.1.12x, tylko wdrożyć v2.

### Zabezpieczenie w 0.1.142

1. Endpoint `/mail/app-version` — żywa wersja z serwera (ta trasa nie jest cache’owana jak JS).
2. Bundel ma w sobie wypieczony numer wersji.
3. Rozjazd → **jeden automatyczny reload** karty.
4. Jeśli nadal stara kopia → **baner**: nie wysyłaj; twardy refresh.

Nie da się w 100% wyłączyć cache w Twenty. Da się wykryć rozjazd i nie pozwolić cicho wysyłać ze starego composera.

---

## 4. Do Twojej decyzji

Bez tego reszta może poczekać; poniedziałek sprzedaży tych punktów nie wymaga.

| #   | Temat                                                                                                            | Stan                                                                                  | Pytanie                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **62 PAYING** na `owocni@gmail.com`                                                                              | Zaparkowane 4 IX, nie restore 11 IX                                                   | Kto prowadzi wpłaty? Imienny owner / zostają archiwum na Owocni / inny podział. **Nie** rozdawać Gosi/Marcie jako świeżych leadów. |
| D2  | Import **Pipedrive** (Robert/Ewa): ~**355** otwartych bez ownera + ~**85** otwartych na Owocni (w tym te PAYING) | Archiwum migracji, nie nabór z weekendu                                               | Zostają na Owocni/null, czy wskazujesz opiekuna historii?                                                                          |
| D3  | **12** dumpów Sortowni VI/VII bez BB (null owner)                                                                | Świadomie nie na tablicy poniedziałku. W tym test poczty i 2× invitely (nie kasować). | Zostawić / przerzucić na Owocni / LOST / cold follow 4–5 z prawdziwym mailem.                                                      |
| D4  | Karta **B** (pusta)                                                                                              | Zdjęta z kolejki, nie LOST                                                            | Końcowa dyspozycja.                                                                                                                |
| D5  | **A** vs karta Roberta                                                                                           | Bez merge                                                                             | Czy A ma iść do Roberta, czy zostaje u Gosi poza kolejką.                                                                          |
| D6  | **~96** starych spraw Maćka w BB, bez karty Twenty                                                               | 0 z ostatnich 30 dni. Create = wsypanie kolejki.                                      | Tworzyć karty później, czy zostawić w BB jako archiwum.                                                                            |
| D7  | Routing **Meta Instant Form → Robert** vs **COPY/NAME z www → Maciej**                                           | W Twoim dokumencie §2.2 / §6.2 — do zatwierdzenia macierzy zanim wejdzie w kod        | Potwierdź macierz; do tego sporne przypadki ręcznie.                                                                               |
| D8  | **W0–W7** — reszta dokumentu (widoki W5, pełne 2A na zamkniętych, odbiór W7)                                     | Status dokumentu: NOT_STARTED; weekend = wycinek                                      | Kiedy ruszamy i w jakiej kolejności fal.                                                                                           |
| D9  | Composer — braki vs pełny plan (Od, wyszukiwarka, MailDraft)                                                     | v2 live **0.1.143**; stary tor ukryty (nie w UI)                                      | Czy to priorytet po starcie zespołu, czy zostaje backlog.                                                                          |
| D10 | Oferty z Twenty vs Thunderbird                                                                                   | Thunderbird nadal awaria                                                              | Od kiedy zespół ma wysyłać z v2 do klientów (po Twoim odbiorze).                                                                   |

---

## 5. Praca na później (nie blokuje poniedziałku)

To nie wymaga Twojej decyzji, żeby dziewczyny mogły pracować. Wymaga czasu i osobnego GO na zapis.

| Temat                                                                  | Co to jest                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Historia maili C-Δ / C2                                                | Reszta OUT z BB (~tysiące), głównie gdy nie ma rodzica IN w Twenty. Runbook ≥30 dni po cutover. |
| Przycisk i job **Odroczenie**                                          | Semantyka zamknięta 3 IX; kod / budzik **nie** ruszane.                                         |
| 8 kart ze **snooze** w przyszłość (m.in. `angel2210rsi` do pon. 09:00) | Świadomie pominięte przy alignie flagi.                                                         |
| Dump / invitely / test poczty                                          | Higiena po D3.                                                                                  |
| Dwie karty na Owocni bez `srcSystem` (7 i 10 IX)                       | Wyglądają na ręczne/testowe (`CONTRACT_SENT` pusta + „test niepoprawny adres email”).           |
| Piątkowe **33 create** pominięte                                       | Nie odtwarzać bez sitka — większość stary Maciej.                                               |
| Przestać syncować flagę **z BB**                                       | Dalsze kliki w BB nadpisałyby Twenty. Nowa poczta z Twenty/Thunderbirda ustawia flagę sama.     |
| Ads / mapa „Wpłaca → PAYING”                                           | Korekta EVENT_CONTRACT z Twojego §2.2 — przed kolejnymi zapisami stage.                         |

---

## 6. Jak pracować w poniedziałek

- CRM = **Twenty**. Kanban „Moje” + „Do odpisania”.
- BB = gdy na karcie **brakuje naszego Sent**.
- Poczta: **composer v2**. Jak coś nie tak — **Thunderbird**. Nie ma przycisku starego composera.
- Po deployu poczty: jeśli baner o wersji → **Cmd+Shift+R** / **Ctrl+Shift+R**, nie wysyłać ze starej karty.
- Konto `owocni@gmail.com` **nie** jest kolejką sprzedaży.

---

## 7. Gdzie leżą dowody

| Co                   | Gdzie                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Plan weekendu        | `integrations/runbooks/QUEUE_TRIAGE_20260912.md`                                                       |
| T1 (testy, dump, BB) | `integrations/runbooks/QUEUE_TRIAGE_T1_CHAT_20260912.md`                                               |
| Composer v2          | `integrations/runbooks/COMPOSER_V2_20260912.md`                                                        |
| Piątkowa oś wysyłki  | `integrations/runbooks/MAIL_EDITOR_REBUILD_20260912.md`                                                |
| Log operacji         | `owocni-crm/ops/OPS_NOTES.md` §5.3                                                                     |
| Manifesty PATCH      | `integrations/runbooks/exports/queue_cleanup/20260912T052202Z/` oraz `exports/bb_sync/runs/20260912T*` |
| Owocni@ / bez ownera | `integrations/runbooks/exports/queue_cleanup/20260913T050000Z/ownerless_minus_pd.json`                 |
