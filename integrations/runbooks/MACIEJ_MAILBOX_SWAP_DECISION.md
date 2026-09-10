---
doc_id: MACIEJ_MAILBOX_SWAP_DECISION
title: "Decyzja właściciela — adresy Macieja: sprzedaż na nową skrzynkę, copywriting@ na odbiorze"
layer: runbook
status: ready_to_implement
decided_at: 2026-09-08
revised_at: 2026-09-10
owner: "Właściciel (decyzja) / Dawid (wykonanie)"
audience: "Dawid"
last_verified: 2026-09-10
supersedes: "MACIEJ_MAILBOX_SWAP_DECISION status=awaiting_mariusz (8.09.2026, autor Dawid) — pytanie A/B; treść pytania zachowana w §5"
verified_against: "twentyhq/twenty @ 6da524b8903ec16a3eeea4b2e4a5fb63dbfc1c58 (v2.37) + instancja Twenty 2026-09-10 (kanały IMAP, uczestnicy, stopki) + repo lokalne"
related:
  - PLAN_NAPRAWCZY_GATES.md
  - E12_EMAIL_SYNC_EXECUTION.md
  - E12_3_EMAIL_SIGNATURES_DECISION.md
  - E12_5_MAIL_DIRECTION_VIEWS.md
  - STUDIO_AT_AUTO_LEAD_DECISION.md
  - ../../owocni-crm/ops/OPS_NOTES.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../../owocni-crm/DECISION_REGISTER.md
source: "pytanie operacyjne 8.09.2026 (Maciek) → analiza na kodzie → decyzja właściciela → red team zewnętrzny 8.09.2026 (§14) → potwierdzenie Macieja 10.09.2026"
---

# Adresy Macieja — decyzja właściciela

**Data decyzji:** 8.09.2026 · **Decyduje:** właściciel · **Wykonuje:** Dawid
**Bramka Macieja:** **PASS 10.09.2026** — potwierdził, wdrażamy.
**Wersja po red teamie + odczycie instancji 10.09** — rejestr korekt w §14. Zastępuje wersję pytającą Dawida („czy odwracać `copywriting@` i `maciej@`"): odwracamy, ale **nie tymi dwiema skrzynkami**.

**Zakres teraz:** tylko skrzynka sprzedażowa Maćka (`maciejwysocki@` + `copywriting@` na odbiorze + `maciej@` nietknięte). **`pomoc@` / `obsluga@` / forward — nie ruszamy.** Wejdą do Twenty dopiero gdy powstanie helpdesk; do tego czasu ta gałąź nie jest częścią tego wdrożenia.

---

## 1. Decyzja

| Adres | Rola po zmianie | Twenty | Co się z nim dzieje |
|---|---|---|---|
| **`maciejwysocki@owocni.pl`** | **nowa sprzedaż i odpowiedzi handlowe Macieja** | **tak** — nowy kanał pod jego loginem | zakładamy od zera, pusty |
| `copywriting@owocni.pl` | **odbiór starego adresu sprzedażowego** + dotychczasowa historia | **tak** — zostaje podpięty | odbiera dalej, **nie startuje z niego nowa wysyłka** |
| `maciej@owocni.pl` | dotychczasowe projekty | **nie** | **bez zmian, nie dotykamy** |
| `pomoc@owocni.pl` | **jedyna skrzynka obsługi** — osobny proces, nie lejek sprzedażowy | **nie** · wejdzie **dopiero z helpdeskiem na Twenty** | do tego czasu **nie ruszamy** — ani podpięcia, ani forwardu z `obsluga@`. Reszta w **§15** |

**Zasady:**

1. **Nic nie przenosimy.** Żadnej kopii IMAP, w żadną stronę.
2. **Nic nie kasujemy i nic nie odłączamy.**
3. **Nowa skrzynka jest pusta i świadomie skonfigurowana w chwili podpięcia** — patrz F1 i krok 5.
4. **Adres jest osobowy, nie produktowy.**
5. **„Odbiór starego adresu" znaczy: dalej czytamy i obsługujemy.** Nie znaczy „ignorujemy nowe zapytania, które ktoś tam przyśle". Ma imiennego opiekuna (§12.2).

> **Do potwierdzenia jednym słowem:** zapis decyzji brzmiał `maciejwysocki@owocnik.pl`. Przyjęto jako literówkę — obowiązuje **`maciejwysocki@owocni.pl`**. Wszystkie skrzynki firmowe są na `owocni.pl`.

**Wzorzec nazewniczy jest zachowany, nie łamany:** `robertmank@owocni.pl` i `ewamalanowska@owocni.pl` już działają w schemacie imię+nazwisko (`findSendableEmailAccount.ts:52-53`). `marta@` / `gosia@` / `mariusz@` to starsza warstwa.

**Co ta decyzja obiecuje — i czego nie obiecuje.** Obiecuje: **brak automatycznego importu dotychczasowego archiwum projektowego z `maciej@`** i zachowanie dotychczasowej drogi odbioru projektów. **Nie obiecuje**, że na adresie sprzedażowym nigdy nie pojawi się korespondencja obsługowa — nowy klient kupi po rozmowie z `maciejwysocki@` i w tym samym wątku poprosi o poprawki. Rozdział ról wymaga też rozdziału w automatyce (§12.1), sama trzecia skrzynka go nie daje.

---

## 2. Co to znaczy dla ludzi

**Maciek.** Dostaje własną skrzynkę pod własnym loginem, z SMTP. Wysyła zawsze z nowego adresu. Starych maili nie traci: `copywriting@` dalej jest w Twenty z całą historią. Jego skrzynka `maciej@` w Thunderbirdzie zostaje dokładnie taka, jaka jest — zero rekonfiguracji, zero przenoszenia.

**Klienci.** Nic nie ogłaszamy i nie stawiamy autorespondera. Stary adres działa dalej, bez terminu. Klient, do którego Maciek napisze, zobaczy nowy adres w polu Od i w stopce. Kto napisze na stary — zostanie obsłużony. **Przy przejściu sprawy do realizacji klient dostaje jednoznaczną informację, gdzie prowadzić obsługę** — to jedyny moment, w którym cokolwiek komunikujemy.

**Zespół.** Karty na lejku nie wiszą na skrzynce, więc przejęcie sprawy działa jak dziś. Zmienia się to, że skrzynka do przejęcia nazywa się nazwiskiem człowieka. Zastępstwo ma osobne kryterium odbioru — T11.

---

## 3. Dlaczego nie zamiana `copywriting@` ↔ `maciej@`

### 3.1. Rzecz nieusuwalna: `copywriting@` nie może zostać skrzynką obsługi

Dopóki żyje choć jedna otwarta Opportunity z wątkiem, w którym From = `copywriting@`, ta skrzynka **musi być podpięta do Twenty**. Nie dla ładnej historii — dla kolejki. „Do odpisania", `bizFirstAttemptAt` i przeliczenie ostatniej wiadomości każdej otwartej sprawy (rozstrzygnięcie właściciela z 3.09: *niezależnie od daty*) czytają wyłącznie Twenty. Odpowiedź, która przyjdzie do skrzynki spoza Twenty, dla systemu nie istnieje.

Gdyby `copywriting@` została skrzynką obsługi i wyszła z CRM — cicho gubilibyśmy odpowiedzi na żywe sprawy. Gdyby została skrzynką obsługi i **została** w CRM — wpuszczamy obsługę do lejka, z pełną treścią dla wszystkich (F5).

Intuicja „możemy zerwać łączność z przeszłością" jest słuszna i przyjęta — ale dotyczy Macieja jako człowieka. On niczego nie zgubi. Zgubiłby CRM. Cena zerwania to jedno zdanie: `copywriting@` zostaje na odbiorze.

### 3.2. Pusta skrzynka usuwa konieczność ruszania archiwum

Cały koszt wariantu z `maciej@` brał się z **F1**: pierwszy sync IMAP wciąga całą zawartość synchronizowanych folderów, bez okna dat. Żeby `maciej@` mogło zostać skrzynką sprzedaży, trzeba by najpierw wyprowadzić z niej całe archiwum projektowe — **przed** podpięciem, bo po pierwszym syncu nic się już nie wyjmuje (F2).

Nowa skrzynka jest pusta. Znika przez to: przenoszenie archiwum (cała robota i ryzyko luki), krok jednokierunkowy na danych, ryzyko F5 (projekty Macieja czytelne dla całej firmy) oraz jednorazowy import obcej korespondencji do lejka.

### 3.3. Kierunek nie jest symetryczny

Nowy adres opłaca się **wyłącznie po stronie, która idzie do Twenty**, bo tylko tam pustka jest zyskiem. Gdyby nowy adres dostała rola projektowa, trzeba by do niego przenieść archiwum z `maciej@` — ta sama praca, ta sama granica, inna etykieta. Zysk zeruje się w całości.

`maciej@` zostaje poza Twenty **dlatego, że wciągnięcie go wymagałoby opróżnienia**, a nie z powodu jakiejkolwiek roli systemowej tego adresu.

### 3.4. Stosunek do bramki G2

`PLAN_NAPRAWCZY_GATES.md` §G2 zapisuje **PASS 2026-09-03**: `copywriting@` jest podpięte pod konto Maćka. Bramka sama zastrzega, że **odbiór nie został wykonany** — „Maciek wysyła jeden mail przyciskiem Odpowiedz (on, nie my). Bez tej wysyłki G2 jest deklaracją, nie testem".

Ta decyzja **nie opiera się na twierdzeniu, że wysyłka Macieja jest zepsuta** — tego nikt nie zmierzył. Opiera się na rozdzieleniu ról i uniknięciu migracji archiwum. Stan podłączenia i wysyłki sprawdzamy odczytem i testem (S1, T2), nie wnioskujemy go z gałęzi obsługi błędu w kodzie.

---

## 4. Fakty zweryfikowane w kodzie

Twenty 2.37 (`6da524b8903ec16a3eeea4b2e4a5fb63dbfc1c58`) + repo lokalne. To warstwa dowodowa — nie przepisywać z pamięci, sprawdzić ponownie po upgradzie.

| # | Fakt | Gdzie |
|---|---|---|
| **F1** | Pierwszy sync IMAP bierze **cały folder** (zakres UID `1:maxUid`). Brak okna dat. Obietnica „Date range: Last 7/30 days" w E12 **nie jest dostępna dla IMAP**. | `imap-sync.service.ts` → `fetchNewMessageUids` |
| **F2** | Wyjęcie wiadomości z synchronizowanego folderu **nic nie kasuje** (`messageExternalIdsToDelete: []` zawsze). Wyłączenie folderu z sync też nie kasuje. Sitko folderowe działa **wyłącznie przed** pierwszym syncem. | `imap-get-message-list.service.ts`; `message-folder-metadata.service.ts` → `setSyncStatus` |
| **F3** | **Odłączenie kanału kasuje** — deterministycznie, nie „może": usuwa powiązania, potem osierocone Message i MessageThread. Wiadomość powiązana z drugim kanałem nie jest sierotą i zostaje. | `messaging-message-cleaner.service.ts`; `messaging-message-channel-deletion-cleanup.job.ts` |
| **F4** | Dedup Message po `headerMessageId` **w całym workspace, bez filtra kanału**. Jedna wiadomość może mieć **kilka powiązań kanałowych**. | `messaging-message.service.ts:79` |
| **F5** | Widoczność liczy się **per wiadomość, wygrywa najbardziej pozwalający kanał**. Jeden kanał `SHARE_EVERYTHING` czyni wiadomość jawną dla wszystkich. | `apply-messages-visibility-restrictions.service.ts` |
| **F6** | `handle` kanału jest **nieedytowalny**. Update przyjmuje tylko `visibility`, `isContactAutoCreationEnabled`, `contactAutoCreationPolicy`, `messageFolderImportPolicy`, `isSyncEnabled`, `excludeNonProfessionalEmails`, `excludeGroupEmails`. | `update-message-channel.input.ts` |
| **F7** | Zapytania z copywriting.pl **już lecą na `leads@`** formularzem i routują do Macieja **po produkcie**, nie po skrzynce. | `formMailWitness.js:86`; `createLead.js:388` |
| **F8** | Fabryka kart to wyłącznie `leads@`. Mail bezpośrednio do handlowca nie tworzy karty u nikogo. | `createLead.js:1115`; `STUDIO_AT_AUTO_LEAD_DECISION.md` |
| **F9** | Podmiana magazynu za adresem u hosta zmienia UIDVALIDITY → `SYNC_CURSOR_ERROR` i pełny resync. | `imap-sync.service.ts` → `validateUidValidity` |
| **F10** | Jeśli wysyłka wskazuje `preferredAccountId`, którego **nie ma na liście dozwolonych**, kod **po cichu spada na konto domyślne** zamiast odmówić. Po zmianie mapowania stary wybór Macieja wyjdzie z nowego adresu, a treść może nadal nieść starą stopkę. | `findSendableEmailAccount.ts:537-546` (`pickDefaultAccount`) |
| **F11** | Stopki: rekordy z CRM **nadpisują** wartości z pliku (`{...DEFAULT, ...crm}`). Zmiana samego `mailSignature.ts` **nie usuwa** starego przypisania, jeśli istnieje rekord w Twenty. | `mailSignature.ts:152` → `mergeSignatureCatalog` |
| **F12** | Worker kolejki dedupikuje **per powiązanie kanałowe** (`wasProcessed(associationId)`), nie per wiadomość. `lastContactAt` ma strażnika kierunku (`resolveForwardLastContactAt`), ale **`isFollowUp` nie ma strażnika kolejności** — starsza wiadomość przetworzona po nowszej ponownie włącza „do odpisania". | `advanceNewToContacted.js:255` vs `:271-276` |
| **F13** | `attachInternalHandoffThread` uruchamia się **wyłącznie** przy `internalHandoff && opportunityId`. **Nie jest** mechanizmem łączenia zwykłych odpowiedzi do klientów. | `send-template-email.logic-function.ts:460` |
| **F14** | Standard floty od 4.09: **auto-create kontaktów = None na 6 skrzynkach**, `CUTOVER_AT=2026-08-31`. Domyślna polityka Twenty na nowym kanale to `SENT` — czyli **inna niż wasza**. | `OPS_NOTES.md` §5.3, wpis 2026-09-04; `message-channel.entity.ts` |

---

## 5. Co w wersji pytającej nie broniło się przy sprawdzeniu

Warstwa dowodowa — te punkty mają nie wrócić przy kolejnej rozmowie o skrzynkach.

1. **Opcja B była wyceniona jako pełna zamiana treści skrzynek** („kopia wszystkich maili w obie strony"). Właściciel o to nie prosił i zdjął wymóg wstecznej kompatybilności.
2. **„Odwrócenie kasuje historię z kart" — nie kasuje**, bo niczego nie odłączamy (F3).
3. **Podmiana skrzynek u theCamels jest kierunkowo błędna**: odpowiedzi na stare wątki sprzedażowe lądowałyby w skrzynce obsługowej. Dodatkowo F9.
4. **„Sitko folderów" nie działa po fakcie** (F2).
5. **„Zero ryzyka kontaktów projektowych" w opcji A też nie było prawdą** — klient, któremu Maciek sprzedał z `copywriting@`, pisze o projekcie w tym samym wątku.
6. **Największego realnego kosztu w liście nie było**: F1.

---

## 6. Kolejność wykonania

| # | Krok | Warunek zaliczenia |
|---|---|---|
| 1 | **Odczyt stanu**: `copywriting@` w Settings → Accounts (konto, sync, SMTP, visibility). Nic nie zmieniać. | Wynik w §11/S1 |
| 2 | **Guard `cutoverAt`** — potwierdzić działanie. Dla nowej skrzynki nie jest blokerem (nie ma historii), ale obowiązuje dla całości. | Wiadomość `receivedAt < cutoverAt` nie zapala „do odpisania" |
| 3 | **Założyć `maciejwysocki@owocni.pl`** na theCamels. Hasła do `better-bitrix-main/.env`. | IMAP/SMTP odpowiada |
| 4 | **Opróżnić skrzynkę powitalną**, jeśli host coś wrzucił. | INBOX i Wysłane puste **przed** krokiem 5 |
| 5 | **Podpiąć pod login Macieja** i **od razu ustawić politykę**, nie zostawiać domyślnych (F14): auto-create kontaktów zgodnie ze standardem floty, wykluczenia, foldery Inbox + Wysłane, visibility `All Email Content`. | Sync ACTIVE, zaimportowano **0** wiadomości, polityka zapisana w `OPS_NOTES.md` §5.3 |
| 6 | **Zamknąć przygotowane wysyłki i odświeżyć edytor Macieja** — zamyka okno F10. | Brak otwartych kompozytorów sprzed zmiany |
| 7 | **Przestawić mapowanie i mapy skrzynek** — §7.1. | Deploy Owocni Mail + worker |
| 8 | **Stopka**: plik **oraz** rekord w Twenty (F11). | Podgląd w edytorze pokazuje nowy adres |
| 9 | **Widoki 📥/📤 Maciej** — filtr `COPYWRITING` **lub** `MACIEJ`. | Maciek widzi stare i nowe w jednym miejscu |
| 10 | **Odbiór** — §10, komplet. | Wszystkie kryteria zielone |

Kroki 6 i 7 idą **razem, w jednym oknie**. Rozdzielenie ich otwiera okno F10 na cały czas między deployami.

---

## 7. Powierzchnia zmiany

### 7.1. Do zmiany

| Plik / miejsce | Zmiana |
|---|---|
| `findSendableEmailAccount.ts:19-25` | `LOGIN_TO_PERSONAL_SEND_HANDLES` → `'maciej@owocni.pl': ['maciejwysocki@owocni.pl']`. **Mapowanie zostaje, zmienia cel** — patrz 7.3. |
| `findSendableEmailAccount.ts:44-55` | `OUR_MAILBOX_VALUE_TO_HANDLE` → dodać `MACIEJ: 'maciejwysocki@owocni.pl'`. `COPYWRITING` **zostaje**. |
| `mail-send-readiness.logic-function.ts:46` | Komunikat „Dla Macieja From = copywriting@ (nie maciej@)" → nowy adres. |
| `mailSignature.ts:23` | Widoczny adres w treści stopki Macieja → `maciejwysocki@`. |
| `mailSignature.ts:55` | `mailboxHandle` → **`'maciejwysocki@owocni.pl'`**. Usunięcie `maciej@` z tej listy jest obowiązkowe. |
| **Rekord „Stopki maili" w Twenty** | **Zaktualizować rekord Macieja** — przypisanie na nowy adres, treść uzgodniona 31.08 bez zmian poza adresem. Bez tego zmiana w pliku nie zadziała (F11). Nie zasiewać wszystkich stopek ponownie. |
| `mail-signature.object.ts:45` | Przykład w opisie pola (kosmetyka). |
| `messageDirectionEnrich.js:21-32` | `HANDLE_TO_VALUE` → dodać `"maciejwysocki@owocni.pl": "MACIEJ"`. **Nie dodawać `maciej@owocni.pl`** (7.4). |
| Twenty, SELECT `ourMailboxes` | Nowa opcja `MACIEJ` (Metadata API). |
| `backfill_message_our_mailboxes.py:40`, `bb_mail_cdelta_append.py:48`, `report_mailbox_history_min.py:26` | Ta sama mapa. |
| `E12_EMAIL_SYNC_EXECUTION.md` | 7 skrzynek → 8; nowe zmienne env; mapowanie „Maciej→`copywriting@`" → nowy adres. |
| `E12_5_MAIL_DIRECTION_VIEWS.md:530` | Maciej = `COPYWRITING` **+** `MACIEJ`. |
| `E12_3_EMAIL_SIGNATURES_DECISION.md` | Wiersz Macieja na nowy adres. |
| `OPS_NOTES.md` §5.3 | Wpis o podpięciu i ustawionej polityce kontaktów. |

### 7.2. Bez zmian — celowo

- `createLead.js`, `CRM_TWENTY_CREATE_LEAD.sGTM.js` — routing po **produkcie** `COPYWRITING`, nie po skrzynce (F7).
- `personContext.ts` → `isInternalMailbox` — obejmuje `@owocni.pl`, łapie nowy adres sam.
- `copywriting@` w Twenty — **zostaje podpięte**.

### 7.3. Mapowanie login → skrzynka: zmienić, nie usuwać

Login Macieja w Twenty pozostaje `maciej@owocni.pl`, a skrzynka nazywa się inaczej — więc mapowanie jest nadal potrzebne, tylko wskazuje nowy cel. Bez tego `isOwnedByCurrentUser()` zwróci `false` i Maciek nie wyśle z własnej skrzynki.

Wyjątek **nie znika, tylko przestaje kłamać**: z „Maciej wysyła z produktu" robi się „login ≠ skrzynka" — kategoria, która już istnieje (Mariusz: login `owocni@gmail.com`, skrzynka `mariusz@`).

Zmiana loginu Twenty i skasowanie mapowania to **osobny, późniejszy krok**. Nie w trakcie stabilizacji.

### 7.4. Dlaczego `maciej@` nie wchodzi do `HANDLE_TO_VALUE`

Ta mapa znaczy „to nasza skrzynka w CRM". `maciej@` zostaje poza CRM. Dopisanie go zaczęłoby etykietować korespondencję projektową jako sprzedażową.

### 7.5. Opcjonalne utwardzenie F10 — tylko w wersji precyzyjnej

Wariant blokujący każdą nierozpoznaną wartość `preferredAccountId` **tworzy regres**: ponowne podpięcie skrzynki nadaje nowe id konta, więc każdy kontekst z poprzednim id przestałby wysyłać zamiast spaść na sensowny domyślny wybór.

Wersja bez regresu: odmawiać **tylko wtedy, gdy wskazane konto istnieje, ale nie jest dozwolone dla tego użytkownika**; id nieznane → zachować dzisiejszy fallback. Dane do rozróżnienia już są — `loadCandidateAccounts` liczy `activeAccounts` przed filtrowaniem i je odrzuca.

**To jest utwardzenie na przyszłość, nie warunek tej migracji** — okno F10 zamyka krok 6. Wartość ma dlatego, że kolejne zmiany skrzynek są przed wami (`pomoc@`, `obsluga@`, konsolidacja domen).

---

## 8. Czego nie robimy — czerwone linie

- **Nie przenosimy archiwum `obsluga@` do `pomoc@`.** FORWARD przekierowuje **ruch**, nie przeprowadza **archiwum** — dokładnie jak 301: nowe żądania idą pod nowy adres, stara treść zostaje tam, gdzie leży. `obsluga@` zostaje archiwum (dostępnym w kliencie poczty), **szablony kopiujemy — nie archiwum**. Wlanie archiwum do skrzynki podpiętej do Twenty to jednorazowy, nieodwracalny import całej historii serwisowej z pełną treścią dla wszystkich (F1 + F5 + F2).
- **Nie podpinamy `obsluga@` do Twenty — nigdy.** Przy zachowanych nagłówkach ta sama wiadomość miałaby dwa powiązania kanałowe (F4) i byłaby liczona dwa razy przez worker kolejki (F12).
- **Nie kasujemy i nie odłączamy `copywriting@`** (F3).
- **Nie przekierowujemy `copywriting@` na `leads@`.** Formularze już tam lecą (F7), a blankietowe przekierowanie złamałoby jedyną fabrykę kart (F8).
- **Nie robimy auto-kart z maila na skrzynce handlowca.**
- **Nie zszywamy automatycznie rozmów po temacie i uczestnikach.** Połączyłoby odrębne sprawy tego samego klienta — a to kłóci się z rozstrzygnięciem „nowe zapytanie od znanego klienta tworzy nową Opportunity". Naprawa kolejki, jeśli będzie potrzebna, jest osobną wąską zmianą.
- **Nie ogłaszamy zmiany adresu** i nie stawiamy autorespondera.
- **Nie podpinamy nowej skrzynki „na próbę"** — pierwszy sync jest ostateczny (F2).
- **Nie ustawiamy `maciej@` jako aliasu na sprzedaż** bez osobnej decyzji: wprowadziłoby to z powrotem korespondencję projektową dokładnie tam, przed czym ta zmiana chroni.

---

## 9. Ryzyka przyjęte świadomie

| Ryzyko | Status | Tripwire |
|---|---|---|
| **Korespondencja obsługowa na adresie sprzedażowym** — nowy klient kupi i w tym samym wątku poprosi o poprawki; może też przyjść w kopii do kilku skrzynek. | **Nie jest usunięte przez tę zmianę.** Usunięty jest wyłącznie import starego archiwum. Pełny rozdział wymaga też automatyki (§12.1). | Obsługa zaczyna dominować na kanale sprzedaży → wraca temat §12.1 |
| **Dwa adresy osobowe jednej osoby** — nazwa nie mówi, do czego służy. | Przejściowo brzydsze, docelowo czystsze. Każdy adres ma jedną rolę; §12.2 wyznacza **termin przeglądu**, nie automatyczne wyłączenie. | Pytanie „po co Maciek ma dwa" bez odpowiedzi w tym pliku → uzupełnić |
| **Rozjazd wątków między kanałami.** `attachInternalHandoffThread` **nie jest** tu zabezpieczeniem (F13) — działa tylko przy wewnętrznym przekazaniu. | Kryterium odbioru T3, w pełnym cyklu. | T3 czerwony → wstrzymać krok 9, nie sięgać po automatyczne zszywanie (§8) |
| **Kolejka: „do odpisania" bez strażnika kolejności** (F12). Luka istniejącego mechanizmu; dwa kanały zwiększają szansę na przetwarzanie poza kolejnością. | Nie naprawiamy przy okazji migracji. Test ma pokazać, czy dwa kanały ją ujawniają. | T3 pokaże powrót „do odpisania" po odpowiedzi handlowca → osobna wąska naprawa |
| **Stary wybór nadawcy** (F10). | Zamknięte krokiem 6; utwardzenie kodu opcjonalne (§7.5). | Ktokolwiek raportuje mail wysłany z nowego adresu ze starą stopką |
| **Zastępstwo** — Marta/Gosia muszą znaleźć sprawę Macieja, zobaczyć historię z **obu** kanałów i odpowiedzieć ze swojego nadawcy (ADR #22). Własność karty nie jest dowodem dostępu do poczty. | Reguła nie jest nowa, ale dotyczy teraz dwóch kanałów. | T11 czerwony → rozstrzygnąć zastępstwo przed urlopem, nie w trakcie |

---

## 10. Kryteria odbioru

| # | Test | Zaliczenie |
|---|---|---|
| T1 | Po kroku 5: liczba zaimportowanych wiadomości na nowym kanale | **0** |
| T2 | Maciek otwiera Opportunity → **Odpowiedz** i **realnie wysyła** | Mail dociera; From = `maciejwysocki@`; zamyka też odbiór G2 |
| T3 | **Pełny cykl:** klient pisze na stary adres → Maciek odpowiada z nowego → klient odpowiada ponownie → powtórzyć przy synchronizacji **w odwrotnej kolejności i z opóźnieniem**. Po każdym kroku sprawdzić: historię, właściwą Opportunity, `isFollowUp`. Uwzględnić klienta z **dwiema otwartymi** sprawami. | Historia kompletna na właściwej karcie; „do odpisania" nie wraca po odpowiedzi handlowca; sprawy się nie mieszają |
| T4 | Klient klika Odpowiedz na mailu od Macieja | Trafia na `maciejwysocki@`, wątek wraca do CRM |
| T5 | Podgląd stopki w edytorze przed wysyłką | Nowy adres; mail wychodzi dokładnie taki jak w edytorze |
| T6 | Mail projektowy na `maciej@` | **Nie pojawia się** w Twenty |
| T7 | Widok 📥 Maciej | Łapie `COPYWRITING` i `MACIEJ` |
| T8 | Maciek próbuje wybrać `copywriting@` jako From | Adresu nie ma na liście |
| T9 | Nowa Opportunity z formularza copywriting.pl | Trafia do Macieja, routing bez zmian (F7) |
| T10 | **Polityka kontaktów** na nowym kanale: mail od **nowego nadawcy spoza CRM** oraz od **istniejącego klienta** | Zachowanie zgodne ze standardem floty, nie z domyślnym Twenty (F14) |
| T11 | **Zastępstwo**: Marta ze swojego konta znajduje otwartą sprawę Macieja, widzi historię z obu kanałów i odpowiada ze swojego nadawcy | Znajduje, widzi komplet, wysyła — bez pomocy administratora |
| T12 | Stopka Marty po zmianie rekordu Macieja | Nienaruszona |

Reguła z planu tygodnia obowiązuje: **poprawka działająca u jednej osoby, a u dwóch nie, nie jest poprawką.** T2 i T5 przejść u Marty lub Gosi bez regresji.

---

## 11. Do sprawdzenia przed startem

| # | Pytanie | Kto | Wynik |
|---|---|---|---|
| S1 | Stan `copywriting@` w Settings → Accounts: konto, sync, SMTP, visibility, polityka kontaktów | Dawid | **PASS 10.09 (UI).** Import Wszystko; wyklucz grupowe ON; widoczność Wszystko; auto-create **Brak**. Kanał IMAP `dc9cc055-…` żywy. |
| S1b | Stan `maciejwysocki@` w Settings → Accounts (to samo) | Dawid | **PASS 10.09.** Import Wszystko; wyklucz grupowe ON; widoczność Wszystko; auto-create **Brak** (po korekcie z domyślnego SENT). T1 = 0. |
| S2 | Czy guard `cutoverAt` działa | Dawid | Kod: `CUTOVER_AT` / default `2026-08-31T00:00:00+02:00` w `followUp.js`. **Nie re-testowane live 10.09** — nie bloker nowej pustej skrzynki (krok 2). |
| S3 | Gdzie `maciej@owocni.pl` jest opublikowany (strona, wizytówka, profil Google, podpisy zewnętrzne) | właściciel + Maciek | ………… — **nie bloker:** `maciej@` nie zmieniamy i nie ogłaszamy. |
| S4 | **Czy `pomoc@` jest realnie podpięte do Twenty.** | Dawid | **Nie — wniosek z instancji 10.09.** 8 kanałów IMAP; żaden nie wygląda na archiwum `pomoc@`. 87 uczestników (11 FROM, 57 TO); ostatni FROM 25.08; mail z `pomoc@` wszedł jako `INCOMING` na cudzy kanał. **Gałąź `pomoc@` odłożona** (helpdesk) — forwardu teraz nie włączamy, więc brak zrzutu Settings nie blokuje skrzynki Maćka. Przed jakimkolwiek forwardem / podpięciem: zrzut UI. |
| S5 | Czy theCamels wrzuca mail powitalny do nowej skrzynki | Dawid | ………… — rozstrzyga się przy kroku 3–4 (opróżnić przed Connect). |
| S6 | Czy istnieje rekord „Stopki maili" Macieja w Twenty i na jakie adresy jest przypisany (F11) | Dawid | **PASS 10.09.** Rekord „Maciej Wysocki” (`dd96f94e-…`): `mailboxHandle=maciejwysocki@owocni.pl`, HTML From zaktualizowany. |

---

## 12. Decyzje pozostające przy właścicielu

1. **Rozdział obsługi od sprzedaży w automatyce.** Trzecia skrzynka rozdziela adresy, nie procesy. Jeśli wymaganiem jest zerowy wpływ obsługi na lejek, potrzebna jest reguła w automatyce. Sam adres obsługi jest już rozstrzygnięty — §15. **Nie blokuje skrzynki Maćka.**
2. **Termin przeglądu starych adresów — nie data wyłączenia.** `copywriting@` należy do domeny `owocni.pl`: wyłączenie strony copywriting.pl **nie sprawi**, że klienci przestaną go używać. Zamknięcie wszystkich obecnych spraw też nie wyklucza powrotu klienta za pół roku. Stare adresy pozostają odbierane i mają **imiennego opiekuna**. Ustalić datę przeglądu, nie egzekucji.
3. **Czy i kiedy zmieniamy login Twenty Macieja** (7.3). Rekomendacja: nie w trakcie stabilizacji.
4. **Zastępstwo** — czy T11 wystarcza, czy potrzebna jest osobna procedura na urlop Macieja.

**Rozstrzygnięte 10.09:** `pomoc@` wejdzie do Twenty **dopiero gdy powstanie helpdesk**. Do tego czasu nie podpinamy, nie włączamy forwardu z `obsluga@` i nie rozwijamy §15.4.

---

## 13. Odwrót

**Odwracalna jest konfiguracja, nie korespondencja.** Po pierwszej realnej wysyłce z nowego adresu historia tej korespondencji istnieje **tylko** na nowym kanale — `copywriting@` jej nie ma i mieć nie będzie.

- **Przed krokiem 5** — cofnięcie darmowe: skrzynka nie zostaje podpięta.
- **Po pierwszej wysyłce** — odwrót **nigdy nie polega na odłączeniu nowego kanału**. Odłączenie kasuje wiadomości powiązane wyłącznie z nim (F3), czyli wszystkie odpowiedzi na już wysłane oferty. Odwrót = **przestajemy wysyłać z nowego adresu, ale zostawiamy jego odbiór, synchronizację i historię**. Powrót do starego nadawcy dopiero po sprawdzeniu, że wysyłka z `copywriting@` realnie działa.
- **Koszt takiego odwrotu**: utrzymanie dodatkowej skrzynki, którą i tak zakładacie. Zero migracji wiadomości.
- **Cofnięcie samego mapowania** (krok 7) wraca do stanu sprzed zmiany tylko wtedy, gdy `copywriting@` jest podpięte pod konto Macieja **i wysyłka z niego przechodzi test**. Inaczej cofnięcie zostawia go bez działającego nadawcy.

**Tripwire powrotu do rozmowy o zamianie skrzynek:** ktokolwiek proponuje przeniesienie maili między skrzynkami — czytać §4 przed odpowiedzią.

---

## 14. Rejestr korekt po red teamie (8.09.2026)

| # | Co poprawiono | Powód |
|---|---|---|
| K1 | Usunięto argument o `MANAGER_EMAIL` / alarmach dyspozytora | `LEAD_DISPATCHER_PLAN.md` ma `status: retired`, **RETIRED 2026-09-04**, alerty managera wycofane. Argument opierał się na archiwum. |
| K2 | Przepisano §3.4 — nie twierdzimy, że wysyłka Macieja jest zepsuta | `PLAN_NAPRAWCZY_GATES.md` §G2: **PASS 2026-09-03**, podpięte pod jego konto; brakuje wyłącznie odbioru. Obecność `canSend: false` w kodzie to gałąź obsługi błędu, nie pomiar. |
| K3 | Usunięto „pełną odwracalność" i „brak kroku nieodwracalnego" (§1, §6, §13) | Po pierwszej realnej wysyłce odłączenie kanału kasuje korespondencję (F3). Odwrót przedefiniowany. |
| K4 | Usunięto „skrzynka czysta od pierwszego dnia i taka zostaje" | Nowy klient przejdzie do realizacji w tym samym wątku. Obietnica zawężona do braku importu archiwum. |
| K5 | Usunięto `attachInternalHandoffThread` jako zabezpieczenie wątkowania | F13 — działa wyłącznie przy wewnętrznym przekazaniu sprawy. |
| K6 | Dodano politykę tworzenia kontaktów do kroku 5 i T10 | F14 — domyślna polityka Twenty (`SENT`) różni się od standardu floty (`None` na 6 skrzynkach, 4.09). |
| K7 | Dodano aktualizację rekordu stopki w Twenty | F11 — rekordy z CRM nadpisują plik; sama zmiana `mailSignature.ts` nie usuwa starego przypisania. |
| K8 | Dodano krok 6 (zamknięcie wysyłek, odświeżenie edytora) i §7.5 | F10 — cichy fallback starego wyboru nadawcy. |
| K9 | Rozszerzono T3 o pełny cykl, odwrotną kolejność i klienta z dwiema sprawami; dodano F12 | Widoczna historia nie dowodzi poprawnej kolejki. |
| K10 | Zamieniono „daty śmierci" na termin przeglądu; dopisano zakaz aliasu `maciej@` → sprzedaż | `copywriting@` jest na `owocni.pl` — konsolidacja copywriting.pl go nie wyłącza. |
| K11 | Dodano T11 (zastępstwo) i T12 (stopka Marty) | Własność karty nie jest dowodem dostępu do poczty. |
| K12 | Dodano §15 — `pomoc@` jako jedyna skrzynka obsługi, FORWARD z `obsluga@` | Decyzja właściciela 8.09 (wieczór). `pomoc@` przestało być pytaniem w §12, stało się deklaracją z warunkami. |
| K13 | §15 przebudowane: „wejdzie wkrótce" → **nierozstrzygnięte**; dopisane §15.3 (czym `pomoc@` nie jest), §15.4 (konsolidacja teraz) i §15.5 (ryzyka na wypadek wejścia do Twenty) | Korekta właściciela: skrzynka działa poza systemem od dawna i **ma** duże archiwum — forward do niego dokłada, nie tworzy go. To nie jest kanał leadów, tylko kolejka pracy do wykonania. Zamiast rozstrzygać wątki teraz — zapisane ryzyka i weryfikacje na moment konsolidacji. |
| K14 | 10.09: Maciej PASS; `pomoc@` odłożone do helpdesku; odczyt instancji w §11 | Potwierdzenie Maćka otwiera wdrożenie skrzynki sprzedażowej. `pomoc@` / forward / §15.4 **nie są częścią tego wdrożenia**. S1 UI nadal przed Connect. S4 (niepodpięte) z kanałów IMAP, nie ze zrzutu Settings. |

**Co zostało bez zmian:** układ czterech adresów, brak przenoszenia historii, pozostawienie loginu Macieja, `copywriting@` na odbiorze, zakaz auto-kart i auto-zszywania, kolejność „pusto przed podpięciem".

---

## 15. `pomoc@` — deklaracja właściciela i warunki brzegowe

**To nie jest część wdrożenia skrzynki Maćka.** 10.09: `pomoc@` wchodzi do Twenty **dopiero z helpdeskiem**. Do tego czasu nie podpinamy, nie włączamy forwardu, nie budujemy procesu. Ta sekcja przechowuje ustalenia, żeby przy helpdesku nie zaczynać od zera.

### 15.1. Deklaracja (właściciel, 8.09.2026; korekta 10.09)

1. **`pomoc@owocni.pl` jest jedyną skrzynką obsługi.** Nie ma drugiego adresu obsługowego i nie powstaje żaden nowy.
2. **`obsluga@owocni.pl` przestaje istnieć jako adres docelowy** — dostaje **FORWARD na `pomoc@`**. W słowach właściciela: *odpowiednik przekierowania 301 dla maili*. Adres nadal odbiera i niczego nie odrzuca, ale nic się na nim nie zatrzymuje. **Forward nie jest w zakresie teraz** — odpala się przy helpdesku, po S4 w UI.
3. **301 przekierowuje ruch, nie przeprowadza archiwum.** Archiwum `obsluga@` zostaje tam, gdzie jest — dostępne, z imiennym opiekunem. Szablony kopiujemy, archiwum nie (§8).
4. **Maciej w roli obsługi pracuje na `pomoc@`** — nie na `obsluga@`, nie na `maciej@`, nie na `copywriting@`.
5. **`pomoc@` wejdzie do Twenty dopiero gdy powstanie helpdesk.** Skrzynka **działa poza systemem od dawna** i ma odpowiednio duże archiwum. Wejście to **osobna, duża operacja migracyjna z własnym planem synchronizacji** — nie rozszerzenie tej decyzji i nie kliknięcie „connect".
6. **Musi powstać osobny dokument** — `POMOC_SERVICE_TRACK_DECISION`. Dopóki nie powstanie, §15 jest jedynym miejscem, w którym te ustalenia istnieją. Przy jego powstaniu §15.2–15.5 **przenieść tam w całości** i zostawić tu odsyłacz.

### 15.2. Warunek kolejnościowy — gdy wrócimy do tej gałęzi

**Odpowiedź na S4 (zrzut Settings → Accounts) musi paść przed ustawieniem FORWARDU, nie przed podpięciem.**

Odczyt 10.09 (kanały IMAP) mówi: `pomoc@` **nie** jest podpięte. To nie zastępuje zrzutu UI w dniu forwardu. Jeśli jednak byłoby podpięte, włączenie forwardu **natychmiast** wlewa ruch obsługowy do CRM — z pełną treścią dla wszystkich (F5) i bez możliwości wycofania (F2). Forward jest bezpieczny **tylko** przy potwierdzonym „nie".

### 15.3. Czym `pomoc@` **nie** jest

Zapisane, bo najgroźniejszy odruch przy tej skrzynce to sięgnięcie po maszynerię sprzedaży.

- **To nie jest kanał leadów.** Nie ma tam leadów marketingowych, nie ma orkiestracji, nie ma rozdzielania, nie ma przydziału ownera.
- **To kolejka pracy do wykonania.** Mail mówi, że ktoś ma coś do zrobienia; osoba na obsłudze procesuje go, aż zostanie zrobione. Miarą jest domknięcie zgłoszenia, nie etap lejka.
- **Fabryka kart jej nie dotyczy** — karty powstają wyłącznie z `leads@` (F8) i tak ma zostać.
- **Inny proces = inne narzędzie procesu.** Jeśli kiedyś trafi do Twenty, potrzebuje własnego widoku i własnych stanów, nie kolumn lejka sprzedażowego.

### 15.4. Konsolidacja `obsluga@` → `pomoc@` — **odłożone do helpdesku**

Nie wykonujemy teraz. Kolejność na tamten dzień:

| # | Krok | Weryfikacja |
|---|---|---|
| K1 | **Odpowiedzieć na S4 przed włączeniem forwardu** (§15.2) | Zrzut z Settings → Accounts |
| K2 | Forward ustawiony **po stronie serwera** (theCamels), nie regułą w kliencie poczty | Reguła działa przy wyłączonym Thunderbirdzie |
| K3 | Forward **zachowuje oryginalne nagłówki** | Mail testowy: `Message-ID` i `From` bez zmian |
| K4 | `obsluga@` **dalej odbiera i jest czytelna** — nie kasujemy skrzynki, nie przenosimy archiwum | Maciek otwiera archiwum w kliencie poczty |
| K5 | **Nikt nie wysyła z `obsluga@`** — wychodzące wyłącznie z `pomoc@` | Stopka i konto domyślne w kliencie poczty |
| K6 | **Szablony** skopiowane do `pomoc@` / do szablonów Twenty (E12.3) | Lista szablonów zgodna |
| K7 | **Imienny opiekun** archiwum `obsluga@` | Wpisany w `POMOC_SERVICE_TRACK_DECISION` |
| K8 | Maciek ma dostęp do `pomoc@` w kliencie poczty | Odbiera i wysyła |

### 15.5. Jeśli kiedyś `pomoc@` miałaby wejść do Twenty — ryzyka i weryfikacje

**Nie rozstrzygamy tego teraz.** Lista istnieje po to, żeby przy tamtej decyzji nie zaczynać od zera. Do przeniesienia do `POMOC_SERVICE_TRACK_DECISION` i **skopiowania do `E12_EMAIL_SYNC_EXECUTION.md`** w momencie podpinania — bo tam zajrzy osoba wykonująca, nie tutaj.

| # | Ryzyko | Procedura / weryfikacja przed podpięciem |
|---|---|---|
| R1 | Pierwszy sync bierze **całe** archiwum skrzynki, która działa od lat (F1), nieodwracalnie (F2) | Osobna operacja migracyjna z własnym preflightem; **zakres importu jest decyzją**, nie skutkiem kliknięcia. Ustalić, co ma wejść, a co zostaje poza CRM |
| R2 | Treść obsługowa staje się czytelna dla całej firmy (F5) | Rozstrzygnąć widoczność kanału **przed** podpięciem. Obsługa niesie reklamacje, faktury, dane dostępowe — inna kategoria niż korespondencja handlowa |
| R3 | Baza Person zaśmiecona nadawcami serwisowymi | Świadoma polityka tworzenia kontaktów (F14). Person to przestrzeń tożsamości sprzedaży (`idOid`, resolver T1–T5, merge) — nie wolno jej zasypać ruchem obsługowym |
| R4 | `ourMailboxes` liczy się z uczestników, nie z kanału | Przestawić kryterium **zanim** `pomoc@` wejdzie: mail przekierowany z `obsluga@` nosi `To: obsluga@` i dostanie etykietę `OBSLUGA`, nie `POMOC`. Forward **ujawnia** znany defekt E12.5, zamiast go ominąć |
| R5 | Ktoś podepnie też `obsluga@` „dla pewności" | **Zakaz** (§8). Ta sama wiadomość na dwóch kanałach = dwa powiązania (F4) i podwójne przeliczenie kolejki (F12) |
| R6 | Nie wiadomo, kto może wysyłać z `pomoc@` | ADR #22: handlowiec wysyła tylko ze swojej skrzynki, adresy ogólne są operatorskie (`GENERAL_MAILBOX_HANDLES` = `studio@`, `leads@`). Dziś konfliktu nie ma, bo Maciek pracuje w kliencie poczty. W dniu podpięcia powstaje |
| R7 | Odruchowe reużycie lejka sprzedażowego | §15.3. Osobny proces, osobne stany, brak auto-kart |

**Świadomie nierozstrzygnięte do helpdesku:** kształt procesu obsługi, czy mail tworzy jakikolwiek rekord, co ze sprawami wygranymi, które wracają, oraz relacja do rozstrzygnięcia z 7.09 („obsługa posprzedażowa w ogóle nie ma być u handlowca"). Wejście do Twenty jest rozstrzygnięte warunkowo: **tak, gdy powstanie helpdesk**. To materiał na `POMOC_SERVICE_TRACK_DECISION`, nie na to wdrożenie.

---

**Podpis decyzji:** właściciel, 8.09.2026 · **Bramka Macieja:** PASS 10.09.2026 · **Przegląd:** po T2 (prawdziwa wysyłka Maćka) albo przy pierwszym czerwonym kryterium z §10.
