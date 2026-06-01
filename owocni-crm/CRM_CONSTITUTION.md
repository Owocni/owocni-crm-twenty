---
doc_id: CRM_CONSTITUTION
title: "CRM_CONSTITUTION — INVARIANTS, role, 9 praw, governance"
layer: core_ssot
status: active
edit_scope: structure_only
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-05-31
recheck_trigger: "zmiana praw / zmiana modelu uprawnień Twenty / nowy plik kanoniczny"
default_trust: D:CORE
related:
  - DATA_MODEL
  - EVENT_CONTRACT
  - IDENTITY_AND_INBOUND
  - DECISION_REGISTER
  - ops/OPS_NOTES
---

# CRM_CONSTITUTION — INVARIANTS, role, 9 praw

## 0. INVARIANTS (primacy — zawsze ładowane, przeżywają kompaktację)

Twarde zakazy nienaruszalne. Każdy: zakaz → powód → konsekwencja → kto odmraża.

| ID | Invariant (zakaz/zasada) | Powód | Konsekwencja naruszenia | Odmraża | Trust |
|---|---|---|---|---|---|
| INV-1 | **Research ≠ decyzja. `[D:CORE]`/`[D:VERIFIED]` bije `[D:RESEARCH]` zawsze.** Zalecenie researchu zmieniające coś `[D:CORE]`/`[D:VERIFIED]` to hipoteza do ADR, nie podstawa edycji. Podważyć `[D:CORE]`/`[D:VERIFIED]` można WYŁĄCZNIE dowodem z instancji/platformy, nigdy innym researchem. | Domysł traktowany jak przemyślana decyzja cutoveru cofa rdzeń systemu. | Cicha zmiana fundamentu pod pozorem „ulepszenia". | Właściciel + ADR | D:CORE |
| INV-2 | **`[D:OPEN]` nie staje się po cichu `[D:CORE]`.** Żaden mechanizm `[D:OPEN]` nie może być traktowany jako zamknięta prawda / warunek cutoveru / finalny runtime bez testu + ADR. | Otwarty obszar „domyka się" przez zmęczenie kontekstu (zdarzyło się raz). | Niesprawdzony mechanizm wpuszczony do cutoveru. | Właściciel + ADR | D:CORE |
| INV-3 | **Loop-prevention NIGDY na trwałym polu.** Zakaz `srcSystem` (lub dowolnego trwałego pola opisującego rekord) jako mechanizmu SKIP w adapterze. Loop-prevention dotyczy *operacji zapisu*, nie *tożsamości rekordu*. Mechanizm docelowy: efemeryczny pending-write w Stape (patrz EVENT_CONTRACT). | Trwałe pole opisuje rekord na zawsze → wycisza legalne późniejsze zdarzenia handlowca = cicha awaria atrybucji. | Legalne qualify_lead/purchase/rejected_lead nie wychodzą do platform, niewidoczne bez audytu. | Właściciel + ADR | D:CORE |
| INV-4 | **native webhook ≠ business event; webhook NIE niesie before/after.** Webhook Twenty = techniczny sygnał stanu aktualnego (`{event, data, timestamp}`). Business event powstaje w adapterze Sortowni; transition wykrywany WYŁĄCZNIE przez Stape Store. Mechanika → EVENT_CONTRACT. | Wskrzeszenie martwej gałęzi before/after lub emisja bez adaptera = fałszywe/zgubione eventy. | Nieodwracalny sygnał do platform reklamowych. | Właściciel + ADR | D:VERIFIED |
| INV-5 | **LOST ≠ rejected_lead; WON = stage, purchase = event.** Stage LOST → brak eventu. `campaignRejected=true` → `rejected_lead`. Zakaz `lead_won`/`closed_won`/`WON` jako event_name. | Zlanie pojęć = sygnał przy każdej przegranej albo żaden przy odrzuceniu. | Zatrucie atrybucji platform. | Właściciel + ADR | D:CORE |
| INV-6 | **import / backfill / replay → no_emit.** Operacja masowa NIGDY nie emituje do platform reklamowych. | Sygnał do platformy jest nieodwracalny (budżety, atrybucja). | Wydane budżety, zatruta atrybucja. | Właściciel + ADR | D:CORE |
| INV-7 | **Tożsamość fail-closed.** Stape Store niedostępny podczas resolve → NIE mintuj id_oid, kolejkuj. Nie-merge różnych osób tej samej firmy. Dwa paid id_oid → T5 ręcznie. Mechanika → IDENTITY. | Fail-open = duplikat id_oid = rozdwojenie tożsamości (nieodwracalne). | Jeden klient z dwoma profilami, zepsuta atrybucja. | Właściciel + ADR | D:CORE |
| INV-8 | **Typ / API name / wartości SELECT pól FROZEN — zmiana = ADR.** Zmiana typu = nieodwracalna migracja DDL. Mechanika → DATA_MODEL. | Łamie adapter Sortowni, webhooki, zapytania, import. | Nieodwracalna migracja danych. | Właściciel + ADR | D:VERIFIED |
| INV-9 | **Custom fields w Twenty nie mogą być required** `[D:VERIFIED]`. Walidacja „business required" przy emisji eventu / w adapterze, nie przy save w Twenty. | Twenty autosave odpala przed wypełnieniem pól; required przy save fałszywie alarmuje. | Workflow wyzwala się na niekompletnym rekordzie. | nowy dowód z instancji | D:VERIFIED |

> **INVARIANTY z researchu** (gdy nie potwierdzone instancją/plikiem) noszą `[D:RESEARCH]` inline, nie `[D:CORE]`. Powyższe wynikają z plików źródłowych lub zweryfikowanych faktów — stąd `[D:CORE]`/`[D:VERIFIED]`.

---

## 0a. LLM QUICK ENTRY

**Ten plik decyduje o:** kto czym rządzi (role); 9 praw (kompas przed każdą zmianą, z Testami); klasy decyzji; AI/MCP governance (default read-only); co wymaga ADR; reguła konfliktów źródeł; system znaczników zaufania; reguła powstawania nowego pliku.

**Ten plik NIE decyduje o:** faktach platformowych Twenty (credits, HMAC nazwy, R-18, audit log gating → `ops/OPS_NOTES.md`); pełnym modelu pól (→ `DATA_MODEL.md`); mechanice webhook→event i manual-create (→ `EVENT_CONTRACT.md`); tożsamości/kanałach (→ `IDENTITY_AND_INBOUND.md`); granicach systemów (→ `ARCHITECTURE.md`).

**Zawsze czytaj razem z:** `DATA_MODEL.md`, `EVENT_CONTRACT.md`, `DECISION_REGISTER.md`.

**Najgroźniejszy błąd:** agent „ulepsza" prawo lub invariant, traktując research jako autorytet nadrzędny (INV-1).

**Przy konflikcie (reguła nadrzędna — rozstrzyga TYP treści, nie liniowa hierarchia):**
- Twardy zakaz / invariant → **CRM_CONSTITUTION §0** (najwyżej).
- Zamknięta decyzja właściciela → **DECISION_REGISTER** (bije pliki domenowe).
- Poza tym: **wygrywa plik-właściciel typu treści** — typ pola→DATA_MODEL; event/trigger→EVENT_CONTRACT; tożsamość/kanał→IDENTITY; granice→ARCHITECTURE; wykonanie→IMPLEMENTATION_PLAN; import→AUDIT_MIGRACJA.
- **Fakt o Twenty (pricing/HMAC/limit API) → rozstrzyga docs/instancja, NIGDY sam Markdown.** OPS_NOTES trzyma fakt z datą; weryfikacja = platforma.
- **archive/ NIGDY nie wygrywa nad aktywnym SSOT.**

**Zmiana wymaga:** ADR (inline ADR-light w DECISION_REGISTER) + zgoda właściciela. Dopóki katalog `adr/` nie istnieje, „ADR" = inline ADR-light entry w DECISION_REGISTER.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | Nie wkładać faktów platformowych Twenty (workflow credits, nazwy nagłówków HMAC, R-18, API-key POC, audit log gating) do tego pliku — to dom OPS_NOTES. | Fakt wersjonowany ze starzeniem ≠ zasada projektowa. Mieszanie = drugi decision log. | Fakt starzeje się niezauważony w konstytucji. | Właściciel + ADR | `ops/OPS_NOTES.md` |
| NR-2 | Nie rozrastać rdzenia §0–§5 ponad ~100 linii — pełne brzmienie praw przez progressive disclosure (sekcja 5 BODY). | Bogaty nagłówek podnosi koszt inferencji; agent ignoruje resztę. | Spadek LLM-friendliness. | Właściciel + ADR | tu |
| NR-3 | Nie powielać mechaniki manual-create / webhook→event / loop-prevention — konstytucja trzyma tylko *zasadę* (Prawo 5/6), właściciel mechaniki = EVENT_CONTRACT. | Dwa pliki z tą samą mechaniką rozjadą się przy pierwszej zmianie. | Sprzeczna mechanika w 2 miejscach. | Właściciel + ADR | `EVENT_CONTRACT.md` |
| NR-4 | INVARIANTS (§0) nie mogą zniknąć przy kompaktacji — pozycja 0, zawsze ładowana. | To bezpiecznik najwyższego rzędu. | Utrata twardych zakazów. | Właściciel + ADR | tu |

---

## 2. PURPOSE

Kompas systemu: kto decyduje, jakie prawa rządzą zmianą, co wymaga ADR, jak AI/MCP ma traktować system — oraz dom dla INVARIANTS (§0). Prawa są falsyfikowalne (każde ma Test), bo czyta je agent przed każdą zmianą. Status: Etap 1 MVP.

---

## 3. SCOPE

### Pokrywa
- Role i odpowiedzialność (właściciel / Dawid / Twenty / Sortownia / n8n / MCP-AI).
- 9 praw w pełnym brzmieniu (rdzeń: nazwa + Test; pełne brzmienie niżej).
- Klasy decyzji (5), AI/MCP governance, reguła konfliktów, system znaczników, reguła powstawania pliku.

### Nie pokrywa
- Faktów platformowych Twenty (→ `ops/OPS_NOTES.md`).
- Modelu pól (→ `DATA_MODEL.md`), mechaniki eventów (→ `EVENT_CONTRACT.md`), tożsamości (→ `IDENTITY_AND_INBOUND.md`), granic (→ `ARCHITECTURE.md`).

---

## 4. CANONICAL DEFINITIONS

- **Opportunity** = lead pipeline w Twenty (natywny obiekt; NIE custom „Deal").
- **id_oid** = kanoniczny identyfikator klienta; mint Sortownia; klucz cross-system.
- **qualify_lead / purchase / rejected_lead / generate_lead** = business event_names SSOT (nie nazwy stage'ów). Pełna semantyka → EVENT_CONTRACT.
- **LOST** = przegrany deal (stage), bez eventu. **WON** = stage; **purchase** = event przejścia do WON.
- **System znaczników zaufania:** `[D:CORE]` (decyzja własna OWOCNI; zmiana tylko właściciel+ADR) · `[D:VERIFIED]` (fakt zweryfikowany na platformie; recheck po triggerze) · `[D:RESEARCH]` (rekomendacja researchu; podważyć tylko dowodem z instancji) · `[D:OPEN]` (świadomie otwarte; agent nie domyka).
- **ADR** (do czasu powstania katalogu `adr/`) = inline ADR-light entry w DECISION_REGISTER.

---

## 5. BODY — role, prawa (pełne brzmienie), governance

### 5.1 Część I — Role

| Rola | Odpowiedzialność |
|------|------------------|
| **1. Właściciel** | Semantyka: co znaczy qualified, rejected, won; kryteria stage'ów; cutover |
| **2. Developer / wdrożenie** | **Dawid** — Twenty, GTM, sGTM, Stape, Sortownia; uzgodnienia z Mariuszem i Krzysztofem (przełożeni) |
| **3. Twenty** | Stan CRM, UI, **native webhook OUT** (nie business events) |
| **4. Sortownia** | id_oid, atrybucja, routing, adaptery, Lista Zadań |
| **5. n8n** | Ad-hoc LLM — **poza** critical path SSOT |
| **6. MCP/AI** | Operator po kontrakcie; **default read-only**; tryb `read → plan w chat → diff → CZŁOWIEK aprobuje i wykonuje` |

### 5.2 Część II — 9 praw

Praw jest dziewięć — każde to osobne pole powierzchni: inny rodzaj błędu, inny moment życia systemu, inny mechanizm obrony. Trzy grupy jako model mentalny:
- **Grupa I — Jak wiemy, co jest prawdą** (Prawa 1–2)
- **Grupa II — Co odlewamy w fundamencie** (Prawa 3–6)
- **Grupa III — Jak utrzymujemy system czytelnym i rozszerzalnym** (Prawa 7–9)

**Rdzeń (nazwa + Test):**

| # | Prawo (nazwa) | Test |
|---|---|---|
| 1 | Rzeczywistość bije dokument. Jeden SSOT, zsynchronizowany ze stanem faktycznym. | „Czy ten dokument opisuje stan zweryfikowany, czy intencję — i czy zmienił się razem z systemem?" |
| 2 | Każdą decyzję najpierw klasyfikuj: nieodwracalna czy kosmetyczna. Dyscyplinę wydawaj tylko na nieodwracalne. | „Jeśli zrobimy to dziś źle i poprawimy później — przepiszemy jeden element, czy dane + workflowy + raporty + integracje?" |
| 3 | Model danych to kontrakt. Typ i nazwę pola ustalasz raz, świadomie, na natywnych obiektach Twenty. | „Czy nazwa techniczna i typ tego pola są efektem świadomej, zapisanej decyzji — czy ustawienia domyślnego?" |
| 4 | Znaczenie definiuj, zanim utworzysz pole i zaczniesz zbierać dane. | „Czy potrafię odpowiedzieć: kto wypełnia, kiedy, po co — i czy dwóch sprzedawców zaklasyfikowałoby ten sam rekord tak samo?" |
| 5 | Jedna jawna ścieżka wejścia. Każda inna jest nazwanym wyjątkiem. | „Czy potrafię wymienić wszystkie ścieżki, którymi rekord trafia do systemu — i czy każda jest jawna i nazwana?" |
| 6 | Każda klasa informacji ma jednego właściciela prawdy. Granica CRM ↔ orkiestracja jest brzytwowo ostra i widoczna w nazwach pól. | „Czy każda klasa informacji ma jednoznacznie wskazane miejsce prawdy — i czy po nazwie API pola widać, po której stronie granicy leży?" |
| 7 | Każdy workflow ma kontrakt graded by complexity. Bez kontraktu workflow nie wchodzi. | „Czy ten workflow ma kontrakt adekwatny do złożoności, kill-switch, walidację po stronie konsumenta, trigger zgodny ze źródłem, i auth jeśli wychodzi poza Twenty?" |
| 8 | System musi być czytelny, zanim stanie się zautomatyzowany — dla ludzi i dla AI. | „Czy nowy człowiek/agent zrozumie to pole/workflow bez pytania właściciela? Czy default role agenta to read-only przez native assignment? Czy każda powierzchnia uprawnień (6 kanałów) i każdy obszar kontroli (3) są zmapowane?" |
| 9 | Start jest brutalnie wąski. Zakres się zdobywa, nie zakłada. | „Czy to należy do wąskiego rdzenia MVP — czy to osobny mini-projekt po retro?" |

---

### 5.3 Pełne brzmienie praw (progressive disclosure)

#### Prawo 1 — Rzeczywistość bije dokument

**a.** Gdy dokumenty są sprzeczne, wygrywa to, co zweryfikowane w kodzie, w POC lub w żywej dokumentacji Twenty. Dokumenty intencji (architektury aspiracyjne) są materiałem do rekonsyliacji, nie SSOT.

**b.** Dokument aktualizuje się **w tej samej zmianie co system**, albo zmiana nie wchodzi. Brak równoległych „zatwierdzonych" wersji prawdy.

**c.** Twenty udostępnia natywnie `docs.twenty.com/llms.txt` — indeks dokumentacji pod agenta. Twenty-internal terminy i obiekty standardowe (Person/Company/Opportunity/Note) **nie są dokumentowane ręcznie** w repo — agent fetchuje z `llms.txt`. Dokumentujemy **wyłącznie** to, czego Twenty nie wie semantycznie (cross-system flow, granice, decyzje architektoniczne).

**Hierarchia źródeł przy konflikcie (kotwica 1:1):** dla **semantyki biznesowej** (co znaczy qualified, cross-system flow, granice) **SSOT jest nadrzędny nad `llms.txt`**. Dla **składni/nazewnictwa platformy** (nazwy obiektów standardowych, terminy Twenty-internal) `llms.txt` jest źródłem. llms.txt mówi *jak Twenty nazywa rzeczy*, SSOT mówi *co te rzeczy znaczą w naszym biznesie*.

**d.** Fakty platformowe Twenty (workflow credits, audit log gating, HMAC native, R-18 trigger, znane bugi, PR IDs, version-specific behavior) żyją w `ops/OPS_NOTES.md` § Twenty Verified Facts — z source, verified in workspace, last checked, recheck trigger. Konstytucja trzyma **konsekwencje** tych faktów jako zasady projektowe, nie wersyjne fakty.

#### Prawo 2 — Klasyfikuj decyzję

Przed każdą decyzją przypisz ją do jednej z pięciu klas:
- **Strukturalna** — topologia danych (model obiektów, relacje, runtime). Cofnięcie = migracja danych + przepisanie workflowów.
- **Semantyczna** — znaczenie utrwalone w danych historycznych (np. kryteria stage'ów). Historii nie wyczyścisz wstecz — zostaje zatruta.
- **Proceduralna** — jednorazowe zdarzenie (cutover, import). Nieodwracalne w momencie zdarzenia.
- **Chroniczna** — dług narastający (sprawl workflowów, bloat pól). Drogie, jeśli zaniedbane, ale stale korygowalne.
- **Kosmetyczna** — UI, nazwy widoków, kolory, layout, kolejność pól. Minuty w UI.

**Klasy można łączyć przy decyzjach wielowymiarowych** („Semantyczna+operacyjna", „Strukturalna+proceduralna") — dozwolone kombinacje pięciu istniejących klas, nie nowe klasy.

Uwaga: **„nieodwracalny" ≠ „strukturalny"** — nazwę stage'a zmienisz w minutę, ale sześć miesięcy historii pod mglistą definicją zostaje brudne na zawsze (klasa semantyczna).

#### Prawo 3 — Model danych to kontrakt

**a.** Pipeline stoi na **natywnych obiektach Twenty** — `Opportunity`, `Person`, `Company`, `Note`. Nie ma „custom object Deal". `Opportunity` jest natywnym odpowiednikiem deal/szansy — etykietę UI wolno dostosować, ale **nie tworzymy równoległego custom object Deal** `[D:VERIFIED]`.

**b.** **Typ pola jest niezmienny po utworzeniu** `[D:VERIFIED]`. Zmiana typu = utwórz nowe pole, migruj dane, dezaktywuj stare. Typ wybierasz raz — zweryfikuj przed utworzeniem.

**c.** **Konwencję nazewniczą blokujesz przed utworzeniem pierwszego pola.** Nazwa pola żyje na 3 warstwach: **API name** (Twenty hard-egzekwuje camelCase + alphanumeric `[D:VERIFIED]`; nazwy API obiektów standardowych stałe; nazwy pól relacyjnych nieedytowalne po utworzeniu — wpływają na API), **label** (warstwa UI, zmienny swobodnie) i **typ** (zmiana = migracja). API/object/field names są częścią trwałego kontraktu API i importu — traktuj jak niezmienne. Konwencja: prefix-camelCase — pole z prefiksem (`idOid`, `bizValue`) należy do języka orkiestracji, pole bez prefiksu (`needsFollowUp`) jest czysto CRM-owe. Prefiks żyje w `API name`, **nie** w `label`. Pełna polityka pól → `DATA_MODEL.md`.

**d.** **Każde pole ma wypełniony `description` w Settings UI** — Twenty native field description jest źródłem prawdy dla MCP (introspekcja GraphQL). Pole bez `description` = dług dokumentacyjny w momencie tworzenia.

#### Prawo 4 — Znaczenie przed polem

**a. Definicja operacyjna przed pierwszym użyciem.** Każdy stage i każde pole klasyfikujące, którego znaczenie utrwali się w danych, musi mieć **pisemną definicję operacyjną przed cutoverem**. Stage'e wymagają kryteriów wejścia (`qualified` = odpowiedział + pasuje do oferty + ma intencję + jest następny krok), ustalonych przez właściciela z handlowcami.

**b. Sześć pytań przed utworzeniem pola:** *kto wypełnia, kiedy, po co, czy wpływa na decyzję biznesową, jaka kategoria (user-facing/systemowe/analityczne), czy musi żyć w Twenty czy poza.* Pole bez odpowiedzi nie powstaje (przeciw field sprawl). Pełna procedura → `DATA_MODEL.md`.

#### Prawo 5 — Jedna jawna ścieżka wejścia (zasada; mechanika → EVENT_CONTRACT)

Leady wchodzą do Twenty **jedną automatyczną ścieżką kanoniczną** (`crm:twenty_create_lead` adapter w Sortowni — analogiczny do SSOT `crm:bitrix_create_lead`). Manual create (leady z polecenia, z telefonu) jest ścieżką legalną i konieczną — ale **jawnym, nazwanym wyjątkiem**.

> **Mechanika rozpoznania manual-create, mapowanie webhook→event i loop-prevention NIE żyją tutaj — właściciel treści to `EVENT_CONTRACT.md` §4.** Konstytucja trzyma tylko zasadę: jedna jawna ścieżka, manual = nazwany wyjątek rozpoznawany przez **brak tożsamości** (nie przez typ operacji). Pole `_operation` **nie istnieje** w payloadzie Twenty — nie opieraj o nie detekcji (szczegół → EVENT_CONTRACT).

Stary watcher `julia362` dostaje **twardą datę wyłączenia**. Cel to nie „jedno źródło" — cel to **brak ścieżek niejawnych**.

#### Prawo 6 — Jeden właściciel prawdy; granica CRM ↔ orkiestracja

**a. Jeden właściciel prawdy per klasa informacji.** Każda informacja ma jedno miejsce, w którym jest prawdą; reszta to kopia/pointer/widok:
- Aktualny stan sprzedaży → **Twenty**
- `id_oid`, Profil Klienta, Akt Własności (atrybucja), consent → **Sortownia**
- Outbox / kolejka zadań → **Lista Zadań Stape** (infrastruktura platformy, NIE custom)
- Retry + atomic transitions → **Robot** (Stape Worker)
- Wartości eventów (VBB/VBO) → **Adapter platformy + Pricing Key** (lookup tuż przed wysłaniem)
- Monitoring + alerty → **Ratownik** (Sortownia/SSOT)
- Biznesowa analiza historyczna → **GCS Ledger** (Archiwizator, cron 2×/dzień)
- Ad-hoc LLM data processing → **n8n** (poza SSOT orkiestracji)
- Reguły biznesowe → dokumentacja / ADR
- Operacyjna praca handlowców → Twenty UI

**b. Granica CRM ↔ orkiestracja (kotwica 1:1 — najczęściej naruszana).** Twenty robi pracę CRM (UI sprzedaży, pipeline, audyt). Orkiestracja Sortowni robi atrybucję marketingową (sygnały VBB/VBO do platform). **Twenty nigdy nie mintuje `idOid`** — robi to Sortownia. Sortownia nigdy nie modyfikuje danych operacyjnych w Twenty bez explicit kontraktu (jedyny wyjątek: backfill `idOid` przy unminted manual lead — patrz EVENT_CONTRACT TRANSITION EXCEPTION). Granica jest widoczna w schemie: pola outbound mają prefiks (`bizX`/`idX`), pola czysto CRM-owe go nie mają.

#### Prawo 7 — Workflow ma kontrakt graded by complexity

**a. Graded contract:**

| Typ workflow | Kontrakt |
|---|---|
| **Prosty internal** (Search/Update, brak external side-effect, brak Code) | 1 wiersz w OPS_NOTES workflow registry: nazwa · obiekt · trigger · side-effect · owner · kill-switch · link-do-snapshotu |
| **Code / HTTP / outbound do Sortowni** | Mini-kontrakt w `/workflows/<nazwa>.contract.md`: input, output, walidacja, idempotency, retry, kill-switch, auth |
| **LLM data processing** | NIE w Twenty workflow — w n8n. Twenty NIE ma synchronicznych pod-workflowów (sub-workflow myth). Złożona logika → n8n flow z własnym contract markdownem |

**b. Walidacja AT EVENT EMISSION, NIE AT SAVE.** Twenty ma real-time autosave — workflow na „Record is created" odpala zanim handlowiec wpisze wszystkie pola; walidacja przy save fałszywie alarmuje. Walidacja siedzi po stronie Sortowni przed emisją business eventu.

**c. Trigger policy by source.** Twenty rozróżnia trigger types per źródło: API/CSV/mailbox/calendar sync (kompletne payloady) → `Record is Created`; Manual UI creation (autosave) → `Record is Created or Updated` + field monitoring; Stage/event transitions → `Record is Updated` z monitorowanymi polami; Bulk import/backfill/mass update → wszystkie workflowy create/update **OFF** podczas operacji. Dogmatyczne „używaj zawsze `or updated`" jest błędne (dla canonical ingress odpala częściej niż trzeba). Konkretne nazwy eventów webhooka → `ops/OPS_NOTES.md` (recheck na instancji).

**d. Branches PARALLEL by default.** Każda gałąź MUSI zaczynać się od `Filter` node z **mutually exclusive** conditions (brak wbudowanego if/else). Bez exclusive Filter = duplikat side-effectu.

**e. Sub-workflow myth.** Twenty NIE ma synchronicznych pod-workflowów. Złożona logika → zewnętrzny system (Sortownia / n8n).

**f. Zakaz sekretów w Twenty Workflow Code i Workflow HTTP.** Code action wymaga external API keys w function body — to nie secure runtime; HTTP może wymagać auth headers — też nie. External secrets żyją w Sortowni runtime env lub n8n credential store (poza Twenty). **Jedyny legalny wyjątek:** Apps Framework variables z `secret: true` (app access token ograniczony rolą aplikacji), NIE zwykły workflow Code Action.

**g. Snapshoty w git.** Workflowów w Twenty nie da się definiować jako kod (`createWorkflowVersion` — status epistemiczny faktu → OPS_NOTES). Snapshot JSON eksportowany ręcznie do git przed każdą modyfikacją. Inwentaryzacja kwartalna oznacza martwe workflowy. (Zasada snapshotów obowiązuje niezależnie od statusu dowodu o API key.)

**Native webhook OUT:** podpisany HMAC SHA256; wysyła wszystkie event types na URL (filtrację robi adapter Sortowni). **Konkretne nazwy nagłówków HMAC + signed-string + status credits → `ops/OPS_NOTES.md` § Twenty Verified Facts** (dom faktu platformowego; nie powielać nazwy tutaj — NR-1).

#### Prawo 8 — Czytelność przed automatyzacją

**a.** Każde pole ma wypełniony `description` (Prawo 3d). Wraz z workflow registry, snapshotami schemy w git, Migration Ledgerem, ADR-ami i OPS_NOTES — to **główny instrument governance** dla planu Pro. Na Pro brakuje **natywnego audit logu** (Organization) oraz **row-level permissions** (Organization/Premium) `[D:VERIFIED]` — stąd governance na instrumentach ręcznych. **Field-level permissions SĄ dostępne na Pro** `[D:VERIFIED]` — kontrola na poziomie pól jest; brakuje audytu i row-level.

**b. Permissions/access matrix — DWA NIEZALEŻNE WYMIARY** (oba obowiązują):

> **Wymiar A — CO wolno (zakres kontroli roli)** `[D:VERIFIED]` — **3 obszary:**
> 1. **Obiekty i Pola** (object-level + field-level permissions)
> 2. **Ustawienia** (settings)
> 3. **Akcje** (actions)

> **Wymiar B — KTO/CZYM dostęp wchodzi (kanał/tożsamość)** — **6 powierzchni:**

| # | Powierzchnia | Mechanizm | Zakres |
|---|---|---|---|
| 1 | Native user role | Settings → Members → Roles | Rola przypisywana użytkownikowi |
| 2 | API key role assignment | Settings → API key + role | API key dziedziczy uprawnienia roli |
| 3 | AI agent role assignment | Settings → AI Agent + role | AI agent dziedziczy uprawnienia roli |
| 4 | Apps Framework default function role | `defineApplicationRole()` w TS | Tylko jeden per app; default role przy instalacji |
| 5 | OAuth Authorization Code + PKCE / MCP user-context | OAuth flow z PKCE | Działa w imieniu użytkownika |
| 6 | **OAuth Client Credentials / MCP** ⚠ | OAuth client credentials | **Workspace-level access — NIE „przypisanie roli"** jak 1–3; inny model ryzyka, osobny least-privilege review |

**Rozróżnienie krytyczne:** Wymiar A mówi *co rola może*; Wymiar B mówi *jakim kanałem dostęp wchodzi*. Pomieszanie (uznanie, że zmapowanie 3 obszarów wystarcza, gdy niezmapowana powierzchnia 6 / client credentials) daje **fałszywe poczucie least-privilege**. Powierzchnie 1–3 = przypisanie roli; powierzchnia 6 = dostęp na poziomie workspace, osobna ostrożność. `defineApplicationRole()` to wąska funkcjonalność Apps Framework, nie ogólny mechanizm governance; native role assignment do API keys i AI agents (powierzchnie 2,3) to osobna warstwa w Settings UI, dostępna bez Apps Framework.

**c. Agent MCP / AI dostaje rolę least-privilege przez native role assignment.**
- Default = **read-only** (dedykowana rola w Settings → Members). To **nasza polityka bezpieczeństwa**, nie domyślne zachowanie Twenty.
- Promocja do write dopiero po retrospektywie Etapu 1.
- Rozróżnij: **MCP server** (natywny w Cloud, OAuth, read/write technicznie możliwe — istnieje dziś) vs **AI Agent jako workflow action** (oficjalnie „Coming Soon"/beta — NIE fundament MVP).
- Powierzchnia OAuth/MCP wymaga osobnej weryfikacji granic (powierzchnia 6).
- AI nie zmienia schemy / nie usuwa danych / nie edytuje workflowów / nie ustawia stage'a programowo bez human approval.

**d. Tryb pracy agenta** — `read → plan w chat → diff → CZŁOWIEK aprobuje i wykonuje` (Rola 6).

#### Prawo 9 — Start brutalnie wąski

**Rdzeń MVP:** nowe leady wpadają do Twenty jedną ścieżką (`crm:twenty_create_lead`), handlowcy pracują na pipeline, zmiany stage'a / `campaignRejected` generują native webhook OUT → adapter mapuje na SSOT eventy (qualify_lead, rejected_lead, purchase), maile i timeline widoczne, aktywne leady zmigrowane z ledgerem, fallback starego systemu jasny.

**Poza rdzeń** (osobne mini-projekty po retrospektywie Etapu 1): Helpdesk *(scope/product placeholder — NIE potwierdzony moduł platformowy Twenty)*; Dashboards Twenty (Beta — Early Access `[D:VERIFIED]`; nie fundament); Follow-up automation; MCP write access (default read-only do retro); AI Agent workflow action (coming soon/beta); KSeF integration; Automated handoff WON → Bitrix24 (MVP = manual SOP; Phase 2 = adapter `crm:bitrix_create_deal`); rozszerzenie roli n8n (po retro). Każdy nowy event/metryka/moduł wymaga udokumentowanego use case'u przed wejściem do scope'u.

### 5.4 Glossary (skrót)

| Termin | Znaczenie |
|--------|-----------|
| Opportunity | Lead pipeline w Twenty |
| Deal (Bitrix24) | Księgowy — osobny system |
| id_oid | Mint Sortownia; klucz cross-system |
| qualify_lead | stage → QUALIFIED |
| purchase | stage → WON (nie lead_won) |
| rejected_lead | campaignRejected true (nie LOST) |
| generate_lead | Formularz lub manual create |
| consent_update | Event aktualizacji zgody (kanał SSOT — patrz EVENT_CONTRACT katalog) |
| assist | Pole paid: drugi kanał (pomocniczy dotyk), para z `owner` (first-touch); multi-touch |
| VBB / VBO | Value-Based Bidding / Optimization — sygnały wartości do platform; gate w adapterach Robot (IDENTITY §VBB) |
| **owner** | **Homonim — 4 znaczenia:** (1) meta-kolumna „Owner" w tabelach (kto zapisuje pole); (2) kolumna ról/zadań (kto odpowiada; np. „Owner techniczny: Dawid"); (3) pole paid: pierwszy kanał (first-touch), para z `assist`, wejście do reguł 90 dni / VBB; (4) Opportunity owner: handlowiec przypisany do leada w Twenty. (3)≠(4): inny system, inny byt. Pełne rozróżnienie (a)/(b) → IDENTITY §13. |
| julia362 | Legacy IMAP watcher — wyłączyć |

### 5.5 AI / MCP rules

- Tryb: read → plan → diff → **człowiek** approve → wykonanie.
- Brak zmian schemy / workflow / stage przez agenta bez zgody.
- Write po retrospektywie Etapu 1.

### 5.6 Governance — reguła powstawania nowego pliku kanonicznego `[D:CORE]`

Plik kanoniczny powstaje wtedy i tylko wtedy, gdy istnieje **dom treści, którego żaden obecny plik nie unosi bez utraty czytelności LUB bez mieszania profili zaufania.** Liczba plików jest WYNIKIEM tej reguły, nigdy jej przyczyną. Nowy plik kanoniczny = `[D:CORE]` = wymaga ADR + zgody właściciela.

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| Fakty platformowe Twenty (credits, HMAC nazwy/signed-string, R-18, audit log) | `ops/OPS_NOTES.md` |
| Mechanika webhook→event, manual-create (`idOid IS NULL`), loop-prevention | `EVENT_CONTRACT.md` |
| Typy / API names / frozen / prefiksy pól; label „Odrzuć leada" | `DATA_MODEL.md` |
| Tożsamość, kanały, Resolver T1–T5, VBB gate, słownik owner (a)/(b) | `IDENTITY_AND_INBOUND.md` |
| Granice systemów, przepływy in/out | `ARCHITECTURE.md` |
| Status decyzji / ADR / brama cutoveru | `DECISION_REGISTER.md` |
| Plan wdrożenia, cutover/rollback, parzystość BB | `runbooks/IMPLEMENTATION_PLAN.md` |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-C1 | Kanon glosariusza: w CONSTITUTION (A) czy osobny GLOSSARY.md (B)? | Właściciel | nie | DECISION_REGISTER (gdy próg) |
| OQ-C2 | Topologia repo (1 vs 2 README) — wpływa na to, czy istnieje root README | Dawid | nie (nie cutover) | oględziny repo |

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Model uprawnień Twenty (3 obszary / 6 powierzchni, field-level na Pro) | Twenty release | Dawid | docs/permissions |
| Custom fields nie-required | Twenty release | Dawid | docs/instancja |
| Native obiekty (Opportunity nie custom Deal) | Twenty release | Dawid | docs |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:CORE`. Inline = odchylenie.
