---
doc_id: CUTOVER_SESSION_SCRIPTS
title: "Cutover — skrypty sesji startowych (1:1 live)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-08-24
parent: CUTOVER_1ON1_CHECKPOINT_SHEET.md
audience: "Dawid (prowadzący) + Marta, Gosia, Maciej, Robert, Ewa"
---

# Skrypty sesji startowych — pn–wt 24–25.08

**Zasada:** 20–40 min, **ekran u handlowca** (nie Twój). Jedna sesja = potwierdzenie, że **Day-1 minimum** działa u nich. Nie feature dump.

**Wspólny ekran startowy (wszyscy):** sidebar → **Lejek Owocni** → filtr **Owner = Me** (już ustawiony). Kanban = główne miejsce pracy.

**Wspólny smoke „pass”:** każdy potwierdza na głos: *„Widzę tylko swoje leady na lejku”* + jedna czynność z listy poniżej.

---

## Co jeszcze zostało (stan 24.08)

### ✅ Zrobione technicznie

| Temat | Status |
|-------|--------|
| Lejek Owocni + Owner = Me (jeden widok, bez kopii) | ✅ |
| Pin **Lejek Owocni** w sidebarze | ✅ |
| Layout szczegółów leada (handlowe góra, techniczne dół) | ✅ |
| Maciej: widoki 📥/📤 w folderze **Poczta** | ✅ |
| Hard-assign, SQL/WON, continuity, health check | ✅ (wcześniej) |
| Skrypt sesji (ten dokument) | ✅ |

### 🔴 / 🟡 Do zrobienia przed dry-runem (cz 27)

| # | Co | Kto | Uwaga |
|---|-----|-----|--------|
| 1 | **Sesje live** — Marta ✅ · Robert ✅ · **Ewa ✅** → zostały Maciej, Gosia | **Ty** | Główny bloker = te dwie |
| 2 | Maciej: opcjonalnie **Sent** sync + test OUT z `copywriting@` | **Ty** + Maciej | 📤 puste może = nic nie wysłał |
| 3 | ~~Robert: Kanban vs taski~~ | — | ✅ sesja 24.08 (+ NEW_LEAD) |
| 4 | **Werdykt dry-run 27** | **Ty** + agent | Wt wieczór, po sesjach |
| 5 | Cleanup leadów PD Ewa/Krzysiek | — | **⏸ odłożone** — Ewa 🟢 bez cleanupu |

### ⏸ Świadomie nie teraz

KSeF/PayU · pełny dyspozytor · Calendly→Twenty · dashboard Macieja · bulk przenoszenie leadów Krzyśka.

### Filmiki (już wysłane)

V1–V5 — odwołuj się w sesji, nie nagrywaj od nowa. Maciej: V3 (SQL), V2 (maile). Marta/Gosia: V1 (widok), V2 (maile).

---

## Ogólnie z każdym — co przejść (ściąga Dawida)

**Każda sesja ma ten sam szkielet** (dopasuj czas i głębokość):

1. **Start (2 min)** — jedno zdanie: *„Twenty = lista Twoich leadów + maile od klientów. Reszty nie musisz oglądać.”*
2. **Lejek (5 min)** — sidebar **Lejek Owocni** → tylko ich karty. Klik w 1 lead → pola na górze (tel, mail, stage, produkt).
3. **Poczta (5–10 min)** — folder **Poczta** → ich widok IN. **ADR #22:** lead z formularza/`leads@` → pinned **Odpowiedz** (Owocni Mail; From = ich skrzynka). Native Reply/Send są wyłączone — nie szukamy ich.
4. **Jeden smoke na osobę (5 min)** — patrz kolumna „Must potwierdzić” poniżej.
5. **SQL/WON (2 min)** — tylko jeśli pytają: *„Filmik V3; na D1: kwota przed Wygrany.”*
6. **Zamknięcie (2 min)** — pass/fail + co zostaje w starym programie (BB/PD/Thunderbird) do cutoveru.

**Czego NIE pokazywać nikomu:** Settings, workflowy, Data Model, custom fields admin, integracje, Sortownia, OID/src „dlaczego tak jest” (chyba że pytają — wtedy 1 zdanie).

---

### Maciej · copy · 30–40 min · 🟡

| | |
|--|--|
| **Dziś pracuje w** | Thunderbird + Docs/Word; BB = przeszkoda |
| **Jego strach** | Twenty = narzędzie marketingu, nie sprzedaży; wolny UI (Firefox); utrata Thunderbirda |
| **Co pokazać** | **Lejek Owocni** (copy leady) → **Poczta → 📥/📤 Maciej** (`copywriting@`) → 1 lead (tel, mail, produkt) → gdzie odpisać |
| **Must potwierdzić** | Widzi 📥 Maciej; Lejek = tylko jego; umie wysłać test OUT (albo wie, że jeszcze nie wysyłał z tej skrzynki) |
| **Powiedzieć wprost** | Thunderbird **zostaje** backup; Workflows/Tasks = nie na D1; Twenty = jego lista copy, nie analityka |
| **Nie obiecywać** | Dashboard „co nowe 2h”, etykiety PD, pełne taski, szybkość jak Thunderbird |
| **Pass** | 📥 OK + Lejek Me + wie gdzie odpisać |

---

### Marta · 20–30 min · 🟡 (priorytet — nie otwiera Twenty)

| | |
|--|--|
| **Dziś pracuje w** | Better Bitrix; maile „wszędzie” |
| **Jej strach** | Nie widzi wszystkiego; załączniki; chaos obcych maili/testów |
| **Co pokazać** | **Lejek Owocni** (bez Roberta/testów) → **Poczta Marta** (IN/OUT) → **search tel/mail** → **notka** na leadzie → **OUT z załącznikiem** |
| **Must potwierdzić** | **Sama** znajduje klienta po telefonie, dodaje notkę, wysyła mail z załącznikiem |
| **Powiedzieć wprost** | *„Rano: Lejek + Poczta Marta. Na leads@ nie klikaj Reply — Szablon / nowa wiadomość z marta@. BB na transition.”* |
| **Nie obiecywać** | Że Twenty zastąpi 5 programów overnight |
| **Pass** | Wykona 3 smokes; mówi, że **otworzy** Twenty jutro rano |
| **Fail** | Dalej „nie otwieram” → **druga sesja jutro** (bloker cutoveru) |

---

### Gosia · 15–30 min · 🟡

| | |
|--|--|
| **Dziś pracuje w** | Better Bitrix; faktury w Firmao |
| **Jej strach** | Gubienie się — co odpisane vs czeka; obce leady na kanbanie |
| **Co pokazać** | **Lejek Owocni** (tylko Gosia) → kafelek (nazwa, kontakt, tel, mail, wartość) → **Poczta** + szablon → **przesunięcie** 1 leada między kolumnami |
| **Must potwierdzić** | *„Widzę tylko swoje”* + przesunie kartę + wie gdzie odpisać |
| **Powiedzieć wprost** | Faktury/proformy = **Firmao** (nie Twenty D1) |
| **Opcja** | Schować/archiwizować testowe leady Dawida, jeśli wciąż widać |
| **Pass** | Lejek Me + odpowiedź szablonem |

---

### Robert · 20–30 min · 🟢 ✅ 24.08

| | |
|--|--|
| **Dziś pracuje w** | Pipedrive + Thunderbird |
| **Jego strach** | Utrata **tasków PD** (priorytety, typy, Calendly→task, wszystko na 1 ekranie) |
| **Co pokazać** | **Lejek** — sprawy z PD OK? → **Maile** klienckie IN/OUT w Twenty → **decyzja Mariusza** (Kanban vs taski) → opcjonalnie **Tasks** przy leadzie |
| **Must potwierdzić** | Import PD OK; maile od klientów w Twenty; akceptuje model dnia (kanban ± taski) |
| **Powiedzieć wprost** | Maile **wewnętrzne** = Thunderbird (celowo); Calendly→Twenty = **po cutoverze** |
| **Wariant A (Kanban-first)** | *„Etap na lejku = prawda o sprzedaży. Task = przypomnienie z terminem obok leada.”* |
| **Wariant B (task-heavy)** | Pokaż Tasks + terminy — bez pełnego PD Day-1 |
| **Pass** | Zgoda na model + maile klienckie OK |

---

### Ewa · 20–30 min · 🟢 ✅ 24.08

| | |
|--|--|
| **Dziś pracuje w** | Pipedrive + Calendly; maile **thecamels** |
| **Jej strach** | Brak czasu na naukę; nie ogarnie wszystkiego w jednym CRM; chaos importu PD |
| **Co pokazać** | **Ustal scope D1** (co w Twenty vs Calendly) → **Lejek Me** → **search po telefonie** (live, ona klika) → **Poczta** thecamels → SQL/WON = filmik V3 |
| **Must potwierdzić** | Search tel działa u niej; jasna lista *„X w Twenty, Y w Calendly do [data]”* |
| **Cleanup PD/Krzysiek** | **⏸ odłożone** — nie wchodź w bulk; ewentualnie 1 zdanie: *„Stare deale Krzyśka masz na koncie z importu — posprzątamy później; na co dzień Lejek filtruje tylko Twoje.”* |
| **Pass** | Scope D1 spisany + search tel + Lejek Me |

---

## Szczegółowe agendy (minuty)

---

## Maciej · 30–40 min

**Cel:** `copywriting@` widać; Lejek = jego dzień; Thunderbird zostaje backup; nie obiecywać PD-style tasków.

**Przed sesją (Ty):**
- [ ] Settings → Accounts → `copywriting@` → **Sent** w sync (jeśli jeszcze nie)
- [ ] On ma Firefox — przygotuj opcję Chrome na bok (tylko jeśli wolno)

**Agenda:**

| min | Temat | Co pokazać / powiedzieć |
|-----|--------|-------------------------|
| 0–3 | Start | *„Twenty = główna lista copy leadów + maile copy. Thunderbird zostaje.”* |
| 3–8 | Lejek | **Lejek Owocni** → tylko jego karty. Kafelek: nazwa, kontakt, mail, tel, wartość. |
| 8–15 | Poczta | Folder **Poczta** → **📥 Maciej** / **📤 Maciej**. Otwórz 1 mail IN. |
| 15–22 | OUT | Jeśli 📤 puste: *„Albo jeszcze nic nie wysłałeś z copywriting@, albo Sent dopiero się zsynchronizuje.”* — wyślij **1 test** do siebie i odśwież. |
| 22–28 | FAQ | Tabela poniżej (#1 SQL, #2 Person, #4 Workflows, #9 tylko moje) |
| 28–35 | Lead | Wejście w 1 lead → pola na górze (tel, mail, produkt). ID OID / Src niżej — *„do audytu, nie musisz codziennie”*. |
| 35–40 | Zamknięcie | Pass/fail + co zostaje w Thunderbird (backup, załączniki, stare wątki) |

**FAQ Maciej (ściąga):**

| Pytanie | Odpowiedź (1–2 zdania) |
|---------|-------------------------|
| Kiedy SQL? | Filmik V3 + reguła firmy: SQL = potwierdzony lead handlowy, nie „częściej w leadach”. |
| Co to Person? | Osoba kontaktowa przy leadzie; często ta sama co na kafelku. |
| Dlaczego nie ma moich maili? | **Setup copywriting@** — dziś powinno być w 📥; obce skrzynki = szum, nie Twój tor. |
| Workflows / Tasks? | D1: **Lejek + maile**. Tasks opcjonalnie później. Workflows = admin. |
| Twenty = marketing? | **Nie** — tu jest sprzedaż copy; marketing czyta skutki. |
| Wolny Firefox | Spróbuj Chrome na 1 leadzie; jak OK → zostaje Firefox + backup Thunderbird. |

**Pass:** widzi 📥 Maciej + Lejek tylko swoje + rozumie gdzie odpisać.  
**Fail:** brak maili copy → wracasz do Settings Sent/sync (nie kończysz sesji „na zielono”).

---

## Marta · 20–30 min

**Cel:** przełamać „w ogóle nie otwieram Twenty”; jeden program na lead + mail + notka.

**Kontekst z ankiety:** BB = główne; chaos obcych maili/testów; strach: czy widzi **wszystko**; search tel/mail + notka z rozmowy = must.

**Agenda:**

| min | Temat | Co pokazać |
|-----|--------|------------|
| 0–3 | Obietnica | *„Jeden ekran: Lejek tylko Twoje + Poczta tylko Twoje. Reszty nie musisz oglądać.”* |
| 3–10 | Lejek | **Lejek Owocni** → Owner Me. Brak Roberta/testów na kanbanie. |
| 10–16 | Poczta | Jej widoki IN/OUT (Marta) — nie cała skrzynka firmy. |
| 16–22 | **Smoke #1** | Search: **telefon** klienta → Person/lead w kilka sekund. |
| 22–26 | **Smoke #2** | **Notka** na leadzie: „Rozmowa tel — kupi w przyszłym miesiącu”. |
| 26–28 | **Smoke #3** | OUT z **załącznikiem** (mały PDF) — jej #1 obawa. |
| 28–30 | Zamknięcie | *„Od jutra: rano Lejek + Poczta Marta. BB na transition.”* |

**Pass:** sama wykona search + notkę (+ załącznik jeśli się da).  
**Fail:** nadal „nie otwieram” → umów **drugi** krótki follow-up jutro (bloker cutoveru).

---

## Gosia · 15–30 min

**Cel:** kanban tylko moje; jasność „co czeka na mnie” vs odpisane.

**Kontekst:** BB + Firmao na faktury; chaos obcych leadów w kolumnach; chce: nazwa, kontakt, tel, mail, data, produkt.

**Agenda:**

| min | Temat | Co pokazać |
|-----|--------|------------|
| 0–3 | Lejek | **Lejek Owocni** → tylko Gosia. |
| 3–8 | Kafelek | Wskazać pola z ankiety na karcie (już są). |
| 8–14 | Maile | IN/OUT — szablon odpowiedzi (filmik V2 jeśli trzeba). |
| 14–20 | Etapy | Przesuń **1 testowy** lead między kolumnami (Nowy → Rozeznanie). |
| 20–25 | Testy | Opcja: archiwizacja / ukrycie **testowych** Opp Dawida (tylko jeśli widzi je na lejku). |
| 25–30 | Zamknięcie | Pass + faktury = Firmao (nie Twenty D1). |

**Pass:** *„Widzę tylko swoje i wiem gdzie odpisać.”*

---

## Robert · 20–30 min

**Cel:** potwierdzić PD-import OK; maile klienckie w Twenty; ustalić **Kanban vs taski** (po Mariuszu).

**Kontekst:** jedyne mocne użycie **tasków PD**; Calendly→task = później; maile wewnętrzne = Thunderbird (OK).

**Przed sesją:** masz odpowiedź Mariusza na Kanban-first vs task-first — wybierz wariant poniżej.

**Agenda:**

| min | Temat | Co pokazać |
|-----|--------|------------|
| 0–5 | Sprawy | Lejek / lista — jego otwarte z PD **wyglądają OK**? |
| 5–10 | Maile | IN/OUT od **klientów/leadów** w Twenty. *„Wewnętrzne = Thunderbird — celowo.”* |
| 10–18 | **Decyzja Mariusza** | **Wariant A (Kanban-first):** *„Etap na lejku = prawda o sprzedaży; task = przypomnienie z terminem obok leada.”* **Wariant B (task-heavy):** pokaż Tasks powiązane z Opp + terminy — bez obietnicy Calendly Day-1. |
| 18–25 | Smoke | 1 lead FB/Meta na lejku (jeśli ma) + szybki search tel/mail. |
| 25–30 | Zamknięcie | Co zostaje w PD/Calendly do końca tygodnia (jeśli cokolwiek). |

**Pass:** akceptuje model dnia (kanban ± taski) + maile klienckie OK.

---

## Ewa · 20–30 min

**Cel:** ustalić **co musi być w Twenty D1** vs Calendly/PD; uporządkować widok; search tel = ✅.

**Kontekst:** Calendly + thecamels; chaos importu PD; **search po telefonie działa** (potwierdzone).

**Agenda:**

| min | Temat | Co pokazać |
|-----|--------|------------|
| 0–5 | Zakres D1 | Lista: *„W Twenty D1: Lejek moje + maile + search tel + SQL/WON. W Calendly: spotkania do …”* — **wpisz datę cutoveru razem**. |
| 5–10 | Lejek | **Lejek Owocni** → Owner Me. |
| 10–15 | Search tel | **Live:** numer z jej realnego leada → wynik w kilka sekund. |
| 15–22 | ~~Cleanup PD~~ | **⏸ odłożone** — tylko jeśli sama pyta: import Krzyśka → Ewa z PD; posprzątamy później. |
| 22–28 | Maile | thecamels IN/OUT — jak u niej dziś. |
| 28–30 | Pass | Jedno zdanie: *„Mogę ogarnąć X w Twenty; Y zostaje w Calendly do …”* |

**Pass:** jasny scope D1 + search tel + Lejek Me (cleanup PD — później).

---

## Ewa — cleanup leadów PD (⏸ odłożone — referencja na później)

### Ważne: co było w imporcie

| Źródło w Pipedrive | Docelowy owner w Twenty (decyzja 2026-07-31) |
|--------------------|-----------------------------------------------|
| **Krzysztof Gilowski** | **Ewa Malanowska** (celowo — przejęcie toru Krzyśka) |
| Kamil, Patryk, niepowiązane | **owocni@gmail.com** (UI: „Owocni Owocni”) |
| Robert | Robert |

Ewa widzi więc **własne + historyczne Krzyśka** — to nie bug syncu, tylko **owner-map**. Jeśli ma widzieć **tylko swoje „od zera”**, trzeba **przepisać owner** albo zamknąć/archiwizować starą pulę.

### Jak rozpoznać „obce” / do przeniesienia na owocni@gmail.com

**Metoda 1 — notatka importu (najszybsza w UI)**  
Przy imporcie powstała notatka typu:  
`[Pipedrive import] deal_id=…; … owner_PD=Krzysztof Gilowski`  
→ filtruj / przeglądaj Opp owner=Ewa z taką notką.

**Metoda 2 — pola na leadzie**  
- `Src System` = **PIPEDRIVE_LEGACY**  
- `Pipedrive ID` wypełnione  
- `Źródło` = **PIPEDRIVE_IMPORT**

**Metoda 3 — staging (pewna, bulk)**  
W eksporcie PD (`integrations/pipedrive-staging/…/deals.json`) każdy deal ma `owner_id` → mapa w `owner_map.json`.  
Lista `pipedriveId` gdzie PD owner = Krzysiek → bulk `update owner` w Twenty na `2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d` (Owocni Owocni).

### Co zrobić praktycznie (propozycja)

1. **Sesja z Ewą:** pokaż 5–10 leadów Krzyśka — *„Te operacyjnie przejmujesz, czy idą na konto ogólne?”*  
2. **Jeśli ogólne:** bulk owner → **Owocni Owocni** (`owocni@gmail.com`).  
3. **Zamknięte / stare >3 lata:** opcjonalnie stage LOST lub archiwum (bez kasowania).  
4. **Na co dzień:** Lejek + Owner Me — po cleanupie zostaje tylko to, co jej zostawicie.

**Nie mylić:** Account Owner (continuity) ≠ Owner leada. Przenosimy **Owner** (kto pracuje na lejku).

### Search po telefonie

Tak — chodzi o **global search / People → phones** i szybkie trafienie w Person/Opp. Skoro u Ciebie działa, na sesji **Ewa robi to sama** na swoim numerze.

---

## Maciej — 📤 puste (copywriting@)

**Tak — możliwe, że nic nie wysłał z `copywriting@`.**  
API pokazało **0 OUT** z `COPYWRITING`. To nie musi być błąd syncu.

**Rozróżnij na sesji:**
1. **Nigdy nie wysyłał z copywriting@** → 📤 puste = OK; test jednym mailem OUT.  
2. **Wysyłał z Gmail/Thunderbird z copywriting@** → włącz **Sent** w Twenty Accounts i poczekaj na backfill.

---

## Karta pass/fail po sesjach (do szybkiego wypełnienia)

**Jak używać:** po każdej sesji wpisz 1–2 słowa na pole. Ma zająć max 30–60 sekund na osobę.

| Osoba | Termin sesji | Lejek Owocni | Tylko moje | Maile IN | Maile OUT | Smoke specjalny | Stary program zostaje do kiedy | Status | 1 główny bloker / next |
|-------|--------------|--------------|------------|----------|-----------|------------------|-------------------------------|--------|------------------------|
| Maciej | | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ / n.d. | test OUT `copywriting@` | Thunderbird do: ___ | 🟢 / 🟡 / 🔴 | |
| Marta | | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | tel + notka + załącznik | BB do: ___ | 🟢 / 🟡 / 🔴 | |
| Gosia | | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | ✅ / ❌ | przesunięcie etapu | BB/Firmao do: ___ | 🟢 / 🟡 / 🔴 | |
| Robert | **24.08** | ✅ | ✅ | ✅ | ✅ | kanban vs taski (+ typ Nowy lead) | PD/Thunderbird transition | **🟢** | taskType Nowy lead + due+1h ✅ |
| Ewa | **24.08** | ✅ | ✅ Me | ✅ | ✅ | search tel + scope D1 ✅ | PD/Calendly transition OK | **🟢** | brak — rozumie, zero próśb |

**Skrót statusów:**
- **🟢** = może jutro pracować w Twenty w swoim torze
- **🟡** = działa częściowo, ale trzeba domknąć 1 rzecz
- **🔴** = bez kolejnej poprawki / sesji nie ruszy

### Minimalny PASS per osoba

| Osoba | Minimalny PASS |
|-------|----------------|
| Maciej | widzi `📥 Maciej`, rozumie Lejek Me, wie skąd odpisuje |
| Marta | sama robi search tel, notkę i 1 OUT |
| Gosia | widzi tylko swoje i przesuwa kartę bez chaosu |
| Robert | akceptuje model dnia (kanban ± taski) i maile klienckie OK |
| Ewa | search tel działa u niej + uzgodniony scope D1 vs Calendly |

---

## Checklist po wszystkich sesjach (wt wieczór)

| Osoba | Lejek Me | Maile | Smoke specjalny | Status |
|-------|----------|-------|-----------------|--------|
| Maciej | | 📥/📤 | test OUT copywriting@ | |
| Marta | | | tel + notka + załącznik | |
| Gosia | | | przesunięcie etapu | |
| Robert | ✅ | ✅ klienci | kanban vs taski (Mariusz) + NEW_LEAD | **🟢** |
| Ewa | ✅ | ✅ | tel + scope D1 (cleanup ⏸) | **🟢** |

**Werdykt dry-run 27.08:** tak / nie / warunkowo — wpisz w `CUTOVER_1ON1_CHECKPOINT_SHEET.md` §D krok 7.

---

## Szablon decyzji — dry-run 27.08

**Kiedy wypełnić:** wt wieczór po sesjach albo śr rano.  
**Cel:** jednym okiem zobaczyć, czy czwartek ma sens.

### Wariant decyzji

| Werdykt | Kiedy użyć |
|---------|------------|
| **TAK** | Wszyscy kluczowi użytkownicy przeszli swój tor i nie mają czerwonych blockerów |
| **WARUNKOWO** | 1–2 rzeczy są jeszcze otwarte, ale mają właściciela i datę domknięcia przed czwartkiem |
| **NIE** | Jest czerwony bloker u osoby krytycznej albo niepewność, czy ktoś w ogóle może pracować tylko w Twenty |

### Bramka decyzyjna

| Obszar | Pytanie | PASS | Status | Notatka |
|--------|---------|------|--------|---------|
| Maciej | Czy maile copy działają i wie, skąd odpisuje? | 📥 + test OUT / świadome n.d. | | |
| Marta | Czy umie znaleźć lead i odpisać bez BB? | search + notka + OUT | | |
| Gosia | Czy ma czytelny kanban „tylko moje”? | Lejek Me + etap + mail | | |
| Robert | Czy akceptuje model pracy po decyzji Mariusza? | kanban/taski ustalone | **🟢** | sesja 24.08 + NEW_LEAD |
| Ewa | Czy ma jasny zakres D1 i działa search tel? | scope + tel | **🟢** | sesja 24.08 — rozumie, zero pytań |
| D1-1 | Maile handlowców + leads@ | brak czerwonych | | |
| D1-4 | Ewa może „śmigać” na swoim minimum | brak czerwonych | **🟢** | cleanup Krzyśka ⏸ |
| D1-8 | Każdy ma użyteczny widok roboczy | potwierdzone na 1:1 | | |

### Krótka notka do Mariusza / dla siebie

**Opcja A — TAK**

> Dry-run 27.08: **TAK**.  
> Wszyscy kluczowi użytkownicy przeszli swój tor D1. Otwarte rzeczy nie blokują pracy (zostają jako follow-up po dry-runie).

**Opcja B — WARUNKOWO**

> Dry-run 27.08: **WARUNKOWO**.  
> Rdzeń działa, ale przed czwartkiem trzeba jeszcze domknąć:  
> 1. ___  
> 2. ___  
> Właściciele: ___ / ___.

**Opcja C — NIE**

> Dry-run 27.08: **NIE**.  
> Są czerwone blokery, które uniemożliwiają uczciwy test pracy tylko w Twenty:  
> 1. ___  
> 2. ___  
> Propozycja: przesunąć dry-run i domknąć najpierw ___.

### Najczęstsze powody „WARUNKOWO”

- Maciej nadal nie widzi sensownie OUT / Sent
- Marta po sesji nadal nie otwiera Twenty sama
- Robert nie kupuje modelu kanban/taski
- Ewa nie ma ustalonego zakresu D1 vs Calendly

### Co po decyzji

| Jeśli wynik | Co robisz dalej |
|-------------|------------------|
| **TAK** | Wysyłasz krótki plan na czwartek + kto pracuje już tylko w Twenty |
| **WARUNKOWO** | Lista 1–2 rzeczy do domknięcia do środy, bez otwierania nowych tematów |
| **NIE** | Krótka lista blockerów + nowy termin / checkpoint |
