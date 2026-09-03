---
doc_id: BB_MAIL_IMPORT_RISKS_DECISION
title: "Decyzja Mariusz — import historii maili BB: ryzyka, zabezpieczenia, warunki startu"
layer: runbook
status: dawid_stamped_2026-09-03 — weekend C-Δ same-mailbox (`WEEKEND_CDELTA_MAIL_IMPORT.md`); nie C2/R-6 w tym oknie
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-09-03
related:
  - CUTOVER_MAIL_HISTORY_DECISION.md
  - BB_MAIL_IMAP_APPEND_RUNBOOK.md
  - PLAN_NAPRAWCZY_GATES.md
  - TWENTY_FOLLOWUP_DECISION.md
  - E12_5_MAIL_DIRECTION_VIEWS.md
  - ../../owocni-crm/ops/OPS_NOTES.md
source: "R-6 (historia od 1.01.2023) + runbook IMAP APPEND zatwierdzony 2026-08-30 + audyt ryzyk 2026-09-03"
---

# Import historii maili z Better Bitrix — ryzyka i warunki startu

**Do:** Mariusz  
**Od:** Dawid  
**Data:** 3.09.2026  
**Status:** sitko weekendu **przyjęte przez Dawida 3.09** (R-6/IMAP nadal przyklepane — tu tylko *jak*). Playbook: [`WEEKEND_CDELTA_MAIL_IMPORT.md`](./WEEKEND_CDELTA_MAIL_IMPORT.md). Hurtem C2/R-6 **nie**.

**Pytanie:** czy odpalamy wgranie starej korespondencji z BB do Twenty, na jakich warunkach i w jakim zakresie.

Ścieżka techniczna jest już ustalona (30.08): maile z BB lądują w folderze **`BB Archive`** na skrzynce handlowca, Twenty sam je wciąga jak zwykłą pocztę. **Nie** wklejamy maili do CRM przez API — to psuje wątki i widoczność.

To **nie** jest dokument o tym, *czy* historia ma być w Twenty (to jest **R-6**: od 1.01.2023). Tu: **jakie szkody mogą powstać przy wgrywaniu i co z nimi robimy**, zanim ruszę maszynę.

---

## W skrócie

1. Karty z BB już są w Twenty. **Wątków z BB nie ma** — BB wysyłał odpowiedzi do Supabase **obok** skrzynki, więc Twenty ich nie widzi. To jest luka **C-Δ** (wysłane z BB, tylko w bazie).
2. Import **nie powinien** robić nowych spraw na lejku. Może za to nasypać **osób i firm**, przestawić **„Do odpisania”**, zatkać **kolejkę formularzy** (limit zapytań CRM — 3.09 już był błąd 429) i, jeśli ktoś zmieni webhooki, pchnąć śmieć do Sortowni / reklam.
3. Najgroźniejsze nie jest „zeżarcie tokenów planu Pro”. Groźne są **skutki uboczne u nas**. Każde realne zagrożenie ma zabezpieczenie poniżej — bez nich **nie startujemy**.
4. **Test 3.09:** rurociąg z bazy działa. Sklejanie **tak**, gdy doklejamy na skrzynkę z pytaniem; **nie**, gdy pytanie jest na `leads@`, a odpowiedź na skrzynkę handlowca. Czekanie 3 miesiące **nie** wciąga maili z bazy.
5. Oryginalny runbook mówił: start **nie wcześniej niż 30 dni po cutoverze** (ok. 30.09). Dziś jest 3. dzień po cutoverze. R-6 chce historię w Twenty. To trzeba rozstrzygnąć osobno (pytanie 2).
6. **C3 (cała poczta BB, ~330 tys. wiadomości) zostaje odrzucone.** Tego nie otwieramy.

---

## Co handlowiec zobaczy po udanym imporcie

Na karcie klienta z BB (np. ProAura u Marty) pojawia się wątek w folderze **`BB Archive`**: stare IN i OUT, daty oryginalne, nie „wysłane dziś”.

Czego **nie** zobaczy: maili bez treści w BB (~11% próbki) — te zostają w BB. Maili wewnętrznych `@owocni.pl` ↔ `@owocni.pl` — ich nie wgrywamy.

BB `/lead` może zostać archiwum do podglądu tych braków. To nie jest zapas do pisania (O-1).

---

## Zagrożenia i co z nimi robimy

Każdy wiersz: **co może pójść nie tak** → **czy to realne** → **zabezpieczenie**. Zabezpieczenia z gwiazdką **\*** są **warunkiem startu** (pytanie 1).

### 1. Nowe karty na lejku

**Ryzyko:** tysiące starych maili = tysiące nowych spraw u Marty/Gosi.

**Czy realne przy tej ścieżce:** **niskie**, o ile nie wkładamy historii na `leads@`. Nowa karta z maila powstaje tylko z kanału `leads@` (webhook → `create_lead`). Folder `BB Archive` na `marta@` / `gosia@` / `copywriting@` tego **nie powinien** tykać.

**Zabezpieczenie \*:**

- APPEND **tylko** na skrzynki handlowców, **nigdy** na `leads@`.
- Folder wyłącznie **`BB Archive`** — nie INBOX, nie Wysłane (żeby stare nie wyglądały jak nowe zapytania).
- Import **nie zapisuje** spraw (Opportunity). Zero scalania, zero zmiany etapu, zero ownera.

**Gdyby mimo to pojawiła się nowa karta:** stop, lista z timestampem importu, ręczne zamknięcie / scalenie. Nie „jedziemy dalej i posprzątamy”.

---

### 2. Nowe osoby i firmy (śmieć w CRM, nie na kanbanie)

**Ryzyko:** Twenty przy syncu poczty **sam tworzy kontakt** z nieznanego adresu (ustawienie skrzynki: Contact auto-creation). Przy „Sent & Received” każdy nowy nadawca z 7 tys. maili może dostać Osobę i Firmę. To nie jest lead na lejku, ale zaśmieca CRM i może odpalić webhook `person.created` / `company.created`.

**Czy realne:** **tak**, jeśli auto-create zostanie włączone na czas importu.

**Zabezpieczenie \*:**

- Na czas importu: auto-create na ruszanych skrzynkach → **wyłączone**. Maile i tak dokleją się do **istniejących** osób.
- Po QA: wracamy do ustawienia, które zaakceptujesz osobno (karta `studio@` A/B/C — **nie tu**).
- Preflight: 10 wątków — **zero** nowych Person/Company, których nie było przed importem (poza świadomym wyjątkiem, jeśli jakiś adres nie miał osoby — wtedy **nie** odpalamy fali, tylko odnotowujemy).

---

### 3. „Do odpisania”, last-contact, przeskok etapu

**Ryzyko:** stary mail od klienta wpadnie z datą **dzisiaj** → system uzna, że klient właśnie napisał → karta skacze na „Do odpisania”, ewentualnie Nowy → Skontaktowany. Handlowiec dostaje fałszywą kolejkę.

**Czy realne:** **tak**, jeśli IMAP zapisze datę przyjęcia zamiast daty z nagłówka. Guard w workerze jest: maile **sprzed 31.08** nie przestawiają flagi; brak daty = nie ruszamy. Guard **nie pomoże**, gdy data = „teraz”.

**Zabezpieczenie \*:**

- APPEND z **oryginalną datą** (`Date` + INTERNALDATE), flaga „już przeczytane”.
- Dry-run 10 wątków: data w Twenty = data w BB, nie 3.09.
- Fail na dacie → **stop całej fali**, nie „poprawimy przy reszcie”.
- Failover oddawania kart jest **już wyłączony** (3.09) — import nie powinien przekładać ownera.

---

### 4. Kolejka formularzy / „zeżarcie tokenów”

**Ryzyko:** Twenty ma twardy limit **100 zapytań / 60 s**. 3.09 worker już dostał 429 — pager od formularza. Import ~7 tys. wiadomości to ~20 min syncu **plus** nasz worker (kierunek maili, last-contact). W tym oknie **nowy lead ze strony może stanąć**.

To nie jest zeżarcie kredytów planu Pro za sam IMAP. To **zatkanie API**, z którego żyje formularz.

Kredyty **workflow** palą się tylko, gdy jakiś ACTIVE workflow słucha Person/Company/Message created. Dziś `lead · mail · powiadom` filtruje nowe sprawy z maila `leads@` — stare maile na istniejącej karcie raczej nie. Nowy Person (pkt 2) + workflow = koszt.

**Czy realne:** **tak** dla limitu API przy imporcie w godzinach formularzy. **Niskie** dla kredytów workflow, jeśli auto-create jest off.

**Zabezpieczenie \*:**

- Import **poza szczytem** (nie południe w dzień roboczy, nie w cyklu `*/5` pollu).
- APPEND partiami 200–500 z przerwami.
- W oknie importu: nie równoległy hurtowy backfill kierunku.
- Jeśli 429 / pager formularza: **stop APPEND**, dokończyć cykl sync, wrócić po uspokojeniu kolejki.
- Przed startem: spis ACTIVE workflow na Person/Company/Message — jeśli coś słucha tworzenia osoby, wyłączamy na czas fali albo zostawiamy auto-create off (pkt 2).

---

### 5. Sortownia / reklamy (O-5 — zakaz emisji przy masowych)

**Ryzyko:** hurt maili = hurtem zdarzenia wychodzące → Sortownia, Stape, platformy. Niezmiennik INV-6: operacja masowa ma być `no_emit`. W Twenty **nie ma** wyłącznika „nie emituj”. Dlatego G9.historia jest dziś zablokowane przez O-5.

**Czy realne przy tej ścieżce:** **niskie, jeśli trzymamy sitko**. Stan z 28.07: webhook OUT tylko `opportunity.*` / `person.*` / `company.*` — **nie** `message.*`. Sam Message nie idzie do Sortowni. Import **nie dotyka** spraw → Stape z kart głuchy. Zostaje dziura: **nowa Osoba/Firma** (pkt 2) **tak** emituje `person.*` / `company.*`.

**Zabezpieczenie \* — propozycja zawężenia O-5 tylko dla tej operacji:**

Ten import uznajemy za `no_emit` **z konstrukcji**, nie z wyłącznika platformy, gdy **wszystkie** punkty są prawdą w dniu startu:

1. Webhook OUT **nadal bez** `message.*` i bez `*.*` (spis w dniu importu, nie z lipca).
2. Auto-create kontaktów **off** (pkt 2) → brak fali `person.created`.
3. Żadnego zapisu Opportunity / etapu / ownera.
4. Wpis w dzienniku operacji: data, skrzynki, liczba APPEND, `no_emit=TAK (konstrukcja)`.

Jeśli którykolwiek punkt padnie na preflighcie — **nie jedziemy**, zamiast „jakoś będzie”. Pełny wyłącznik webhooków na stałe **nie** jest potrzebny do tej jednej operacji, o ile sitko trzyma.

To jest pytanie 3 na dole: albo akceptujesz to zawężenie, albo historia czeka na prawdziwy kill-switch (tygodnie, nie ten tydzień).

---

### 6. Duplikaty i rozjechane wątki

**Ryzyko:** ten sam mail już jest na IMAP (odbiorcze z Thunderbirda / Gmail) + jeszcze raz z BB → dwa rekordy albo dziwny wątek. Albo odwrotnie: odpowiedź z BB nie sklei się z pytaniem klienta.

**Czy realne:** **średnie**. Część IN już jest na skrzynce; luka to głównie **OUT z BB**.

**Zabezpieczenie \*:**

- Dedup po `Message-ID` w manifeście (wznawialność: nic dwa razy).
- Preflight: bajtowo ten sam mail już na serwerze → w Twenty **jeden**.
- RFC822 z oryginalnym `In-Reply-To` / `References`.
- Jeśli preflight duplikatów padnie: **nie** wgrywamy całych wątków — tylko brakujące **wychodzące** (wariant C-Δ). To i tak najbezpieczniejszy pierwszy krok.

---

### 7. Skrzynka i serwer poczty

**Ryzyko:** ~7,4 tys. × ~50 KB = setki MB na skrzynkę; za szybki APPEND zabije `mail.owocni.pl`. Folder nie włączony w sync Twenty = leży na serwerze, handlowiec w CRM nic nie widzi.

**Czy realne:** **średnie** przy C2 na raz; **niskie** przy C-Δ i throttle.

**Zabezpieczenie \*:** quota skrzynki przed startem; throttle; w Twenty **włączony sync folderu `BB Archive`** zanim poleci pierwsza paczka.

---

### 8. Czego ten import świadomie nie robi

- Nie wypełnia treści, której nie było w BB.
- Nie wciąga całej bazy ~330 tys. (C3).
- Nie włącza z powrotem failovera leadów.
- Nie rozstrzyga auto-karty na `studio@` (osobna karta A/B/C).
- Nie zastępuje BB jako miejsca, gdzie nadal leży to, czego nie da się wciągnąć.

---

## Zakres — co w ogóle wgrywamy

Liczby z audytu 28–31.08 (otwarte karty z okna ~30 dni, Marta/Gosia/Maciej):

| Wariant | Co | Szacunek | Kiedy ma sens |
|---|---|---:|---|
| **C-Δ** | tylko **wysłane z BB**, których nie ma na IMAP | ~1,5–2,5 tys. | najmniejsza szkoda; zamyka prawdziwą lukę |
| **C1** | te same karty, maile **od 1.01.2026** | ~2,5–3,5 tys. | krótszy QA |
| **C2** | pełna historia wątków tych ~236 adresów | ~7,4 tys. | to, co było w runbooku 30.08 |
| **R-6** | historia **od 1.01.2023** (ustalenie naprawcze) | **do policzenia** — może być więcej niż C2, jeśli bierzemy więcej adresów niż 30-dniowe otwarte | cel biznesowy; nie pierwszy strzał |
| **C3** | cała poczta BB | ~330 tys. | **odrzucone** |

**Rekomendacja:** najpierw **C-Δ** (10 adresów dry-run → jedna skrzynka → reszta). Po QA z Martą/Gosią — **C2 albo R-6 od 2023 na tych samych adresach**, nie 330 tys.

R-6 („od 1.01.2023 w Twenty”) zostaje celem. Pierwsza fala nie musi być R-6 w całości — ma udowodnić, że sitko trzyma.

Starsze niż 2023: lokalny serwer firmowy (R-6), nie Twenty.

**Tak — wiadomości wysłane z BB, które są tylko w Supabase, są w zakresie.** To nie dopisek. To **właściwa dziura**. BB po „Wyślij” zapisywał treść do `email_message` i **nie** doklejał kopii na IMAP (`folder_path: Sent` w bazie ≠ folder Wysłane na serwerze). Twenty widzi wyłącznie skrzynkę. Wariant **C-Δ** to dokładnie te rekordy: Sent + treść w BB, brak na IMAP. Przychodzące z Thunderbirda / INBOX często już są na serwerze — ich ponowne wgrywanie jest zbędne i ryzykowniejsze (duplikat).

---

## Test, który da się cofnąć — czy import w ogóle jest realny

Hurtem nie zaczynamy. Najpierw **dowód na 2–3 wątkach**, nie na 7 tysiącach.

Bierzemy sprawy, gdzie w Twenty widać pytanie klienta (IN już na IMAP), a **odpowiedzi handlowca z BB nie ma** — bo siedzi tylko w Supabase. To jedyny test, który sprawdza prawdziwą lukę, nie „czy umiemy skopiować mail, który i tak już jest”.

**Faza 0 — Twenty jeszcze nie widzi (cofnięcie = skasować folder)**

1. Z Supabase składa się RFC822 (oryginalne `Message-ID`, `Date`, `In-Reply-To`, treść).
2. APPEND do folderu **`BB Archive`**, który w Twenty **nie jest włączony w sync**.
3. Na IMAP: mail jest, data jest, da się otworzyć w Thunderbirdzie.
4. Cofnięcie: usunąć folder / te UID. CRM **nie został ruszony**.

To pokazuje: da się zbudować mail z bazy i włożyć go na skrzynkę. Jeszcze **nie** pokazuje, czy Twenty sklei wątek.

**Faza 1 — włączamy sync na tym folderze (2–3 maile, nie paczka)**

Po jednym cyklu sync (~5 min) sprawdzamy na karcie:

- odpowiedź z BB **widać w tym samym wątku** co pytanie klienta,
- data = stara, nie „dziś”,
- **zero** nowej karty, **zero** nowej osoby,
- kierunek wychodzący,
- kolejka formularzy bez 429.

**Cofnięcie fazy 1 nie jest chirurgiczne.** Wyłączenie folderu / skasowanie UID na IMAP — Twenty **może** zostawić osierocone rekordy Message (message-cleaner). Dlatego faza 1 = **2–3 wiadomości na jednej skrzynce testowej**, nie 200. Po teście: albo kasujemy te UID i spisujemy co zostało w CRM (to jest check „f” z runbooka — *zachowanie rollbacku znane przed falą*), albo zostawiamy je jako pierwsze prawdziwe wgranie.

**FAIL fazy 0 albo 1** = import odłożony. Nie „poprawimy przy reszcie”. Fallback: BB zostaje archiwum / ewentualnie notatka-podsumowanie na karcie, nie udawanie wątku.

Ten test **nie wymaga** Twojej zgody na C2/R-6. Wymaga zgody na **2–3 maile w `BB Archive`**. Sitko z gwiazdek (auto-create off, nie `leads@`, poza szczytem) i tak obowiązuje.

### Wynik testów 3.09.2026 (Dawid)

Dwa przebiegi. Import hurtem **nadal nie startuje**. Jedną prawdziwą brakującą odpowiedź Maćka **zostawiliśmy** w Twenty (udane sklejenie). Resztę śmieci testowych cofnięto.

#### Test A — czy w ogóle wchodzi z bazy (2 maile, `mariusz@`, 2024)

Zrobione i **cofnięte**.

| Check | Wynik |
|---|---|
| Luka jest prawdziwa | **Tak.** Folder Wysłane na IMAP Mariusza = **0**. BB Sent nie było na serwerze. |
| Złożenie maila z bazy + APPEND | **PASS** |
| Data w Twenty = data z BB, nie „dziś” | **PASS** |
| Kierunek | **OUTGOING** |
| Nowa karta / nowa osoba | **Nie** |
| Folder „bez syncu” = CRM nietknięty | **FAIL.** Nowy folder Twenty zbiera sam w ~5 min. **Ponowne stworzenie tego samego folderu po skasowaniu — już nie syncuje.** Trzeba nowego *nazwiska* folderu. |
| Kasacja folderu na IMAP czyści Twenty | **Nie.** Rekordy zostają, aż schowamy je ręcznie. |

#### Test B — sklejanie wątku (to, o co pytałeś)

Nagłówki `In-Reply-To` / `References` wstawialiśmy **1:1** z bazy. To nie był błąd składania maila.

**B1. Ta sama skrzynka — PASS**  
`copywriting@`: pytanie klienta już w Twenty (25.08, Gmail). Odpowiedź Maćka z BB (26.08, tylko w Supabase) weszła **do tego samego wątku**. Data oryginalna, kierunek OUTGOING, zero nowej karty. Folder IMAP po teście skasowany — wątek w Twenty **został** (to jest właściwe zachowanie C-Δ: brakująca odpowiedź wraca na stałe).

**B2. Inna skrzynka niż pytanie — FAIL**  
Pytanie z formularza siedzi na `leads@`. Odpowiedź Mariusza z BB włożyliśmy na `mariusz@`. Mimo identycznego `In-Reply-To` Twenty **założył nowy wątek**. Dwa razy (Dekarstwo PRO, SCTS). Te dwa maile i puste wątki **cofnięte**.

```
Formularz / leads@  ──wątek 1──  „Zapytanie: copywriting.pl…”
mariusz@ APPEND     ──wątek 2──  ta sama sprawa, osobno   ← nie skleja
copywriting@ IN+OUT ──wątek 1──  pytanie i odpowiedź razem ← skleja
```

#### Co z tego wynika (do Twojej decyzji)

1. **Import z bazy jest realny.** Data, kierunek, brak nowych kart — trzyma.
2. **Sklejanie działa tylko gdy doklejamy na tę skrzynkę, na której już leży pytanie.** C-Δ na `marta@` / `gosia@` / `copywriting@` do wątków, które handlowiec już ma w IMAP — **tak**.
3. **Odpowiedź z BB na zapytanie z formularza (`leads@`) nie wpadnie do wątku z formularza**, jeśli włożymy ją na skrzynkę handlowca. Dostaniemy drugi, „ślepy” wątek. Wkładanie historii na `leads@` **nie robimy** (auto-karty). Świadomy haczyk: przy sprawach z formularza historia OUT z BB będzie **obok**, nie w tym samym wątku — albo zostaje w BB.
4. Nie ma bezpiecznego „schowka na IMAP”. Każdy nowy folder na podpiętej skrzynce = od razu CRM. Partie po 1–2, nie 200 „na próbę”.
5. **429:** samo szukanie kandydatów w API Twenty wpadło w limit. Fala 7 tys. bez przerw znowu zatka formularz.

**Rekomendacja po dowodzie:** C-Δ **tylko same-mailbox** (brakujące Sent na skrzynce, która już ma IN). Sprawy z `leads@` / formularza — albo świadomie osobny wątek, albo nie importować OUT, zostawić BB. Nie C2/R-6, dopóki to sitko nie jest w manifeście narzędzia.

**Stempel 3.09:** przyjęte. Weekend: [`WEEKEND_CDELTA_MAIL_IMPORT.md`](./WEEKEND_CDELTA_MAIL_IMPORT.md).

---

## „Most na 3 miesiące” — połączenie z Supabase zamiast importu

Sam upływ czasu **nie wciągnie** maili, które są tylko w bazie. IMAP się nie dowie o tabeli `email_message`. Za 3 miesiące:

| Co | Czy samo się naprawi |
|---|---|
| **Nowa** korespondencja od cutoveru | **Tak.** IN wpada na skrzynkę, OUT z Twenty ląduje na IMAP. Wątek w Twenty jest kompletny. |
| Stara sprawa, klient **pisze znowu** | Nowy mail w Twenty **jest**. Dziura zostaje w **środku** wątku: odpowiedzi wysłane kiedyś z BB, tylko w Supabase. |
| Stara sprawa **cicha** | W Twenty nadal pusto. Źródło = BB / baza. |

Dlatego „poczekamy, aż wątek i tak będzie w Twenty przez IMAP” działa tylko dla **nowych** spraw. Nie zamyka R-6 i nie zamyka ProAury, jeśli tam brakuje OUT z BB.

Trzy realne mosty — żaden nie jest magią:

**A — BB jako archiwum 3 miesiące (już ustalone na cutover)**  
Handlowiec przy starej sprawie otwiera BB / szuka po `bb:`. Zero ryzyka w Twenty. Zero dowodu, że import w ogóle działa. Po 3 miesiącach pytanie wraca, a luka Sent-z-BB zostaje.

**B — leniwy APPEND (ten sam rurociąg, nie hurtem)**  
Gdy ktoś otwiera kartę albo klient pisze, wciągamy **tylko ten wątek** z Supabase (brakujące OUT). Po 3 miesiącach: sprawy żywe mają historię w Twenty; ciche zostają w BB. Stop = przestajemy doklejać. Już wciągnięte zostają (jak faza 1). To nadal import IMAP, tylko na żądanie — nie osobny „podgląd bazy”.

**C — panel „historia BB” w Owocni Mail, odczyt z Supabase**  
Cofnięcie = wyłączyć panel. Wątek **nie** wchodzi do natywnej poczty Twenty (szukajka, „Do odpisania”, sklejanie z nowym IMAP). Budujemy drugi widok poczty na 3 miesiące, a R-6 i tak kiedyś wymaga fazy 0+1. **Nie rekomendowane** jako substytut importu.

**Rekomendacja:** test wątków **zrobiony 3.09** (wynik wyżej). C-Δ tylko na skrzynkę, która już ma pytanie. Formularz/`leads@` — osobna świadoma zgoda na rozcięty wątek albo skip. Most czasowy: **A albo B**, nie C.

---

## Kiedy — 30 dni vs teraz

Runbook z 30.08: start **≥ 30 dni po cutoverze** (ankieta: czy BB jako archiwum wystarcza). Cutover = 31.08 → kalendarzowo **ok. 30.09**.

Dziś (3.09) zespół dopiero uczy się Twenty. Import w tym tygodniu = ryzyko, że awaria wygląda jak „CRM znowu coś zrobił z lejkiem”.

| | |
|---|---|
| **Czekać do ~30.09** | zgodne z runbookiem; mniej paniki; R-6 przesuwa się o ~4 tygodnie |
| **Ruszyć po preflighcie, nie czekać 30 dni** | szybciej zamyka lukę wątków; wymaga Twojego świadomego zwolnienia bramki „+30 dni” |

Niezależnie od daty: **bez PASS na 10 wątkach nie ma fali**.

---

## Prośba o decyzję

**0. Test 2–3 wątków (faza 0, potem 1) — zanim cokolwiek hurtem**

- [x] **Zrobione 3.09.** Sitko z gwiazdek obowiązywało. To nie była zgoda na C2/R-6. Wynik: sklejanie PASS na tej samej skrzynce, FAIL gdy IN = `leads@` a OUT = skrzynka handlowca.

**1. Pakiet zabezpieczeń (pkt 1–7, gwiazdki)**

- [x] **Tak — warunek startu.** Bez kompletnego sitka nie importujemy.
- [ ] **Nie** — nie importujemy w ogóle; BB zostaje archiwum do podglądu historii

**2. Kiedy (pełna fala — po teście)**

- [ ] **Czekamy ~do 30.09** (jak runbook +30 dni), potem preflight *(bezpieczniej dla zespołu)*
- [x] **Piątek 4.09 rano test 10 szt. `copywriting@`; weekend większy C-Δ same-mailbox tylko po PASS** — playbook: `WEEKEND_CDELTA_MAIL_IMPORT.md`
- [ ] **Nie teraz** — wrócimy po innym terminie: …………

**2b. Most na 3 miesiące (zamiast albo obok importu)**

- [x] **Nie** — nie budujemy panelu z Supabase. BB archiwum zostaje dla spraw z formularza / `leads@` (nie importujemy ich w C-Δ).
- [ ] **BB archiwum 3 mies.** (most A) — import tylko jeśli test PASS i wrócimy do pytań 4–5
- [ ] **Leniwy APPEND** (most B) — wciągamy wątek, gdy ktoś otwiera kartę / klient pisze; stop w każdej chwili
- [ ] **Panel historii z bazy w Owocni Mail** (most C) — świadomie drugi widok, nie natywna poczta Twenty

**3. O-5 (zakaz emisji) dla tej jednej operacji**

- [x] **Akceptuję zawężenie:** import maili = `no_emit` z konstrukcji (sitko z pkt 5), bez czekania na wyłącznik platformy.
- [ ] **Nie** — historia czeka, aż będzie prawdziwy kill-switch webhooków / `no_emit`

**4. Pierwsza fala**

- [x] **C-Δ same-mailbox** — tylko brakujące wysłane z BB na skrzynkę, która już ma pytanie
- [ ] **C-Δ także na sprawy z formularza / `leads@`** — świadomie drugi wątek obok zapytania
- [ ] **C1** — od 1.01.2026, te same karty
- [ ] **C2** — pełne wątki ~7,4 tys. od razu
- [ ] **od razu R-6** — od 1.01.2023 (najpierw nowy audyt liczby)

**5. Po udanym C-Δ / pierwszej fali**

- [ ] **Druga fala = R-6** (od 1.01.2023, te adresy / uzgodniony zbiór), po QA Marty i Gosi
- [ ] **Druga fala = C2** (pełne wątki 30-dniowych kart, także sprzed 2023 jeśli taki wątek istnieje)
- [x] **Stop po pierwszej fali** — decyzja o reszcie osobno (po QA 7.09)

**Uwagi / wyjątki:**

Weekend: pt rano test 10 (`copywriting@`). Po PASS: paki 25, C-Δ same-mailbox do wyczerpania eligible (nie C2). Auto-create off. Stop przy 429 albo nowej karcie. Nie `leads@` / `studio@`.

---

**Data decyzji:** 3.09.2026  
**Podpis:** Dawid (sitko wykonania; R-6/IMAP przyklepane wcześniej przez Mariusza)

---

## Po stemplu 3.09 — kolejność

Playbook weekendu (jedyna ścieżka apply): [`WEEKEND_CDELTA_MAIL_IMPORT.md`](./WEEKEND_CDELTA_MAIL_IMPORT.md).  
Szczegół IMAP ogólny: [`BB_MAIL_IMAP_APPEND_RUNBOOK.md`](./BB_MAIL_IMAP_APPEND_RUNBOOK.md).
