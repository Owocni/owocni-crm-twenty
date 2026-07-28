---
doc_id: E12_5_MAIL_DIRECTION_VIEWS
title: "E12.5 — Poczta Otrzymane / Wysłane w Twenty: materializacja kierunku na Message"
layer: runbook
status: active
version: "2.5"
supersedes: "2.4 · 2.3 · 2.2 · 2.1 · 2.0 · 1.0"
edit_scope: content_and_structure
owner: "Dawid"
last_verified: 2026-07-28
recheck_trigger: "Twenty release / zmiana modelu messaging / zmiana visibility lub folderów którejkolwiek skrzynki / podłączenie skrzynki spoza owocni.pl / zmiana rate limitów lub cennika credits / natywne pole direction na Message / zmiana mapowania operandu CONTAINS"
default_trust: D:VERIFIED
related:
  - E12_EMAIL_SYNC_EXECUTION
  - KANBAN_CARD_SPEC
  - DATA_MODEL
  - OPS_NOTES
  - EVENT_CONTRACT
  - DECISION_REGISTER
---

# E12.5 — Poczta Otrzymane / Wysłane w Twenty

> **Status: wdrożone na sandbox 2026-07-28.** Reguła kierunku §5.2 = `[D:CORE]` (ADR #19).
> Backstop Kanbana (Z1/Z2) — **nie** zamiennik klienta poczty. Zero custom app.

---

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** sposobie zbudowania widoków „Otrzymane / Wysłane"; regule kierunku dla maila widzianego przez wiele naszych skrzynek; kontrakcie writera (backfill) i mechanizmu dla nowych maili.

**Ten plik NIE decyduje o:** semantyce eventów (→ `EVENT_CONTRACT`), tożsamości (→ `IDENTITY_AND_INBOUND`), polityce FROZEN i prefiksach (→ `DATA_MODEL`), faktach platformowych (→ `OPS_NOTES` — ten plik je **proponuje**).

**Zawsze czytaj razem z:** `E12_EMAIL_SYNC_EXECUTION` (7 podpiętych skrzynek — one tworzą problem kierunku **i decydują, czy treść w ogóle istnieje** — §5.3), `KANBAN_CARD_SPEC` (bloker „jak oznaczony jest kierunek" — ten plik go zamyka).

**Najgroźniejszy błąd:** puścić backfill bez preflightu webhooka (NR-1) · przyjąć, że kierunek jest cechą maila — nie jest, jest cechą pary (mail, kanał) · **przyjąć, że każdy mail ma treść — zależy od `Message Visibility` każdej skrzynki (NR-7)** · wskrzesić pole `participants` (NR-3).

**Czego ten plik NIE robi (świadomie):** nie buduje filtrowania po adresie uczestnika i nie stawia crona co 15 min. Oba wycięte decyzją właściciela 2026-07-16 — powód w NR-3.

**Zmiana wymaga:** dla reguły kierunku — ADR (zatwierdzona, formalizacja otwarta) · dla nazwy/typu pola — `DATA_MODEL` §5.4/§5.6.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie |
|---|---|---|---|---|---|
| **NR-1** | **NIE uruchamiać backfillu, dopóki nie potwierdzono, że webhook OUT nie łapie `message.updated`.** | **Zapis hurtowy skraca CZAS, nie liczbę zdarzeń.** 188 041 zmienionych rekordów = 188 041 powiadomień, choć żądań jest ~1 881. Operacja masowa musi być `no_emit` (INV-6). | Zalanie Sortowni; potencjalny sygnał do platform reklamowych. | Preflight §6 krok 0 + wiersz w `OPS_NOTES` §5.3 | §6 |
| **NR-2** | **NIE brać kierunku z pierwszej napotkanej asocjacji.** | `direction` liczony per kanał; jeden mail ma N asocjacji o różnych kierunkach. Pierwsza = arbitralna. | Mail wychodzący ląduje w „Otrzymane" losowo, zależnie od kolejności paginacji. | — | §5.2 |
| **NR-3** | **NIE wskrzeszać pola `participants` (sklejone adresy) ani crona 15 min.** | Filtr po treści pokrywa większość potrzeby wyszukiwania; filtr po adresie kosztuje **31 h zapisu + wieczny cron + 6 dodatkowych ryzyk**. Wycięte świadomie, po policzeniu alternatywy. | Powrót całego ciężaru, który v1 nakładała bez policzenia. | Nowy wymóg biznesowy + **ADR** | §5.3, §5.4 |
| **NR-4** | **NIE filtrować i NIE sortować widoku po relacji `Message Participants` / `Message Channel Association`.** | UI dopuszcza filtr po relacji **wyłącznie MANY_TO_ONE**; obie to ONE_TO_MANY → pola nie pojawią się na liście. Sortowanie po relacji nie istnieje wcale. | Godziny szukania filtra, którego nie ma. | Twenty dopuści filtr po ONE_TO_MANY | §5.1 |
| **NR-5** | **NIE robić backfillu przez workflow.** | ~376 k kroków ≈ **$38 ≈ 7,6 mies. całej puli monthly**; brak prymitywu iteracji po 188 k. REST/GraphQL = **$0**. | Wyczerpanie puli wspólnej z AI. | — | §5.4 |
| **NR-6** | **NIE wiązać filtrowalności `Text` z widocznością kolumny — i NIE opisywać treści jako „surowego HTML".** | Filtr działa niezależnie od tego, czy kolumna jest widoczna (f(typ, `isActive`)). Treść to **oczyszczony plaintext** (HTML zdjęty, cytaty i podpisy wycięte przy imporcie), **nie** surowy HTML — patrz §5.3e. | Fałszywy wniosek „ukryłem, więc nie da się szukać"; albo odrzucenie widocznej kolumny `Text` w przekonaniu, że pokaże śmieci — a pokazuje czytelny początek maila. | — | §5.3e |
| **NR-7** | **NIE zakładać, że każdy mail ma treść — ani że wyszukiwanie po adresie działa.** | `Message Visibility` jest **per skrzynka**: `Metadata Only` → brak treści **i tematu**; `Subject and Metadata` → brak treści. Wyszukiwanie „po adresie" trafia **wyłącznie wtedy, gdy adres jest w treści** (dowód: instancja) — pierwszego maila od nowego klienta nie znajdzie. | Projekt stoi na filtrze po treści. Skrzynka z ograniczoną widocznością = ślepa plama, o której nikt nie wie. | Preflight §6 krok 0b | §5.3 |
| **NR-8** | **NIE usuwać kolumny `Subject`, bo „dubluje się z wątkiem".** | `messageThread.subject` = temat **najnowszego** maila w wątku, nadpisywany przy każdym imporcie. Zbieżność wartości ≠ tożsamość pól. | Przy starszych mailach w wątku chip pokaże temat cudzej odpowiedzi (`Re:`/`Fwd:`) zamiast tematu maila, na który patrzysz. | — | §5.3 |
| **NR-9** | **NIE dobudowywać filtra „nieprzydzielone" / „należy do mnie" / „na skrzynkę X" do tych widoków bez ADR.** | To **osobne, większe zadanie**, nie dopracowanie E12.5. „Nieprzydzielone" = filtr po relacji `messageParticipants` (ONE_TO_MANY, niefiltrowalna — NR-4) + auto-linkowanie kontaktów jest **wyłączone** (incydent freemail), więc przychodzące i tak się nie linkują. „Na skrzynkę X" = wymaga wskrzeszenia `participants` (NR-3). „Należy do mnie" = reguła własności, **nie istnieje w danych maila w ogóle**. Zadanie nr 2 (§2) domknięte jest **backstopem wizualnym** (widzę wszystkie przychodzące), nie filtrem. | Ktoś w przyszłej sesji „dobuduje szybki filtr", cofając NR-3 i/lub materializując własność — bez świadomości, że to inny projekt. | Nowy wymóg + **ADR** (materializacja własności/linkage) | §2, §5.3 |

---

## 2. PURPOSE

**Problem źródłowy:** przy ~150 nowych kontaktach/miesiąc Kanban **nie może** utrzymywać wszystkich — karty znikają między stanami do czasu reakcji, inaczej Kanban puchnie w nieskończoność. Handlowiec traci widoczność maili, które wypadły z Kanbana albo nigdy nie zostały rozpoznane. Widok pocztowy jest **backstopem**: tym, co Kanban musi gubić, poczta łapie.

`/objects/messages` pokazuje 188 041 wiadomości bez podziału na przychodzące/wychodzące i bez podziału na skrzynki. Cel: **per handlowiec** (skrzynka Marty / Gosi / Mariusza — bez wspólnego widoku „studio") folder **Poczta** z widokami 📥 Otrzymane / 📤 Wysłane, kolumny: temat, data, uczestnicy, wątek — z wyszukiwaniem po treści, filtrem czasu, sortowaniem po dacie i przejściem do pełnej treści.

**Trzy realne zadania, które to uzasadniają (2026-07-16, właściciel):**

| # | Zadanie handlowca | Domknięte przez | Klasa |
|---|---|---|---|
| **Z1** | „Dostałem maila 2 dni temu, nie pamiętam od kogo/z jakiej firmy" | 📥 Otrzymane + sort daty + filtr okna → rozpoznanie po chipie uczestnika | **custom** (wymaga kierunku) |
| **Z2** | „Czy ktoś dziś do mnie pisał, a nie trafił na Kanban / świeży nierozpoznany mail leży na poczcie" | 📥 Otrzymane jako **widoczny backstop** — skan okiem po dzisiejszych przychodzących. **Nie filtr** — patrz granica niżej | **custom** (wymaga kierunku) |
| **Z3** | „Wiem, że gadałem z klientem o drewnianych stolikach — nie pamiętam kto/jaki projekt (po 3 mies. przy 150/mc)" | `Text` → Contains `stolik` → chip uczestnika = kto. **Najważniejsze zadanie wg właściciela** | **NATYWNE — zero buildu** |

**Rozdział, który musi zostać jawny:**
- **Z3 nie potrzebuje niczego z tego dokumentu.** Działa dziś na natywnym filtrze `Text → Contains`. Custom-build (pole `direction` + backfill + workflow) uzasadniają **wyłącznie Z1 i Z2**. Warunkiem Z3 jest tylko `All Email Content` na skrzynce (§6 krok 0b) — bez tego najważniejsza funkcja jest martwa.
- **Z2 domknięte w wersji „widzę", nie „filtruję".** Backstop = widoczna lista przychodzących do przeskanowania. Twarde filtry „nieprzydzielone / należy do mnie / na skrzynkę X" są **poza zakresem — NR-9** (inny, większy projekt: cofnięcie NR-3 + materializacja własności). Właściciel zaakceptował wersję „na początek wystarczy, że widzę".
- **Zakres per skrzynka handlowca**, bez wspólnego widoku „studio" — decyzja właściciela 2026-07-16.

Dokument tłumaczy, **dlaczego kierunek (Z1, Z2) trzeba zmaterializować** i dlaczego wyszukiwarka (Z3) jest już w Twenty za darmo.

---

## 3. SCOPE

### Pokrywa
- Regułę wyznaczania `direction` na poziomie firmy.
- Kontrakt backfillu (hurtowy) + mechanizm dla nowych maili.
- Widoki, kolumny, folder, wyszukiwanie po treści, ścieżkę do pełnej treści.

### Nie pokrywa
- Wysyłki maili z Twenty (→ `E12_4_OWOCNI_MAIL_RESET_PLAN`). Twenty jest czytnikiem: `Reply` w wątku przerzuca do skrzynki `[JEST @ docs 2026-07-16]`.
- Tworzenia leadów z maili / tożsamości (→ `IDENTITY_AND_INBOUND`).
- `lastContactAt` / `bizLastContactLabel` (→ `KANBAN_CARD_SPEC` — ten sam trigger, inny cel).
- **Filtrowania po adresie uczestnika** — wycięte, NR-3.
- **Filtra „nieprzydzielone / należy do mnie / na skrzynkę X"** (twarda wersja Z2) — poza zakresem, **NR-9**. Backstop Z2 = widoczność, nie filtr.
- **Wspólnego widoku „studio"** — zakres per skrzynka handlowca (Marta / Gosia / Mariusz), decyzja właściciela 2026-07-16.
- **Konfiguracji skrzynek** (visibility, foldery) — dom faktu: `E12_EMAIL_SYNC_EXECUTION`. Ten plik tylko **wymaga preflightu** (NR-7).

---

## 4. CANONICAL DEFINITIONS

| Termin | Znaczenie |
|---|---|
| **Message** | Rekord maila. **Jeden per `headerMessageId` w całym workspace.** Nosi `subject`, `text`, `receivedAt`, `messageThread`. **Nie nosi kierunku.** Nie ma strony rekordu — z listy nie da się w niego kliknąć (§5.3). |
| **MessageThread** | Rekord **rozmowy**. Ma własny `subject` = temat **najnowszego** maila w wątku (nadpisywany przy imporcie). **Jedyne klikalne wyjście z listy do treści.** |
| **MCMA** (`MessageChannelMessageAssociation`) | Powiązanie *mail ↔ kanał*. **Tu żyje `direction`.** Jeden mail ma **N** asocjacji — po jednej na skrzynkę, która ten mail widziała. |
| **MessageParticipant** | Powiązanie *mail ↔ uczestnik*. Nosi `role` (FROM/TO/CC/BCC/REPLY_TO), `handle` (adres), `displayName` oraz **relację `person`** do kontrahenta. |
| **Kierunek per kanał** | `direction` = f(nadawca, konto **tego** kanału). Ten sam mail bywa OUTGOING w jednej asocjacji i INCOMING w drugiej. |
| **Kierunek firmy** | Nasza reguła pochodna (§5.2): „czy ktokolwiek od nas to wysłał". Materializowana na Message. |
| **Writer** | Proces zewnętrzny zapisujący pole pochodne. Twenty go nie wypełni — §5.4. |

---

## 5. BODY

### 5.1 Dlaczego filtr nie wystarczy `[D:VERIFIED @ main 2026-07-16]`

Trzy fakty, jeden wniosek.

**(a) Kierunku nie ma na mailu.** `MessageWorkspaceEntity`: `headerMessageId`, `subject`, `text`, `receivedAt`, `messageThread(Id)`, `messageParticipants`, `messageChannelMessageAssociations`, `messageCampaign(Id)`, `deliveryStatus`, `isDraft`. **Ani jednego pola kierunku.** `deliveryStatus` to status wysyłki kampanii — przy imporcie IMAP pusty.

**(b) Kierunek jest cechą pary (mail, kanał).**

```ts
computeMessageDirection = (fromHandle, connectedAccount) =>
  connectedAccount.handle === fromHandle ||
  connectedAccount.handleAliases?.includes(fromHandle)
    ? OUTGOING : INCOMING
```

Dedup maili jest **workspace-wide, bez filtra kanału** (`where: { headerMessageId: In(...) }`). Przy 7 skrzynkach — `marta@` pisze do klienta, DW do `studio@`:

```
message (1 rekord — ten sam headerMessageId)
├── MCMA (kanał marta@)  → direction = OUTGOING   (nadawca == konto kanału)
└── MCMA (kanał studio@) → direction = INCOMING   (nadawca != konto kanału)
```

**Jedno pole na Message nie zmieści dwóch prawd. Trzeba wybrać regułę — §5.2.**

**(c) Z widoku Messages nie sięgniesz do asocjacji.** Filtr po relacji działa **tylko dla MANY_TO_ONE** (`getFilterFilterableFieldMetadataItems.ts:18-21`). `messageParticipants` i `messageChannelMessageAssociations` to ONE_TO_MANY → w ogóle nie pojawią się na liście pól (NR-4).

**Wniosek:** kierunek trzeba **zmaterializować**. Nie da się go „dociągnąć".

---

### 5.2 Reguła kierunku — perspektywa firmy `[D:CORE @ 2026-07-16]`

```
direction = OUTGOING, jeśli JAKAKOLWIEK asocjacja ma direction = OUTGOING
            (= ktoś od nas to wysłał)
            w przeciwnym razie INCOMING
```

**Zatwierdzona przez właściciela 2026-07-16.** ADR #19 w `DECISION_REGISTER` — **closed 2026-07-28**.

**Dlaczego to nie był wybór między dwiema opcjami:** wariant „perspektywa użytkownika" jest **niewykonalny** — `connectedAccount` i `messageChannel` nie są wystawione przez Core API, więc mapowanie kanał→konto (i aliasy) trzeba by utrzymywać ręcznie i wiecznie. Reguła firmy jest jedyną realizowalną, a przy tym semantycznie właściwą dla agencji: handlowiec pyta *„my do nich czy oni do nas"*.

**Właściwości:** deterministyczna · idempotentna · niezależna od kolejności paginacji i od kolejności zdarzeń · nie wymaga listy naszych kont.

**Łagodzenie:** maile czysto wewnętrzne (wszyscy uczestnicy z naszej domeny) **nie są synchronizowane** — domyślnie; przełącznik `Sync Internal Emails` (Settings → Advanced → General → Security) jest **workspace-wide** `[JEST @ docs 2026-07-16]`. Konflikt kierunku powstaje tylko przy DW/CC między naszymi skrzynkami na mailu z klientem.

---

### 5.3 Co jest natywne — i gdzie są jego granice `[D:VERIFIED @ instancja 2026-07-16]`

Cztery rzeczy Twenty daje za darmo. Każda ma granicę, którą trzeba znać.

#### (a) Wyszukiwanie po treści — **fundament projektu**

`Filter → Text → Contains → fraza`:

| Właściwość | Dowód |
|---|---|
| **Podciąg, nie słowo** → rdzeń działa: `faktur` łapie fakturę/fakturze/fakturowanie | test na instancji: `hik` trafiło **wewnątrz** ciągu `hIkEALw_wcB` — mechanizm słowny nie znalazłby tego nigdy |
| **Ignoruje wielkość liter** | ten sam test: `hik` = `hIk` |
| **Pole `Text` jest filtrowalne** (typ TEXT) | filtr widoczny w UI; w kodzie: lista typów filtrowalnych zawiera TEXT, **nie zawiera RICH_TEXT**; `text` nie jest polem ukrytym (ukryte = `id`, `searchVector`, `position`) |
| **Filtr działa niezależnie od widoczności kolumny** | filtrowalność = f(typ, `isActive`), nie f(widoczności) — NR-6. (Kolumna `Text` jest u nas widoczna — §5.3e — ale filtr działałby też przy ukrytej) |

**To jedyna droga do treści.** Wyszukiwarka indeksuje na Message **wyłącznie `subject`** (`search-fields-by-standard-object-name.constant.ts:20`) — potwierdzone po reworku search-vectorów w 2.18, **nie przebite**.

**Cena podciągu:** szuka też w linkach i identyfikatorach (dowód: `gclid`). Reguła: **rdzeń ≥ 5–6 znaków**; frazy 3–4-znakowe łapią śmieci; zawężaj drugim filtrem (data / kierunek).

**Wydajność:** brak indeksu dla podciągu → sekwencyjny odczyt. Test na instancji: **niemal natychmiast**. Zastrzeżenie: test był na frazie **częstej** — widok kończy pracę po zapełnieniu pierwszej strony. Fraza **rzadka** wymusza pełny przegląd; jeśli filtr kiedyś mieli, to jest przyczyna, nie awaria. `[D:RESEARCH]`

**Granica twarda — `Message Visibility` (NR-7):** ustawienie **per skrzynka** `[JEST @ docs 2026-07-16]`:

| Ustawienie | `text` | `subject` | Skutek dla nas |
|---|---|---|---|
| `All Email Content` | ✅ | ✅ | wszystko działa |
| `Subject and Metadata` | ❌ | ✅ | **wyszukiwanie po treści martwe dla tej skrzynki** |
| `Metadata Only` | ❌ | ❌ | martwe też wyszukiwanie po temacie; zostaje data i uczestnicy |

Kierunek działa w każdym z trzech (MCMA istnieje niezależnie od widoczności) — ale **wyszukiwanie, czyli powód istnienia tych widoków, nie**. Preflight: krok 0b.

**Druga granica — `Message Folder Selection`:** foldery można wykluczyć z synchronizacji `[JEST @ docs 2026-07-16]`. **Jeśli któraś skrzynka nie synchronizuje folderu `Sent`, widok 📤 Wysłane będzie dla niej pusty — i nikt się nie dowie.** Preflight: krok 0b.

#### (b) „Search by any field" — **wygodne, ale nie sięga uczestników**

Znajduje mail po adresie e-mail **tylko wtedy, gdy adres występuje w treści lub temacie** (stopka, cytat odpowiedzi). `[D:VERIFIED @ instancja 2026-07-16 — trafienie potwierdzone jako pochodzące z treści]`

**Nie jest substytutem filtra po uczestnikach.** Pierwszego, krótkiego maila od nowego klienta — bez stopki i bez cytatu — **nie znajdzie**, bo adres żyje wyłącznie w `MessageParticipant.handle`. To jest świadomie akceptowana strata (NR-3), nie luka do naprawienia po cichu.

#### (c) Uczestnicy — kolumna natywna

`Message Participants` renderuje chipy (do 10 inline, dalej `+N`). Nie mylić z wyciętym polem `participants` (NR-3): **kolumna pokazuje, pole filtrowało**. Kolumna była zawsze darmowa. `MessageParticipant` niesie `handle`, `displayName` i relację `person` `[JEST W KODZIE]`.

#### (d) Droga do pełnej treści — **przez wątek, nie przez mail** `[D:VERIFIED @ instancja]`

**Message nie ma strony rekordu — z listy nie da się kliknąć w mail.** Komórka `Text` daje tylko nieprzewijalny podgląd.

**Klikalny jest chip `Message Thread`** — i to jest **jedyne** wyjście z listy do pełnej treści. Stąd: kolumna obowiązkowa (§8).

**Dlaczego `Subject` i chip wątku wyglądają tak samo (NR-8):** to dwa różne rekordy. Twenty ustawia `messageThread.subject` na temat **najnowszego** maila w wątku i nadpisuje przy każdym imporcie `[JEST W KODZIE @ main 2026-07-16: messaging-message.service.ts:205-233 — wygrywa większe receivedAt]`. Dlatego:

```
mail 1:  "Wycena strony"        ← Subject tego maila
mail 2:  "Fwd: Wycena strony"   ← Subject tego maila
mail 3:  "Re: Wycena strony"    ← najnowszy → nazwa całego wątku

wiersz maila 2 →  Subject: "Fwd: Wycena strony"  |  Wątek: "Re: Wycena strony"
```

Identyczne są tylko przy najnowszym mailu w wątku — z definicji. **Zbieżność wartości ≠ tożsamość pól.**

#### (e) Fragment treści w wierszu — **widoczny, przycięty, czytelny** `[D:VERIFIED @ main 2026-07-16]`

Kolumna `Text` jest **widoczna** (decyzja właściciela 2026-07-16) i pokazuje **początek maila**. Trzy fakty, które to uzasadniają:

1. **Wiersz się nie rozpycha.** Komórka TEXT przycina treść do wysokości wiersza; nadmiar chowa się w powiększeniu przy kursorze (znane z instancji). Długi mail **nie** rozwala tabeli. `[instancja]`
2. **Szerokość kolumny = ile fragmentu widać.** Natywny suwak szerokości; węziej/szerzej reguluje długość podglądu. Zero kosztu.
3. **Treść jest czysta, nie HTML.** Import robi: `html-to-text` (HTML → plaintext) → `email-reply-parser` (wycina cytaty odpowiedzi) → `planer` (wycina stopki/podpisy) → normalizacja. Więc początek `text` to **realny początek wiadomości**, nie `<div>`/`<style>`. `[JEST W KODZIE: extract-message-body-text.util.ts + create-html-to-text-converter.util.ts]`

**Haczyk (zaakceptowany):** maile marketingowe/powiadomienia z linkami śledzącymi (`gclid`) mają na początku szum z URL-i — `html-to-text` renderuje link jako tekst. Dla korespondencji z klientem margines; dla newsletterów fragment bywa brzydki. Przycięcie per mail wymagałoby pola pochodnego (writer → koszt) — **odrzucone jako nieopłacalne**, native przycięcie wystarcza.

**Korekta względem wcześniejszej wersji:** v2.0–v2.1 opisywały `Text` jako „nieczytelny HTML" i trzymały kolumnę ukrytą. To był **błąd** — kod pokazuje oczyszczony plaintext. Stąd flip na widoczną (NR-6 poprawione).

#### (f) Kontrahent — natywnie z drugiej strony

Person / Company / Opportunity mają zakładkę **Emails**: klik w mail otwiera pełną konwersację, przewijalną przez całą historię z kontaktem `[JEST @ docs 2026-07-16]`.

---

### 5.4 Writer: dlaczego konieczny i dlaczego tani `[D:VERIFIED @ main 2026-07-16]`

**Dlaczego Twenty tego nie zrobi:**
1. **Brak pól obliczanych.** 25 typów `FieldMetadataType`, brak `FORMULA`/`COMPUTED`/`ROLLUP`. Docs mają how-to „Formula Fields przez workflow, until native support" — **nie przebite** @ 2026-07-16.
2. **Import pisze do zamkniętej listy pól.** Payload w `messaging-message.service.ts` jest typowany; pipeline nie wie o naszym polu i nigdy do niego nie napisze.

**Dlaczego writer ma prawo pisać:** custom field na obiekcie systemowym jest dozwolony (read-only zależy od `isUIEditable`, default `true`, nie od `isSystem`); `message` nie jest na liście obiektów wymagających uprawnień settings (`{ apiKey, webhook }`) → zapis idzie na zwykłych object permissions. Dowód empiryczny: `twenty_cleanup.py` robi GET i DELETE na `/rest/messages` naszym kluczem.

**Zapis hurtowy — sedno v2 `[D:RESEARCH → 1 test, OQ-2]`:**

```
updateMany(filter: { id: { in: [...100 id...] }}, data: { direction: OUTGOING })
```

`MUTATION_MAXIMUM_AFFECTED_RECORDS = 100` (`config-variables.ts:1450`) + `update-many-resolver.factory.ts` `[JEST W KODZIE @ main 2026-07-16]`.

| | v1 (rekord po rekordzie) | **v2 (hurtem)** |
|---|---|---|
| Żądania | 188 041 | **~1 881** (2 paczki: OUTGOING / INCOMING) |
| Czas przy 100 req/min | ~31 h | **~20 min** |
| Zdarzeń `message.updated` | 188 041 | **188 041 — bez zmian (NR-1!)** |

Działa, **bo kierunek ma tylko dwie wartości**. Dla pola o wartości unikalnej per rekord (wycięte `participants`) hurt nie pomaga — to jest cała różnica kosztowa między v1 a v2.

**Limity:** `SHORT 100/1 s` · **`LONG 100/60 s` (sufit)**; throttling tylko dla auth kluczem API — UI go nie widzi, writer tak. Defaulty; Cloud do zmierzenia (OQ-3).

**Rollback:** writer jest idempotentny i bezstanowy → cofnięcie = ponowny przebieg z poprawioną regułą. Nie ma stanu do odkręcania. Jedyny nieodwracalny skutek błędu to **wysłane webhooki** (NR-1).

---

### 5.5 Nowe maile — mechanizm bieżący `[D:OPEN — decyzja człowieka, OQ-5]`

Backfill obejmuje historię. Nowe maile potrzebują mechanizmu — inaczej pole zostanie puste i **mail nie pojawi się w żadnym widoku**. Tryb awarii jest **cichy**: nie błąd, tylko brak. Stąd widok kontrolny (krok 10b).

**Ważny kontekst dla wyboru:** import maili chodzi **co 5 minut** `[JEST @ docs 2026-07-16]`. Mail i tak pojawia się w Twenty z opóźnieniem do 5 min — więc „workflow reaguje natychmiast" jest przewagą pozorną. Realna różnica to **utrzymanie i koszt**, nie szybkość.

| | **A. Workflow w Twenty** | **B. Cron w naszym GCP** |
|---|---|---|
| Mechanizm | trigger `messageChannelMessageAssociation.created` → `Update Record` na Message | job w istniejącym `twenty-crm-worker` (Scheduler co ~2 min) |
| Wzorzec u nas | **wdrożony** — `deploy_workflow_new_to_contacted.py` używa dokładnie tego triggera i filtra po `MCMA.direction` `[instancja]` | wdrożony — `MIGRATE_TWENTY_CRM_TO_GCP` |
| Koszt | ~1,9 kroku/mail × M. Przy M=200/d ≈ **$1,1/mc ≈ 23% puli monthly** `[D:RESEARCH — stawka $0,0001/krok @ in-app billing 2026-07-16]` | **$0** kredytów |
| Utrzymanie | Twenty pilnuje samo; historia uruchomień w Settings → Workflows | nasz kod; awaria zauważalna dopiero, gdy ktoś spojrzy |
| Ryzyko | pula **wspólna z AI chat** — przyszłe użycie AI kanibalizuje budżet | zużywa limit klucza API wspólnie z workerem leadów (OQ-3) |

**Kontrakt — obowiązuje oba warianty:**

1. **Odporność na kolejność.** Reguła §5.2 musi dać ten sam wynik niezależnie od tego, która asocjacja dotrze pierwsza. Konkretnie dla wariantu A wymaga **dwóch workflowów**:
   - `MCMA.direction = OUTGOING` → ustaw `OUTGOING` **bezwarunkowo**
   - `MCMA.direction = INCOMING` → ustaw `INCOMING` **tylko gdy pole jest puste** (krok FILTER na `direction IS_EMPTY` przed UPDATE)

   Bez warunku w drugim workflowie asocjacja INCOMING przychodząca po OUTGOING skasuje poprawny kierunek. **To jest najłatwiejsze miejsce na cichy błąd w całym projekcie.**
2. **Idempotencja.** Zapis wyłącznie przy zmianie wartości. **Żadnej trwałej flagi loop-prevention (INV-3)** — pole `direction` nie może nieść stanu przetwarzania.
3. **Zakres.** Mechanizm dotyka **wyłącznie `direction`**. Nic więcej.

**Rekomendacja `[D:RESEARCH]`:** wariant A. Warunki zwycięstwa: zmierzone M ≲ 190/d (monthly) oraz brak planów na intensywne AI w Twenty. Obala: pomiar zużycia po 48 h > 50% puli.

---

### 5.6 Model docelowy

```
Twenty (import IMAP co 5 min, niezmieniony)
   │
   ├─ messageThread ──────── subject = temat NAJNOWSZEGO maila     [platforma]
   ├─ message ────────────── subject, text*, receivedAt            [platforma]
   │     └─ + direction                                            [NASZE, writer]
   ├─ messageChannelMessageAssociation ── direction per kanał      [platforma, źródło prawdy]
   └─ messageParticipant ── role, handle, displayName, person      [platforma, źródło prawdy]

   * text istnieje TYLKO przy Message Visibility = All Email Content (NR-7)

writer
   backfill (jednorazowo):  updateMany, ~1 881 żądań, ~20 min
   bieżąco (§5.5):          2 workflowy Twenty  albo  job w twenty-crm-worker
   czyta:  MCMA.direction    liczy: reguła §5.2    pisze: TYLKO direction

natywne, 0 pracy
   treść        → Filter → Text → Contains (podciąg, case-insensitive)
   uczestnicy   → kolumna Message Participants (chipy)
   pełna treść  → klik w chip Message Thread          ← JEDYNE wyjście z listy
   kontrahent   → Person/Company → zakładka Emails → wątek

widoki (T1)
   📥 Otrzymane  = direction IS INCOMING
   📤 Wysłane    = direction IS OUTGOING
   🔧 Nieoznaczone — MA BYĆ 0 = direction IS EMPTY   ← czujka cichej awarii (pasywna)
```

**Granica odpowiedzialności:** Twenty pozostaje właścicielem faktów (kierunek per kanał, uczestnicy, treść, wątki). Writer produkuje **jedno pole pochodne dla UI**. Zero logiki biznesowej po stronie Twenty; zero mutacji faktów po stronie writera. **NIGDY do payloadów eventów** (`DATA_MODEL` §5.6 — pole CRM-only, bez prefiksu).

---

## 6. KROKI WDROŻENIA

| # | Kto | Krok | PASS |
|---|---|---|---|
| **0** | Dawid | **Preflight NR-1:** Settings → Webhooks → czy webhook OUT łapie `message.updated` / obiekt Message. Jeśli tak → zawęzić zakres albo wyłączyć na czas backfillu. | Potwierdzone na piśmie w `OPS_NOTES` |
| **0b** | Dawid | **Preflight NR-7 — BRAMA, nie checklist:** Settings → Accounts → dla **każdej skrzynki handlowca w zakresie** (Marta / Gosia / Mariusz): (a) `Message Visibility` = `All Email Content`? (b) folder `Sent` synchronizowany? **`All Email Content` jest warunkiem koniecznym Z3 (§2) — najważniejszego zadania. Bez niego wyszukiwarka treści jest martwa i budowa traci główny sens.** | Tabela per skrzynka. `Message Visibility` ≠ `All Email Content` na którejkolwiek → **STOP, eskalacja do właściciela** przed dalszymi krokami. Brak `Sent` → 📤 tej skrzynki pusty — zapisać |
| **1** | Dawid | Settings → Experience → **Advanced mode** ON | Messages widoczne w Data Model |
| **2** | Dawid | Settings → Data Model → filtr **„System objects"** → Messages → New field (§7) | Pole widoczne w `/objects/messages` |
| **2b** | Dev | **RT-3:** `GET /rest/metadata` → potwierdzić, że wartości SELECT to dokładnie `INCOMING` / `OUTGOING`. UI potrafi nadać inne API values. | Wartości zgodne; brak tabeli tłumaczeń |
| **3** | Dev | **OQ-2:** 1 zapytanie `updateMany` na 2 testowych mailach — czy przechodzi na custom fieldzie obiektu systemowego | 200 + wartość w UI |
| **4** | Dev | **Env-guard (RT-5):** writer przyjmuje jawne `--env sandbox\|prod`, walidowane wobec `TWENTY_REST_URL`. **Bez tego nie startuje.** | Uruchomienie bez `--env` = błąd |
| **5** | Dev | `--dry-run`: (a) licznik maili z konfliktem — **liczyć maile, nie asocjacje** (RT-9) · (b) **licznik maili bez żadnej MCMA** (nie dostaną kierunku — RT-11) · (c) **pomiar M** (MCMA/dobę) na wejście do §5.5 | Próbka zgodna z regułą §5.2; trzy liczby zapisane |
| **6** | Dev | Test limitu: pierwsze 10 paczek po 100, zmierzyć 429 (OQ-3) | Zero 429 |
| **7** | Dev | Backfill hurtowy na pełnym zbiorze. **~20 min.** | `bledy: 0` |
| **7b** | Dev | **Weryfikacja backfillu:** liczba maili z pustym `direction` = liczba z kroku 5b (maile bez MCMA). Rozbieżność = backfill niekompletny → **nie iść dalej** | Zgodność liczb |
| **8** | Dawid | Wiersz w `OPS_NOTES` §5.3 — operacja masowa, kolumna `no_emit` obowiązkowa | Wiersz istnieje |
| **9** | Dawid+Dev | Mechanizm bieżący wg decyzji §5.5. **Wariant A = dwa workflowy; drugi z warunkiem `IS_EMPTY`** (§5.5 kontrakt pkt 1) | Test: mail OUTGOING z DW do naszej skrzynki → po 15 min `Wychodzący`, nie `Przychodzący` |
| **10** | Dawid | `/objects/messages` → **Save as new view** ×2 (§8) | Oba widoki na liście |
| **10b** | Dawid | Trzeci widok — czujka: **🔧 Nieoznaczone — MA BYĆ 0** = `Kierunek is empty`. **Widoczny w folderze** (nie ukrywać). Nazwa niesie sens: każdy nie-zerowy licznik = alarm. **Twenty nie pokazuje licznika w menu** (`[JEST W KODZIE: NavigationDrawerItem = label+ikona]`) → czujka **pasywna**, wymaga zaglądania | Licznik ≈ krok 5b i **nie rośnie** |
| **10c** | Dawid | **Przypisać właściciela kontroli:** kto i jak często zagląda w 🔧 (np. handlowiec raz w tygodniu / Dawid przy przeglądzie). Bez tego pasywna czujka nikogo nie ochroni — wisi niewidziana | Właściciel + kadencja zapisane (tu albo w `OPS_NOTES`) |
| **11** | Dawid | Sidebar → „Workspace" → ikona klucza → folder **„Poczta"** → przeciągnąć widoki | Folder działa |
| **12** | Dawid | Wpis pola do `DATA_MODEL`; fakty §10 → `OPS_NOTES` §5.1; ADR reguły §5.2 → `DECISION_REGISTER` (OQ-1) | Wpisy istnieją |

---

## 7. POLE DO UTWORZENIA

Konwencja `DATA_MODEL` §5.4 — trzy rozłączne warstwy: **API name** (camelCase, angielski) · **wartości SELECT** · **UI label** (polski). Wzorzec działa u nas: `NEW` → „Nowy", `WON` → „Wygrany".

| API name | Typ | UI label | Wartości | Prefiks? | Required? |
|---|---|---|---|---|---|
| `direction` | SELECT | Kierunek | `INCOMING` → „Przychodzący" · `OUTGOING` → „Wychodzący" | **nie** | **nie** (INV-9) |

**Wartości SELECT są 1:1 z enumem `MessageDirection` Twenty** — writer przepisuje `direction` dosłownie, bez mapowania. O jedno miejsce na pomyłkę mniej. **Weryfikacja obowiązkowa: krok 2b.**

**Brak prefiksu** — `biz*`/`id*`/`src*` dotyczą pól kontraktu integracyjnego. To pole CRM-only.

**Pole będzie edytowalne ręcznie w UI** (`isUIEditable` default `true`). Ręczna zmiana jest **legalna, ale nietrwała** — najbliższy przebieg mechanizmu bieżącego przywróci wartość z reguły §5.2. Pole nie jest miejscem na ludzką korektę; jeśli reguła myli się systematycznie → ADR, nie klikanie.

---

## 8. WIDOKI

| Widok | Filtr | Rola |
|---|---|---|
| **📥 Otrzymane** | `Kierunek` **is** `Przychodzący` | praca |
| **📤 Wysłane** | `Kierunek` **is** `Wychodzący` | praca |
| **🔧 Nieoznaczone — MA BYĆ 0** | `Kierunek` **is empty** | **czujka** — pusto = zdrowo, nie-0 = mechanizm padł (§11). **Pasywna**: Twenty nie pokazuje licznika w menu, więc ktoś musi zaglądać (krok 10c) |

**Kolumny (Otrzymane / Wysłane):**

| Kolumna | Po co | Obowiązkowa? |
|---|---|---|
| `Subject` | temat **tego** maila | **tak** — NR-8, chip wątku jej nie zastąpi |
| `Received At` | data + sortowanie | tak |
| `Message Participants` | **z kim** — chipy uczestników | **tak** — główny powód istnienia widoku |
| `Message Thread` | **jedyne klikalne wyjście do pełnej treści** | **tak** — §5.3d. Pozycja: koniec wiersza (funkcja = klik, nie informacja) |
| `Kierunek` | kontrola poprawności filtra | opcjonalna |
| `Text` | **fragment treści** — podgląd początku maila | **widoczna, przycięta** (§5.3e) — decyzja właściciela 2026-07-16 |

- **Wyszukiwanie po treści:** `Text` **contains** `faktur` — **rdzeń ≥ 5–6 znaków**, zawężony datą lub kierunkiem (§5.3a).
- **„Search by any field":** wygodny skrót po temacie i treści; **nie sięga uczestników** (§5.3b).
- **Okno czasu:** `Received At` → operand **is relative** → `Past 7 days` / `Past 1 month`. Format: `{THIS|PAST|NEXT}_{n}_{DAY|WEEK|MONTH|QUARTER|YEAR|...}` `[D:VERIFIED]`. *Docs `filters-and-sorting.md` podaje dla dat tylko Equals/Before/After/Between/Is empty — **jest w tyle za kodem**.* `[PRZEBITE → kod @ 5f8baa9]`
- **Sort:** `Received At` malejąco.
- **Zapis:** widok „All Messages" ma `ViewKey.INDEX` — **nie przyjmie filtrów.** Zawsze **Save as new view**.

---

## 9. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blokuje | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| **OQ-1** | ADR reguły §5.2 — zatwierdzona 2026-07-16 | — | — | **ZAMKNIĘTE 2026-07-28: ADR #19** |
| **OQ-2** | `updateMany` na custom fieldzie obiektu systemowego | — | — | **ZAMKNIĘTE 2026-07-28: PASS** |
| **OQ-3** | Realne limity API na Cloud Pro | — | — | **ZAMKNIĘTE 2026-07-28: 100 req/min (API key)** |
| **OQ-5** | Mechanizm bieżący: workflow czy cron (§5.5) | — | — | **ZAMKNIĘTE 2026-07-28→28b: wariant B (GCP worker).** Wariant A padł: Twenty `UPDATE_RECORD` na Message → `Object cannot be updated by automation`. Workflowy E12.5 / E12.5b **DEACTIVATED**. Live = `messageDirectionEnrich` w `twenty-crm-worker` (webhook MCMA + poll). |
| **OQ-6** | Czy webhook OUT łapie `message.updated` | — | — | **ZAMKNIĘTE 2026-07-28: NIE (tylko opp/person/company)** |
| **OQ-7** | **Visibility + foldery skrzynek handlowców** (Marta / Gosia / Mariusz) — `All Email Content` + `Sent` | Dawid | **TAK — warunek konieczny Z3** | krok 0b (brama) — **nadal otwarte** |
| **OQ-8** | Ile maili nie ma żadnej MCMA | — | — | **ZAMKNIĘTE 2026-07-28: empty direction = 91** |
| **OQ-9** | Czy chip uczestnika klika do Person | Dawid | nie | 1 kliknięcie |
| **OQ-10** | **Właściciel + kadencja kontroli 🔧** | Dawid | nie (ale bez tego czujka bezużyteczna) | krok 10c — **nadal otwarte** |
| ~~OQ-4~~ | ~~Czy da się przejść z listy do treści~~ | — | — | **ZAMKNIĘTE 2026-07-16: tak, przez chip `Message Thread`. Message nie ma strony rekordu.** |

---

## 10. FAKTY DO OPS_NOTES §5.1 (propozycja)

| Fakt | Wartość | row_class | source | last_checked |
|---|---|---|---|---|
| **Kierunek maila** | Żyje na `MessageChannelMessageAssociation.direction`, **nie na Message**. Liczony per kanał. Dedup Message po `headerMessageId` workspace-wide → 1 mail = N asocjacji o możliwie różnym kierunku. | `verified_fact` | kod @ main 2026-07-16 | 2026-07-16 |
| **Filtr po polu relacji** | Tylko **MANY_TO_ONE**. ONE_TO_MANY nie pojawia się na liście. Sortowanie po relacji **nie istnieje**. | `verified_fact` | `getFilterFilterableFieldMetadataItems.ts:18-21` | 2026-07-16 |
| **Wyszukiwarka na Message** | `searchVector` = **wyłącznie `subject`**. Treść nieindeksowana nigdzie. Bonus: `messageParticipant` indeksuje `handle`. **Nie przebite** po reworku search-vectorów 2.18 (#22063, #22355). | `verified_fact` | `search-fields-by-standard-object-name.constant.ts:20,28` | 2026-07-16 |
| **Operand CONTAINS** | **Podciąg, case-insensitive** — nie wyszukiwanie po słowach. Rdzeń działa (`faktur` → fakturze). Szuka też w linkach/identyfikatorach. Brak indeksu → fraza rzadka = pełny przegląd. | `verified_fact` | **instancja** (test `hik` ↔ `hIkEALw_wcB`) | 2026-07-16 |
| **„Search by any field"** | Operand `VECTOR_SEARCH`. Trafia po adresie **tylko gdy adres jest w treści/temacie**; **nie sięga `messageParticipant`**. | `verified_fact` | **instancja** (trafienie zweryfikowane jako pochodzące z treści) | 2026-07-16 |
| **`Message Visibility`** | **Per skrzynka**: `Metadata Only` (brak text+subject) · `Subject and Metadata` (brak text) · `All Email Content`. **Determinuje, czy wyszukiwanie po treści w ogóle działa.** Foldery można wykluczyć z sync (np. `Sent`). Import co 5 min, ~400 msg/min. | `verified_fact` | docs `calendar-emails/overview` | 2026-07-16 |
| **`messageThread.subject`** | = temat **najnowszego** maila w wątku; nadpisywany przy każdym imporcie (wygrywa większe `receivedAt`). Stąd `Re:`/`Fwd:` rozjeżdżające się z `Message.subject` przy starszych mailach. | `verified_fact` | `messaging-message.service.ts:205-233` | 2026-07-16 |
| **Strona rekordu Message** | **Nie istnieje** — z widoku nie da się kliknąć w mail; komórka `Text` daje nieprzewijalny podgląd. Jedyne wyjście do treści: chip `Message Thread` (MANY_TO_ONE). | `verified_fact` | **instancja** | 2026-07-16 |
| **`Message.text` = oczyszczony plaintext** | **Nie surowy HTML.** Import: `html-to-text` (HTML→tekst) → `email-reply-parser` (wycięte cytaty odpowiedzi) → `planer` (wycięte podpisy/stopki) → normalizacja. Początek `text` = realny początek maila → kolumna-fragment jest czytelna. Wyjątek: linki śledzące renderują się jako URL (szum w mailach marketingowych). | `verified_fact` | `extract-message-body-text.util.ts` · `create-html-to-text-converter.util.ts` @ main 2026-07-16 | 2026-07-16 |
| **Zapis hurtowy** | `updateMany` istnieje; cap `MUTATION_MAXIMUM_AFFECTED_RECORDS = 100`. **Skraca czas, nie liczbę zdarzeń webhooka.** | `verified_fact` | `update-many-resolver.factory.ts` · `config-variables.ts:1450` | 2026-07-16 |
| **Rate limit API** | 100 req/s (short) i **100 req/min (long — wiążący)**. Tylko dla auth kluczem API; sesje UI nie. Defaulty self-hosted — Cloud do zmierzenia. | `inference_from_docs` | `config-variables.ts:1458-1484` | 2026-07-16 |
| **Credits** | **Jedna pula: workflow + AI agents + AI chat.** 5/mc (monthly) · 50/rok (yearly) — per **cykl**, nie plan. Rollover z capem 1 okresu. Basic ops = „Minimal". **1 credit = $1; krok ≈ $0,0001 (~10 k kroków/credit)** — kotwica: strona in-app po zalogowaniu. Delay = 1 credit (na `workflow-credits`; strona in-app o tym milczy — dywergencja). | `verified_fact` (alokacja, pula, rollover) + `needs_anchor` (stawka $ — źródło in-app, nie docs) | docs `billing/capabilities/credits` + `workflows/capabilities/workflow-credits` + in-app | 2026-07-16 |
| **Issue #15859 („miliony credits")** | `[PRZEBITE → model 5/mc + „Minimal" + stawka in-app @ 2026-07-16]` — nagrobek. Nie wracać. | `deprecated_fact` | — | 2026-07-16 |
| **`connectedAccount` / `messageChannel`** | **Poza Core API** — brak na liście obiektów standardowych. `handleAliases` niedostępne dla writera. → perspektywa użytkownika niewykonalna (§5.2). | `verified_fact` | kod @ `5f8baa9` | 2026-07-16 |
| **Custom field na obiekcie systemowym** | Dozwolony: read-only zależy od `isUIEditable` (default `true`), nie od `isSystem`. Widoczność: Advanced mode + filtr „system objects". | `verified_fact` | `isObjectMetadataReadOnly.ts` · `SettingsObjectTable.tsx:83,145-146` | 2026-07-16 |
| **Brak pól obliczanych** | 25 typów `FieldMetadataType`, brak FORMULA/COMPUTED/ROLLUP. Docs how-to „przez workflow, until native support" — **nie przebite**. | `verified_fact` | kod + docs | 2026-07-16 |
| **Zakładka Emails** | Na Person / Company / Opportunity. Klik w mail → pełna konwersacja + historia z kontaktem. `Reply` przerzuca do skrzynki — Twenty jest czytnikiem, nie klientem poczty. | `verified_fact` | docs `collaboration/emails-and-calendars` | 2026-07-16 |
| **Maile wewnętrzne** | Domyślnie **nie synchronizowane** (wszyscy uczestnicy z naszej domeny). Przełącznik `Sync Internal Emails`: Settings → Advanced → General → Security — **workspace-wide**. | `verified_fact` | docs `calendar-emails/overview` | 2026-07-16 |

---

## 11. RYZYKA

| Ryzyko | Kiedy gryzie | Mitigacja |
|---|---|---|
| **Skrzynka bez treści / bez folderu Sent** | `Message Visibility` ≠ `All Email Content` albo `Sent` wykluczony | **NR-7 / krok 0b.** Nie da się wykryć z widoku — mail po prostu nie ma treści albo nie istnieje. **Największe ryzyko dla sensu projektu**, bo widoki wyglądają na kompletne |
| **Backfill zalewa Sortownię** | webhook OUT słucha Message | **NR-1 / krok 0.** Zapis hurtowy **nie chroni**: liczba zdarzeń = liczba rekordów |
| **Cicha awaria mechanizmu bieżącego** | workflow/cron pada (kliknięcie, brak kredytów, wygasły klucz) | mail bez kierunku **nie znika — nie pojawia się** w Otrzymanych ANI Wysłanych. Brak błędu, tylko luka. Czujka: **widok 🔧 Nieoznaczone — MA BYĆ 0** (krok 10b). **Pasywna** — chroni tylko, jeśli ktoś w nią zagląda (krok 10c). Skan Otrzymanych tej klasy NIE wykryje |
| **INCOMING kasuje OUTGOING** | wariant A bez warunku `IS_EMPTY` w drugim workflowie | §5.5 kontrakt pkt 1 + test z kroku 9. **Najłatwiejsze miejsce na cichy błąd** |
| Backfill na produkcji zamiast sandboxa | writer bierze klucz z pierwszego `.env.local` | **krok 4** — jawny `--env` |
| 429 zabija backfill | Cloud ma niższy limit niż default | krok 6; writer idempotentny → restart bezpieczny |
| Maile bez żadnej MCMA | osierocone po `message-cleaner` / odłączeniu skrzynki | nie dostaną kierunku → wpadają w widok 🔧. Policzyć w kroku 5b; jeśli liczba **rośnie** ponad tę bazę → coś kasuje asocjacje |
| Fraza rzadka mieli | brak indeksu dla podciągu | zawężaj datą/kierunkiem (§5.3a) — to nie jest awaria |
| Szukanie po adresie zawodzi | adresu nie ma w treści (pierwszy mail od klienta) | **świadoma strata (NR-3/§5.3b).** Nie „naprawiać" po cichu polem `participants` — to wymaga ADR |
| Ręczna korekta kierunku znika | ktoś poprawi pole w UI | §7 — pole nie jest miejscem na ludzką korektę; mechanizm je nadpisze |
| Powrót wymogu „filtr po adresie" | zmiana potrzeb | **NR-3** — koszt: 31 h + cron. Wymaga ADR, nie „szybkiej poprawki" |
| **Regresja po update Twenty** | natywne `direction` na Message albo filtr ONE_TO_MANY | **tripwire:** release note / PR ze słowami „message direction" lub „filter on collection relation" → pole staje się zbędne |
| Pula credits skonsumowana przez AI | wariant A + wzrost użycia AI chat w Twenty | pula wspólna — Settings → Billing co miesiąc przez pierwszy kwartał |

---

## 12. CROSS-REFERENCES

| Temat | Gdzie |
|---|---|
| 7 podpiętych skrzynek — źródło problemu N-asocjacji **oraz dom faktu o visibility/folderach** | `E12_EMAIL_SYNC_EXECUTION` FAZA 2 |
| Bloker „jak w schemacie `message` oznaczony jest kierunek" | `KANBAN_CARD_SPEC` — **ten plik go zamyka** (§5.1b) |
| Trigger na kierunek dla `lastContactAt` | `KANBAN_CARD_SPEC` „Workflow odpowiedzi mailowej" — ta sama mechanika, inny cel |
| Wzorzec workflow na `messageChannelMessageAssociation.created` | `deploy_workflow_new_to_contacted.py` |
| Powierzchnia cron (Scheduler + CF) | `MIGRATE_TWENTY_CRM_TO_GCP` |
| Konwencja nazw / prefiksy / FROZEN | `DATA_MODEL` §5.4, §5.6 |
| Log operacji masowych (`no_emit`) | `OPS_NOTES` §5.3 |
| Zakres webhooka OUT (Opportunity + Person) | `EVENT_CONTRACT` §5.1 |

---

## 13. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-07-16 | Utworzenie v1 `[D:RESEARCH]` | Claude (research) | Zamknięcie blokera kierunku z `KANBAN_CARD_SPEC` |
| 2026-07-16 | v1: pole adresowe usunięte → **cofnięte** (wraca jako `participants`) | Dawid (pytanie) | `searchVector` = tylko subject |
| 2026-07-16 | **v2 — pole `participants` wycięte ostatecznie (NR-3)** | **Dawid (decyzja)** | Filtr `Text → Contains` pokrywa wyszukiwanie; adresy widoczne w chipach natywnie. Koszt filtra po adresie: 31 h + wieczny cron |
| 2026-07-16 | **v2 — backfill hurtowy zamiast rekord-po-rekordzie (31 h → ~20 min)** | Claude (research) | `updateMany` + cap 100 `[JEST W KODZIE]`. **v1 tego nie uwzględniała — błąd v1** |
| 2026-07-16 | **v2 — reguła kierunku `[D:RESEARCH]` → `[D:CORE]`** | **Dawid (decyzja)** | Zatwierdzona; wariant „perspektywa użytkownika" niewykonalny (brak `connectedAccount` w Core API) |
| 2026-07-16 | v2 — cron 15 min wycięty; mechanizm bieżący = OQ-5 (workflow preferowany) | Claude (research) | Cron istniał wyłącznie dla `participants` |
| 2026-07-16 | v2 — uzasadnienie „docs sprzeczne o credits" **przebite** | Claude (research) | Kotwica in-app: 1 credit = $1, krok ≈ $0,0001. NR-5 stoi na liczbie ($38 vs $0) |
| 2026-07-16 | **v2.1 — NR-7: `Message Visibility` per skrzynka może zabić wyszukiwanie po treści; folder `Sent` może nie być synchronizowany** | Claude (red team) | **Najpoważniejsza luka v2** — projekt stoi na filtrze po treści, a treść bywa niesynchronizowana. Nowy krok 0b |
| 2026-07-16 | **v2.1 — OQ-4 zamknięte: Message nie ma strony rekordu; jedyne wyjście do treści = chip `Message Thread`** | **Dawid (instancja)** | Kolumna `Message Thread` z opcjonalnej na **obowiązkową** |
| 2026-07-16 | **v2.1 — NR-8: nie usuwać `Subject`** | Dawid (pytanie) + Claude (kod) | `messageThread.subject` = temat najnowszego maila w wątku → rozjazd `Re:`/`Fwd:` przy starszych mailach |
| 2026-07-16 | **v2.1 — „Search by any field" nie sięga uczestników** | **Dawid (instancja)** | Trafienie po adresie pochodziło z treści. Strata z NR-3 jest realna i nazwana, nie zamaskowana |
| 2026-07-16 | v2.1 — kontrakt §5.5 pkt 1: wariant A wymaga **dwóch** workflowów, drugi z `IS_EMPTY` | Claude (red team) | v2 mówiła „odporne na kolejność" bez wskazania jak → najłatwiejsze miejsce na cichy błąd |
| 2026-07-16 | v2.1 — nowe kroki: 0b (visibility), 5b (maile bez MCMA), 7b (weryfikacja backfillu), 10b (widok kontrolny) | Claude (red team) | v2 nie miała żadnego kroku sprawdzającego, czy backfill zadziałał |
| 2026-07-16 | v2.1 — §7: pole edytowalne ręcznie, ale zmiana nietrwała | Claude (red team) | Nieopisany tryb interakcji człowiek↔mechanizm |
| 2026-07-16 | **v2.2 — GO potwierdzone: §2 PURPOSE dostał trzy realne zadania (Z1 rozpoznanie, Z2 backstop, Z3 recovery)** | **Dawid (input) + Claude** | Odpowiedź na GO/NO-GO z v2.1. Zakładka Emails jest per-kontakt; Z1/Z2 są globalne → globalny widok uzasadniony. **Z3 jawnie oznaczone jako natywne (zero buildu)** — custom uzasadniają tylko Z1/Z2 |
| 2026-07-16 | **v2.2 — NR-9: filtr „nieprzydzielone / należy do mnie / na skrzynkę X" poza zakresem** | Claude (red team) | Twarda wersja Z2 = inny projekt (cofnięcie NR-3 + materializacja własności/linkage). Właściciel przyjął wersję „na początek wystarczy, że widzę" |
| 2026-07-16 | **v2.2 — zakres zawężony: per skrzynka handlowca, bez wspólnego widoku „studio"** | **Dawid (decyzja)** | §2, §3, krok 0b |
| 2026-07-16 | **v2.2 — krok 0b podniesiony z checklistu do BRAMY** | Claude | `All Email Content` = warunek konieczny Z3 (najważniejszego zadania); brak → STOP + eskalacja |
| 2026-07-16 | **v2.3 — kolumna `Text` z ukrytej na WIDOCZNĄ (fragment treści); NR-6 poprawione** | **Dawid (decyzja)** + Claude (kod) | **Korekta błędu v2.0–v2.1:** `Text` opisywany jako „nieczytelny HTML" — kod pokazuje **oczyszczony plaintext** (html-to-text + wycięte cytaty/podpisy). Komórka przycina się do wiersza (nie rozpycha), szerokość reguluje długość fragmentu. Haczyk zaakceptowany: szum z linków śledzących w mailach marketingowych. Nowy §5.3e + fakt do OPS_NOTES |
| 2026-07-16 | **v2.4 — widok kontrolny przemianowany `🔧 Bez kierunku` → `🔧 Nieoznaczone — MA BYĆ 0`; opisany jako czujka PASYWNA** | **Dawid (decyzja: opcja A)** + Claude | Nazwa myliła („co to bez kierunku?"). Nazwa niesie teraz sens (nie-0 = alarm), bez stałego „UWAGA" (kłamałby w stanie zdrowym). **Fakt z kodu: Twenty nie pokazuje licznika rekordów w menu** (`NavigationDrawerItem` = label+ikona) → czujka wymaga zaglądania. Nowy krok 10c + OQ-10: właściciel i kadencja kontroli |
| 2026-07-28 | **v2.5 — wdrożenie sandbox:** pole `Message.direction`; backfill `updateMessages`; 2 workflowy ACTIVE; 3 widoki + folder Poczta; SSOT (DATA_MODEL / OPS_NOTES / ADR #19) | Composer + Dawid | Korpus ≈ 24 k Message / 27 k MCMA (nie 188 k z v2.4 — stan instancji); OQ-2 PASS; rate limit Cloud = 100/min (API key); OQ-5 = wariant A; OQ-7/OQ-10 nadal na Dawida |

### Implementacja sandbox (2026-07-28) — kotwice

| Artefakt | ID / ścieżka |
|---|---|
| Pole `direction` | `1132c3ef-cbc4-4078-a8c4-94ead344518e` (SELECT INCOMING/OUTGOING) |
| Writer | `integrations/tools/backfill_message_direction.py` |
| Workflow OUTGOING | `2b2d4fbb-…` / version `561bafe4-…` — **DEACTIVATED 2026-07-28** (`Object cannot be updated by automation`) |
| Workflow INCOMING (if empty) | `e268bd53-…` / version `f2a0d209-…` — **DEACTIVATED 2026-07-28** |
| Live mechanizm | `workers/messageDirectionEnrich.js` w `twenty-crm-worker` (webhook MCMA + poll Scheduler) |
| Widoki | Otrzymane `43b754f3-…` · Wysłane `b14a50cf-…` · Nieoznaczone `1cc612c2-…` |
| Folder nav | `Poczta` `b3044f77-…` |
| Deploy IDs | `integrations/tools/deploy_workflow_message_direction.py` |

**Otwarte na człowieka:** OQ-7 (visibility/Sent per skrzynka — brama Z3) · OQ-10 (kto zagląda w 🔧).

### Soft filter skrzynek (2026-07-28) — świadome otwarcie NR-9 w wariancie A

| Artefakt | Wartość |
|---|---|
| Pole | `ourMailboxes` MULTI_SELECT (`4b2ecd47-…`) |
| Reguła widoku | Marta/Gosia/Mariusz = **własna** ∪ `STUDIO` ∪ `LEADS` + kierunek |
| Writer | `backfill_message_our_mailboxes.py` (żywe Message → participants) |
| Live | **GCP worker** `messageDirectionEnrich` (workflow E12.5b DEACTIVATED — Message blocked for automation) |
| Granica | **nie ACL** — to filtr widoku; da się zdjąć / obejść |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja rdzeniowa · `[D:VERIFIED]` — zweryfikowane w kodzie/instancji · `[D:RESEARCH]` — propozycja researchu, niezatwierdzona · `[D:OPEN]` — otwarte
- `[PRZEBITE → X]` — nagrobek: teza obalona nowszym dowodem; zostaje jako ostrzeżenie przed regresją
- **Kotwice dowodów:** `twentyhq/twenty` @ `main` 2026-07-16 (weryfikacja niezależna) · `5f8baa9` (2026-07-15, v1) · `docs.twenty.com` @ 2026-07-16 · **instancja owocni** @ 2026-07-16 (CONTAINS, brak strony rekordu Message, chip wątku, „search by any field"). Fakt bez kotwicy = „nie wiem" w przebraniu.
