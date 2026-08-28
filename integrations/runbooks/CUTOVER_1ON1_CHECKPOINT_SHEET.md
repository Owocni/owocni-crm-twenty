---
doc_id: CUTOVER_1ON1_CHECKPOINT_SHEET
title: "Cutover — arkusz 1:1 + checkpoint pt 21 VIII"
layer: runbook
status: active — living checklist
owner: "Dawid"
last_verified: 2026-08-24
parent: CUTOVER_TWENTY_TEAM_PLAN.md
---

# Arkusz: 1:1 + checkpoint pt 21 VIII

**Rola tego pliku:** dziennik postępu (pytania, scorecard, odhaczenia).  
**Plan / kontekst:** [CUTOVER_TWENTY_TEAM_PLAN.md](./CUTOVER_TWENTY_TEAM_PLAN.md) — nie edytuj tam statusów smoke’ów.

**Na rozmowie / w ankiecie:** te 7 pytań. Scorecard D1 = ściąga na piątek, nie skrypt dla handlowca.

Czas: **20–30 min**. Cel: czy osoba już może pracować w Twenty, a jeśli nie — **jeden konkretny bloker**.

Legenda statusu: 🟢 mogę pracować / 🟡 częściowo / 🔴 nie dam rady bez pomocy.

---

## Skrypt 1:1 — 7 pytań (mówisz to wprost)

Na start (1 zdanie):  
*„Chcemy do końca miesiąca przejść w pełni na Twenty. Te kilka pytań ma sprawdzić, czy już możesz tu normalnie pracować i czego Ci brakuje.”*

| # | Pytanie (mówisz tak) | Po co pytasz | Co zanotować |
|---|----------------------|--------------|--------------|
| **1** | **Gdzie dziś ogarniasz leady, maile i follow-upy?** Better Bitrix, Pipedrive, Twenty, czy mieszanka? | Czy już siedzi w Twenty, czy jeszcze w starym systemie. | BB / PD / Twenty / mix |
| **2** | **Gdybyś jutro rano miała/miał domknąć jedną sprzedaż — co dokładnie musisz zrobić?** (napisać, zadzwonić, wysłać ofertę, wystawić…) | Czy krytyczna praca dnia jest możliwa w Twenty. | 1–2 czynności „must” |
| **3** | **Otwórz proszę Twenty — widzisz swoje otwarte sprawy / klientów, nad którymi pracujesz?** | Czy dane są na miejscu (import / przydział). | tak / nie / częściowo + przykład |
| **4** | **Pokaż mi krótko (albo powiedz), czy umiesz:** znaleźć lead, przesunąć etap, potwierdzić SQL („to jest lead kwalifikowany”), zamknąć wygraną z kwotą. | Czy zna podstawowy flow sprzedaży w Twenty. | co umie / czego nie |
| **5** | **Czy na Twojej skrzynce w Twenty przychodzą maile i możesz odpisać tak, że klient dostaje odpowiedź?** | Maile = najczęściej czerwone. | IN OK? OUT OK? |
| **6** | **Co Cię najbardziej niepokoi, jak wyłączymy stary system?** | Strach = realny bloker albo potrzeba video/szkolenia. | 1 zdanie obawy |
| **7** | **Gdybyś miała/miał jedną listę „moje sprawy na dziś” — co chcesz na niej widzieć, a czego nie chcesz oglądać?** | Widok roboczy (bez ściany pustych pól). | „chcę X / ukryć Y” |

Na koniec (1 zdanie):  
*„Dzięki. Z tego, co mówisz, status na piątek to 🟢 / 🟡 / 🔴, a największa rzecz do poprawy to: ___.”*  
Zapisz to od razu w macierzy poniżej.

**Czego nie robisz na 1:1 / w ankiecie:** nie tłumaczysz Fakturowni, PayU, dyspozytora, continuity, ani scorecardu D1-1…D1-8.

**Pyt. 4 (SQL / stage / WON):** świadomie **pominięte w ankiecie** — zespół dostał filmiki „jak to się robi”. Nie trzeba powtarzać dema 1:1 z każdym. Weryfikacja = krótki smoke przy sesji widoków / dry-run 27, nie osobne spotkanie „na SQL”.

---

## A. Macierz po 1:1 (wypełniasz Ty)

| Osoba | Data 1:1 | Gdzie dziś (pyt. 1) | Maile (5) | Widzi sprawy (3) | Flow SQL/WON (4) | Widok (7) | Status | Bloker / next |
|-------|----------|--------------------|-----------|------------------|------------------|-----------|--------|---------------|
| Marta | **24.08 sesja live** (+ ankieta 21.08) | **BB** (PD nie używa) | 🟡 widzi Poczta · **OUT/Reply 🔴** (skrzynka tylko na koncie głównym) | ✅ Lejek Owocni / Me OK | ✅ video | Lejek + Poczta OK · reszta wyjaśniona | **🟡** | **P0:** Marta loguje się **jako Marta** → Settings → Accounts → podpiąć `marta@` |
| Gosia | 20.08 (ankieta) | **BB** | ✅ OK | 🟡 chaos (nie „moje”) | ✅ video | ✅ lista pól | **🟡** | Widok tylko moje + cleanup kanbanu |
| Maciej | 21.08 (ankieta) | **Thunderbird + Docs/Word/notatki** (BB = przeszkoda) | 🟡 widoki 📥/📤 Maciej ✅ (24.08) · sprawdzić Sent | 🟡 częściowo (UI: tekst/godzina/dropdowny) | ✅ video | ukryć ID/src/OID; „co nowe” + taski dziś | **🟡** | Sesja FAQ + potwierdź że widzi 📥; **Sent folder** jeśli 📤 puste |
| Robert | **24.08 sesja live** (+ ankieta 21.08) | **PD + Thunderbird** | ✅ (tylko klienci/leady) | ✅ sprawy OK | ✅ video | pola OK · taski OK | **🟢** | NEW_LEAD + due+1h ✅; Calendly później |
| Ewa | **24.08 sesja live** (+ ankieta 21.08) | **PD + Calendly + thecamels** | ✅ OK | 🟡 częściowo (import Krzyśka — ⏸ cleanup później) | ✅ video | elastyczna | **🟢** | Sesja OK — rozumie, bez próśb; cleanup PD później |
| Maja | n/a | faktury później | — | — | — | — | n/a | po cutoverze |

### Notatki — Marta (21.08 ankieta → 24.08 sesja live)

- **Dzień pracy:** głównie **crm.owocni.pl (BB)**; maile czasem szuka „wszędzie” (bez Pipedrive — ten ma Robert).
- **Sesja 24.08:** reszta flow **OK / wyjaśniona**. Znalezione 4 problemy (patrz niżej).
- **Maile (D1-1) po sesji:** podgląd w **Poczta** ✅, ale **nie może odpisywać / pisać do leada** — wszystkie skrzynki wiszą na **koncie głównym** (`owocni@…`), nie na koncie Marty. Sync ≠ send: Reply wymaga skrzynki podpiętej **pod zalogowanego użytkownika**.
- **UX create (zgłoszone 24.08):** zadanie bez domyślnego assignee; lead bez domyślnego Owner; `lastContactAt` nie wypełnia się przy create.

**Fix techniczny (Agent 24.08):**
1. Workflow **`Opp Create Owner Me v1`** ACTIVE — `opportunity.created` + Owner pusty → `createdBy`; `lastContactAt` = `createdAt` + label `Godzin: 0` (nie nadpisuje Owner gdy routing/createLead już ustawił).
2. Workflow **`Task Create Assignee Me v1`** ACTIVE — `task.created` + Assignee pusty → `createdBy`.
3. Metadata: `lastContactAt` defaultValue `now` (wcześniej w sesji).

**Next (Dawid — operacyjnie, P0 maile):**
1. ~~Marta podpięła `marta@`~~ ✅ · odłączone z konta głównego ✅
2. **ADR #22 override:** smoke — lead z `leads@` (np. Strona · Dawiddd) → pinned **Odpowiedz** (= Owocni Mail; native Reply/Send wyłączone) → pusty edytor, From = `marta@` → Wyślij
3. Sync app Owocni Mail (`cd apps/owocni-mail-twenty && yarn twenty apply`) — v0.1.46 musi być live na workspace
4. To samo przeniesienie skrzynek: Gosia / Maciej / …

### Notatki — Gosia (20.08)

- **Dzień pracy:** nadal Better Bitrix.
- **Must jutro:** odpis szablonem → po akceptacji proforma/faktura (Firmao) + ew. umowa PDF. *(Faktury = tor później; na D1 wystarczy wiedzieć, że w Twenty ma odpisać.)*
- **Kanban:** w Nowych leady już odpisane w BB + obce; w Rozeznaniu leady Roberta; dalej testy Dawida → **prosi o wyczyszczenie / „tylko moje”**.
- **Maile:** widzi IN/OUT ✅.
- **Strach:** gubienie się — co odpisane vs czeka.
- **Pola na karcie / liście:** nazwa leada, imię i nazwisko, telefon, mail, data leada, produkt.
- **Pyt. 4 (SQL/WON):** pominięte w ankiecie — **filmiki** (OK).

**Next (Dawid):** 15–30 min z Gosią — widok „Gosia — moje dziś” (owner=Gosia, bez cudzych/testów); opcjonalnie schować/archiwizować testowe Opp. SQL tylko jeśli przy okazji utknie.

### Notatki — Maciej (21.08)

- **Dzień pracy:** **Thunderbird + Google Docs / Word / notatki**. BB („LepszyBitrix”) = przeszkoda; Novedo = biurokracja. **Bez Pipedrive** (nigdy nie używał).
- **Must jutro (oczekiwania vs Twenty):** widać co nowe w ostatnich 1–2 h vs kontynuacja; etykiety / przypominajki / statusy; dashboard „tu i teraz / najbliższe godziny”; w trakcie rozmowy — szukanie po 1 słowie kluczowym + miejsce na negocjacje/rabat. **Przekonanie:** Twenty = narzędzie dla optymalizacji firmy / marketingu / analityki, **nie dla handlowca** (mało siedział w BB; sprzedaje copy).
- **Dane:** **częściowo** — UI frustruje: za duży tekst (nie mieści się), **brak godziny wejścia leada**, półprzezroczyste dropdowny zasłaniają treść.
- **Maile (D1-1):** 🔴 **nie widzi** skrzynki **`copywriting@owocni.pl`** (ani swoich maili `maciej@` w poczcie). Widzi maile **innych** osób → szum. Podgląd maila po kliknięciu często nie działa / wolno (Firefox, Win11, kabel); po paru leadach podglądy znikają.
- **Strach:** powtórka BB (koszt + spowolnienie sprzedaży procedurami); wdrożenie miesięcy bez zysku „szybciej/drożej vs Thunderbird×Excel”. Chce **zapas** = zwykły klient poczty / webmail na te same skrzynki.
- **Widok:** **ukryć** rzeczy niehandlowe (ID, src, orkiestracja, temperatura, OID…). Chce graficznie: co się działo od wyjścia, zadania na dziś, (nice) podsumowanie stanu leada.
- **Pyt. 4 (SQL/WON):** pominięte w ankiecie — filmiki; **sam dopytuje definicję SQL** (FAQ #1 poniżej).
- **Propozycja rolloutu od niego:** najpierw fikcyjne leady / mniej pól → potem tylko logo → potem drogie (strony). Zasada: wywalaj, nie dokladaj.

**FAQ Macieja → odpowiedzi / next (ściąga na sesję, nie Day-1 feature dump):**

| # | Pytanie | Kierunek odpowiedzi / akcja |
|---|---------|-----------------------------|
| 1 | Kiedy SQL? | Filmik V3 + 1 zdanie reguły firmy (nie „częściej w leadach”) |
| 2 | Co to Person? | Kontakt/osoba; w UI często „People” / rekord osoby przy Opp |
| 3 | Dlaczego nie ma mych maili / `maciej@`? | **Bug/setup** — podpiąć `copywriting@` (+ aliasy); obce skrzynki = szum D1-8 |
| 4 | Uczestnicy / Workflows / Tasks? | Na D1: **nie zaglądasz** (oprócz Tasks opcjonalnie); reszta admin |
| 5 | Twenty = kampanie/AI nie sprzedaż? | **Nie** — SoR sprzedaży; marketing czyta skutki, nie odwrotnie |
| 6 | Wolny UI / brak podglądu maila (Firefox Win) | Sprawdzić sync + przeglądarkę (Chrome smoke); nie obiecywać „jak na filmie” |
| 7 | Wszystkie maile od/do klienta + załączniki | Timeline na Person/Opp; Thunderbird zostaje backup |
| 8 | Numer = obsługa vs sprzedaż (statystyki rozmów) | Po cutoverze / osobny tor telefonów — nie D1 |
| 9 | Poczta wielu osób | To samo co Marta/Gosia — **filtr tylko moje** |
| 10 | Mac vs Win / inne przyciski | Smoke na jego Firefox; nie wymagać Maca |
| 11 | Przekazywanie leadów / stopka / autoresponder | Owner change = tak (MVP); stopka/autoresponder = poczta Google, nie Twenty Day-1 |
| 12 | Skórki / kolory / etykiety UX | Widoki + (opc.) taski; pełny UX poczty = Thunderbird backup |

**Next (Dawid) — kolejność:**
1. ~~P0: podpiąć `copywriting@`~~ → **DONE** (user) + widoki **📥 Maciej** / **📤 Maciej** (24.08).
2. **Ty:** Settings → Accounts → `copywriting@` → folder **Sent** w sync + Visibility = All Email Content (📤 jest teraz puste: 0 maili `COPYWRITING`+`OUTGOING`).
3. ~~Przeciągnij widoki do folderu **Poczta**~~ → **DONE 24.08** (Metadata API: pin 📥/📤 Maciej w Poczta).
4. Sesja 30–40 min: FAQ #1–5 + #7 + potwierdź że widzi 📥.
5. Smoke wydajności Firefox vs Chrome.

### Notatki — Ewa (21.08 ankieta → 24.08 sesja)

- **Dzień pracy:** leady = **Pipedrive + Calendly**; maile = skrzynka **thecamels** (nie Thunderbird).
- **Must jutro (ankieta):** „zależy od klienta” — wcześniej nie widziała pełnego „tylko Twenty”; wymagało sesji zakresu D1.
- **Dane:** częściowo widzi swoje sprawy; **zamieszanie** — import z Pipedrive Krzyśka (owner-map celowy; cleanup ⏸).
- **Maile:** widzi IN/OUT ✅.
- **Strach (ankieta):** brak czasu na naukę + debug.
- **Widok / search:** chciała skuteczne wyszukiwanie po numerze telefonu.
- **Pyt. 4 (SQL/WON):** pominięte — filmiki (OK).
- **Sesja 24.08:** **wszystko rozumie**, **zero dodatkowych próśb / pytań** — może pracować. Cleanup importu PD Krzyśka zostaje na później (nie bloker sesji).

**Next (Dawid):**
1. ✅ Sesja live 24.08 — PASS (scope + zrozumienie).
2. ⏸ Cleanup / filtr „tylko Ewa” vs tor Krzyśka — później (nie Day-1 blocker).
3. Search tel — potwierdzone na sesji / wcześniej; bez nowych zgłoszeń.

### Notatki — Robert (21.08 ankieta → 24.08 sesja)

- **Dzień pracy:** **Pipedrive + Thunderbird** (maile jeszcze poza Twenty).
- **Must jutro:** pisać może w Thunderbird; widzi, że w Twenty da się robić **własne szablony**.
- **Dane (D1-5):** otwarte sprawy **wyglądają OK** ✅.
- **Maile (D1-1):** widzi maile; brakujące po 15:47 to **prawdopodobnie wewnętrzne** (nie od klientów/leadów) — Twenty ich nie bierze pod uwagę. Robert sam to zasugerował. **Nie traktować jako sync-bug** — na D1: OK jeśli IN/OUT od klientów/leadów działa; Thunderbird zostaje na wewnętrzne.
- **Strach / bloker #1:** utrata wygody **zadań w PD**:
  - priorytety + typy (pierwszy telefon / FU / oferta / video),
  - nazwa zadania + ikona typu,
  - wszystko o kliencie na jednym ekranie zadania (bez zakładek),
  - kalendarz: zadanie z terminem + gość + busy w paru klikach,
  - **Calendly → auto task w PD** (bez tego ręczne przeklepywanie).
  - Boi się więcej przeklikiwania vs seamless PD.
- **Pola ważne:** telefon, mail, źródło, data utworzenia, produkt (+ wartość / co wziął), kontakt, stage.
- **Pyt. 4 (SQL/WON):** pominięte — filmiki (OK).
- **Pyt. 7:** „nie rozumiem” — ale pola wypisał (wyżej).
- **Sesja 24.08:** poza jednym życzeniem — **jasne, gotowy pracować**. Prośba: przy nowym leadzie zadanie od razu z typem **Nowy lead** + **due date ≈ +1h** (później realny SLA z rozdzielania).

**Komentarz Dawida (proces — do decyzji z Mariuszem):**
- Robert jest **jedyny**, który mocno opiera dzień na **taskach** (reszta = kanban/maile).
- W Twenty taski **już są**: powiązanie z leadem, termin, status; da się rozbudować o kategorie/typy.
- Pytanie strategiczne: czy od sprzedawców wymagamy przede wszystkim ruchu po **Kanbanie** (etapy = potencjał sprzedaży decyduje system/proces), a nie żeby handlowiec sam „batchował” pracę w taskach jak w PD?
- Propozycja D1: **Kanban = SoR dnia sprzedaży**; taski u Roberta = opcjonalny overlay (termin/FU), bez obiecywania pełnego PD+Calendly Day-1. Kategorie tasków = nice, nie blocker cutoveru.

**Next (Dawid):**
1. (Opcja) 1 zdanie do Roberta: maile w Twenty = klienci/leady; wewnętrzne = Thunderbird.
2. ✅ **24.08:** `taskType=NEW_LEAD` + `dueAt=now+1h` w workflowach form/mail notify (v4 / v2).
3. Ustalenie z Mariuszem: Kanban-first vs task-first → sesja tasków obok kanbanu.
4. Calendly→Twenty = **nie Day-1**.
5. Później: podmienić +1h na realny czas z rozdzielania leadów.

---

## B. Scorecard D1 — tylko na checkpoint pt 21 (Twoja ściąga)

Nie czytaj tego handlowcom. To checklista „czy system jest gotowy”, uzupełniasz po 1:1 + smoke’ach.

| ID | Po ludzku: co musi działać | Status | Kto naprawia | Do kiedy |
|----|----------------------------|--------|--------------|----------|
| D1-1 | Maile handlowców + leads@ — widać i da się odpisać | 🟡 **ADR #22 override:** pinned **Odpowiedz** = Owocni Mail; native Reply/Send wyłączone · Marta: skrzynka ✅ · smoke Odpowiedz na leadzie z `leads@` ⏳ · Maciej Sent? | Dawid + handlowcy | ≤ 26.08 |
| D1-2 | Lead z formularza wpada do właściwej osoby | 🟢 smoke OK 20.08 | — | — |
| D1-3 | Lead z Facebooka wpada do Roberta | 🟢 smoke OK 20.08 | — | — |
| D1-4 | Sprawy Ewy z Pipedrive są w Twenty | 🟢 sesja 24.08 PASS · dane w Twenty · cleanup Krzyśka ⏸ później | — | — |
| D1-5 | Sprawy Roberta z Pipedrive są w Twenty | 🟢 Robert: „wygląda OK” | — | — |
| D1-6 | SQL / wygrana / przegrana / odrzucenie — bez kombinowania | 🟢 smoke OK · **najpierw kwota, potem WON** | — | — |
| D1-7 | Nowe leady rozdzielają się sensownie (Marta/Gosia, copy→Maciej, FB→Robert) | 🟢 smoke OK 20.08 | — | — |
| D1-8 | Każdy ma użyteczny widok (nie ściana pustych pól) | 🟡→🟢 layout szczegółów + Lejek/Me (24.08) · smoke przy sesjach · Robert = task vs kanban | Dawid (+ Mariusz) | ≤ 26.08 |

Już załatwione (nie wraca na rozmowy): Continuity / Account Owner ✅.

---

## B2. Status techniczny Dawida (uzupełnij sam — nie z pytań do ludzi)

To jest **Twoja** ściąga „co jest gotowe w systemie”. Nie myl z odpowiedziami handlowców.

### Gotowe (możesz odhaczyć teraz)

| Temat | Status | Uwaga |
|-------|--------|--------|
| GUS / dane rejestrowe firmy | ✅ | workflow „Uzupełnij dane (GUS/KRS)” |
| Szablony emaili | ✅ | |
| Scalanie leadów | ✅ | merge MVP |
| Continuity / Account Owner | ✅ | worker ON + AO v13 |
| Opp/Task create → Owner/Assignee Me | ✅ | workflowy `Opp Create Owner Me v1` + `Task Create Assignee Me v1` (24.08) |
| lastContactAt na create leada | ✅ | field default `now` + workflow ustawia gdy Owner był pusty |
| Poranny system health check | ✅ | CF `system-health-check` + digest ~08:00 — szczegóły w planie §7b |
| create_lead (formularz → Twenty) | ✅ tech | D1-2 i tak wymaga 1 smoke’a z Martą/Gosią |
| SQL workflow (Przyjmij jako SQL) | ✅ tech | D1-6: potwierdzenie z handlowcem |
| Przydział hard-assign (hash / COPY / FB) | ✅ tech | D1-7: 3 scenariusze smoke |
| Odrzucenie / guard | ✅ tech | |

### Czeka na Ciebie (nie na odpowiedzi z pytań)

| Temat | Co zrobić | Status |
|-------|-----------|--------|
| **Video V2 → V3 → V1** | 4 filmiki wysłane — dopięte (20.08) | ✅ |
| **D1-2 smoke** | 1 lead testowy z formularza | ✅ |
| **D1-3 smoke** | 1 lead FB → Robert | ✅ |
| **D1-7 smoke** | 3 scenariusze: hash / COPY / FB | ✅ |
| **D1-6 smoke** | SQL + WON z kwotą — **kolejność: najpierw kwota, potem WON** | ✅ |
| Import PD Ewa (D1-4) | Sesja 24.08 ✅ · cleanup Krzyśka ⏸ | 🟢 |
| Import PD Robert (D1-5) | Robert: sprawy OK | ✅ |
| Maile `leads@` + skrzynki (D1-1) | Sync na koncie głównym ✅ · **Reply = skrzynka na koncie użytkownika** (Marta 24.08) | ⏳ per-osoba Accounts |

### Czeka na odpowiedzi ludzi (pytania już poszły)

| Temat | Skąd wiesz | Status |
|-------|------------|--------|
| D1-1 maile per osoba | odpowiedzi na pyt. 5 | ✅ wszyscy (Maciej = 🔴 setup) |
| D1-8 widok „używam” | odpowiedzi na pyt. 7 + 3 | ✅ odpowiedzi; widoki do zrobienia ≤26 |
| Status 🟢🟡🔴 per osoba | sesje 24.08 | ✅ **Ewa / Robert 🟢** · Marta/Gosia/Maciej 🟡 |
| Bloker #1 per osoba | pyt. 6 + braki w 3–5 | ✅ w notatkach |

### Świadomie później (nie uzupełniasz pod cutover)

| Temat | Kiedy |
|-------|--------|
| Fakturownia / PayU | **PayU ✅ skonfigurowane**; przycisk zapłaty ❌ — **brak KSeF** (wymóg Fakturowni dla kont po 15.04.2026). Dalej: KSeF + userzy. Szczegóły: plan §7 |
| Pełny dyspozytor („Biorę”, zegar…) | po cutoverze (opcjonalnie wcześniej) |
| Video V6 faktury | z Mają później |

---

## C. Piątek 21 VIII — 30–45 min z Mariuszem

1. Po osobie: status 🟢🟡🔴 + **jeden** bloker (2 min).
2. Scorecard D1: czerwone → kto + data (max środa 26).
3. Czy dry-run w czwartek 27 jest realny?
4. Filmiki: **już wysłane** (Obsługa leadów, Kanban, Skrzynki, Rozmowy, Szablony) — nie blokuje.

Wzór wpisu: *„Marta 🔴 — nie wie jak odpisywać z Twenty → filmik skrzynek + 15 min na żywo.”*

---

## D. Plan Pn 24 – Wt 25 VIII (naprawy przed dry-runem 27)

**Cel do wtorku wieczór:** Maciej ma maile; każdy ma widok „tylko moje”; przynajmniej 2–3 sesje startowe zrobione; wiadomo czy Cz 27 dry-run jest realny.

| # | Krok | Kto | Kiedy |
|---|------|-----|-------|
| **0** | Od Mariusza (async OK): Kanban-first vs taski (Robert); zakres Ewy D1; czy trzymamy dry-run 27 | **Ty → Mariusz** | Pn rano |
| **1** | Diagnoza: czy `copywriting@` w ogóle podpięte / pod kim / sync | Agent + **Ty** (Settings→Accounts w Twenty) | Pn przed południem |
| **2** | **P0:** podpiąć / naprawić sync `copywriting@` → smoke IN u Macieja | **Ty** (IMAP z `.env` / OAuth) · Agent: checklist + weryfikacja po syncu | Pn |
| **3** | ~~Widoki „X — moje dziś”~~ → **DONE 24.08:** jeden **Lejek Owocni** + filtr **Owner = Me** (już był); pin sidebara **Lejek Owocni**; OBJECT „Wszystkie leady” niżej. Szczegóły leada: pola handlowe na górze, ukryte ID/src/OID/orkiestracja/temperatura | Agent | ✅ Pn |
| **4** | Cleanup / filtr Ewy (bez obcych z importu Krzyśka) + smoke search po telefonie | Agent: diagnostyka danych · **Ty:** decyzja co archiwizować + sesja z Ewą | Pn–Wt |
| **5** | Sesje live: **Marta ✅** · **Robert ✅** · **Ewa ✅ 24.08** → Maciej / Gosia | **Ty** · Agent: docs + defaults | Pn–Wt |
| **6** | Robert: 1 zdanie „Kanban = SoR; taski = overlay” (po decyzji Mariusza) | **Ty** | Wt |
| **7** | Update arkusza: status osób + D1-1/D1-8 + werdykt „dry-run 27: tak/nie/warunkowo” | Agent po Twoim feedzie | Wt wieczór |

**Legenda:** Agent = ja w Cursorze (diagnoza, docs, widoki/API, smoke po fakcie). **Ty** = logowanie do Twenty Settings, podpinanie skrzynek, rozmowy z ludźmi, kliknięcia OAuth.

**Świadomie nie robimy Pn–Wt:** KSeF/PayU, pełny dyspozytor, Calendly→Twenty, dashboard AI Macieja.
