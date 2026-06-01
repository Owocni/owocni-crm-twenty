---
doc_id: STRUKTURA_I_ROLE
title: "STRUKTURA + ROLE — kontrakt zawartości plików SSOT OWOCNI CRM"
layer: meta
status: active
edit_scope: structure_only
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-05-31
recheck_trigger: "zmiana liczby plików kanonicznych / zamknięcie F1 (topologia repo)"
default_trust: D:CORE
depends_on:
  - SKELETON.md
---

# STRUKTURA + ROLE — kontrakt zawartości plików

> **Czym jest ten dokument:** dla każdego pliku docelowej struktury określa ROLĘ i POJEMNIK — co trzyma, czego NIE trzyma, czego NIE wolno (NEGATIVE RULES), z jakiego starego pliku pochodzi treść, jak wygląda BODY.
>
> **Czym NIE jest:** to NIE jest treść SSOT. Nie ma tu zdań typu "stage → QUALIFIED = qualify_lead". Są tu opisy pojemników, do których ta treść trafi w warstwie 2 (przeszczepy).
>
> **Format każdego pliku:** patrz `SKELETON.md`. Ten dokument mówi CO w którym pliku; SKELETON mówi JAK każdy plik wygląda.

---

## 0. PRZYPOMNIENIE CELÓW (kolejność priorytetów)

1. **Bezpieczeństwo cutoveru** — nie ruszać działającej logiki. Przy każdym konflikcie wygrywa zachowanie istniejącego zachowania systemu. **Uściślenie:** „nie ruszać działającej logiki" = zachować **efekt biznesowy i bezpieczeństwo**, niekoniecznie stary *mechanizm techniczny*. Jeśli stary mechanizm jest źródłem cichej awarii (np. srcSystem-SKIP, §6.3), wolno go zastąpić prostszym bezpiecznikiem — ale TYLKO przy zachowaniu zachowania zewnętrznego + testów brzegowych.
2. **LLM-friendliness** — struktura i zapis pod agentów: jedno miejsce na jedną prawdę, jawny zakres negatywny, znaczniki zaufania, primacy position dla rzeczy świętych.
3. **Minimum plików** — uzgodnione przed researchem; cel trzeci, ustępuje #1 i #2.

---

## 0a. ZGODNOŚĆ Z SKELETON.md + REGUŁA KONFLIKTÓW

**SKELETON.md = wzorzec formatu (nadrzędny dla formy). STRUKTURA_I_ROLE = kontrakt pojemników (co/gdzie/czego nie).** Oba muszą zgadzać się w 3 punktach (potwierdzone aktualne w obu plikach — gdyby przy edycji się rozjechały, obowiązuje brzmienie poniżej): `[D:CORE]`
1. **DECISION_REGISTER** = single-file register + inline ADR-light. `adr/` NIE powstaje w tym refaktorze (`[D:CORE:refactor-scope]`, nie zakaz fundamentalny).
2. **Brak osobnego CUTOVER_RUNBOOK** — minimum cutover/rollback wchodzi do `IMPLEMENTATION_PLAN`.
3. **srcSystem** = proweniencja; loop-prevention = efemeryczny pending-write w Stape.

**Reguła konfliktów (gdy pliki mówią różne rzeczy)** `[D:CORE]`:
- Twardy zakaz / invariant → **CRM_CONSTITUTION §0 INVARIANTS** (najwyżej).
- Zamknięta decyzja właściciela → **DECISION_REGISTER** (bije pliki domenowe).
- Poza tym: **wygrywa plik-właściciel danego typu treści** (typ pola → DATA_MODEL; event/trigger → EVENT_CONTRACT; tożsamość/kanał → IDENTITY; granice → ARCHITECTURE; wykonanie → IMPLEMENTATION_PLAN; import → AUDIT_MIGRACJA).
- **Fakt o Twenty (pricing/HMAC/limit API) → rozstrzyga docs/GitHub/workspace, NIGDY sam Markdown.** OPS_NOTES trzyma fakt z datą, ale weryfikacja = platforma.
- **archive/ NIGDY nie wygrywa nad aktywnym SSOT.**

(Nie liniowa hierarchia „A>B>C dla wszystkiego" — konflikt rozstrzyga TYP treści, bo każdy plik jest właścicielem swojego typu. To celowo, nie niedopowiedzenie.)

**⚠ Meta-pliki (SKELETON, STRUKTURA_I_ROLE) NIE są aktywnym SSOT repo** — agent z nich nie czerpie po refaktorze (są śladem genezy + możliwym przyszłym fragmentem). Dlatego reguły rdzeniowe, które MAJĄ żyć po refaktorze, MUSZĄ zostać przeszczepione do plików kanonicznych: `[D:CORE]`
- system znaczników `[D:CORE/VERIFIED/RESEARCH/OPEN]` → CRM_CONSTITUTION §0 (SKELETON §A już to deklaruje)
- reguła konfliktów (§0a) → CRM_CONSTITUTION governance
- reguła funkcjonalna powstawania pliku → CRM_CONSTITUTION governance
- definicja „ADR = inline ADR-light w DECISION_REGISTER" → CRM_CONSTITUTION + DECISION_REGISTER
Bez tego przeszczepu te reguły wyparują po usunięciu meta-plików.

---

## 1. DRZEWO DOCELOWE (stan zatwierdzony)

```
owocni-crm-github/                    # ROOT repo  [D:OPEN:F1 — do oględzin repo przez Dawida]
│
├── README.md                         # [ROOT] topologia repo + instrukcja LLM
│
└── owocni-crm/                       # SSOT — 8 plików kanonicznych
    ├── README.md                     # [1] routing wewnątrz SSOT
    ├── CRM_CONSTITUTION.md           # [2] INVARIANTS (sekcja 0) + 9 praw + role + governance
    ├── ARCHITECTURE.md               # [3] granice systemów + przepływy in/out
    ├── IDENTITY_AND_INBOUND.md       # [4] id_oid, Resolver T1–T5, kanały wejścia
    ├── DATA_MODEL.md                 # [5] semantyka pól + ownership + frozen policy
    ├── EVENT_CONTRACT.md             # [6] Twenty↔Sortownia + wchłonięte STAGE_MAPPING
    ├── DECISION_REGISTER.md          # [7] single-file register + inline ADR-light
    │
    ├── ops/
    │   └── OPS_NOTES.md              # [8] fakty platformowe Twenty + recheck
    ├── runbooks/
    │   └── IMPLEMENTATION_PLAN.md    # przeszczep z PLAN_DZIALAN.md
    ├── audits/
    │   └── AUDIT_MIGRACJA.md         # przeszczep (dostarczony)
    ├── generated/                    # SCAFFOLD — generator do zbudowania, NIE istnieje dziś
    │   ├── twenty-schema.snapshot.json
    │   ├── event-contract.schema.json
    │   └── data-model.generated.md
    └── archive/
        └── STAGE_MAPPING.md          # przeszczep treści → EVENT_CONTRACT + DATA_MODEL, potem stub
```

**Zasada drzewa — funkcjonalna, nie liczbowa** `[D:CORE]`:
> Plik kanoniczny powstaje wtedy i tylko wtedy, gdy istnieje **dom treści, którego żaden obecny plik nie może unieść bez utraty czytelności LUB bez mieszania profili zaufania.** Liczba plików (8 dziś) jest WYNIKIEM tej reguły w danym momencie, nigdy jej przyczyną. **Nowy plik kanoniczny = `[D:CORE]` = wymaga ADR + zgody właściciela.**

W tym refaktorze reguła daje wynik: tworzymy wyłącznie pliki powstałe z 13 dostarczonych MD + scaffold `generated/` — bo obecne pliki unoszą całą treść z 13 MD bez przeładowania. To wynik reguły, nie sufit. `[D:CORE:refactor-scope]`

**Dlaczego funkcjonalna, nie liczbowa (lekcja):** „13 jako sufit nadrzędny" byłoby tautologią (tyle dziś jest = tyle wolno) i blokowałoby roadmapę z Prawa 9 (Helpdesk, Dashboards, handoff WON→Bitrix24 — każdy będzie potrzebował domu). Anty-spaghetti (cel #3) to „żadnego pliku bez nośnej funkcji", nie „mało plików dla małości" — spaghetti powstaje też przez przeładowanie istniejących plików, nie tylko przez ich mnożenie.

**Świadomie NIEOBECNE (i dlaczego):**
- `CUTOVER_RUNBOOK.md`, `AUDIT_AKK.md`, `migration/README.md` — **nie były wśród 13 dostarczonych MD; ich logika jest już rozdzielona w dostarczonych plikach.** Nie tworzymy pustych pojemników. Otwieranie wątku o pliku spoza zestawu = błąd krytyczny.
- `adr/` — **NIE powstaje w tym refaktorze** `[D:CORE:refactor-scope]` (NIE jako zakaz fundamentalny). Pełne decyzje zostają w DECISION_REGISTER (Sekcja A open / Sekcja B closed, jak w oryginale), z inline lightweight-ADR body. Powód: register źródłowy unosi decyzje bez utraty czytelności (Sekcja A/B działa); brama cutoveru żyje w jednym pliku; rozbicie teraz = duplikacja tytułów + rozproszenie stanu bramy. **Trigger przyszłego wydzielenia `adr/` (osobną decyzją właściciela + ADR, nie domyślnie):** >~25 decyzji w register · decyzja wymaga >300–500 słów uzasadnienia · decyzja superseduje wcześniejszą · pojawiają się równoległe warianty A/B/C · register zaczyna mieszać decyzje/taski/statusy · właściciel/Dawid nie ocenia blockerów cutoveru z jednej tabeli. Do tego czasu: register jako single-file decision register.
- `CHECKLIST_REVIEW.html`, `STRESS_TEST_PLAN.md`, `SALES_OPS_REQUIREMENTS.md`, `POC_MAPPING.md` — **nie były wśród 13 MD** (to artefakty referowane, nie dostarczone). Nie ma ich w drzewie.
- `REJESTR_STANU_WERYFIKACJI.md` — plik kontroli pracy poprzedniej tury, NIE wchodzi do struktury docelowej.

**Liczenie (dwie osie, bez sprzeczności):**
- Repo SSOT: **8 plików kanonicznych** + root README + katalogi pomocnicze.
- Warstwa aktywna agenta: **≤6–7 ładowanych naraz** — konstytucja (z INVARIANTS sekcja 0) zawsze; reszta przez progressive disclosure.

---

## 2. WARSTWY PLIKÓW (nie wszystko to "SSOT")

| Warstwa | Pliki | Czy SSOT semantyki? |
|---|---|---|
| Navigator | README (root + SSOT) | Nie — routing, nie treść |
| Always-load guardrail | INVARIANTS (sekcja 0 konstytucji) | Tak — najsztywniejszy |
| Core SSOT | CONSTITUTION, ARCHITECTURE, IDENTITY, DATA_MODEL, EVENT_CONTRACT | Tak — każdy dla swojej klasy prawdy |
| Living index | DECISION_REGISTER | Tak — ale indeks, nie magazyn |
| Ops facts | ops/OPS_NOTES | Nie — fakty platformowe z datą |
| Execution control | runbooks/* | Nie — plan i procedura |
| Audit | audits/* | Nie — bramki jakości |
| Decision history | DECISION_REGISTER (inline) → `adr/*` w przyszłości (po triggerze) | Tak — dziś w register, wydzielenie warunkowe |
| Technical truth target | generated/* | Tak docelowo — dziś scaffold |
| Memory/archive | archive/* | Nie — pamięć historyczna |

---

# CZĘŚĆ II — KONTRAKT POJEMNIKÓW (per plik)

Każdy plik opisany identycznie: Rola · default_trust · Decyduje / NIE decyduje · NEGATIVE RULES (czego nie wolno) · BODY (struktura) · Źródło treści (skąd przeszczep) · Najgroźniejszy błąd.

**Definicja kotwicy 1:1:** minimalny fragment treści źródłowej, którego utrata zmienia sens, bezpieczeństwo cutoveru albo zachowanie systemu. Kotwica wskazuje nazwę pola, zakaz, tabelę lub warunek brzegowy — NIE rozwija pełnej procedury ani pełnego body docelowego pliku. **Pending warstwy 2** (Część Va) = szczegół wykonawczy/body, zapisany tam, by nie zmienić tego dokumentu w drugi SSOT.

---

## [ROOT] README.md — topologia repo

- **Rola:** brama wejścia do repo. Człowiek i LLM zaczynają tutaj.
- **default_trust:** D:CORE
- **Decyduje o:** co jest SSOT (`owocni-crm/`), co archiwum (`twenty/`), kolejność czytania dla LLM, co ignorować.
- **NIE decyduje o:** szczegółowym routingu temat→plik (to robi SSOT README), żadnych regułach biznesowych.
- **NEGATIVE RULES:** nie powtarzać routingu z SSOT README; nie opisywać treści plików, tylko ich położenie i status.
- **BODY:** topologia (drzewo) + tabela "co SSOT / co archiwum" + instrukcja LLM (kolejność czytania, priorytet konfliktów na poziomie repo).
- **Źródło treści:** `01_ROOT__README__entry-point.md` (sekcje: struktura repo, instrukcja LLM, NIE używać jako SSOT, blokery cutover).
- **Najgroźniejszy błąd:** agent myli `twenty/` (archiwum POC) z prawdą produkcyjną.
- **Status warunkowy:** istnieje TYLKO jeśli F1 potwierdzi root nad `owocni-crm/`. Jeśli `owocni-crm/` jest rootem → ten plik znika, jego funkcja wchłonięta do [1].

---

## [1] owocni-crm/README.md — routing wewnątrz SSOT

- **Rola:** mapa treści. "Mam pytanie X → który plik?"
- **default_trust:** D:CORE
- **Decyduje o:** routing temat→primary file→secondary, priorytet przy konflikcie źródeł, kolejność czytania dla agenta wewnątrz SSOT.
- **NIE decyduje o:** topologii całego repo (to root README), żadnych regułach merytorycznych.
- **NEGATIVE RULES:** nie dublować całego repo; nie pełnić roli konstytucji; routing skrócić (obecny jest za szeroki — robi z każdego pliku kanon).
- **BODY:** tabela routingu (temat → primary → secondary) + blok priorytetu konfliktów + instrukcja kolejności czytania.
- **Źródło treści:** `02_owocni-crm__README__routing-zadan.md` (task→file routing, AI write access, priorytet konfliktów).
- **Priorytet konfliktów:** patrz §0a (reguła konfliktów po typie treści) `[D:CORE]`. README [1] ją streszcza, nie redefiniuje — jedno źródło, żeby kolejności się nie rozjechały.
- **Najgroźniejszy błąd:** dwa README z nakładającą się funkcją (routing w obu).

---

## [2] CRM_CONSTITUTION.md — prawa, role, governance + INVARIANTS

- **Rola:** kompas. Kto decyduje, jakie prawa, co wymaga ADR, jak AI/MCP ma traktować system. ORAZ dom dla INVARIANTS (sekcja 0).
- **default_trust:** D:CORE
- **Decyduje o:** 9 praw, role (właściciel/Dawid/handlowcy/AI), klasy decyzji, AI governance (read-only default), co wymaga ADR. **INVARIANTS (sekcja 0):** twarde zakazy nienaruszalne.
- **NIE decyduje o:** faktach platformowych (→ OPS_NOTES), szczegółach runtime (HMAC, credits, endpointy), pełnym modelu pól (→ DATA_MODEL).
- **NEGATIVE RULES:**
  - nie wkładać faktów Twenty (credits, HMAC nazwy, R-18, API-key POC) — te idą do OPS_NOTES;
  - nie rozrastać rdzenia ponad ≤100 linii (pełne brzmienie praw → progressive disclosure niżej w pliku);
  - INVARIANTS nie mogą zniknąć przy kompaktacji — pozycja 0, zawsze ładowana.
- **BODY (odstępstwo od skeletonu — INVARIANTS przed QUICK ENTRY):**
  - `## 0. INVARIANTS` — twarde zakazy w formacie: zakaz + powód + konsekwencja + unfreeze_authority + **kontrargument wobec znanej rekomendacji**. + reguła nadrzędna "Research ≠ decyzja". **Wśród nich generyczny: „`[D:OPEN]` nie staje się po cichu `[D:CORE]` — żaden mechanizm `[D:OPEN]` nie może być traktowany jako zamknięta prawda / warunek cutoveru / finalny runtime bez testu + ADR."** (zostaje niezależnie od srcSystem — chroni każdy przyszły otwarty obszar).
  - `## 0a. LLM QUICK ENTRY`
  - role · 3 grupy mentalne · hierarchia źródeł (SSOT vs llms.txt) · klasy decyzji · AI governance · "co wymaga ADR"
  - 9 praw: nazwy + testy w rdzeniu (≤100 linii); pełne brzmienie poniżej (warunkowe ładowanie).
- **Źródło treści:** obecny `CRM_CONSTITUTION.md` (9 praw, role, governance) + INVARIANTS skomponowane z: SKELETON §A reguła nadrzędna + invarianty wskazane przez K1 (Stape nietykalny, native webhook=D2, native webhook≠before/after, zakaz lead_won, LOST≠rejected_lead, custom fields nie-required, frozen fields). **UWAGA: invarianty z researchu (K1) nie mogą wejść jako `[D:CORE]` bez potwierdzenia — oznaczyć każdy `[D:RESEARCH]` przy pisaniu, dopóki nie potwierdzi ich Twoja decyzja lub plik źródłowy.**
- **srcSystem — loop-prevention rozstrzygnięte (trzecia droga, `[D:CORE]`).** Spór „trwałe pole (A) vs ledger §6.4 (B)" był fałszywą alternatywą — oba zakładały, że loop-prevention musi *odzyskiwać* z payloadu, czy webhook jest echem. Fakt: Sortownia WIE, kiedy sama pisze do Twenty — to informacja posiadana w momencie zapisu, nie do odzyskiwania. Rozstrzygnięcie:
  - **Konstytucja — invariant zamknięty (`[D:CORE]`, nie `[D:OPEN]`):** „**Loop-prevention NIGDY na trwałym polu.** Zakaz używania `srcSystem` (lub jakiegokolwiek trwałego pola opisującego rekord) jako mechanizmu SKIP w adapterze. Powód: trwałe pole opisuje rekord na zawsze → wycisza legalne późniejsze zdarzenia (cicha awaria atrybucji, Research §6.3). Loop-prevention dotyczy *operacji zapisu*, nie *tożsamości rekordu*. Odmraża: właściciel + ADR." To invariant zamknięty, bo opiera się na zasadzie inżynierskiej (trwałe pole ≠ marker operacji), nie na niezweryfikowanym zachowaniu Twenty.
  - **Mechanizm docelowy (single-layer):** efemeryczny pending-write w Stape — Sortownia przy zapisie do Twenty zapisuje krótkotrwały znacznik „spodziewam się webhooka dla rekordu Y przez N s"; webhook w oknie → SKIP tej operacji; po TTL znacznik znika sam. JEDNA warstwa, nie trzy.
  - **Idempotencja — z istniejącego Stape Store, BEZ osobnego event_ledger:** duplikat webhooka dla tego samego stanu → `last_stage`/`last_campaignRejected` się nie zmienia → brak przejścia → SKIP naturalnie. Warstwa 3 z §6.4 jest zbędna — Stape Store już to pokrywa.
  - **srcSystem zdegradowany:** zostaje wyłącznie jako pole raportowe (proweniencja, „skąd lead") — NIGDY jako mechanizm SKIP. Patrz DATA_MODEL [5] + EVENT_CONTRACT [6].
- **Kotwice (1:1, nie parafrazować):** Prawo 6 (granica CRM↔orkiestracja), Prawo 1c (llms.txt vs SSOT), label "Odrzuć leada" niesie uzgodnienie z handlowcami.
- **Najgroźniejszy błąd:** agent "ulepsza" invariant lub prawo, traktując research jako autorytet nadrzędny.

---

## [3] ARCHITECTURE.md — granice systemów + przepływy

- **Rola:** który system za co odpowiada i jak płyną dane. Nie szczegółowy kontrakt eventów.
- **default_trust:** D:CORE
- **Decyduje o:** granice systemów (Twenty/Sortownia/Stape/Robot/legacy), boundary matrix, przepływy inbound/outbound, co legacy do wyłączenia, backup path (Sheets §3.1).
- **NIE decyduje o:** jak techniczne zdarzenie staje się business eventem (→ EVENT_CONTRACT), szczegółach runbookowych (→ runbooks/).
- **NEGATIVE RULES:**
  - nie dublować EVENT_CONTRACT (architektura mówi "kto za co", kontrakt mówi "jak zdarzenie→event");
  - nie używać żargonu "C4-lite" (kusi do rozbudowy diagramów ponad potrzebę);
  - nie usuwać `sendToGoogleSheets` z opisu backup bez ADR.
- **BODY:** boundary matrix (system / source of truth / robi / nie robi / failure mode) + diagramy inbound/outbound + legacy do wyłączenia + out-of-scope (helpdesk, MCP write, workflow HTTP).
- **Źródło treści:** `CRM_ARCHITECTURE_CURRENT.md` → rename na ARCHITECTURE (tytuł "CURRENT" mylił stan z aspiracją). Sekcje: legacy, docelowy MVP, diagramy in/out, boundary matrix, D1–D6, §3.1 backup, credit budget.
- **Kotwice (1:1):** "nie usuwać sendToGoogleSheets bez ADR"; D1–D6; rozdzielenie current vs target.
- **Najgroźniejszy błąd:** architektura zaczyna dublować kontrakt eventów i obie wersje się rozjeżdżają.

---

## [4] IDENTITY_AND_INBOUND.md — tożsamość + kanały wejścia

- **Rola:** master identity. To, czego Twenty nie zrobi — nie ma identity graph.
- **default_trust:** D:CORE
- **Decyduje o:** Resolver T1–T5, macierz email×phone (2D), zamknięta lista kanałów wejścia, id_oid jako jedyne źródło prawdy o tożsamości (Stape master, Twenty projekcja), VBB gate, kiedy człowiek rozstrzyga konflikt (T4/T5).
- **NIE decyduje o:** mapowaniu eventów (→ EVENT_CONTRACT), polach Twenty (→ DATA_MODEL), backlogu implementacji (→ runbooks/IMPLEMENTATION_PLAN).
- **NEGATIVE RULES:**
  - nie skracać T1–T5, zamkniętej listy kanałów, kontakt@ jako świadomie nieobsługiwanego, VBB gate, T4/T5 human review — to reguły tożsamości, nie backlog;
  - GA = sygnał, NIE klucz tożsamości (nie wolno mintować id_oid z GA);
  - dwa maile tego samego nadawcy nie mogą stworzyć dwóch id_oid (concurrency);
  - **Stape Store niedostępny podczas resolve → fail-closed (NIE mintuj, kolejkuj)** — fail-open grozi duplikatem id_oid = rozdwojenie tożsamości (nieodwracalne). Reguła degradacji o skutku tożsamościowym, nie parametr runtime.
  - **NIE merguj różnych osób tej samej firmy** (asystent ≠ szef) — auto-merge = nieodwracalne sklejenie tożsamości (źródłowy §11);
  - **dwa paid id_oid → T5, ręczna korekta, NIGDY auto** (źródłowy §11).
- **BODY:** Resolver T1–T5 + macierz email×phone + lista kanałów (paid/manual/email; kontakt@ poza obsługą; Email Sync Etap 1.2) + VBB gate + reguły human review + 5 reguł procesowych §11 + słownik §13.
- **Źródło treści:** obecny `IDENTITY_AND_INBOUND.md` (§5–6 kanały, §8.4 resolver, §10 VBB, §11 reguły procesowe, §13 słownik). Backlog implementacji (§8/§12) → IMPLEMENTATION_PLAN; bramki DO-TESTU (§12) → preflight/audit, NIE backlog (zachować status „blokuje cutover").
- **Kotwice (1:1):** macierz 2D (GA nie jest kluczem); event merge = biała plama (zostaje jawna); kontakt@ świadomie nieobsługiwany; **VBB gate (identity_status==verified AND vbb_eligible; skip≠fail; bramka w Robot, nie Sortowni — decyduje czy sygnał idzie do Google/Meta)**; **5 reguł procesowych §11 = NEGATIVE RULES, nie skracać**; **słownik §13 (canonical_oid vs id_oid, identity_status, vbb_eligible) = one-term-per-concept dla LLM**.
- **Najgroźniejszy błąd:** agresywne skrócenie gubi logikę T1–T5 i zamkniętą listę kanałów.

---

## [5] DATA_MODEL.md — semantyka pól + frozen policy

- **Rola:** kontrakt pól krytycznych. Semantyka i ownership ręcznie; technika docelowo z generated/.
- **default_trust:** D:CORE
- **Decyduje o:** semantyka pól krytycznych, ownership, frozen policy (3 warstwy: typ / API name / wartości SELECT), prefiksy (id*/biz*/src*), 6 pytań przed nowym polem.
- **NIE decyduje o:** standardowych polach Twenty (→ MCP/Settings), pełnym eksporcie schematu (→ generated/, gdy istnieje).
- **NEGATIVE RULES:**
  - **NIE pisać "prawda techniczna jest w `generated/`" dopóki generator nie istnieje** — `generated/` jest dziś scaffoldem; ten plik = pełny ręczny SSOT pól krytycznych `[D:VERIFIED]` (brak pipeline'u dziś);
  - nie zmieniać typu / API name / wartości SELECT pola FROZEN bez ADR (zły typ pola w Twenty = nieodwracalny bez migracji DDL);
  - nie mylić "dodanie opcji SELECT" (Metadata API, tanie) z "zmianą typu" (DDL, drogie).
  - **`srcSystem` = pole raportowe (proweniencja), NIGDY mechanizm loop-prevention** `[D:CORE]`. Opisuje „skąd lead", nie służy do SKIP w adapterze (loop-prevention = efemeryczny pending-write w Stape, patrz EVENT_CONTRACT [6]).
- **BODY:** tabela pól krytycznych Opportunity/Person + frozen policy 3-warstwowa + prefiksy + reguły operacyjne + 6 pytań + preflight.
- **Źródło treści:** obecny `DATA_MODEL.md` (pola krytyczne, frozen 3-warstwy, prefiksy) + wchłonięte ze STAGE_MAPPING: wartości stage (NEW/.../LOST).
- **Kotwice (1:1) — pełna tabela pól, nie tylko „frozen policy" abstrakcyjnie:** wszystkie pola krytyczne Opportunity (idOid, stage, campaignRejected, rejectionReason, bizProduct, bizSource, bizValueWon, srcSystem, lastOrchestrationEventAt/Id, bitrixDealId) + Person.idOid + **jawne rozróżnienie „pole→event" vs „pole CRM-only"**. Szczególnie nie zgubić: `lastOrchestrationEvent*` (jedyny ślad audytowy emisji po stronie Twenty — brak audit logu na Pro); `bitrixDealId` (most handoff WON→Bitrix24, Prawo 9); `lossCategory/lossDescription` = **CRM-only, NIGDY do payloadu** (podpięcie = wyciek powodu przegranej do platform); `rejectionReason` FROZEN (sprzężony z campaignRejected).
- **Decyzje treści do oznaczenia w pliku:** `bizSource = SELECT` `[D:RESEARCH]` + `bizProduct = SELECT` `[D:RESEARCH]` (typu nie da się tanio zmienić po utworzeniu — research-zaufanie; obalony kontrargument DDL — wzór w SKELETON §A). **Dwa wymiary, nie mylić:** (a) *decyzja o typie* = SELECT `[D:RESEARCH]`; (b) *status operacyjny* = NIE tworzyć pola w Twenty przed preflight F6 — ale **OPISAĆ w DATA_MODEL już teraz** (dokumentacja ≠ utworzenie pola; pole zostaje w tabeli z adnotacją „do utworzenia po F6"). **Business required ≠ Twenty save-time required** (custom fields nie mogą być required — walidacja poza save-time).
- **Najgroźniejszy błąd:** ręczny DATA_MODEL deklaruje, że prawda jest gdzie indziej (generated/), którego nie ma → agent traci jedyne źródło typów.

---

## [6] EVENT_CONTRACT.md — Twenty ↔ Sortownia

- **Rola:** najważniejszy plik techniczno-semantyczny. Jak techniczny webhook staje się business eventem.
- **default_trust:** D:CORE
- **Decyduje o:** mapowanie Twenty→SSOT (qualify_lead/purchase/rejected_lead/generate_lead), LOST vs rejected_lead, zakaz lead_won jako event_name, cold-start, adapter logic, "import ≠ event", transport (native webhook OUT). Wchłania STAGE_MAPPING (WON=stage, purchase=event).
- **NIE decyduje o:** pełnych definicjach SSOT orkiestracji (→ Google Docs), JSON schema (→ generated/event-contract.schema.json), Pricing Key, modelu pól (→ DATA_MODEL).
- **NEGATIVE RULES:**
  - native webhook ≠ business event (webhook = techniczny sygnał, adapter Sortowni = mapper);
  - native webhook NIE niesie before/after — transition detection wyłącznie przez Stape Store (last_stage/last_campaignRejected);
  - lead_won/closed_won/WON zakazane jako event_name;
  - import/backfill/replay → no_emit (NIGDY sygnał do platform).
  - **webhook endpoint odbiera WSZYSTKIE wspierane obiekty — adapter MUSI filtrować typ obiektu/zdarzenia przed mapowaniem.** Brak filtra = zdarzenia obcych obiektów emitują jako fałszywe eventy (nieodwracalny sygnał do platform). NIE traktować webhooka jako Opportunity-only.
  - **Loop-prevention: efemeryczny pending-write w Stape, NIGDY `srcSystem`-SKIP** `[D:CORE]`. Sortownia przy zapisie do Twenty zapisuje krótkotrwały znacznik (rekord + TTL); webhook w oknie → SKIP tej operacji; po TTL znika sam. Zakaz: `SKIP gdy srcSystem==OWOCNI_SORTOWNIA` (trwałe pole wycisza legalne późniejsze zdarzenia handlowca — cicha awaria atrybucji, §6.3). Konsekwencja błędu: legalne qualify_lead/purchase/rejected_lead nie wychodzą do platform, niewidoczne bez audytu.
  - **Idempotencja: z istniejącej detekcji przejść (Stape Store), bez osobnego event_ledger** — duplikat webhooka dla tego samego stanu → `last_stage`/`last_campaignRejected` bez zmiany → brak przejścia → SKIP naturalnie.
  - **⚠ TRANSITION EXCEPTION L-1 — backfill idOid** `[D:OPEN]`. Docelowy runtime NIE używa `srcSystem` jako loop-prevention. ALE przejście ma SEKWENCJĘ — stary anti-loop backfillu (manual create → mint → `crm:twenty_update_person` → webhook) stoi dziś na `srcSystem`-SKIP (źródłowy §6). Kolejność obowiązkowa: **(1)** pending-write Sortowni obejmuje operację backfill idOid → **(2)** smoke test #4 PASS (manual create → backfill → brak drugiego generate_lead) → **(3)** dopiero wtedy usuń `srcSystem`-SKIP dla tej ścieżki. **Usunięcie przed krokiem 2 = pętla LUB drugi mint idOid = rozdwojenie tożsamości klienta (nieodwracalne).** To NIE rozszerza się na stage/campaignRejected i NIE jest finalną architekturą — to guard migracyjny dla jednej ścieżki. Warunek zamknięcia: Dawid/test #4. **Wyjątek dotyczy WYŁĄCZNIE backfillu — invariant „loop-prevention nigdy na trwałym polu" obowiązuje wszędzie indziej.**
- **BODY (najpełniejszy — podsekcje):** transport · event catalog · trigger conditions · transition detection + cold-start · loop prevention · idempotency · failure/retry · test matrix · examples.
- **Źródło treści:** obecny `EVENT_CONTRACT.md` (mapowanie, LOST vs rejected, §4.1 cold-start, smoke testy) + wchłonięte ze `STAGE_MAPPING.md` (mapowanie kanoniczne, SQL≡QUALIFIED, zakazane nazwy).
- **Kotwice (1:1):** tabela LOST vs rejected_lead; **cold-start = TABELA 4 sytuacji (brak stanu→nie emituj / pierwsze zdarzenie po cutoverze→baseline bez emisji / kolejna zmiana→wykrywaj transition / backfill-import-replay→no_emit), nie hasło — wszystkie 4 wiersze 1:1** (źródłowy §4.1, to NIE edge case — dotyczy KAŻDEGO pierwszego zdarzenia po cutoverze); HMAC `X-Twenty-Webhook-Signature` + `X-Twenty-Webhook-Timestamp`.
- **Kotwice-wskaźniki do treści (warstwa 2 — nie gubić):** test matrix = **brama go/no-go**, min. 5 scenariuszy z §7 (lub 10 z Research §6.10: manual create+autosave→JEDEN generate_lead; campaignRejected true→true→BRAK drugiego; duplicate webhook→brak duplikatu; import→no_emit), NIE ilustracja. Reason codes adaptera = **obowiązkowa obserwowność** (kompensuje brak audit logu na Pro): SKIP_DUPLICATE_DELIVERY / SKIP_ECHO_OWN_WRITE / SKIP_COLD_START_BASELINE / SKIP_NO_RELEVANT_TRANSITION / SKIP_DUPLICATE_BUSINESS_EVENT / SKIP_UNSUPPORTED_OBJECT / EMITTED.
- **`[D:CORE]` srcSystem — rozstrzygnięte:** loop-prevention = efemeryczny pending-write w Stape; `srcSystem` zdegradowany do proweniencji; idempotencja z istniejącego Stape Store. Nie jest już otwartą decyzją. **Dwa różne testy, NIE mylić:** *test G.2* = czy `srcSystem` jest przepisywany przy UI-edit → **OPCJONALNY** (mechanizm nie zależy od trwałości pola). *Smoke test #4* = czy pending-write pokrywa backfill idOid → **OBOWIĄZKOWY, BRAMA** (bez niego nie wolno usunąć srcSystem-SKIP dla backfillu — L-1).
- **Najgroźniejszy błąd:** uznać native webhook za business event i emitować eventy bez adaptera/shadow-state/idempotencji.

---

## [7] DECISION_REGISTER.md — indeks decyzji

- **Rola:** single-file decision register + brama cutoveru. Pełni rolę adr/ inline (lightweight-ADR), dopóki nie przekroczy progu wydzielenia. Nie magazyn esejów.
- **default_trust:** D:CORE
- **Decyduje o:** stan każdej decyzji (open/accepted/superseded), klasa, owner, czy blokuje cutover, pełna treść decyzji (Sekcja A open / Sekcja B closed). Reguła: decyzja z Blocks=cutover open → cutover nie startuje.
- **NIE decyduje o:** zadaniach wykonawczych (→ runbooks/IMPLEMENTATION_PLAN), faktach platformowych (→ OPS_NOTES).
- **NEGATIVE RULES:**
  - nie mieszać statusu decyzji ze statusem wdrożenia (rozróżnić decision_status vs implementation_status);
  - zadania wykonawcze nie są decyzjami — idą do IMPLEMENTATION_PLAN;
  - zamknięte decyzje NIE wracają do „open" bez jawnej rewizji (zasada z REJESTR_STANU — chroni przed dryfem);
  - **closed decision bez `evidence_source` = NOT closed** — każdy wpis zamknięty MUSI nieść evidence_source (source_file / source_section / verified_by / date). Bez tego „closed" to deklaracja bez kotwicy (REJESTR_STANU nie wchodzi do repo, więc dowód zamknięcia musi żyć w samym wpisie);
  - pełne uzasadnienie decyzji NIE jest esejem prozą — ma strukturę inline lightweight-ADR (decision/context/options/consequences/supersedes/recheck).
- **BODY (struktura, nie esej):**
  - `0. CUTOVER GATE` — reguła bramy
  - `1. OPEN CUTOVER BLOCKERS` — tabela (ID/tytuł/klasa/owner/decision-status/impl-status/evidence/next-action)
  - `2. OPEN NON-BLOCKING DECISIONS` — ta sama tabela
  - `3. CLOSED DECISIONS INDEX` — tabela skrócona
  - `4. DECISION DETAILS — inline ADR-light` — per decyzja: status/closed-at/blocks/owner/decision/context/options/consequences/supersedes/recheck/**evidence_source (source_file/section/verified_by/date — obowiązkowy przy closed)**
  - `5. TASKS MOVED OUT` — tylko linki do IMPLEMENTATION_PLAN, bez treści zadań
  - `6. FUTURE adr/ EXTRACTION POLICY` — triggery wydzielenia (patrz §1 drzewa)
  - sekcja legendy 3 osi faz
- **Źródło treści:** obecny `DECISION_REGISTER.md` 1:1 (Sekcja A open, Sekcja B closed, mapowanie eventów, decyzje planowe). Struktura zachowana, wzbogacona o inline ADR-light.
- **Kotwice (1:1):** legenda 3 osi faz (numeryczne / A-B-C / Etap 1.1-1.2-2+) — blok nienaruszalny, łatwo go pomylić.
- **adr/ — patrz reguła funkcjonalna w §1 drzewa.** Register jest domem decyzji do czasu triggera wydzielenia; wtedy adr/ powstaje osobną decyzją właściciela, NIE domyślnie. To NIE jest zakaz fundamentalny adr/.
- **Najgroźniejszy błąd:** register staje się "drugim mózgiem" i sam dryfuje; albo blockers cutoveru giną w długiej tabeli; albo zamknięta decyzja wraca jako otwarta przez dryf kontekstu.

---

## [8] ops/OPS_NOTES.md — fakty platformowe

- **Rola:** fakty platformowe Twenty z datą i recheck. Naturalny dom faktów, nie decyzji.
- **default_trust:** **D:VERIFIED** (odstępstwo — to plik faktów, nie decyzji rdzeniowych)
- **Decyduje o:** Twenty Verified Facts (credits, HMAC, R-18, audit log gating, known bugs), bezpieczeństwo integracji, workflow registry, gdzie szukać logów.
- **NIE decyduje o:** decyzjach (→ DECISION_REGISTER), procedurach cutoveru, semantyce CRM.
- **NEGATIVE RULES:**
  - żadnych decyzji w tym pliku;
  - żadnych procedur cutoveru;
  - każdy fakt MUSI mieć klasę + źródło + datę + recheck trigger;
  - **klasa wiersza NADPISUJE `default_trust` pliku** — `default_trust: D:VERIFIED` NIE podnosi automatycznie wiersza F-POC/IMPL/Z/DO-TESTU do verified. Każdy wiersz niesie własną klasę; POC/inferencja NIE staje się faktem platformowym przez default pliku.
- **BODY:** tabela faktów z klasą (F-DOCS/F-PRICING/F-POC/IMPL/Z/DO-TESTU) + known issues + workflow registry + bezpieczeństwo integracji + incident log (pusty, kolumny: id/date/symptom/impact/root-cause/fix/prevention) + bulk-ops log (pusty, kolumny: operacja[import/replay/backfill]/mode/**no_emit**/owner/result — `no_emit` obowiązkowa jako ślad, że operacja masowa nie emitowała do platform, zgodność z „import≠event").
- **Źródło treści:** obecny `OPS_NOTES.md` (Twenty Verified Facts, known issues, integracje, workflow registry).
- **Najgroźniejszy błąd:** OPS_NOTES staje się drugim decision logiem — fakty, domysły i decyzje się mieszają.

---

# CZĘŚĆ III — POJEMNIKI POMOCNICZE (tylko przeszczepy z 13 MD)

| Plik / katalog | Rola | default_trust | Źródło (z 13 MD) | NIE |
|---|---|---|---|---|
| `runbooks/IMPLEMENTATION_PLAN.md` | wykonanie przed cutoverem **+ minimum cutover control** (go/no-go, rollback, kill-switch, safe-sink/no_emit, owner decyzji, post-cutover smoke checks) — bo NIE ma osobnego CUTOVER_RUNBOOK | D:CORE | `PLAN_DZIALAN.md` | nie trzymać ADR explanations (link do DECISION_REGISTER); **role: Mariusz/Krzysztof = przełożeni, NIE wykonawcy techniczni — nie przypisywać im zadań**; FIX-1 (assist Opcja A) / FIX-2 (epoch ms) jako backlog; must-have przed cutover (szablony maili, szkolenie) zachować |
| `audits/AUDIT_MIGRACJA.md` | fault-only audit przed importem | D:CORE | `AUDIT_MIGRACJA.md` | **kroki 1–7 NIETKNIĘTE** (surjekcja/semantyka/relacje/false-triggers/ciągłość/tożsamość/odwracalność) — nie ujednolicać numeracji; **import preflight: fields+select-options istnieją, owners/users istnieją, relacje zmapowane; side-effect guard: adapter no_emit LUB webhook safe-sink/off, brak workflow HTTP do Sortowni; import NIE mintuje id_oid**; zasada „**pusty wynik = brak faultów w zakresie 7 kroków, NIE migracja bezpieczna**" (1:1) |
| `generated/*` | techniczna prawda eksportowana z Twenty | D:VERIFIED docelowo | **SCAFFOLD — generator nie istnieje** | nie traktować jako źródło dopóki pipeline nie działa; **jeśli powstaje placeholder — zawiera TYLKO „NOT GENERATED YET — DO NOT USE AS SOURCE OF TRUTH", nie udawany schema JSON** |
| `archive/STAGE_MAPPING.md` | stub po wchłonięciu treści | D:RESEARCH | `STAGE_MAPPING.md` | nie linkować jako produkcyjny SSOT; **stub MUSI wskazać: deprecated + target sections (EVENT_CONTRACT/DATA_MODEL) + „not production SSOT" + data migracji**; **archive = evidence/historia, NIGDY źródło mechaniki — zakaz wskrzeszania martwych mechanik (np. `_operation=create`) jako żywej logiki; ratować można semantykę, nigdy martwy kod** |

**Brak w tej tabeli (świadomie):** CUTOVER_RUNBOOK, AUDIT_AKK, migration/ — nie były wśród 13 MD; ich logika rozdzielona w plikach kanonicznych. CHECKLIST_REVIEW/STRESS_TEST/SALES_OPS/POC_MAPPING — nie dostarczone, poza zakresem. **`adr/` — nie powstaje w tym refaktorze (`[D:CORE:refactor-scope]`), ale jest zarezerwowaną przyszłą ścieżką ekstrakcji** (trigger w §1 drzewa) — to NIE zakaz fundamentalny.

---

# CZĘŚĆ IV — MAPA PRZESZCZEPÓW (stary → nowy)

Co z którego obecnego pliku trafia gdzie. To NIE jest wykonanie — to mapa pojemników. Wykonanie (ZNAJDŹ→ZAMIEŃ + ledger pokrycia) = warstwa 2.

**Wymóg warstwy 2 (zapisany tu, by warstwa 2 go nie pominęła):** każdy przeszczep pliku MUSI wyprodukować ledger pokrycia — każda sekcja źródłowa dostaje status (preserved / moved / transformed / archived / dropped-with-reason) + grep-check. Żadna sekcja starego pliku nie znika bez statusu `archived` lub `dropped-with-reason`. To artefakt wykonawczy (nie nowy plik kanoniczny), ale wymóg żyje tutaj.

| Obecny plik | Akcja | Cel | Uwaga |
|---|---|---|---|
**Mapa obejmuje WYŁĄCZNIE 13 dostarczonych MD.** Pliki spoza zestawu nie mają wiersza — nie istnieją dla tego refaktoru.

| Obecny plik (z 13) | Akcja | Cel | Uwaga |
|---|---|---|---|
| `01_ROOT__README` | rewrite | `[ROOT] README.md` | topologia; warunkowy — jeśli F1 potwierdzi root |
| `02_owocni-crm__README` | rewrite | `[1] README.md` | routing skrócić |
| `CRM_CONSTITUTION` | keep + rewrite | `[2]` | + INVARIANTS sekcja 0 (oznaczone [D:RESEARCH] dopóki niepotwierdzone); fakty → OPS |
| `CRM_ARCHITECTURE_CURRENT` | rename + rewrite | `[3] ARCHITECTURE` | bez "CURRENT", bez "C4-lite" |
| `IDENTITY_AND_INBOUND` | keep + rewrite light | `[4]` | backlog (§8) → IMPLEMENTATION_PLAN |
| `DATA_MODEL` | keep + rewrite | `[5]` | typy ręcznie do czasu generated/; NEGATIVE RULE srcSystem |
| `EVENT_CONTRACT` | keep + rewrite | `[6]` | + wchłonięte STAGE_MAPPING; NEGATIVE RULE srcSystem |
| `STAGE_MAPPING` | wchłonięcie | `[6]` + `[5]`, potem stub w `archive/` | treść 1:1 do EVENT_CONTRACT/DATA_MODEL, stub zostaje |
| `DECISION_REGISTER` | keep + rewrite | `[7]` | rozdzielić decision/impl status; inline ADR-light; pełne decyzje ZOSTAJĄ (adr/ nie w tym refaktorze) |
| `OPS_NOTES` | keep + rewrite | `[8] ops/` | klasy faktów + recheck |
| `PLAN_DZIALAN` | move + rewrite | `runbooks/IMPLEMENTATION_PLAN` | DoD/dependencies; FIX-1/2 → backlog; parzystość BB = bramka tutaj |
| `AUDIT_MIGRACJA` | move + rewrite light | `audits/AUDIT_MIGRACJA` | + import preflight |
| `REJESTR_STANU_WERYFIKACJI` | **poza strukturą** | — | NIE wchodzi do docelowego repo. ALE do końca refaktoru pozostaje aktywnym artefaktem kontroli operacji (anty-dryf: domyślny status bytu=otwarty, zamknięte nie wraca bez REWIZJA, append-only po każdym kroku). „Poza strukturą" ≠ „ignoruj od teraz". |

**Sekcja syntetyczna, NIE source-file:** `INVARIANTS` nie jest osobnym plikiem wejściowym ani docelowym — nie ma go wśród 13 MD i nie powstaje jako plik. Powstaje jako `CRM_CONSTITUTION.md §0` z reguły nadrzędnej (SKELETON §A) + potwierdzonych invariantów z researchu/plików (każdy `[D:RESEARCH]` dopóki niepotwierdzony). To zamyka ryzyko fantomowego `INVARIANTS.md`.

**Parzystość better-bitrix:** materiał historyczny — treść wymagań pozostaje w archiwum (jak SALES_OPS, poza 13 MD). Jeśli funkcjonuje jako bramka cutoveru, jej odzwierciedlenie jest w `IMPLEMENTATION_PLAN` jako warunek go-live, nie jako osobny żywy plik.

---

## CZĘŚĆ V — CO BLOKUJE PRZEJŚCIE DO TREŚCI (warstwa 2)

Nie blokuje *tego* dokumentu (struktura gotowa). Blokuje *wypełnianie treścią*:

| Blokada | Czego dotyczy | Status |
|---|---|---|
| F1 — topologia repo | 1 vs 2 README; kształt drzewa | `[D:OPEN:F1]` — Dawid, oględziny repo |
| backfill idOid w pending-write | czy pending-write obejmuje backfill (L-1, ryzyko rozdwojenia tożsamości) | `[D:OPEN]` — Dawid/test, smoke #4 przed usunięciem srcSystem-SKIP |
| Opportunity webhook payload | czy niesie Person.idOid, czy follow-up query | `[D:OPEN]` — sandbox; do testu NIE pisać Person.idOid jako [D:VERIFIED] |
| Preflight F2–F14 | typy pól, webhook payload, manual create, Email Sync | `[D:OPEN]` — sandbox/Settings |
| generated/ pipeline | czy DATA_MODEL = hybryda czy pełny ręczny | `[D:VERIFIED]` brak pipeline'u dziś → DATA_MODEL = pełny ręczny SSOT; po powstaniu generatora wymagana rewizja struktury DATA_MODEL |

**srcSystem — już NIE blokada** `[D:CORE]`. Rozstrzygnięte: loop-prevention = efemeryczny pending-write (single-layer), srcSystem do proweniencji, idempotencja z istniejącego Stape Store. Test G.2 (przepisywanie pola) zdegradowany do opcjonalnego. **Wyjątek: backfill idOid — patrz blokada L-1 powyżej (osobna operacja, osobny test).**

**Reguła:** żadna treść `[D:CORE]`/`[D:VERIFIED]` nie powstaje na założeniu. Dopóki preflight nie wróci, te pola są `[D:OPEN]` lub `[D:RESEARCH]`, nigdy `[D:CORE]`.

---

## CZĘŚĆ Va — PENDING WARSTWY 2 (treść docelowych plików — NIE wpisywać do STRUKTURA)

To są słuszne uwagi researchu, które są TREŚCIĄ plików, nie kontraktem pojemników. Zapisane, by nie zginęły — ale ich dom to body docelowego pliku w warstwie 2, nie ten dokument. Wpisanie ich tutaj zmieniłoby STRUKTURA z mapy w drugi SSOT.

| Pending | Plik docelowy (body warstwy 2) |
|---|---|
| Minimal read-pack per task (eventy→READ x; identity→READ y; cutover→READ z) | README [1] |
| AS-IS / TARGET MVP / DECOMMISSION / FALLBACK / OUT-OF-SCOPE jako sekcje | ARCHITECTURE [3] |
| Email Sync preflight (leads@/studio@/handlowcy mailbox-vs-alias, auto-create per mailbox, concurrency mint-guard) | IDENTITY [4] |
| Field status taxonomy (MUST_CREATE/EXISTS_VERIFIED/DO_NOT_CREATE/FUTURE/DEPRECATED) + lifecycle migracji pola (create→backfill→dual-read→deactivate) | DATA_MODEL [5] |
| pending-write TTL + failure modes (webhook po TTL, przed zapisem, retry, edycja w oknie) | EVENT_CONTRACT [6] — failure modes ODWRACALNE (opóźnienie); backfill idOid jest wyjątkowo w [6] NEGATIVE RULES jako L-1, bo NIEODWRACALNY (rozdwojenie tożsamości) |
| IMPLEMENTATION_PLAN pełne sekcje (milestones Etap 1.1/1.2/Testy/Cutover, gate criteria) | IMPLEMENTATION_PLAN |

---

## CZĘŚĆ Vb — WYMAGANY OUTPUT WARSTWY 2 (kontrola wykonania, nie treść SSOT)

Wymóg zapisany tu (nie tylko w changelogu), bo changelog czyta się jako historię — a to jest **obowiązek wykonania**, nie notatka. `[D:CORE]`

**Każdy batch refaktoru pliku MUSI zostawić `refactor_coverage_ledger`:**

| source_file | source_section | target_file | target_section | status | reason | grep_check |
|---|---|---|---|---|---|---|

Status: `preserved` / `transformed` / `moved` / `archived` / `dropped_with_reason`.

**Zakazy:**
- żadna sekcja starego pliku nie znika bez statusu `archived` lub `dropped_with_reason`;
- zamknięte decyzje nie wracają do `open` bez jawnego `REWIZJA`;
- batch bez semantic diff + grep-check NIE jest gotowy do podmiany.

**Must-pass gates warstwy 2** (pełna treść → IMPLEMENTATION_PLAN, tu tylko wykaz, by nie zginęły): traceability · event-semantics (LOST≠rejected, WON≠event) · webhook-truth (brak before/after) · manual-create (idOid null) · loop-prevention (pending-write, nie srcSystem) · data-model (typy frozen) · import-safety (no_emit) · identity-safety (T1–T5, fail-closed).

**Handoff po batchu (funkcja WDROZENIE_KONTROLA, jeśli istnieje w repo):** lista plików do podmiany + grep-checki (lead_won=0, brak srcSystem-jako-jedyny-loop, PLAN bez ADR-explanations) + known risks + „czego NIE ruszać". To wzorzec outputu, NIE plik kanoniczny.

---

## CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-05-31 | Utworzenie dokumentu struktury + ról | Konsolidator | Warstwa pojemników: co/gdzie/czego nie, mapa przeszczepów; treść = warstwa 2 |
| 2026-05-31 | Red-team + korekta: drzewo TYLKO z 13 MD (usunięto CUTOVER_RUNBOOK, AUDIT_AKK, migration/, adr/ jako zmyślone pojemniki); srcSystem = generyczny [D:OPEN]-guard w konstytucji + NEGATIVE RULES lokalne (nie nazwany invariant); parzystość BB → archive/IMPLEMENTATION_PLAN; REJESTR_STANU poza strukturą | Konsolidator | Wierność jedynemu faktowi (13 MD); rozstrzygnięcie srcSystem (K1+K2 zbieżnie); usunięcie awansu researchu do D:CORE |
| 2026-05-31 | srcSystem ROZSTRZYGNIĘTY trzecią drogą (`[D:CORE]`): loop-prevention = efemeryczny pending-write w Stape (single-layer), srcSystem→proweniencja, idempotencja z istniejącego Stape Store (bez event_ledger). Invariant zamknięty "loop-prevention nigdy na trwałym polu". Test G.2 zdegradowany z bramy do opcjonalnego. | Konsolidator | Fałszywa alternatywa A vs ledger §6.4 obnażona; §6.3 (cicha awaria) potwierdzone 3 niezależnymi ścieżkami; rozwiązanie bez "lotniskowca" |
| 2026-05-31 | KOREKTA reguły drzewa: „13 plików jako sufit nadrzędny" → **reguła funkcjonalna** (plik = dom treści którego obecne nie unoszą; liczba = wynik, nie przyczyna; nowy plik kanoniczny = ADR). adr/ → `[D:CORE:refactor-scope]` (nie zakaz fundamentalny) + triggery wydzielenia. DECISION_REGISTER = inline ADR-light, struktura sekcyjna. | Konsolidator | K1+K2 zbieżnie: konkluzja (adr/ nie teraz) dobra, uzasadnienie („13 nadrzędne") groźne — tautologia sprzeczna z G.4/Prawo 9, blokowałaby roadmapę |
| 2026-05-31 | Znacznik root repo: `[D:VERIFIED — F1 pending]` → `[D:OPEN:F1]` | Konsolidator | Hybryda VERIFIED+pending łamała system znaczników (pół-stan); spójność z §G.1 SKELETON |
| 2026-05-31 | Red-team konsultantów: PRZYJĘTO kotwice (L-1 backfill idOid=KRYT, cold-start-tabela, IDENTITY: VBB+§11 reguły+słownik, DATA_MODEL pełna tabela pól+CRM-only, test-matrix+reason-codes jako wskaźniki) + §0a (zgodność SKELETON + reguła konfliktów) + cutover-control w IMPLEMENTATION_PLAN + import-preflight w AUDIT + OPS row-class-overrides-default + ledger-pokrycia wymóg. ODRZUCONO lotniskowiec: TTL/body-contracts/read-pack/taxonomy → Część Va (pending warstwy 2, nie treść STRUKTURA) | Konsolidator | Filtr cel#1>#2; STRUKTURA = kontrakt pojemników nie drugi SSOT; treść = warstwa 2. L-1 jedyna luka mogąca ZEPSUĆ (rozdwojenie tożsamości) → [D:OPEN]+test |
| 2026-05-31 | Przegląd końcowy: B-1 backfill → jawna TRANSITION EXCEPTION L-1 z sekwencją (1)(2)(3); cel #1 doprecyzowany (efekt biznesowy ≠ stary mechanizm); meta-pliki NIE aktywne w repo → reguły rdzeniowe przeszczepić do konstytucji (C-3); INVARIANTS wyjęte z tabeli przeszczepów (fantom); definicja kotwica vs pending; B-2 dwa testy rozróżnione (G.2 opcj./smoke#4 brama); B-5 bizSource dwa wymiary; generated/ fakt vs konsekwencja | Konsolidator | Usunięcie pozornych sprzeczności i furtek interpretacyjnych — bez zmiany decyzji; meta-pliki = ślad genezy, agent z nich nie czerpie |
| 2026-05-31 | Selective rescue (5 przyjętych, 1 odrzucony): PRZYJĘTO Część Vb (ledger pokrycia jako operacyjny obowiązek + must-pass gates + handoff WDROZENIE_KONTROLA); REJESTR_STANU aktywny do końca refaktoru; archive selective-rescue NEGATIVE RULE (zakaz wskrzeszania martwych mechanik); IDENTITY fail-closed przy Stape down (nieodwracalny duplikat id_oid); OPS kolumny incident/bulk-ops (no_emit ślad); naprawiono własne zakazane sufiksy [D:VERIFIED: ...]. ODRZUCONO glosariusz homonimów (R-1: kolizja teoretyczna, lotniskowiec w konstytucji ≤100 linii) | Konsolidator | Filtr cel#1>#2; R-5 trafny co do funkcji (handoff), nietrafny co do faktu (WDROZENIE nie był wśród 13 MD tej sesji); reguła sufiksów ujawniła własny błąd |
| 2026-05-31 | Domknięcie końcowe — awans 2 resztówek z Części Va (były tam przez nadmiar ostrożności; stres test wykazał, że to format/reguła, nie treść body): (1) `evidence_source` obowiązkowy w closed decisions → NEGATIVE RULE + struktura wpisu [7] („closed bez evidence = not closed", anty-dryf zamkniętych decyzji bez REJESTR_STANU w repo); (2) object filtering → NEGATIVE RULE [6] (reguła o skutku na emisję: brak filtra = fałszywe eventy z obcych obiektów = nieodwracalny sygnał). Reszta uwag konsultantów: wdrożona wcześniej (reason-codes+uzasadnienie potwierdzone faktem) lub słusznie zostaje w Va jako treść warstwy 2 (read-pack, AS-IS/TARGET, TTL) | Konsolidator | Format ≠ treść: evidence_source to struktura wpisu (jak 9 pól front-matter), object filtering to reguła (jak fail-closed) — należą do sekcji plików, nie do pendingu treści |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:CORE`. Inline = odchylenie.
