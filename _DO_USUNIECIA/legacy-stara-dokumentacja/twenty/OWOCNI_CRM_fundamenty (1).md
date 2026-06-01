# OWOCNI CRM — Fundamenty

**Role + Konstytucja (9 praw) + Decyzje architektoniczne + Brama 5-fazowa + Rejestr decyzji otwartych + Preflight evidence**

---

## Jak czytać ten dokument

- **Część I — Role.** Kontrakt odpowiedzialności: kto czym rządzi i czego nie powinien dotykać.
- **Część II — Konstytucja.** 9 praw w 3 grupach. Kompas decyzyjny czytany przed każdą zmianą systemu.
- **Część III — Decyzje architektoniczne.** Sześć rozstrzygnięć, które dyktują strukturę pakietu i runtime systemu.
- **Część IV — Rejestr decyzji otwartych.** Co jeszcze wymaga rozstrzygnięcia, w którym momencie, i co konkretnie blokuje.
- **Część V — Brama 5-fazowa.** Warunki gotowości per faza.
- **Część VI — Preflight evidence register.** Co weryfikowane w docs vs co wymaga POC w sandboxie vs co decyduje właściciel vs co poza Twenty.

Części I + II tworzą trzon pliku `CRM_CONSTITUTION.md`. Część III warunkuje strukturę całego pakietu plików operacyjnych.

---

## Uwaga ramowa — gdzie naprawdę leży ryzyko

Spaghetti to ryzyko **chroniczne** — narasta przez miesiące iteracji w rozbudowanym systemie. Gdyby nadeszło, miałoby konkretną nazwę: **spaghetti no-code** — wszystko klika się w UI Twenty, ale nie wiadomo, gdzie tego szukać i co wywołało błąd. Na **starcie** (1 obiekt, ~10 pól, 2–4 workflowy z POC) spaghetti nie ma z czego powstać. Pilnowanie „czystości kodu" w tym momencie jest pilnowaniem pustego pola.

Realne ryzyko startu jest **czterokrotne**:

1. **Decyzje nieodwracalne podjęte przypadkiem.** Typ pola, model obiektów, nazwa techniczna, definicja stage'a, transport eventów, runtime semantyczny — raz źle ustawione, kosztują przepisanie danych, workflowów i raportów. Decyzje minutowe w skutkach miesięcznych.
2. **Dryf dokumentów.** Każdy czytelnik — człowiek lub agent — dziedziczy błąd, jeśli dokument opisuje intencję, a nie stan zweryfikowany.
3. **Słaby plan przejścia.** Brak jednej kanonicznej ścieżki wejścia leadów i brak runbooka cutover/rollback — to tędy „leady giną".
4. **Walidacja w niewłaściwym momencie cyklu życia rekordu.** Twenty ma real-time autosave — workflow „blokuj save jeśli pole puste" odpala przed wpisaniem wartości i daje silent data loss. Walidacja musi siedzieć przy **emisji eventu** outbound, nie przy save record.

Konstytucja celuje w te cztery rzeczy. Anti-spaghetti (Prawa 7–9) jest obecne, ale jako dyscyplina **na wyrost rozbudowy**, nie jako lęk startowy.

---

# CZĘŚĆ I — ROLE

Role są nadrzędne wobec praw: dopiero gdy wiadomo, **kto** podejmuje daną decyzję, ma sens pytać, **jak** ją podjąć. Sześć ról, każda z innym kontraktem.

## Rola 1 — Właściciel / architekt biznesowy

**Właściciel semantyki.** Nie programista, nie Twenty, nie MCP, nie AI. Rozstrzyga: co znaczy `lead` / `qualified` / `rejected` / `won`, które dane mają sens biznesowy, które decyzje są nieodwracalne, kiedy system wolno rozbudować, kiedy AI ma tylko analizować, a kiedy może wykonywać. Spójne z **Bus Factor = 1 With Intent** — logika orchestratora przy właścicielu.

**Bus Factor = 1 With Intent** to świadomy wybór, nie błąd architektury: właściciel jest jedynym, kto rozstrzyga decyzje semantyczne (co znaczy `qualified`, kiedy `rejected_lead` ma być emitowany, jakie wartości w Pricing Key per kontekst klienta), ale ta zależność jest udokumentowana, a system zaprojektowany tak, by każdy nowy człowiek mógł odtworzyć kontekst z dokumentów (Prawa 1, 3, 7, 8). Nie eliminujemy ryzyka choroby właściciela — minimalizujemy konsekwencje: w jego nieobecności praca operacyjna (sprzedaż, obsługa leadów, ingress) idzie dalej, a tylko decyzje strukturalne / semantyczne czekają.

## Rola 2 — Developer / implementator techniczny

**Potwierdza i wdraża kontrakty; nie interpretuje biznesu.** Zakres: POC techniczne, walidacja Twenty, setup pól / workflowów / API, import, Migration Ledger, cutover, snapshoty, testy regresji, raport „działa / nie działa / wymaga decyzji". Nie rozstrzyga: kryteria stage'ów (`QUALIFIED`, `WON`, `campaignRejected`), czy `Person` ma mieć `idOid`, czy follow-up AI wchodzi do MVP. Te rzeczy wracają do Roli 1.

## Rola 3 — Twenty (Cloud Pro)

**Operacyjny CRM: stan, UI, pipeline, rekordy, simple internal workflowy + native webhook OUT.** Trzyma: aktualny stan sprzedaży, `Person` / `Company` / `Opportunity`, pipeline, notatki, komunikację, widoki sprzedażowe. Twenty workflows wykonują wyłącznie **simple internal CRM automations** (Search, Update, własne pola). Twenty wysyła **natywny webhook OUT** (z HMAC SHA256) na każde create/update/delete — to jest **raw CDC source**, nie business event. Native webhook **NIE pożera workflow credits**.

Twenty nie staje się „mózgiem całej firmy". Workflow credits Twenty Pro = 50/rok hard-egzekwują zakaz outbound w workflowach: przy 150 leadów/mc × 3 emitowane SSOT eventy = ~5400 emisji/rok ≫ 50 credits. **Outbound do Sortowni MUSI iść przez native webhook OUT, nie przez Workflow HTTP Request action.** Decyzje semantyczne (czy to qualify_lead, rejected_lead, purchase) ustala webhook adapter w Sortowni przez mapowanie raw CDC → event_name.

## Rola 4 — Sortownia (Stape sGTM): router konfiguracyjny + identity layer

**Definicja zgodna z SSOT orkiestracji** (`Spis Treści — Sortownia, Silnik Przetwarzania Zdarzeń`):

- Sortownia mintuje `id_oid` (triggery: `oid_init` lub `generate_lead`)
- Identity matching w Profilu Klienta (read-only lookup: email/telefon/ga_client_id/fbp)
- Atrybucja (Akt Własności: Owner+Assist zamrożone na 90 dni w momencie `generate_lead`)
- Routing wg Inteligentnego Routingu (plik konfiguracyjny mapujący `event_name` → lista `targets`)
- Tworzenie zadań na **Liście Zadań Stape** (z `id_event`, `job_type`, payload)

**Sortownia NIE robi:**
- Decyzji semantycznych „kiedy emit który event" — to robi CRM albo webhook adapter inbound (mapowanie raw CDC → event_name)
- Stateful diff payloadów (poza minimalną 2-polową pamięcią w webhook adapter Twenty inbound dla filtrowania transition vs noise)
- Outboxa biznesowego — Lista Zadań Stape JEST infrastrukturą kolejki (status: pending → in_progress → success/retry/failed_final)
- Retry orchestration — to robi **Robot (Stape Worker)**
- Webhook failure recovery infrastructure — to robi **Ratownik** (alerty proaktywne)
- Terminal state machine enforcement — delegujemy idempotency platformom reklamowym (Google Ads dedup po order_id, Meta po event_id)

**Adaptery (po stronie Robota)** to miejsce, gdzie żyje cała złożona logika per platforma: `platform:google_ads`, `platform:meta_ads`, `analytics:ga4_mp`, `crm:twenty_create_lead`, `system:WRITE_AKT_WLASNOSCI`, `system:merge_oid`, `system:consent_update`, `system:identity_update`. Adapter sprawdza consent (Profil Klienta), pobiera wartość (Pricing Key) tuż przed wysłaniem, wysyła do platformy, raportuje status.

## Rola 5 — n8n (poza SSOT orkiestracji; ad-hoc LLM data processing)

**n8n NIE jest częścią SSOT orkiestracji OWOCNI.** Pełni rolę poboczną: stateless transformer dla zadań ad-hoc wymagających LLM (enrichment leadu, klasyfikacja copy, generowanie wariantów wiadomości, parsing notatek).

n8n **nie jest** event runtime, **nie trzyma** outboxa, **nie robi** retry business events, **nie jest** na critical path orchestracji. Jeśli n8n nie odpowiada — system działa dalej, tylko ad-hoc enrichment nie odpala się.

Rola n8n może się rozszerzyć po retrospektywie Etapu 1 (np. operacje wokół Twenty UI, gdy AI-asystowane workflowy okażą się sensowne).

## Rola 6 — MCP / AI

**Operator po kontrakcie, nie źródło prawdy.** Może: czytać system, wykrywać niespójności, proponować diff, draftować ADR, wskazywać ryzyka, generować raporty, pomagać w utrzymaniu dokumentacji. Nie może: tworzyć / usuwać / zmieniać pól, zmieniać typów, edytować workflowów, edytować stage'y, zmieniać Event Contractu, omijać review.

**Tryb pracy:**
- `read` — agent czyta system przez MCP (Twenty 2.8.0 ma native MCP server w każdym Cloud workspace; OAuth scope per agent)
- `plan` — agent prezentuje plan zmiany w chacie
- `diff` — porównanie current vs proposed w chacie
- `approve` — explicite zgoda człowieka w chacie
- `wykonanie` — przez **człowieka** w Twenty UI / Settings lub przez agenta z explicit per-tool-call confirmation; default agent role = read-only

**MCP write access jest technicznie dostępny w Twenty Cloud, ale wyłączony przez governance policy (Etap 1).** Powód: brak production learning period, brak retrospektywy, ograniczona auditability na planie Pro. Promocja do write dopiero po retro Etapu 1 i decyzji właściciela.

---

# CZĘŚĆ II — KONSTYTUCJA: 9 PRAW

Praw jest dziewięć, nie dziesięć — liczba nie jest celem. Każde prawo to osobne **pole powierzchni**: inny rodzaj błędu, inny moment życia systemu, inny mechanizm obrony.

Trzy grupy są nadrzędnym modelem mentalnym:

- **Grupa I — Jak wiemy, co jest prawdą.** (Prawa 1–2)
- **Grupa II — Co odlewamy w fundamencie.** (Prawa 3–6)
- **Grupa III — Jak utrzymujemy system czytelnym i rozszerzalnym.** (Prawa 7–9)

---

## Grupa I — Jak wiemy, co jest prawdą

### Prawo 1 — Rzeczywistość bije dokument. Jeden SSOT, zsynchronizowany ze stanem faktycznym.

**a.** Gdy dokumenty są sprzeczne, wygrywa to, co zweryfikowane w kodzie, w POC lub w żywej dokumentacji Twenty. Dokumenty intencji (architektury aspiracyjne) są materiałem do rekonsyliacji, nie SSOT.

**b.** Dokument aktualizuje się **w tej samej zmianie co system**, albo zmiana nie wchodzi. Brak równoległych „zatwierdzonych" wersji prawdy.

**c.** Twenty udostępnia natywnie `docs.twenty.com/llms.txt` — indeks dokumentacji zaprojektowany pod agenta. Twenty-internal terminy i opisy obiektów standardowych (Person/Company/Opportunity/Note) **nie są dokumentowane ręcznie** w naszym repo — agent fetchuje z `llms.txt`. Dokumentujemy **wyłącznie** to, czego Twenty nie wie semantycznie (cross-system flow, granice systemów, decyzje architektoniczne).

**d.** Fakty platformowe Twenty (workflow credits, audit log gating, HMAC native, R-18 trigger, znane bugi, PR IDs, version-specific behavior) żyją w `/ops/OPS_NOTES.md` sekcja **Twenty Verified Facts** — z kolumnami source, verified in workspace, last checked, recheck trigger. Konstytucja trzyma **konsekwencje** tych faktów jako zasady projektowe, nie wersyjne fakty.

**Test.** *„Czy ten dokument opisuje stan zweryfikowany, czy intencję — i czy zmienił się razem z systemem?"*

### Prawo 2 — Każdą decyzję najpierw klasyfikuj: nieodwracalna czy kosmetyczna. Dyscyplinę wydawaj tylko na nieodwracalne.

Przed każdą decyzją przypisz ją do jednej z pięciu klas:

- **Strukturalna** — topologia danych (model obiektów, relacje, runtime). Cofnięcie = migracja danych + przepisanie workflowów.
- **Semantyczna** — znaczenie utrwalone w danych historycznych (np. kryteria stage'ów). Historii nie wyczyścisz wstecz — zostaje zatruta.
- **Proceduralna** — jednorazowe zdarzenie (cutover, import). Nieodwracalne w momencie zdarzenia.
- **Chroniczna** — dług narastający (sprawl workflowów, bloat pól). Drogie, jeśli zaniedbane, ale stale korygowalne.
- **Kosmetyczna** — UI, nazwy widoków, kolory, layout, kolejność pól. Minuty w UI.

Uwaga kluczowa: **„nieodwracalny" nie znaczy „strukturalny"** — nazwę stage'a zmienisz w minutę, ale sześć miesięcy historii zebranej pod mglistą definicją zostaje brudne na zawsze (klasa semantyczna).

**Test.** *„Jeśli zrobimy to dziś źle i poprawimy później — przepiszemy jeden element, czy dane + workflowy + raporty + integracje?"*

---

## Grupa II — Co odlewamy w fundamencie

### Prawo 3 — Model danych to kontrakt. Typ i nazwę pola ustalasz raz, świadomie, na natywnych obiektach Twenty.

**a.** Pipeline stoi na **natywnych obiektach Twenty** — `Opportunity`, `Person`, `Company`, `Note`. Nie ma „custom object Deal".

**b.** **Typ pola jest niezmienny po utworzeniu.** Zmiana typu = utwórz nowe pole, migruj dane, dezaktywuj stare. Typ wybierasz raz — zweryfikuj przed utworzeniem.

**c.** **Konwencję nazewniczą blokujesz przed utworzeniem pierwszego pola.** Twenty hard-egzekwuje camelCase + alphanumeric, nazwy API obiektów standardowych są stałe, nazwy pól relacyjnych są nieedytowalne po utworzeniu; zmienny swobodnie jest tylko `label` (warstwa UI). Konwencja: prefix-camelCase — pole z prefiksem (`idOid`, `bizValue`) należy do języka orkiestracji, pole bez prefiksu (`needsFollowUp`) jest czysto CRM-owe. Prefiks żyje w `API name`, **nie** w `label`.

**d.** **Każde pole ma wypełniony `description` w Settings UI.** Twenty native field description jest źródłem prawdy dla MCP (czyta przez introspekcję GraphQL). Pole bez `description` to dług dokumentacyjny w momencie tworzenia.

**Test.** *„Czy nazwa techniczna i typ tego pola są efektem świadomej, zapisanej decyzji — czy ustawienia domyślnego?"*

### Prawo 4 — Znaczenie definiuj, zanim utworzysz pole i zaczniesz zbierać dane.

**a. Stage'e i pola klasyfikujące — definicja operacyjna przed pierwszym użyciem.** Każdy stage i każde pole, którego znaczenie utrwali się w danych historycznych, musi mieć **pisemną definicję operacyjną przed cutoverem**. Stage'e wymagają kryteriów wejścia (`qualified` = odpowiedział + pasuje do oferty + ma intencję + jest następny krok), ustalonych przez właściciela z handlowcami.

**b. Każde nowe pole — sześć pytań przed utworzeniem.** Niezależnie od typu pola, przed jego utworzeniem musi paść odpowiedź na: *kto wypełnia, kiedy, po co, czy wpływa na decyzję biznesową, jaka to kategoria (user-facing / systemowe / analityczne), czy musi żyć w Twenty czy poza nim.* Pole bez odpowiedzi nie powstaje. To zapobiega **field sprawl** — masie pól, które wyglądają profesjonalnie, ale nikt po pół roku nie pamięta, po co istnieją.

**Test.** *„Czy potrafię odpowiedzieć: kto wypełnia, kiedy, po co — i czy dwóch sprzedawców niezależnie zaklasyfikowałoby ten sam rekord tak samo?"*

### Prawo 5 — Jedna jawna ścieżka wejścia. Każda inna jest nazwanym wyjątkiem.

Leady wchodzą do Twenty **jedną automatyczną ścieżką kanoniczną** (`crm:twenty_create_lead` adapter w Sortowni — analogiczny do SSOT `crm:bitrix_create_lead`). Manual create (leady z polecenia, z telefonu) jest ścieżką legalną i konieczną — ale **jawnym, nazwanym wyjątkiem**: `Person.idOid = null` → Twenty native webhook OUT z `_operation=create` → webhook adapter Sortowni emituje `generate_lead` (manual variant) → mint `id_oid` + backfill przez `crm:twenty_update_person`.

Stary watcher `julia362` dostaje **twardą datę wyłączenia**. Cel to nie „jedno źródło" — cel to **brak ścieżek niejawnych**.

**Test.** *„Czy potrafię wymienić wszystkie ścieżki, którymi rekord trafia do systemu — i czy każda z nich jest jawna i nazwana?"*

### Prawo 6 — Każda klasa informacji ma jednego właściciela prawdy. Granica CRM ↔ orkiestracja jest brzytwowo ostra i widoczna w nazwach pól.

**a. Jeden właściciel prawdy per klasa informacji.** Każda informacja ma jedno miejsce, w którym jest prawdą; reszta to kopia, pointer lub widok. Przydział własności:

- Aktualny stan sprzedaży → **Twenty** (Rola 3)
- `id_oid`, Profil Klienta, Akt Własności (atrybucja), consent → **Sortownia** (Rola 4)
- **Outbox / kolejka zadań → Lista Zadań Stape (infrastruktura platformy, NIE custom)**
- **Retry + atomic transitions → Robot (Stape Worker)**
- **Wartości eventów (VBB/VBO) → Adapter platformy + Pricing Key (lookup tuż przed wysłaniem)**
- **Monitoring + alerty → Ratownik (Sortownia/SSOT)**
- **Biznesowa analiza historyczna → GCS Ledger (Archiwizator, cron 2×/dzień)**
- Ad-hoc LLM data processing → **n8n** (Rola 5, poza SSOT orkiestracji)
- Reguły biznesowe → dokumentacja / ADR (Rola 1 + dokument)
- Operacyjna praca handlowców → Twenty UI

**b. Granica CRM ↔ orkiestracja — case specyficzny, najczęściej naruszany.** Twenty robi pracę CRM (UI sprzedaży, pipeline, audyt). Orkiestracja Sortowni robi pracę atrybucji marketingowej (sygnały VBB/VBO do platform). Twenty nigdy nie mintuje `idOid` — robi to Sortownia. Sortownia nigdy nie modyfikuje danych operacyjnych w Twenty bez explicit kontraktu (jedyny wyjątek: backfill `idOid` przy unminted manual lead — patrz Plik 4).

Granica jest widoczna w schemie: pola outbound mają prefiks (`bizX`/`idX`), pola czysto CRM-owe go nie mają.

**Test.** *„Czy każda klasa informacji ma jednoznacznie wskazane miejsce prawdy — i czy po samej nazwie API pola widać, po której stronie granicy CRM↔orkiestracja ono leży?"*

---

## Grupa III — Jak utrzymujemy system czytelnym i rozszerzalnym

### Prawo 7 — Każdy workflow ma kontrakt graded by complexity. Bez kontraktu workflow nie wchodzi.

**a. Graded contract:**

| Typ workflow | Co stanowi kontrakt |
|---|---|
| **Prosty internal** (Search/Update, brak external side-effect, brak Code) | 1 wiersz w `OPS_NOTES.md` workflow registry: nazwa · obiekt · trigger · side-effect · owner · kill-switch · link-do-snapshotu |
| **Code / HTTP / outbound do Sortowni** | Mini-kontrakt w `/workflows/<nazwa>.contract.md`: input, output, walidacja, idempotency, retry, kill-switch, auth |
| **LLM data processing** | NIE w Twenty workflow — w n8n. Twenty NIE ma synchronicznych pod-workflowów (sub-workflow myth). Złożona logika dzielona na n8n flow z własnym contract markdownem |

**b. Walidacja AT EVENT EMISSION, NIE AT SAVE.** Twenty ma real-time autosave — workflow triggerowany na „Record is created" odpala zanim handlowiec wpisze wszystkie pola; walidacja przy save zawsze fałszywie alarmuje. Walidacja musi siedzieć po stronie Sortowni przed emisją business eventu (Sortownia ma payload zwalidowany przed wysłaniem do platform).

**c. Trigger policy by source.** Twenty dokumentacja wprost rozróżnia trigger types per źródło danych:
- **API / CSV / mailbox sync / calendar sync** (kompletne payloady) → `Record is Created`
- **Manual UI creation** (autosave triggeruje przed wypełnieniem pól) → `Record is Created or Updated` + field monitoring
- **Stage / event transitions** → `Record is Updated` z monitorowanymi polami (stage, campaignRejected)
- **Bulk import / backfill / mass update** → wszystkie workflowy triggered by create/update **OFF** podczas operacji

Dogmatyczne „używaj zawsze `or updated`" jest **błędne**: dla canonical API/CSV ingress odpala workflow częściej niż trzeba.

**d. Branches w Twenty workflows: PARALLEL by default.** Każda gałąź MUSI zaczynać się od `Filter` node z **mutually exclusive** conditions. Bez exclusive Filter = duplikat side-effectu.

**e. Sub-workflow myth.** Twenty NIE ma synchronicznych pod-workflowów. Złożona logika dzielona na zewnętrzny system (Sortownia / n8n).

**f. Zakaz sekretów w Twenty Workflow Code i Workflow HTTP.** Twenty Code action wymaga wpisywania external API keys bezpośrednio w function body — to nie jest secure runtime. Workflow HTTP może wymagać auth headers w request — to też nie jest secure. **Reguła:** żadne external API secrets w Twenty workflowach. External secrets żyją w Sortowni runtime env lub w n8n credential store (oba poza Twenty).

**g. Snapshoty w git.** Workflowów w Twenty **nie da się definiować jako kod** (`createWorkflowVersion` zwraca FORBIDDEN przez API key). Snapshot JSON eksportowany ręcznie do git przed każdą modyfikacją. Inwentaryzacja kwartalna oznacza martwe workflowy.

**Test.** *„Czy ten workflow ma kontrakt adekwatny do złożoności, kill-switch, walidację po stronie konsumenta eventu, trigger zgodny ze źródłem danych, i auth jeśli wychodzi poza Twenty?"*

### Prawo 8 — System musi być czytelny, zanim stanie się zautomatyzowany — dla ludzi i dla AI.

**a. Każde pole ma wypełniony `description` w Twenty (patrz Prawo 3d).** Wraz z workflow registry, snapshotami schemy w git, Migration Ledgerem, ADR-ami i `OPS_NOTES` — to **główny instrument governance** dla planu Pro. Audit log natywny jest funkcją planu Organization, nie Pro.

**b. Permission surfaces matrix — sześć osobnych warstw uprawnień w Twenty 2.8.0:**

| # | Powierzchnia | Mechanizm | Zakres |
|---|---|---|---|
| 1 | Native user role | Settings → Members → Roles | Role przypisywane bezpośrednio użytkownikom |
| 2 | API key role assignment | Settings → API key + role assignment | API key dziedziczy uprawnienia roli |
| 3 | AI agent role assignment | Settings → AI Agent + role assignment | AI agent dziedziczy uprawnienia roli |
| 4 | Apps Framework default function role | `defineApplicationRole()` w TS | **Tylko jeden** per app; default role aplikacji przy instalacji |
| 5 | OAuth Authorization Code / MCP user-context | OAuth flow z PKCE | Działa w imieniu użytkownika |
| 6 | OAuth Client Credentials | OAuth client credentials | Workspace-level access |

`defineApplicationRole()` to **wąska funkcjonalność Apps Framework**, nie ogólny mechanizm governance. Native role assignment do API keys i AI agents (powierzchnie 2, 3) to **osobna warstwa** zarządzana w Settings UI, dostępna bez Apps Framework.

**c. Agent MCP / AI dostaje rolę least-privilege przez native role assignment.**
- Default = **read-only** (dedykowana rola w Settings → Members)
- Promocja do write dopiero po retrospektywie Etapu 1
- Powierzchnia OAuth/MCP wymaga osobnej weryfikacji granic (różny model ryzyka niż API key)
- AI nie zmienia schemy / nie usuwa danych / nie edytuje workflowów / nie ustawia stage'a programowo bez human approval

**d. Tryb pracy agenta** — patrz Rola 6 (`read → plan w chat → diff → CZŁOWIEK aprobuje i wykonuje`).

**Test.** *„Czy nowy człowiek albo agent zrozumie to pole / workflow bez pytania właściciela? Czy default role agenta to read-only przez native assignment? Czy każda powierzchnia uprawnień jest zmapowana?"*

### Prawo 9 — Start jest brutalnie wąski. Zakres się zdobywa, nie zakłada.

**Rdzeń MVP:** nowe leady wpadają do Twenty jedną ścieżką (adapter `crm:twenty_create_lead` w Sortowni), handlowcy pracują na pipeline, zmiany stage'a / `campaignRejected` generują native webhook OUT do Sortowni → webhook adapter mapuje na SSOT eventy (qualify_lead, rejected_lead, purchase), maile i timeline są widoczne, aktywne leady są zmigrowane z ledgerem, fallback starego systemu jest jasny.

**Poza rdzeń** — jako osobne mini-projekty po retrospektywie Etapu 1 — wychodzą:
- Helpdesk
- Dashboards Twenty (Beta — nie jako fundament)
- Follow-up automation
- MCP write access (default read-only do retro)
- KSeF integration
- Automated handoff WON → Bitrix24 księgowy (MVP = manual SOP dla handlowca; Phase 2 = nowy SSOT adapter `crm:bitrix_create_deal` analogiczny do istniejącego `crm:bitrix_create_lead`)
- Rozszerzenie roli n8n (operacje wokół Twenty UI, jeśli AI-asystowane workflowy okażą się sensowne) — zakres do ustalenia po retro

Każdy nowy event, metryka czy moduł wymaga udokumentowanego use case'u przed wejściem do scope'u.

**Test.** *„Czy to należy do wąskiego rdzenia MVP — czy to osobny mini-projekt po retro?"*

---

# CZĘŚĆ III — DECYZJE ARCHITEKTONICZNE

Sześć rozstrzygnięć dyktujących strukturę pakietu i runtime systemu. Każda decyzja kaskaduje przez 3-5 plików.

## D1 — Tryb implementacji: **No-code (Settings UI)**

**Wybór:** schema (obiekty, custom fields, role, widoki) konfigurowana w Twenty Settings UI; workflowy klikane w workflow editor; snapshoty JSON eksportowane do git.

**Powody:**
- Apps Framework wymaga `npx create-twenty-app`, testów Vitest, CI; krzywa nauki wyższa.
- Skills/Agents w Apps Framework są obecnie alpha; budowanie pakietu na alpha primitive = ryzyko breaking changes.
- No-code czysty + dyscyplina dokumentacyjna (Prawa 3, 7, 8) daje wystarczającą governance dla MVP z jednym właścicielem semantyki.
- W Phase 2 możliwe przejście na Apps Framework dla wybranych komponentów (Logic Functions z DB trigger dla event runtime) bez przebudowy modelu danych.

**Konsekwencja dla dokumentów:** `DATA_MODEL.md` jest **źródłem prawdy**, nie snapshotem kodu. `EVENT_CONTRACT.md` opisuje semantykę i kontrakt outbound, nie kod.

## D2 — Runtime eventów semantycznych: **Native Twenty webhook OUT → thin webhook adapter w Sortowni**

**Wybór:** Twenty wysyła natywny webhook OUT (HMAC SHA256) na każde create/update/delete Opportunity (raw CDC). Webhook adapter w Sortowni (`inbound:twenty_webhook`) mapuje raw CDC → `event_name` zgodnie z prostą regułą per pole:

```
record.stage == "QUALIFIED" (i wcześniej != "QUALIFIED")   → event_name = "qualify_lead"
record.stage == "WON"        (i wcześniej != "WON")          → event_name = "purchase"
record.campaignRejected == true (i wcześniej == false)       → event_name = "rejected_lead"
record._operation == "create" AND record.id_oid IS NULL      → event_name = "generate_lead" (trigger manual mint)
```

Webhook adapter trzyma **minimalną pamięć w Stape Store**: 2 pola per `opportunity_id` (`last_stage`, `last_campaignRejected`) — wyłącznie do filtrowania transition vs noise. To nie jest „stateful event runtime" — to jest cienki filter na 2 polach, mieszczący się w SSOT zasadzie *„całą złożoną logikę i inteligencje przetwarzania należy rozwijać w Adapterach"* (webhook adapter Twenty inbound jest właśnie takim Adapter).

Po określeniu `event_name`, webhook adapter wpada do standardowego flow Sortowni: Inteligentny Routing → Lista Zadań Stape → Robot → Adaptery platform.

**Powody:**
- Twenty Pro = 50 workflow credits/rok hard limit; 150 leadów/mc × 3 SSOT eventy = ~5400/rok ≫ 50. Workflow HTTP outbound odpada.
- Native webhook OUT nie pożera credits (Settings → Developers → Webhooks).
- Twenty visual workflow Filter NIE ma udokumentowanego access do previous values; Filtr stateful w Twenty bez Apps Framework jest niewykonalny.
- Apps Framework Logic Function z `databaseEventTriggerSettings` (before/after/diff) wymagałby D1=Apps Framework (alpha-adjacent) — nieuzasadnione przy skali 150 leadów/mc.
- Webhook adapter w Sortowni z 2-polową pamięcią to **minimum viable** mechanizm zgodny z SSOT (rola Sortowni = identity + routing; webhook adapter to inbound preprocessor pasujący do tej roli).

**Konsekwencja dla dokumentów:** `EVENT_CONTRACT.md` opisuje 3 SSOT eventy emitowane przez Twenty (qualify_lead, rejected_lead, purchase) + `generate_lead` przy manual create; `CRM_ARCHITECTURE_CURRENT.md` ma sekcję „Integracja Twenty ↔ SSOT orkiestracji" zamiast „Event Runtime & Ownership"; usuwamy stateful diff i outbox z Twenty-side dokumentacji (oba są w SSOT orkiestracji).

## D3 — Outbox / kolejka zadań: **Lista Zadań Stape (infrastruktura platformy, NIE custom outbox)**

**Wybór:** kolejka zadań i ich stany żyją w Liście Zadań Stape — natywnej infrastrukturze platformy. Per SSOT orkiestracji (`Spis Treści — Lista Zadań`):

```
Task: {
  Job_ID,              # unique identifier zadania
  id_event,            # ID zdarzenia (mintowane przez Sortownię)
  job_type,            # np. "platform:google_ads"
  payload,             # full payload event_name + dane
  status,              # pending → in_progress → success / retry / failed_final / skipped_*
  locked_until,        # atomic lock dla Robota
  locked_by,           # który Robot worker
  attempt_count
}
```

Robot (Stape Worker, cron) wykonuje atomic transition `pending → in_progress`, woła odpowiedni Adapter, finalizuje status (`success` / `retry` / `failed_final` / `skipped_*`). Po `failed_final` — Ratownik alertuje (e-mail diagnostyczny z klasą błędu: quota / auth / schema / timeout).

**NIE budujemy:**
- Własnego event outbox w Sortowni — Lista Zadań JEST outboxem
- Stable `event_id` z payload_hash + retry orchestration — SSOT ma `id_event` mintowany w Sortowni przy tworzeniu zadania; retry obsługuje Robot
- Webhook failure recovery infrastructure — Ratownik alertuje, manual repair via Stape UI
- Terminal state machine z `terminal_event_emitted_for_idOid` — idempotency delegujemy platformom (Google Ads dedup po `order_id`, Meta dedup po `event_id` Meta-side)

**Powody:**
- Stape platform robi to natywnie — nie powtarzamy infrastruktury
- Przy 150 leadów/mc skala absolutnie nie uzasadnia enterprise event runtime infrastructure
- *„Akceptujemy 'burdel' (podwójne liczenie) w raportach wewnątrz platform, bo naszym celem jest optymalizacja algorytmów"* (SSOT cytat) — terminal SM enforcement po naszej stronie jest **niepotrzebny** w środowisku low-N gdzie celem jest gęstość uczących sygnałów, nie księgowość

**Konsekwencja dla dokumentów:** `EVENT_CONTRACT.md` nie ma sekcji „outbox persistence rule"; `CRM_ARCHITECTURE_CURRENT.md` opisuje Listę Zadań Stape jako referencję do SSOT, bez duplikacji szczegółów.

## D4 — Manual idOid=null strategia: **Sortownia mintuje przy `generate_lead` (zgodnie z SSOT)**

**Wybór:** SSOT mówi: *„OID mint triggers = (oid_init OR generate_lead)"*. Manual create w Twenty UI to **inny generate_lead** w SSOT — webhook adapter Twenty inbound rozpoznaje create event z `id_oid=null` jako trigger `generate_lead` i wpada w standardowy flow:

1. Handlowiec tworzy Opportunity w Twenty UI ręcznie → `Person.idOid = null`
2. Twenty native webhook OUT → Sortownia webhook adapter
3. Webhook adapter: `_operation=create` AND `id_oid IS NULL` → emit `generate_lead` z minimalnym PII potrzebnym dla matchingu
4. Sortownia: lookup w Profilu Klienta (email/telefon priority) → znajduje istniejący `id_oid` LUB mintuje nowy
5. Sortownia tworzy zadanie `system:WRITE_AKT_WLASNOSCI` (zamrożenie atrybucji) + zadanie `crm:twenty_update_person` (backfill `id_oid` w Twenty Person via API)
6. Następne webhooki przychodzą z `id_oid` wypełnionym — normal flow continues

**Powody:**
- Manual create to po prostu inny rodzaj `generate_lead` — nie wymyślamy osobnego message type (`identity_resolution_request` z poprzedniej iteracji był nadinterpretacją; SSOT nie ma takiego bytu)
- `system:WRITE_AKT_WLASNOSCI` jako adapter już istnieje w SSOT — manual lead dziedziczy ten sam flow co paid touchpoint lead
- Webhook adapter widzi `_operation=create` + `id_oid IS NULL` jako jednoznaczny sygnał manual (paid touchpoint generate_lead idzie z formularza przez inny adapter inbound z już ustalonym `id_oid`)

**Konsekwencja dla dokumentów:** `EVENT_CONTRACT.md` opisuje `generate_lead` jako jeden event z dwoma źródłami (paid touchpoint adapter vs Twenty manual create webhook); `DATA_MODEL.md` Person.id_oid = nullable, backfill przez `crm:twenty_update_person` adapter.

## D5 — Terminal state machine: **NIE ROBIMY enforcement po naszej stronie**

**Wybór:** **odrzucamy** enforcement WON / rejected jako mutually exclusive terminals po naszej stronie. Idempotency delegujemy platformom reklamowym (Google Ads dedup po `order_id`, Meta dedup po `event_id` Meta-side).

**Powody:**
- SSOT w sekcji *„Decyzja o karmieniu danymi dwóch platform jeśli asystowały w konwersji"* explicite akceptuje *„burdel (podwójne liczenie) w raportach wewnątrz platform"*: *„Zagłodzenie danych (Low-N) jest gorsze niż burdel w raportach"*. Cel = uczenie algorytmów VBB/VBO, nie księgowość — księgowość jest osobno w GCS.
- Skala 150 leadów/mc nie uzasadnia własnej infrastruktury terminal SM — koszt operacyjny (debug + monitoring + correction path) przewyższa korzyść z deduplikacji.
- SSOT używa `qualify_lead` (RESTATE upgrade), `rejected_lead` (RESTATE downgrade), `purchase` (Secondary Goal). Te zdarzenia są **kolejnymi adjustami wartości** w Google Ads / Meta, nie wzajemnie wykluczającymi się terminalami. Lead może być qualify_lead → purchase (normalny szczęśliwy flow); rzadko qualify_lead → rejected_lead (post-SQL anuluje, biznes rzadki).
- Robot retry w Stape obsługuje transient delivery failures automatycznie; Ratownik alertuje przy `failed_final`.

**Co robimy zamiast:**
- Adaptery platform wysyłają z `id_event` jako idempotency key — platformy mają własną dedup
- Ratownik monitoruje anomalie wolumenowe (np. ten sam `id_oid` z 3 różnymi terminalami w 24h = alert do właściciela)
- W razie błędu handlowca (np. ustawił WON, potem zmienił na rejected_lead) — w MVP akceptujemy emisję obu eventów do platform, ręczna korekta w GCS przy biznesowej analizie

**Konsekwencja dla dokumentów:** `EVENT_CONTRACT.md` NIE ma sekcji „State machine conflicts + correction path"; `DATA_MODEL.md` NIE ma pól typu `terminalEventEmittedAt`.

## D6 — Agent routing convention: **Plain README sekcja**

**Wybór:** `/owocni-crm/README.md` z plain header (purpose / status / owner / last updated) i sekcją „Agent Routing" — tabela mapowania `zadanie → primary file → secondary files`.

**Powody:**
- Anthropic Skills używa `SKILL.md` z YAML frontmatter — to oficjalny format, NIE `AGENTS.md`. Tworzenie `AGENTS.md` z YAML-like header udaje compliance, której nie ma.
- Twenty `defineSkill()` to TypeScript API (Apps Framework) — wymaga D1=Apps Framework.
- README sekcja to czysta repo-internal konwencja bez fałszywej formalności.

Jeśli w przyszłości zechcemy compliance z Anthropic Skills marketplace → wyciągnięcie sekcji do `SKILL.md` z YAML frontmatter to ~1h pracy.

**Konsekwencja dla dokumentów:** `/owocni-crm/README.md` jest **Plikiem 0** pakietu — dodany do struktury repo.

---

# CZĘŚĆ IV — REJESTR DECYZJI OTWARTYCH

Po zamknięciu D1-D6 w Części III, pozostają decyzje wymagające rozstrzygnięcia w trakcie kolejnych faz. Każda pozycja ma kolumny: `Blocks` (phase / step / cutover / none) i `Decision type` (ADR / preflight / implementation standard / known-fact).

| # | Decyzja | Klasa | Blocks | Decision type | Faza otwierająca | Rekomendacja / Kto rozstrzyga |
|---|---|---|---|---|---|---|
| 1 | **Konwencja nazw pól** (prefix-camelCase, hard-egzekwowane przez Twenty) | Strukturalna | none | known-fact | Faza 2 | Zamknięte — wynika z mechanizmu Twenty + Prawa 3c |
| 2 | **Model obiektów** (natywne Opportunity/Person/Company/Note) | Strukturalna | none | known-fact | Faza 2 | Zamknięte — POC potwierdził |
| 3 | **`idOid` jako unique custom field** | Strukturalna | step | preflight | Faza 2 | Zamknięte na poziomie zasady; POC unique+null wymagany (D.2) |
| 4 | **Ścieżka ingressu kanonicznego** (`crm:twenty_create_lead` adapter Sortowni — analogiczny do SSOT `crm:bitrix_create_lead`) | Strukturalna | step | implementation standard | Faza 3 | Domyślna ścieżka; manual create jako wyjątek (patrz D4) |
| 5 | **Kryteria wejścia stage'ów** (definicja operacyjna per stage Twenty: NEW / CONTACTED / QUALIFIED / PROPOSAL / WON + boolean `campaignRejected`; mapowanie na SSOT eventy: `QUALIFIED → qualify_lead`, `WON → purchase`, `campaignRejected=true → rejected_lead`) | Semantyczna | cutover | ADR | Faza 4 | Właściciel **z handlowcami**, przed cutoverem |
| 6 | **Plan Twenty: Pro vs Organization** | Semantyczna + finansowa | cutover | ADR | Faza 4 | Pro ($9/u): fallback governance (snapshoty, ledger, ADR). Organization ($19/u): natywny audit log, row-level permissions, SSO. Audit log nieodzyskiwalny retroaktywnie po cutoverze. Decyzja właściciela. |
| 7 | **Strategia środowisk** (sandbox + produkcyjny vs single produkcyjny) | Proceduralna | cutover | ADR | Faza 5 | Rekomendacja: sandbox + produkcyjny (Faza 1 wymaga sandboxa do nauki bez ryzyka skażenia produkcji). Brak natywnego eksportu modelu danych w Twenty utrudnia replikację między workspace'ami. |
| 8 | **Runbook cutover / rollback** (data odcięcia, okno read-only, thresholds rollbacku) | Proceduralna | cutover | ADR | Faza 5 | Decyzja właściciela; szczegóły w `CUTOVER_RUNBOOK.md` |
| 9 | **Rekonsyliacja dokumentów po cutoverze** (czy ARCHITECTURE_CURRENT i EVENT_CONTRACT zgodne ze stanem) | Procedurowa | step | implementation standard | Faza 5 | Decyzja właściciela + developer |

**Reguła:** dopóki choć jedna pozycja typu **ADR** o `Blocks=cutover` ma status **open**, cutover NIE startuje. Pozycje typu **implementation standard** lub **preflight** nie blokują fazy globalnie — blokują konkretny krok (np. utworzenie pola wymaga zamknięcia preflight unique+null).

---

# CZĘŚĆ V — BRAMA 5-FAZOWA

Każda faza ma własne warunki gotowości. Nie da się ich ominąć przez „zacznijmy już przenosić, resztę dopiszemy".

| Faza | Warunki gotowości |
|---|---|
| **Faza 1 — Sandbox / pierwsze dotknięcie Twenty** | **Brak bramy dokumentacyjnej.** Uczymy się platformy: gdzie są custom fields, jak działa workflow editor, jak native MCP server reaguje na role, jak webhook delivery wygląda w praktyce. Empiryczne testy z preflight D.2 robione tutaj. |
| **Faza 2 — Produkcyjna schema (custom fields, role, opisy)** | `CRM_CONSTITUTION.md` + `CRM_ARCHITECTURE_CURRENT.md` + `DATA_MODEL.md` gotowe. Decyzje 1, 2, 3 zamknięte (model, konwencja, `idOid` zasada). Preflight `idOid unique + null` (D.2) zaliczony lub jawnie zaakceptowany jako workaround. |
| **Faza 3 — Import danych** | `DATA_MODEL.md` finalny + `/migration/README.md` + test importu 3–5 rekordów w sandbox + backup legacy Supabase + **bulk operation gate aktywny** (wszystkie workflowy triggered by create/update na importowanym obiekcie OFF). Decyzja 4 (ingress canonical) operacyjnie ustalona. |
| **Faza 4 — Outbound eventy** | `EVENT_CONTRACT.md` finalny + **Twenty native webhook OUT skonfigurowany** + **webhook adapter w Sortowni gotowy** (`inbound:twenty_webhook` mapuje raw CDC → event_name z minimalną pamięcią 2-polową `last_stage` / `last_campaignRejected` per opportunity_id) + Inteligentny Routing zawiera reguły dla `qualify_lead` / `rejected_lead` / `purchase` / `generate_lead` (manual) + smoke test end-to-end: 1 `qualify_lead` i 1 `purchase` przechodzą przez Twenty → Sortownia → Lista Zadań → Robot → Adaptery platform. Decyzje 5 (kryteria stage'ów) i 6 (Pro vs Organization) zamknięte. |
| **Faza 5 — Cutover** | `CUTOVER_RUNBOOK.md` + dry-run pełnej procedury + owner per krok + rollback procedure + workflow OFF lista + handoff WON→Bitrix24 manual SOP. Decyzje 7, 8, 9 zamknięte. |

**Reguła bramy:** Faza N nie rusza, dopóki warunki tej fazy nie są spełnione. Decyzje zamykane są sekwencyjnie, nie wszystkie na raz.

---

# CZĘŚĆ VI — PREFLIGHT EVIDENCE REGISTER

Pozycje pogrupowane wg statusu weryfikacji. Format per pozycja:

```
Claim: <co twierdzimy>
Source: docs / POC / both
Tested in workspace: yes / no
Evidence: <link / screenshot / run id>
Owner: <kto odpowiada za recheck>
Recheck trigger: <kiedy weryfikować ponownie — np. Twenty 3.0 release>
```

## D.1 — Rozstrzygnięte na podstawie żywej dokumentacji Twenty

Pozycje verbatim w docs Twenty — nie wymagają sandbox testu, ale **wymagają wpisu do `Twenty Verified Facts` w OPS_NOTES** z kolumną `Last checked` (Prawo 1d).

- **Workflow credits Twenty Pro = 50/rok (yearly) lub 5/mc (monthly).** Code actions i HTTP Requests są droższe niż basic internal operations. Konsekwencja przy skali 150 leadów/mc: outbound do Sortowni MUSI iść przez **native webhook OUT** (Settings → Developers → Webhooks; nie pożera credits), nie przez Workflow HTTP Request. Twenty workflows trzymają proste internal CRM automations.

- **Audit logs na Pro = brak.** Pricing table verbatim: *„Audit logs: No on Pro, Yes on Organization"*. Row-level permissions analogicznie: tylko Organization. SSO analogicznie. Konsekwencja: Decyzja 6 + Prawo 8a (czytelność na ręcznych instrumentach).

- **Dashboards = Beta / Early Access.** Aktywowane przez Settings → Updates → Early Access. Brak eksportu, brak udostępniania zewnętrznym. Konsekwencja: Dashboards = convenience layer, nie SSOT, nie fundament kontroli operacyjnej MVP.

- **Formula fields i nested fields = niewydane** (docs verbatim: *„coming in Q1 2026"*). Konsekwencja: computed metrics przez Twenty workflowy + custom fields, lub przez Sortownię/n8n; nie projektować zależności między polami jako formula fields.

- **Twenty webhooks OUT są natywnie podpisane HMAC SHA256.** Headers: `X-Twenty-Webhook-Signature`, `X-Twenty-Webhook-Timestamp`. Konsekwencja: Twenty → Sortownia webhook jest natywnie zabezpieczony.

- **Twenty webhooks wysyłają WSZYSTKIE event types do URL** (brak natywnego filtra per event type w 2.8.0). Konsekwencja: webhook adapter w Sortowni filtruje (`record.stage` change + `record.campaignRejected` change + `_operation=create` z `id_oid IS NULL`) — reszta webhooków = SKIP (noise).

- **`data.updatedBy` w webhook payload istnieje od stycznia 2026.** Pokazuje `source` (API/MANUAL), `workspaceMemberId`, `name` (API key name), `context`. `apiKeyId` NIE jest exposed. Konsekwencja: loop prevention przez kombinację `source` + `name` jako secondary observer (primary = `srcSystem` field).

- **Twenty 2.8.0 ma `defineRole()` / `defineApplicationRole()`** w Apps Framework, ale **`defineApplicationRole()` jest dozwolony dokładnie jeden raz per app** (default function role). Native role assignment do API keys i AI agents to **osobna warstwa** w Settings → Members → Roles. Konsekwencja: Prawo 8b matrix (6 powierzchni).

- **Custom fields NIE mają natywnego required w 2.8.0.** FAQ Twenty verbatim: *„custom fields cannot currently be required"*. Konsekwencja: walidacja wartości eventów (np. `bizValueWon` przy `purchase`) po stronie **Adaptera platformy** tuż przed wysłaniem (Adapter pobiera Pricing Key, sprawdza payload, decyduje czy wysłać czy skip + alert do Ratownika).

- **Trigger policy by source** (docs verbatim): `Record is Created` rekomendowane dla CSV / mailbox sync / calendar sync / API; `Record is Updated or Created` dla manual creation (autosave). Konsekwencja: Prawo 7c.

- **CSV import + workflows: deactivate przed bulk operations.** FAQ Twenty verbatim: *„Should I deactivate workflows before CSV imports? Yes, if your workflows are triggered by record creation or updates"*. Mass operations mogą hit 5000 runs/h limit, consume credits, send unexpected notifications, create duplicates. Konsekwencja: bulk operation gate (Faza 3).

- **Workflowów NIE da się definiować jako kod** w Apps Framework (`createWorkflowVersion` FORBIDDEN przez API key — potwierdzone empirycznie POC analiza-migracja 25-26.05.2026). Konsekwencja: snapshoty JSON w git jako workaround (Prawo 7g).

- **Native MCP server w każdym Cloud workspace.** Agent łączy się przez OAuth, czyta/pisze CRM w naturalnym języku. Konsekwencja: nie budujemy własnej infrastruktury MCP; agent dostaje rolę przez native assignment (Prawo 8c).

- **`docs.twenty.com/llms.txt` istnieje natywnie.** Konsekwencja: Twenty-internal terminy nie dokumentujemy ręcznie — agent fetchuje (Prawo 1c).

## D.2 — Wymaga sandbox POC przed freeze schematu / workflowów

- **`idOid` jako unique custom field + null tolerance.** Czy Twenty unique constraint pozwala na wiele rekordów z `idOid=null` jednocześnie? Czy CSV/API import wielu rekordów z empty `idOid` działa? Czy unique traktuje empty string vs null różnie? Test: utworzyć 3 Opportunity z `idOid=null` ręcznie, sprawdzić czy unique enforcement działa po wartościach non-null.

- **Native webhook OUT payload schema.** Czy payload zawiera `data.before` / `data.after` / `data.diff` (przed/po stan)? Jeśli tak — webhook adapter w Sortowni może działać bez minimalnej pamięci 2-polowej. Jeśli nie — webhook adapter trzyma `last_stage` / `last_campaignRejected` per `opportunity_id` w Stape Store. Test: zmienić `stage` z NEW na QUALIFIED w sandboxie, zobaczyć payload native webhook delivery.

- **Native webhook OUT delivery semantics.** Czy Twenty robi automatyczny retry przy 5xx response? Jaka jest TTL delivery? Jest log delivered/failed widoczny w Settings → Developers → Webhooks? Test: skonfigurować webhook do nieistniejącego endpointu, sprawdzić co Twenty pokazuje.

- **Idempotency ingressu przez upsert po `idOid` jako unique custom field.** Pattern: `idOid` jako osobne unique custom field + upsert / search-before-create (Twenty REST/GraphQL nie pozwala nadać własnego natywnego `id` — `id` reserved).

- **Email Sync na custom providerze `mail.owocni.pl`.** Test: podłączyć `leads@owocni.pl`, sprawdzić Inbox/Sent/custom folders, auto-link do `Person/Company`. Hard limit: aliasy forwardujące NIE są „true mailboxes" — sprawdzić, czy 7 skrzynek z julia362 są realnymi skrzynkami czy aliasami.

- **Empiryczna weryfikacja: czy zmiana `label` custom pola NIE zmienia API name.** Docs Twenty nie potwierdzają verbatim. Test w sandboxie.

- **Empiryczna weryfikacja: czy istnieje rename-path dla relation fields.** Docs nie opisują wprost.

## D.3 — Decyzje architektoniczne właściciela (zamknięte w Części III; otwarte poniżej)

Otwarte:
- Decyzja 5 — Kryteria wejścia stage'ów (właściciel + handlowcy)
- Decyzja 6 — Plan Twenty: Pro vs Organization
- Decyzja 7 — Strategia środowisk (sandbox + produkcyjny vs single)
- Decyzja 8 — Runbook cutover/rollback (data odcięcia, thresholds)
- Decyzja 9 — Rekonsyliacja dokumentów po cutoverze

## D.4 — Poza Twenty (osobna weryfikacja u dostawców)

- **HMAC u Sortowni, Fakturownia, SMSAPI** — niepotwierdzone u dostawców (Fakturownia API na tokenie; SMSAPI callbacki bez znalezionego HMAC w docs). Konserwatywne fallbacki dla integracji bez HMAC: shared secret/header po naszej stronie; allowlist IP tylko jeśli dostawca publikuje stabilne IP; idempotency key per request; log raw payload z PII masking; ograniczyć metodę do POST.

- **PII w obecnych payloadach SSOT (`qualify_lead` / `rejected_lead` / `purchase` / `generate_lead` / `oid_init` / `consent_update`)** — sprawdzić w SSOT orkiestracji i kodzie Adapterów Sortowni, staging event capture z maskowaniem wartości i zachowaniem kluczy. Zamknąć whitelist payloadów per event przed Fazą 4.

- **Stape Store dla webhook adapter Twenty inbound** — czy Sortownia może utrzymać 2-polową pamięć (`last_stage`, `last_campaignRejected`) per `opportunity_id` w Stape Store? Sprawdzić limity (klucze, retencja). 150 leadów/mc × dziesiątki updates per lead = niska skala, ale wymaga klarowności kontraktu z osobą odpowiedzialną za Sortownię/Stape.

- **Inteligentny Routing — nowy event_name?** Czy SSOT już zawiera reguły routingu dla `generate_lead` z manual create (Twenty UI) jako kolejne źródło? Sprawdzić w SSOT plik konfiguracyjny Inteligentnego Routingu — może wystarczy istniejąca reguła `generate_lead`, może wymaga rozszerzenia.

---

## Reguła bramy

> **Faza N nie rusza, dopóki warunki tej fazy nie są spełnione.**
> Faza 1 (Sandbox) — brak warunków, otwarta od razu.
> Faza 2 (Schema) — Pliki 1+2+3 gotowe; Decyzje 1, 2, 3 zamknięte; D.2 unique+null POC zaliczony + POC native webhook payload schema.
> Faza 3 (Import) — Plik 3 finalny + `/migration/README.md`; bulk operation gate aktywny.
> Faza 4 (Eventy) — Plik 4 finalny + Twenty native webhook OUT skonfigurowany + webhook adapter w Sortowni gotowy + Inteligentny Routing zawiera reguły dla SSOT eventów emitowanych z Twenty + smoke test end-to-end; Decyzje 5, 6 zamknięte.
> Faza 5 (Cutover) — Plik 6 + dry-run + owner per krok; Decyzje 7, 8, 9 zamknięte.

To jest cała obrona przed „system zacznie działać, zanim zostanie zrozumiany": skoro budowy kolejnej fazy nie można zacząć przed istnieniem i weryfikacją fundamentu tej fazy, system **nie może** wyprzedzić swojego zrozumienia. Brama zamienia lęk w **sekwencję warunków wejścia**.
