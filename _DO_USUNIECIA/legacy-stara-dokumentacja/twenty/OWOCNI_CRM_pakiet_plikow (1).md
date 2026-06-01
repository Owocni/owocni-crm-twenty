# OWOCNI CRM — Pakiet plików startowych

**Specyfikacja 6 plików operacyjnych + README routing + 2 katalogi**

---

## Struktura repo

```
/owocni-crm/
├── README.md                       # Plik 0 — Agent Routing + meta
├── CRM_CONSTITUTION.md             # Plik 1 — Role + 9 praw + Glossary + AI rules
├── CRM_ARCHITECTURE_CURRENT.md     # Plik 2 — Stan + boundary + Event Runtime & Ownership
├── DATA_MODEL.md                   # Plik 3 — Krytyczne pola × 8 kolumn + graded protocol
├── EVENT_CONTRACT.md               # Plik 4 — Semantyka + runtime + outbox + transitions
├── DECISION_REGISTER.md            # Plik 5 — Open decisions + ADR + reguły kiedy NIE ADR
├── CUTOVER_RUNBOOK.md              # Plik 6 — Pre/Cutover/Rollback + webhook recovery
├── /migration/
│   ├── README.md                   # 5 reguł ledger + bulk operation gate
│   └── active_leads_YYYY_MM_DD.csv
└── /ops/
    └── OPS_NOTES.md                # Twenty Verified Facts + 3 registries + retention
```

---

## Mapowanie plików na fazy

Pełna definicja bramy w fundamentach (Część V). Tutaj — które pliki muszą być gotowe per faza:

| Faza | Pliki / artefakty MUSZĄ być gotowe |
|---|---|
| **Faza 1 — Sandbox** | README.md istnieje (routing) + OPS_NOTES.md (Twenty Verified Facts rozszerzany organicznie) |
| **Faza 2 — Schema produkcyjna** | Plik 1 + Plik 2 + Plik 3 + preflight `idOid unique+null` zaliczony |
| **Faza 3 — Import danych** | Plik 3 finalny + `/migration/README.md` z bulk gate + backup legacy |
| **Faza 4 — Outbound eventy** | Plik 4 finalny + Twenty native webhook OUT skonfigurowany + webhook adapter `inbound:twenty_webhook` w Sortowni gotowy + Inteligentny Routing zawiera reguły dla SSOT eventów z Twenty + 5 smoke test scenarios (Plik 4 §9) PASSED |
| **Faza 5 — Cutover** | Plik 6 + dry-run + owner per krok |

Plik 5 (`DECISION_REGISTER`) jest **przekrojowy** — pozycje domykane sekwencyjnie per faza.

---

# Plik 0 — `README.md` (Agent Routing)

**Cel:** plain-text routing dla agentów (AI lub ludzkich) wchodzących do repo. Nie udaje zgodności z Anthropic Skills ani Twenty `defineSkill()` — to repo-internal konwencja.

**Tryb dostępu agenta:** czytany jako pierwszy plik w repo (z poziomu `/owocni-crm/`).

**Rytm zmian:** przy każdej zmianie struktury pakietu lub dodaniu nowego pliku.

**Anty-wzorzec:** NIE jest dokumentem architektury (to Plik 2), NIE zawiera reguł (to Plik 1), NIE udaje SKILL.md.

## Struktura sekcji

```markdown
# OWOCNI CRM — Repo routing

Purpose: Operational pakiet dokumentów dla CRM OWOCNI.PL na Twenty.
Status: Pre-cutover (Faza 1-2 w toku).
Owner: Królu złoty (OWOCNI.PL).
Last updated: <data>.

## How agents should use this repo

1. Read this README first.
2. For governance / decision questions → CRM_CONSTITUTION.md.
3. For "where data flows" / "who owns what" → CRM_ARCHITECTURE_CURRENT.md.
4. For "what fields exist, what types, what's frozen" → DATA_MODEL.md.
5. For "what triggers what event, what payload, what runtime" → EVENT_CONTRACT.md.
6. For "why was this decided" / "what's still open" → DECISION_REGISTER.md.
7. For "how does cutover work, how to rollback" → CUTOVER_RUNBOOK.md.
8. For "where to look when something breaks" / "Twenty platform facts" → /ops/OPS_NOTES.md.
9. For "how to import data, what's the ledger format" → /migration/README.md.

## Task → file routing

| Zadanie / pytanie | Primary file | Secondary files |
|---|---|---|
| "Czy mogę dodać pole X do Opportunity?" | DATA_MODEL.md | CRM_CONSTITUTION.md (Prawo 3, 4) |
| "Jak emitować purchase / qualify_lead / rejected_lead?" | EVENT_CONTRACT.md | CRM_ARCHITECTURE_CURRENT.md (§7 Integracja Twenty ↔ SSOT orkiestracji) |
| "Czy AI agent może to zrobić?" | CRM_CONSTITUTION.md (Prawo 8, Rola 6) | DECISION_REGISTER.md |
| "Co się dzieje przy cutoverze?" | CUTOVER_RUNBOOK.md | /migration/README.md |
| "Jaki workflow credit limit? Czemu native webhook OUT a nie Workflow HTTP?" | /ops/OPS_NOTES.md (Twenty Verified Facts) | CRM_ARCHITECTURE_CURRENT.md §8 |
| "Dlaczego nie Apps Framework?" | CRM_CONSTITUTION.md Część III (D1) | DECISION_REGISTER.md |
| "Manual lead — jak działa?" | EVENT_CONTRACT.md (§5 webhook adapter + §3 mapping table) | DATA_MODEL.md (Person.idOid) |
| "Co jeśli zmiana stage nie odpaliła SSOT eventu?" | EVENT_CONTRACT.md (§9 smoke test scenarios + §10 failure modes) | /ops/OPS_NOTES.md (Ratownik alerts) |
| "Gdzie żyje Inteligentny Routing / Pricing Key / Lista Zadań?" | SSOT orkiestracji Sortowni (poza tym pakietem; link w /ops/OPS_NOTES.md §3) | CRM_ARCHITECTURE_CURRENT.md §7 |
| "Co jeśli n8n padnie?" | n/a — n8n nie jest na critical path SSOT orkiestracji; patrz CRM_ARCHITECTURE_CURRENT (Rola n8n) | — |

## AI write access status

Default: read-only via native role assignment (Settings → Members → Roles).
Promotion to write: only after Etap 1 retrospective + owner approval.
Reason: governance policy, not platform limitation (MCP write is technically available in Twenty Cloud).

## What this repo is NOT

- Not a Twenty platform manual (use docs.twenty.com/llms.txt for that).
- Not an Anthropic Skill package (would require SKILL.md with YAML frontmatter).
- Not a Twenty App package (would require defineSkill() in TypeScript).
- It IS our internal governance overlay for one specific workspace.
```

**Łączna objętość:** ~1 strona markdownu.

---

# Plik 1 — `CRM_CONSTITUTION.md`

**Cel:** stała warstwa reguł decyzyjnych i terminologii cross-system. Czytana przed każdą decyzją dotykającą fundamentu.

**Tryb dostępu agenta:** load na początek sesji jako rule-set. Twenty-internal terminy (Person, Company, Opportunity) NIE są tutaj — agent fetchuje `docs.twenty.com/llms.txt`.

**Rytm zmian:** kwartalnie. Każda zmiana = wpis do `DECISION_REGISTER.md`.

**Anty-wzorzec:** NIE jest podręcznikiem CRM, NIE opisuje schemy (to `DATA_MODEL.md`), NIE opisuje workflowów ani eventów (to `EVENT_CONTRACT.md`), NIE zawiera wersyjnych faktów platformowych Twenty (to `OPS_NOTES.md` sekcja Twenty Verified Facts).

## Struktura sekcji

### Header

- Status, owner, zakres
- Uwaga ramowa: gdzie naprawdę leży ryzyko (4 wymiary — patrz fundamenty)

### CZĘŚĆ I — Role (6 ról)

Per rola: 2-4 zdania określające co rola trzyma, czego nie robi, gdzie jest granica.

- **Rola 1 — Właściciel / architekt biznesowy** = właściciel semantyki + Bus Factor = 1 With Intent (3-zdaniowa definicja inline)
- **Rola 2 — Developer** = potwierdza i wdraża kontrakty, nie interpretuje biznesu
- **Rola 3 — Twenty (Cloud Pro)** = state + UI + simple internal workflows + **native webhook OUT (raw CDC source, NIE business event); native webhook NIE pożera workflow credits**
- **Rola 4 — Sortownia (Stape sGTM)** = router konfiguracyjny + identity layer per SSOT orkiestracji; mintuje `id_oid` (triggery: `oid_init` lub `generate_lead`); routing przez Inteligentny Routing; tworzy zadania na **Liście Zadań Stape** (NIE custom outbox); webhook adapter Twenty inbound mapuje raw CDC → event_name z minimalną 2-polową pamięcią
- **Rola 5 — n8n (poza SSOT orkiestracji)** = ad-hoc LLM data processing; NIE event runtime; NIE outbox; NIE critical path
- **Rola 6 — MCP / AI** = operator po kontrakcie; default read-only via native role assignment; MCP write disabled by governance, not platform

### CZĘŚĆ II — Konstytucja: 9 praw w 3 grupach

Per prawo: jednowierszowy nagłówek, sekcje (a/b/c/...) z podpunktami, jednowierszowy **Test**.

**Grupa I — Jak wiemy, co jest prawdą**
- **Prawo 1** — Rzeczywistość bije dokument (4 sekcje, w tym 1d: fakty platformowe Twenty → OPS_NOTES, konsekwencje → konstytucja)
- **Prawo 2** — Klasyfikuj nieodwracalność (5 klas decyzji)

**Grupa II — Co odlewamy w fundamencie**
- **Prawo 3** — Model danych to kontrakt (4 sekcje, w tym 3d: każde pole ma `description`)
- **Prawo 4** — Znaczenie definiuj zanim utworzysz pole (6 pytań przed tworzeniem)
- **Prawo 5** — Jedna jawna ścieżka wejścia (manual jako wyjątek; mapping na D4: Sortownia mintuje `id_oid` przy `generate_lead` triggered przez Twenty manual create)
- **Prawo 6** — Jeden właściciel prawdy per klasa informacji (mapowanie: Twenty = state CRM; Sortownia = identity + routing + Lista Zadań Stape; Robot = retry; Adaptery = logika per platforma); granica CRM↔orkiestracja widoczna w prefiksach (`idX`/`bizX` outbound)

**Grupa III — Jak utrzymujemy system czytelnym**
- **Prawo 7** — Workflow ma kontrakt graded by complexity (7 sekcji, w tym 7c: **trigger policy by source**, 7f: **zakaz sekretów w Workflow Code i Workflow HTTP**)
- **Prawo 8** — System czytelny przed automatyzacją (4 sekcje, w tym 8b: **permission surfaces matrix — 6 powierzchni**, 8c: MCP write disabled by governance)
- **Prawo 9** — Brutalnie wąski start

### CZĘŚĆ III — Glossary (cross-system, tylko terminy konfliktowe)

Tabela ~13 terminów (definicja operacyjna per system):

| Termin | System | Definicja operacyjna |
|---|---|---|
| Lead (legacy) | better-bitrix (Supabase legacy) | Rekord z formularza przed weryfikacją |
| Opportunity | Twenty | Pipeline'owy rekord sprzedaży (zastępuje Lead z legacy po migracji) |
| Deal | Bitrix24 (osobny system księgowy) | Zamknięty kontrakt po stronie księgowej (handoff manual w MVP po `stage=WON`) |
| `id_oid` | OWOCNI ecosystem (SSOT orkiestracji) | Uniwersalny klucz ścieżki klienta mintowany **wyłącznie** przez Sortownię przy `oid_init` lub `generate_lead` (UUID v4) |
| `id_event` | SSOT orkiestracji — Lista Zadań Stape | ID zadania na Liście Zadań mintowane przez Sortownię przy tworzeniu zadania |
| `Job_ID` | SSOT orkiestracji — Lista Zadań Stape | Unikalny identyfikator zadania, po którym Robot wykonuje atomic transitions |
| SSOT eventy z CRM | EVENT_CONTRACT events | 3 eventy emitowane z Twenty przez native webhook OUT: `qualify_lead`, `rejected_lead`, `purchase`; manual create dodatkowo triggeruje `generate_lead` |
| `generate_lead` | SSOT orkiestracji | Lead creation; w SSOT triggery: paid touchpoint formularza ALBO Twenty manual create (webhook adapter wykrywa `id_oid IS NULL` przy `_operation=create`) |
| `qualify_lead` | SSOT orkiestracji | SQL z CRM; Twenty: `stage` zmienia się na QUALIFIED |
| `rejected_lead` | SSOT orkiestracji | Kampanijne odrzucenie; Twenty: `campaignRejected` zmienia się na true |
| `purchase` | SSOT orkiestracji | Closed Won; Twenty: `stage` zmienia się na WON |
| Akt Własności | SSOT orkiestracji — Profil Klienta | Zamrożony Owner+Assist na 90 dni w momencie `generate_lead` |
| Pricing Key | SSOT orkiestracji | Centralny cennik wartości eventów (Google Sheet → JSON), pobierany przez Adapter tuż przed wysłaniem |
| Faktura | Fakturownia | Zewnętrzny obiekt, NIE w Twenty |
| julia362 | system legacy | IMAP watcher na `leads@owocni.pl` (do wyłączenia) |
| Sortownia | Stape sGTM | Router konfiguracyjny + identity layer; mint `id_oid` + Inteligentny Routing + Lista Zadań |

**Frequently Conflated Terms:**
- „Deal" (Bitrix24 księgowy) vs „Opportunity" (Twenty CRM operacyjny) — różne byty; Bitrix24 dostaje Deal tylko po `stage=WON` (manual SOP w MVP, Phase 2 = adapter `crm:bitrix_create_deal`)
- „Lead" (better-bitrix legacy) vs „Opportunity" (Twenty) — ten sam byt po migracji
- `rejected_lead` (kampanijne odrzucenie, `campaignRejected=true`) vs `purchase` (closed_won, `stage=WON`) — różne SSOT eventy; mogą być emitowane do tych samych platform jako adjusty wartości (RESTATE downgrade vs Secondary Goal), **NIE są mutually exclusive** w architekturze SSOT — celem jest gęstość uczących sygnałów, nie księgowość
- Native Twenty webhook OUT (raw CDC z HMAC, NIE pożera credits) vs Twenty Workflow HTTP Request (workflow runs, pożera credits — NIE używane dla outbound)
- `id_oid` (SSOT — uniwersalny klucz ścieżki klienta) vs `id_event` (SSOT — ID zadania) vs `Job_ID` (SSOT — Lista Zadań)
- `qualify_lead` jako semantyczna transition (Twenty: stage→QUALIFIED) vs `qualify_lead` jako RESTATE upgrade w Google Ads (mechanika platformy)

### CZĘŚĆ IV — AI / MCP rules

- AI default = read-only role via Settings → Members → Roles native assignment (NIE przez `defineApplicationRole`, który jest wąską funkcjonalnością Apps Framework — patrz Prawo 8b matrix)
- AI nie zmienia schemy / nie usuwa danych / nie edytuje workflowów / nie ustawia stage'a programowo bez human approval
- Tryb pracy: `read → plan w chat → diff → CZŁOWIEK aprobuje/wykonuje`
- **MCP write access disabled by governance policy** (NIE technical limitation): brak retro Etapu 1, ograniczona auditability na Pro
- Promocja do write dopiero po retro
- Wszystkie zmiany agenta logowane do `OPS_NOTES`
- Agent fetchuje Twenty-internal terminy z `docs.twenty.com/llms.txt`

**Co fizycznie wypełnia plik:**

Treść Części I + II + VI z `OWOCNI_CRM_fundamenty.md` (6 ról + 9 praw + preflight evidence) + Glossary + AI rules. Bez wersyjnych faktów platformowych Twenty (te idą do OPS_NOTES).

**Łączna objętość:** ~5-7 stron markdownu (~250-300 linii, po cleanup od wcześniejszych iteracji).

---

# Plik 2 — `CRM_ARCHITECTURE_CURRENT.md`

**Cel:** opisuje *stan*, nie intencję. Sufiks `CURRENT` chroni przed dryfem (nie ma „wersji finalnej", jest tylko aktualna).

**Tryb dostępu agenta:** load przy pytaniach o pochodzenie/destynację danych, granice systemów, decyzje transportowe.

**Rytm zmian:** przy każdej decyzji architektonicznej (zamknięcie pozycji z `DECISION_REGISTER` → update tutaj).

**Anty-wzorzec:** NIE opisuje pól i typów (to `DATA_MODEL`), NIE opisuje eventów i payloadów (to `EVENT_CONTRACT`), NIE opisuje cutoveru (to `CUTOVER_RUNBOOK`), NIE opisuje przyszłości (wymienić jako „Poza Etapem 1").

## Struktura sekcji

### 1. Header

Status: aktualny, data ostatniej rekonsyliacji, owner.

### 2. Stan przed migracją (legacy do wyłączenia)

- Supabase jako legacy źródło `/lead`
- julia362 IMAP watcher na `leads@owocni.pl`
- Pipeline: email → julia362 → better-bitrix (skrypt LLM-based) → GPT-4o → Supabase
- Bitrix24 jako system księgowy (poza zakresem CRM; handoff manual w MVP)

### 3. Stan docelowy MVP

- **Inbound canonical**: Sortownia odbiera sygnał formularza/API → mintuje `id_oid` przy `generate_lead` → tworzy zadania (m.in. `crm:twenty_create_lead`, `system:WRITE_AKT_WLASNOSCI`) → Robot wykonuje Adapter `crm:twenty_create_lead` → Twenty (upsert po `idOid` jako unique custom field)
- **Manual create**: jawny wyjątek (`Person.idOid` nullable; Twenty native webhook OUT przy create z `id_oid IS NULL` → webhook adapter w Sortowni wykrywa manual i emituje `generate_lead` → mint `id_oid` + WRITE_AKT_WLASNOSCI + backfill Twenty Person via `crm:twenty_update_person`)
- julia362 z twardą datą wyłączenia (TBD w runbooku — Decyzja 8 w rejestrze)
- Twenty jako single CRM dla pipeline operacyjnego (zastępuje Bitrix z SSOT orkiestracji jako CRM); Bitrix24 zostaje system księgowy (Phase 2 adapter `crm:bitrix_create_deal` przy `stage=WON`)
- **Outbound**: Twenty native webhook OUT (raw CDC, HMAC SHA256, NIE pożera credits) → webhook adapter w Sortowni (`inbound:twenty_webhook` mapuje na SSOT event_name z minimalną 2-polową pamięcią) → Inteligentny Routing → Lista Zadań Stape → Robot wykonuje Adaptery platform (`platform:google_ads`, `platform:meta_ads`, `analytics:ga4_mp`) → downstream platforms

### 4. Model obiektów

- Natywne: `Opportunity`, `Person`, `Company`, `Note`
- Pełne detale: → `DATA_MODEL.md`
- „Custom object Deal" z dokumentów aspiracyjnych **NIE jest częścią architektury** — używamy natywnego `Opportunity`

### 5. Flow diagrams

3 podstawowe (Mermaid lub ASCII):

**5.1 Inbound canonical (paid touchpoint formularz → Twenty):**
```
Lead form / API → Sortownia
                  → mint id_oid (przy generate_lead)
                  → Inteligentny Routing dla generate_lead:
                      ['system:WRITE_AKT_WLASNOSCI', 'crm:twenty_create_lead', 'analytics:ga4_mp']
                  → Lista Zadań Stape (3 zadania pending)
                  → Robot pobiera zadania sekwencyjnie:
                      → Adapter crm:twenty_create_lead → Twenty REST API (upsert po idOid) → success
                      → Adapter system:WRITE_AKT_WLASNOSCI → Profil Klienta (zamrożenie Owner+Assist 90d) → success
                      → Adapter analytics:ga4_mp → GA4 Measurement Protocol → success
```

**5.2 Outbound business event (qualify_lead / rejected_lead / purchase):**
```
Handlowiec zmienia stage Opportunity (np. CONTACTED → QUALIFIED) w Twenty UI
  → Twenty native webhook OUT (raw CDC, HMAC SHA256) → Sortownia endpoint
  → webhook adapter inbound:twenty_webhook:
      → weryfikuje HMAC
      → lookup Stape Store: last_stage[opportunity_id]
      → jeśli last_stage != "QUALIFIED" AND new_stage == "QUALIFIED":
          → event_name = "qualify_lead"
          → update Stape Store: last_stage[opportunity_id] = "QUALIFIED"
          → emit do Inteligentnego Routingu
      → jeśli no transition (np. zmiana name): SKIP
  → Inteligentny Routing dla qualify_lead:
      ['FIND_SOURCE_PLATFORM', 'analytics:ga4_mp']
  → FIND_SOURCE_PLATFORM lookup w Profilu Klienta (Akt Własności Owner+Assist)
      → np. zwraca ['platform:google_ads', 'platform:meta_ads']
  → Lista Zadań Stape (3 zadania pending: google_ads, meta_ads, ga4_mp)
  → Robot pobiera, Adapter pobiera Pricing Key, wysyła:
      → Google Ads → RESTATE upgrade Lead → success
      → Meta CAPI → Offline Conversion → success
      → GA4 MP → begin_checkout event → success
```

**5.3 Manual create w Twenty (manual lead z polecenia):**
```
Handlowiec → Twenty UI manual create Opportunity 
          → Person.idOid = null (auto)
          → Twenty native webhook OUT (operation=create)
          → webhook adapter inbound:twenty_webhook:
              → wykrywa _operation=create AND id_oid IS NULL
              → event_name = "generate_lead" (manual variant)
              → emit do Inteligentnego Routingu
          → Inteligentny Routing dla generate_lead:
              ['system:WRITE_AKT_WLASNOSCI', 'crm:twenty_update_person']
          → Sortownia lookup Profilu Klienta (email/telefon priority) → match LUB mint id_oid
          → Lista Zadań Stape:
              → Adapter system:WRITE_AKT_WLASNOSCI (manual source, brak paid touchpoint)
              → Adapter crm:twenty_update_person → backfill Person.idOid via Twenty REST API
          → następne webhooki dla tego opportunity mają id_oid wypełniony, normal flow continues
```

### 6. Boundary matrix (granice systemów)

| System | Co trzyma | Czego NIE robi |
|---|---|---|
| **Twenty** | Aktualny stan sprzedaży, UI, pipeline, simple internal workflowy, **native webhook OUT** (raw CDC source, NIE business event, NIE pożera credits) | NIE mintuje `id_oid`; NIE emituje business events semantycznie (Sortownia interpretuje raw CDC); NIE prowadzi outbound przez Workflow HTTP (50 credits/rok Pro nie wystarczy przy 150 leadów/mc); NIE trzyma żadnego outboxa |
| **Sortownia (Stape sGTM)** | `id_oid` mint, atrybucja (Akt Własności), consent, hash PII, Profil Klienta, Inteligentny Routing (plik konfiguracyjny), webhook adapter Twenty inbound z minimalną 2-polową pamięcią (`last_stage`, `last_campaignRejected` per opportunity_id w Stape Store) | NIE robi pełnego stateful diff (tylko 2-polowy filter); NIE trzyma własnego event outbox (Lista Zadań Stape jest infrastrukturą platformową); NIE robi retry orchestration (Robot to robi); NIE robi terminal state machine enforcement (delegujemy platformom); NIE modyfikuje danych operacyjnych w Twenty (wyjątek: backfill `id_oid` via `crm:twenty_update_person` adapter) |
| **Lista Zadań Stape (infrastruktura)** | Kolejka zadań z statusami: pending / in_progress / success / retry / failed_final / skipped_*; locked_until, locked_by, attempt_count | NIE jest custom code — to natywna funkcjonalność Stape platformy |
| **Robot (Stape Worker)** | Cron pobiera zadania pending z Listy Zadań, atomic transition na in_progress, wywołuje Adapter, finalizuje status (success / retry / failed_final / skipped_*) | NIE decyduje semantycznie — wykonuje to co Adapter mu mówi |
| **Adaptery (po stronie Robota)** | Cała złożona logika per platforma: consent check, Pricing Key lookup, transformation, API call, dedup key, response handling | NIE są centralizowane — każdy Adapter zna tylko swoją platformę |
| **Ratownik** | Monitoring proaktywny: alerty o `failed_final`, latency, EMQ, % retry, spadek wolumenu; emaile diagnostyczne z klasami błędów (quota / auth / schema / timeout) | NIE robi automatycznego replay (manual repair via Stape UI po analizie) |
| **n8n** (poza SSOT) | Ad-hoc LLM data processing (enrichment, klasyfikacja, parsing) — stateless transformer | NIE jest event runtime; NIE trzyma outboxa; NIE robi retry business events; NIE jest na critical path orchestracji |
| **Bitrix24** | Faktury, deals księgowe | Poza zakresem CRM Twenty (handoff manual w MVP po `stage=WON`; Phase 2 adapter `crm:bitrix_create_deal`) |
| **Supabase legacy** | Historia leadów do migracji | Po cutoverze: read-only history; pipeline (julia362 + better-bitrix) wyłączony |

### 7. Integracja Twenty ↔ SSOT orkiestracji (KLUCZOWA SEKCJA)

Spójna z Decyzjami D2, D3, D5 w fundamentach. Replace dla starej sekcji „Event Runtime & Ownership".

**Twenty NIE jest event runtime; SSOT orkiestracji Sortowni JEST event runtime.** Ten dokument opisuje TYLKO integrację Twenty (CRM operacyjny) ze SSOT, **bez duplikacji** mechanizmów SSOT (Lista Zadań, Robot, Adaptery, Ratownik, Archiwizator) — te są w `Spis Treści — Sortownia` SSOT.

| Odpowiedzialność | Owner | Mechanizm |
|---|---|---|
| Raw CDC z Twenty | Twenty (native webhook OUT) | HMAC SHA256 (`X-Twenty-Webhook-Signature`, `X-Twenty-Webhook-Timestamp`); Settings → Developers → Webhooks; NIE pożera workflow credits |
| Map raw CDC → SSOT event_name | Webhook adapter w Sortowni (`inbound:twenty_webhook`) | 2-polowa pamięć w Stape Store: `last_stage` / `last_campaignRejected` per `opportunity_id`; reguły mapowania per pole change (`QUALIFIED` → `qualify_lead`, `WON` → `purchase`, `campaignRejected=true` → `rejected_lead`, `_operation=create` + `id_oid IS NULL` → `generate_lead`) |
| Routing | Sortownia (per SSOT — Inteligentny Routing) | Plik konfiguracyjny mapujący `event_name` → lista `targets` (statyczne lub dynamiczne jak `FIND_SOURCE_PLATFORM`) |
| `id_oid` mint | Sortownia (per SSOT) | Mintowane wyłącznie przy `oid_init` (paid web ping) lub `generate_lead` (formularz lub manual create w Twenty) |
| `id_event` mint | Sortownia (per SSOT) | ID zadania przy tworzeniu zadania na Liście Zadań |
| Outbox / kolejka zadań | Lista Zadań Stape (per SSOT) | Statusy: pending → in_progress → success / retry / failed_final / skipped_*; locked_until, attempt_count |
| Retry orchestration | Robot (Stape Worker, per SSOT) | Cron, atomic transitions, exponential backoff |
| Business logic per platforma | Adaptery (per SSOT) | `platform:google_ads`, `platform:meta_ads`, `analytics:ga4_mp`, `crm:twenty_create_lead`, `crm:twenty_update_person`, `system:WRITE_AKT_WLASNOSCI` |
| Wartość eventu (VBB/VBO) | Adapter + Pricing Key (per SSOT) | Adapter buduje klucz (np. `strony|google_ads|SQL|premium`) i pobiera `value_final` z Pricing Key tuż przed wysłaniem |
| Dedup (downstream) | Adapter + downstream platform | Platforms mają własną dedup (Google Ads po `order_id`, Meta po `event_id` Meta-side); my przekazujemy `id_event` jako idempotency key |
| Alerts / monitoring | Ratownik (per SSOT) | Email diagnostyczny przy `failed_final`; klasy błędów (quota / auth / schema / timeout); progi latency, EMQ, % retry, wolumen |
| Backfill `id_oid` w Twenty (manual lead) | Adapter `crm:twenty_update_person` | Twenty REST API z osobnym API key Sortowni z native role assignment (write scope: Person.idOid only) |
| PII whitelisting | Adapter per platforma | Każdy Adapter wysyła tylko PII potrzebne dla danej platformy (zgodnie z consent + privacy policy + Event Contract SSOT) |

**Co MY nie robimy** (świadomie usunięte z poprzedniej iteracji):
- Stateful diff payloadów po stronie Twenty (workflow Filter NIE ma previous values)
- Własny event outbox z `event_id` + `attempt_id` + `payload_schema_version` — Lista Zadań Stape JEST outboxem z `Job_ID` + `attempt_count`
- Webhook failure recovery infrastructure z reconciliation report — Ratownik alertuje, manual repair via Stape UI
- Terminal state machine enforcement po naszej stronie — SSOT akceptuje „burdel w raportach", celem jest gęstość uczących sygnałów
- Correction path z `correction_event` — w MVP akceptujemy duplikaty terminali, ręczna korekta w GCS

**Pre-Faza 4 weryfikacje u Sortowni/Stape (przed cutoverem):**
- Czy native Twenty webhook payload zawiera `data.before` / `data.after`? Jeśli tak — webhook adapter może działać bez minimalnej pamięci. Jeśli nie — Stape Store na 2 pola per opportunity.
- Czy Inteligentny Routing zawiera reguły dla 3 SSOT eventów emitowanych z Twenty (`qualify_lead`, `rejected_lead`, `purchase`) + `generate_lead` z manual source? Jeśli brak — rozszerzenie pliku konfiguracyjnego Routingu.
- Czy webhook adapter `inbound:twenty_webhook` istnieje? Jeśli nie — projekt + implementacja po stronie osoby odpowiedzialnej za Sortownię.

### 8. Decyzja transportowa i credit budget

**Skala 150 leadów/mc × 3 SSOT eventy emitowane z Twenty (qualify_lead, rejected_lead, purchase) = ~5400 emisji/rok. Plus generate_lead z manual create (rzadkie, oszacuj ~20-50/rok).**

| Potrzeba | Mechanizm | Auth | Credit cost |
|---|---|---|---|
| Raw CDC z Twenty do Sortowni | **Native Twenty webhook OUT** (default) | HMAC SHA256 natywny (`X-Twenty-Webhook-Signature`) — weryfikowany w webhook adapter Sortowni | **ZERO** (native webhook NIE pożera workflow credits) |
| Sortownia → Twenty (backfill `id_oid` via `crm:twenty_update_person`) | **Twenty REST/GraphQL API z Sortowni** | Twenty API key (z native role assignment, scope minimal — write Person.idOid only) | NIE workflow credit (zewnętrzny API call) |
| Sortownia → downstream platform (przez Adapter platform) | Per platforma (Google Ads API, Meta CAPI, GA4 MP) | Per platform credentials (zarządzane przez Sortownię/Stape) | NIE Twenty |
| n8n → Twenty (ad-hoc tasks) | **Twenty REST API** (read-only domyślnie) | Osobny API key dla n8n, read-only role | NIE workflow credit |
| Twenty workflow internal | Workflow editor (simple Search/Update) | Native | Zużywa credit per run; budżet ~50/rok zarezerwowany dla simple internal (Decyzja 6 — Pro vs Organization, ADR Faza 4) |

**Caveats krytyczne:**
- Twenty webhooks wysyłają WSZYSTKIE event types do URL (brak natywnego filtra per event type w 2.8.0). Webhook adapter w Sortowni filtruje (`record.stage` change + `record.campaignRejected` change + `_operation=create` z `id_oid IS NULL`) — reszta = SKIP.
- Workflow HTTP Request action (gdyby kiedyś użyta) NIE ma natywnego HMAC + pożera credits — **NIE używamy w MVP**.
- Sekrety w Twenty Workflow Code i HTTP NIE są secure — external API secrets żyją w Sortowni runtime env / Stape credential store (Prawo 7f).

### 9. Co jest POZA Etapem 1 (świadomie odłożone)

- Helpdesk
- Dashboards / 20 metryk monitoringu (Twenty Dashboards Beta, nie używamy jako fundament; monitoring eventów w Sortowni → Ratownik + Archiwizator → GCS dla biznesowej analizy)
- MCP write access (Phase 2 po retro)
- Follow-up automation
- KSeF integration
- Automated handoff WON → Bitrix24 księgowy (Phase 2: nowy SSOT adapter `crm:bitrix_create_deal` analogiczny do `crm:bitrix_create_lead`)
- Rozszerzenie roli n8n poza ad-hoc LLM processing
- Apps Framework migration (Phase 2: jeśli Logic Function DB triggers staną się stabilne, można przemigrować webhook adapter na Apps Framework — ale niesie ryzyko ze względu na alpha primitives)

**Co fizycznie wypełnia plik:**

Aktualny stan systemu po wybraniu D2=thin webhook adapter Sortowni z 2-polową pamięcią, D3=Lista Zadań Stape jako outbox, D5=NIE terminal SM (delegujemy platformom). Eliminacja sprzeczności z dokumentami aspiracyjnymi (custom Deal, Bitrix24 jako CRM, stateful event runtime po naszej stronie, audit log na Pro).

**Łączna objętość:** ~5-7 stron markdownu, z 3 diagramami.

---

# Plik 3 — `DATA_MODEL.md`

**Cel:** lekka tabela krytycznych pól z semantyką, której Twenty nie ma natywnie (freeze status, used-by-event mapping). Operacyjny artefakt — czytany przy dodaniu pola, debugowaniu workflow, interpretacji eventu.

**Tryb dostępu agenta:** load przy pytaniach o konkretne pole, jego rolę i status.

**Rytm zmian:** przy każdym nowym polu (entry) lub deaktywacji (status change).

**Anty-wzorzec:** NIE jest pełnym katalogiem każdego pola Twenty (Twenty udostępnia natywnie przez MCP + Settings UI). Trzyma TYLKO pola KRYTYCZNE = systemowe / eventowe / integracyjne / walidowane / frozen. Standardowe pola Twenty (`firstName`, `email`) NIE wchodzą.

## Struktura sekcji

### 1. Header

### 2. Jak czytać tę tabelę

- Wpisujemy tylko pola krytyczne (definicja powyżej)
- `Twenty description` = co musi być wpisane w field description w Settings (źródło prawdy dla MCP — czyta natywnie przez introspekcję GraphQL)
- `Freeze?` = czy zmiana wymaga ADR (FROZEN) czy nie (OPEN)
- `Empty behavior` = co się dzieje przy pustym (walidacja po stronie Adaptera platformy przed wysłaniem, fallback, akceptowalne)

### 3. Krytyczne pola — Opportunity

| Field | Type | Unique | Owner | Empty behavior | Used by | Freeze? | Twenty description |
|---|---|---|---|---|---|---|---|
| `idOid` | TEXT | YES | Sortownia mintuje (przy `oid_init` lub `generate_lead`) | Manual create = null (Sortownia backfilluje przy emisji `generate_lead` z `_operation=create`); auto ingress = wypełniane przez adapter `crm:twenty_create_lead` | All SSOT events emitowane do platform; dedup ingressu (upsert key) | FROZEN | "Universal cross-system identifier (id_oid) minted by Sortownia at oid_init or generate_lead; primary key for SSOT events to platforms" |
| `bizValueWon` | CURRENCY | NO | Handlowiec wypełnia przy `stage=WON` | nullable; Adapter `platform:google_ads` / `platform:meta_ads` wysyła `purchase` event NAWET BEZ `bizValueWon` (wartość VBB/VBO przychodzi z Pricing Key dynamicznie); `bizValueWon` jest dla raportowania w GCS Ledger (informacyjna, NIE używana przez VBB/VBO) | `purchase` event payload (raportowo do Archiwizatora/GCS); NIE wpływa na algorytmy VBB/VBO | FROZEN | "Business value of closed_won opportunity from invoice; reporting-only (does NOT affect VBB/VBO learning); fed dynamically from Pricing Key in Adapter" |
| `stage` | SELECT | NO | Handlowiec ustawia | N/A (zawsze ma wartość — default NEW) | Twenty native webhook OUT → webhook adapter Sortowni → mapowanie na SSOT events (`QUALIFIED → qualify_lead`, `WON → purchase`) | FROZEN | "Pipeline stage; canonical states: NEW / CONTACTED / QUALIFIED / PROPOSAL / WON" |
| `campaignRejected` | BOOLEAN | NO | Handlowiec ustawia | false default | Twenty native webhook OUT → webhook adapter Sortowni → emit `rejected_lead` (gdy zmiana false→true); akceptujemy współistnienie z `purchase` (SSOT cytat: „burdel w raportach jest gorszy niż zagłodzenie danych") | FROZEN | "True if rejected by campaign attribution rules; emits SSOT rejected_lead event (RESTATE downgrade to platforms)" |
| `rejectionReason` | SELECT | NO | Handlowiec wypełnia przy `campaignRejected=true` | nullable; Adapter wysyła `rejected_lead` nawet bez `rejectionReason` (wartość z Pricing Key); `rejectionReason` raportowo dla retro analytics | `rejected_lead` event payload (raportowo); retro analytics | FROZEN | "Categorical reason for campaignRejected=true; reporting-only" |
| `srcSystem` | SELECT | NO | Adapter `crm:twenty_create_lead` ustawia automatycznie przy create; UI default = TWENTY_UI | "TWENTY_UI" default; adapter overwrite na "OWOCNI_SORTOWNIA" przy adapter create; "BETTER_BITRIX_LEGACY" dla migrated records | Loop prevention w webhook adapter Sortowni (primary observer) | FROZEN | "Origin marker for loop prevention; values: TWENTY_UI / OWOCNI_SORTOWNIA / BETTER_BITRIX_LEGACY / UNKNOWN" |
| `twentyActorSource` | TEXT | NO | Twenty native webhook payload `data.updatedBy.source` przepisany przez webhook adapter | nullable | Loop prevention (secondary observer, tania redundancja) | OPEN | "Observed actor source from data.updatedBy.source webhook payload (API / MANUAL)" |
| `twentyActorName` | TEXT | NO | Twenty native webhook payload `data.updatedBy.name` przepisany przez webhook adapter | nullable | Loop prevention (secondary observer) | OPEN | "Observed actor name from webhook (API key name when source=API)" |
| `bitrixDealId` | TEXT | NO | Handlowiec (Phase 1 manual SOP) / Sortownia (Phase 2 adapter `crm:bitrix_create_deal`) | nullable; wypełniane po utworzeniu Dealu w Bitrix24 (po `stage=WON`) | Handoff WON→Bitrix24 SOP; audit śledzenia faktur | OPEN | "Bitrix24 Deal ID po manualnym utworzeniu Dealu (MVP); Phase 2 wypełniane automatycznie przez adapter SSOT" |

### 4. Krytyczne pola — Person

| Field | Type | Unique | Owner | Empty behavior | Used by | Freeze? | Twenty description |
|---|---|---|---|---|---|---|---|
| `idOid` | TEXT | YES | Sortownia (mintuje przy `generate_lead`) | nullable allowed; manual create = null → Twenty native webhook OUT z `_operation=create` AND `id_oid IS NULL` → webhook adapter Sortowni emituje `generate_lead` (manual variant) → mint + backfill via adapter `crm:twenty_update_person` | Person-level attribution; SSOT events do platform | FROZEN | "Person-level cross-system identifier (id_oid); null = manual create exception, backfilled by Sortownia at generate_lead" |

Standardowe pola Person (firstName/lastName/email) — nie wpisujemy (Twenty native).

### 5. Krytyczne pola — Company

- Brak dodatkowych custom fields w Etapie 1
- W przyszłości: `industry` / `sourceCampaign` per ADR

### 6. Reguły operacyjne

1. **Frozen field nie zmienia się bez ADR** (dodanie do `DECISION_REGISTER`).
2. **Open field zmienia się swobodnie**, log w `OPS_NOTES`.
3. **`Twenty description` MUSI być wypełniony w Settings** (źródło prawdy dla MCP — Prawo 3d).
4. **Required dla custom fields NIE jest natywnie w Twenty 2.8.0** (FAQ Twenty verbatim: *„custom fields cannot currently be required"*); enforcement = walidacja po stronie Adaptera platformy przed wysłaniem (NIE walidacja AT SAVE w Twenty — autosave łamie ten model; NIE walidacja w webhook adapter Sortowni — to za wcześnie semantycznie).
5. **Konwencja nazewnicza:** prefix-camelCase enforced by Twenty w API names; `idX`/`bizX` outbound; brak prefiksu CRM-only; prefiks w API name, NIE w label. W payloadach SSOT do platform: snake_case (`id_oid`, `biz_value_won`); mapping Twenty camelCase → SSOT snake_case w Adapterze.
6. **Graded destructive change protocol:**
   - **Kosmetyczne pole / nieużywane** → deactivate w Twenty + notatka w `DATA_MODEL.md` (Twenty zachowuje dane; reaktywacja możliwa)
   - **Eventowe / integracyjne pole** → mini-ADR w `DECISION_REGISTER` + downstream test (Adapter platformy musi obsłużyć zmianę payload schema; aktualizacja Event Contract SSOT)
   - **Frozen pole** → decyzja właściciela + downstream test obowiązkowy
   - **Hard delete** → dopiero po pełnym audicie API/integracji
   - **Standard fields w Twenty NIE mogą być usunięte** (tylko deaktywowane — verbatim z docs)

### 7. POC required (preflight D.2)

- **`idOid` unique constraint + null tolerance**: czy Twenty unique pozwala na wiele rekordów z `idOid=null`? Test w sandboxie przed Fazą 2 (3 Opportunity z null + 2 z unique values).

**Co fizycznie wypełnia plik:**

~10 wierszy critical fields × 8 kolumn (3 obiekty: Opportunity 10 pól, Person 1 pole, Company 0 pól w MVP). Plus 6 reguł operacyjnych + 1 POC requirement.

**Łączna objętość:** ~3 strony markdownu.

---

# Plik 4 — `EVENT_CONTRACT.md`

**Cel:** semantyczny kontrakt 3 SSOT eventów emitowanych z Twenty (`qualify_lead`, `rejected_lead`, `purchase`) + `generate_lead` przy manual create. Opisuje granicę Twenty → webhook adapter Sortowni. **NIE jest** kopią Event Contract SSOT orkiestracji (ten żyje w `Spis Treści — Event Contract` w SSOT Sortowni).

**Tryb dostępu agenta:** load przy operacjach setupu Twenty native webhook OUT, projektowania webhook adapter mappingu, debugowania flow Twenty → Sortownia.

**Rytm zmian:** przy zmianie definicji stage'ów w Twenty (Decyzja 5 ADR), przy nowym evencie emitowanym z Twenty, przy zmianie reguł webhook adapter mappingu.

**Anty-wzorzec:** NIE jest słownikiem terminów (to `CONSTITUTION` Część III Glossary), NIE jest specyfikacją wszystkich pól Twenty (to `DATA_MODEL`), NIE jest specyfikacją cutover (to `CUTOVER_RUNBOOK`), NIE duplikuje Event Contract SSOT orkiestracji (to żyje w SSOT Sortowni).

## Struktura sekcji (10 sekcji)

### 1. Header

Wersja kontraktu, data ostatniej synchronizacji ze schemą Twenty i SSOT orkiestracji, link do `Spis Treści — Event Contract` SSOT.

### 2. Co ten dokument pokrywa, czego NIE

**Pokrywa:**
- Mapowanie Twenty schema → SSOT events (stage transitions, campaignRejected, manual create)
- Konfiguracja native Twenty webhook OUT (Settings → Developers → Webhooks)
- Reguły webhook adapter `inbound:twenty_webhook` w Sortowni (mapping logic, 2-polowa pamięć)
- Loop prevention przy Sortownia → Twenty backfill (`crm:twenty_update_person`)
- PII whitelist payload Twenty webhook (które pola Twenty record forwardujemy do Sortowni)
- Smoke test scenarios pre-cutover

**NIE pokrywa:**
- Definicje SSOT eventów (`oid_init` / `generate_lead` / `qualify_lead` / `rejected_lead` / `purchase` / `consent_update`) — to żyje w **SSOT Event Contract Sortowni**
- Inteligentny Routing per event — to żyje w **SSOT pliku konfiguracyjnym Routingu**
- Adaptery platform (Google Ads, Meta, GA4 MP) — to żyje w **SSOT Księga Zadań Robota**
- Lista Zadań Stape mechanika — to żyje w **SSOT Lista Zadań** + Stape platform docs
- Pricing Key i Adapter value lookup — to żyje w **SSOT Pricing Key & Config**
- Retry / Robot / Ratownik / Archiwizator — to żyje w **SSOT odpowiednich sekcjach**

### 3. Mapowanie Twenty schema → SSOT events

**Twenty stage canonical states** (Decyzja 5 ADR — kryteria wejścia stage'ów):

| Twenty stage | Trigger SSOT event | Webhook adapter mapping condition |
|---|---|---|
| NEW | brak (status początkowy) | — |
| CONTACTED | brak (komunikacja, nie sygnał uczący) | — |
| QUALIFIED | `qualify_lead` | `last_stage != "QUALIFIED"` AND `new_stage == "QUALIFIED"` |
| PROPOSAL | brak (przygotowanie oferty, nie sygnał uczący) | — |
| WON | `purchase` | `last_stage != "WON"` AND `new_stage == "WON"` |

**Twenty `campaignRejected` boolean:**

| Twenty field | Trigger SSOT event | Webhook adapter mapping condition |
|---|---|---|
| `campaignRejected: false → true` | `rejected_lead` | `last_campaignRejected == false` AND `new_campaignRejected == true` |

**Twenty manual create (lead z polecenia, z telefonu):**

| Twenty operation | Trigger SSOT event | Webhook adapter mapping condition |
|---|---|---|
| `_operation == "create"` + `Person.idOid == null` | `generate_lead` (manual variant) | Webhook adapter rozpoznaje manual create jako trigger mint `id_oid` |

**Co NIE jest SSOT eventem (bo Twenty go nie generuje):**
- `oid_init` — to web ping z formularza/strony przez sGTM, NIE z Twenty
- `consent_update` — serwerowo z formularza, NIE z Twenty
- `generate_lead` (paid touchpoint formularz) — przez Sortownia adapter formularza inbound, NIE z Twenty

### 4. Konfiguracja Twenty native webhook OUT

**Settings → Developers → Webhooks → Create webhook:**

```
Target URL: https://<sortownia_endpoint>/inbound/twenty_webhook
Operations: ☑ create  ☑ update  ☐ delete  (delete poza scope Etap 1)
Objects: ☑ Opportunity  ☑ Person  ☐ Company (poza scope)
HMAC: enabled (Twenty native)
```

**Headers wysyłane przez Twenty:**
- `X-Twenty-Webhook-Signature: <HMAC SHA256 z body + secret>`
- `X-Twenty-Webhook-Timestamp: <unix epoch ms>`
- `Content-Type: application/json`

**Payload struktura** (per `data.updatedBy` rollout styczeń 2026):
```json
{
  "targetUrl": "...",
  "eventName": "opportunity.updated",
  "objectMetadata": { ... },
  "recordId": "...",
  "data": {
    "before": { ... },           // pre-change record (do POC weryfikacji)
    "after": { ... },            // post-change record
    "diff": { ... },             // changed fields
    "updatedBy": {
      "source": "API" | "MANUAL",
      "workspaceMemberId": "...",
      "name": "...",
      "context": "..."
    }
  }
}
```

**Preflight POC** (D.2): zweryfikować empirycznie czy `data.before` / `data.after` / `data.diff` są obecne w native webhook payload (nie tylko w Apps Framework Logic Function). Jeśli obecne — webhook adapter może działać bez 2-polowej pamięci. Jeśli nieobecne — webhook adapter trzyma `last_stage` / `last_campaignRejected` per `opportunity_id` w Stape Store.

### 5. Webhook adapter w Sortowni: `inbound:twenty_webhook`

**Lokalizacja:** Sortownia (Stape sGTM) — preprocessor przed Inteligentnym Routingiem; działa jak inbound Adapter ale specyficzny dla Twenty native webhook payload.

**Odpowiedzialności:**
1. Weryfikacja HMAC (`X-Twenty-Webhook-Signature` + `X-Twenty-Webhook-Timestamp`)
2. Loop prevention check (patrz §7)
3. Lookup Stape Store: `last_stage[opportunity_id]`, `last_campaignRejected[opportunity_id]` (jeśli native webhook NIE ma `data.before`)
4. Mapping decision logic (per §3 tabela)
5. Update Stape Store: nowe wartości `last_stage` / `last_campaignRejected`
6. Emit do Inteligentnego Routingu z `event_name` + payload SSOT-compatible
7. Jeśli no semantic transition: SKIP (drop, log do Ratownika tylko przy anomalii)

**Pseudokod mapping logic:**
```
on receive Twenty webhook:
  1. verify HMAC; if fail → 401 + Ratownik alert (auth class error)
  2. loop prevention: if data.updatedBy.source == "API" AND data.updatedBy.name == "OWOCNI_SORTOWNIA_KEY":
       → SKIP (this is our own backfill, not handlowiec action)
  3. opportunity_id = data.recordId
  4. if Twenty operation == "create" AND record.Person.idOid IS NULL:
       → event_name = "generate_lead"
       → payload = { source: "TWENTY_MANUAL", ...minimal PII for matching }
       → emit to Inteligentny Routing
       → return
  5. previous_stage = data.before.stage IF present ELSE Stape Store lookup
     previous_campaignRejected = data.before.campaignRejected IF present ELSE Stape Store lookup
  6. current_stage = data.after.stage
     current_campaignRejected = data.after.campaignRejected
  7. determine event_name:
       if previous_stage != "QUALIFIED" AND current_stage == "QUALIFIED":
         event_name = "qualify_lead"
       elif previous_stage != "WON" AND current_stage == "WON":
         event_name = "purchase"
       elif previous_campaignRejected == false AND current_campaignRejected == true:
         event_name = "rejected_lead"
       else:
         return SKIP (no semantic transition; this webhook is noise)
  8. update Stape Store: last_stage[opportunity_id] = current_stage
                        last_campaignRejected[opportunity_id] = current_campaignRejected
  9. build SSOT payload from record (per §6 whitelist)
  10. emit to Inteligentny Routing with event_name
```

**Edge cases (do skonsultowania z osobą odpowiedzialną za Sortownię):**
- Stape Store cold start (brak `last_stage` w pamięci → traktuj jako transition jeśli current jest semantyczny)
- Concurrent updates (locked_until na poziomie webhook adapter)
- Stape Store retention (TTL na klucze — np. 1 rok)

### 6. PII whitelist payload Twenty webhook → SSOT event

**Zasada:** webhook adapter NIE forwarduje całego raw record do Inteligentnego Routingu. Buduje SSOT-compatible payload z whitelist:

**Wspólne pola** (każdy event):
```
id_oid                  ← record.Person.idOid (lub minted dla generate_lead manual)
opportunity_id          ← record.id (Twenty native UUID)
person_id               ← record.Person.id (Twenty native UUID)
company_id              ← record.Company.id (Twenty native UUID)
src_system              ← record.srcSystem
twenty_actor_source     ← data.updatedBy.source
twenty_actor_name       ← data.updatedBy.name
event_time_unix_s       ← computed: unix timestamp eventu (Twenty timestamp lub now())
```

**Per event additional fields:**

| Event | Additional payload fields |
|---|---|
| `qualify_lead` | brak (Adapter platformy pobiera wartość z Pricing Key) |
| `rejected_lead` | `rejection_reason` (z `record.rejectionReason`) |
| `purchase` | `biz_value_won` (z `record.bizValueWon` — informacyjna, NIE używana przez VBB/VBO) |
| `generate_lead` (manual) | `email`, `phone`, `firstName`, `lastName` (z `record.Person.*` — minimal PII dla matchingu w Profilu Klienta); `source: "TWENTY_MANUAL"` |

**PII fields NIE forwardowane do Inteligentnego Routingu:**
- `record.Note.*` (treść notatek handlowca)
- `record.activities.*` (aktywności CRM)
- `record.tasks.*` (zadania CRM)
- Inne pola Person/Company poza minimal PII dla matchingu

**Raw payload retention** w Sortowni internal logs: 7 dni, potem PII masking lub deletion. Nigdy NIE forwardowany do platform reklamowych ani do n8n.

### 7. Loop prevention

**Problem:** Sortownia adapter `crm:twenty_update_person` backfilluje `Person.idOid` po manual `generate_lead`. Ten update generuje Twenty native webhook OUT z `data.updatedBy.source == "API"`. Webhook adapter musi rozpoznać że to **własna akcja**, nie handlowiec.

**Mechanizm:**
1. **Primary observer**: pole `srcSystem` w Twenty Opportunity. Adapter ustawia `srcSystem == "OWOCNI_SORTOWNIA"` przy create. Webhook adapter SKIP gdy `srcSystem` matches znane source systems własne.
2. **Secondary observer (tania redundancja)**: kombinacja `data.updatedBy.source == "API"` AND `data.updatedBy.name == "OWOCNI_SORTOWNIA_KEY"` (nazwa API key Sortowni). Webhook adapter SKIP.

**Edge case (do empirycznej weryfikacji w Faza 1)**: czy backfill `idOid` przez API generuje `data.updatedBy.source == "API"` lub `"MANUAL"`? Empirical test wymagany.

### 8. Idempotency

**Delegujemy platformom.** Adaptery wysyłają z `id_event` (mintowany w Sortowni przy tworzeniu zadania na Liście Zadań) jako idempotency key. Platforms mają własną dedup:
- Google Ads: dedup po `order_id` (przekazywany jako `id_event` lub `id_oid` zależnie od mechaniki RESTATE)
- Meta CAPI: dedup po `event_id` Meta-side (przekazywany jako `id_event`)
- GA4 Measurement Protocol: dedup po `transaction_id` lub `event_id` Meta-side

**MY nie robimy:**
- Stable per-logical-event `event_id` z payload_hash (Stape `id_event` wystarczy)
- Outbox dedup pre-emission (Lista Zadań Stape ma `Job_ID` unique)
- Terminal state machine („pierwszy WON wygrywa") — duplikaty terminali emitowane do platform; platforms i biznesowa analiza w GCS rozstrzyga

### 9. Smoke test scenarios (pre-cutover, Faza 4 gate)

**Test 1 — qualify_lead E2E:**
1. Utwórz Opportunity w sandbox Twenty z `id_oid` ustawionym (auto ingress albo backfilled manual)
2. Zmień stage z CONTACTED na QUALIFIED
3. Verify: Twenty native webhook OUT delivered do Sortowni (Settings → Developers → Webhooks → log)
4. Verify: webhook adapter `inbound:twenty_webhook` rozpoznał transition, emitował `qualify_lead` do Inteligentnego Routingu (Sortownia log)
5. Verify: Lista Zadań Stape ma 2-3 nowe zadania pending (`platform:google_ads`, `platform:meta_ads`, ew. `analytics:ga4_mp` per Akt Własności lookup)
6. Verify: Robot wykonał Adaptery, status `success` na każdym Job
7. Verify: Google Ads i Meta dashboard pokazują nowy RESTATE event w ciągu 4h (Ratownik latency thresholds)

**Test 2 — purchase E2E:**
1. Ten sam Opportunity z Test 1
2. Zmień stage z QUALIFIED na WON
3. Wpisz `bizValueWon` (np. 5000.00 PLN)
4. Verify: webhook adapter emitował `purchase`
5. Verify: Lista Zadań → Robot → Adaptery → Google Ads (Secondary Goal Purchase), Meta CAPI (Offline Conversion z `bizValueWon`)
6. Verify: Archiwizator (cron 2×/dzień) zarchiwizował event do GCS Ledger

**Test 3 — rejected_lead E2E:**
1. Utwórz nowy Opportunity
2. Zmień `campaignRejected` z false na true; wpisz `rejectionReason`
3. Verify: webhook adapter emitował `rejected_lead`
4. Verify: Google Ads dostał RESTATE downgrade (wartość `rejected_lead` z Pricing Key)

**Test 4 — manual create generate_lead E2E:**
1. Utwórz Opportunity ręcznie w Twenty UI z handlowca (Person.idOid = null)
2. Verify: webhook adapter rozpoznał `_operation=create` + `id_oid IS NULL`, emitował `generate_lead` (manual variant)
3. Verify: Sortownia mintowała `id_oid`, adapter `crm:twenty_update_person` backfillował Person.idOid via Twenty API
4. Verify: kolejny webhook (z `data.updatedBy.source=API` + `name=OWOCNI_SORTOWNIA_KEY`) SKIPnięty przez loop prevention
5. Verify: Lista Zadań ma WRITE_AKT_WLASNOSCI + crm:twenty_update_person, oba `success`

**Test 5 — noise filtering:**
1. Zmień opis Opportunity (`description`) bez zmiany stage/campaignRejected
2. Verify: Twenty native webhook OUT delivered
3. Verify: webhook adapter rozpoznał no semantic transition → SKIP
4. Verify: Lista Zadań Stape NIE ma nowych zadań

### 10. Failure modes i Ratownik alerts

Webhook adapter w Sortowni może zwrócić:
- `200 OK` — accepted (emitted lub SKIP for noise)
- `401 Unauthorized` — HMAC failure (Ratownik alert: class=auth)
- `409 Conflict` — schema mismatch w payload (Ratownik alert: class=schema; np. nowy stage canonical nie zmapowany)
- `500 Internal Server Error` — Stape Store unreachable (Ratownik alert: class=infrastructure; Twenty retry per native webhook delivery semantics — patrz preflight D.2 POC)

**Edge case po naszej stronie (Twenty Opportunity)**: jeśli Twenty workflow internal zmienia stage programowo (np. automation Search → Update), webhook adapter dostaje update z `data.updatedBy.source == "API"` i `name` jako nazwa API key zarządzającego workflowem — webhook adapter NIE robi SKIP (bo to nie jest backfill Sortowni), traktuje jak normalny update; loop prevention działa tylko dla `name == OWOCNI_SORTOWNIA_KEY`.

**Co fizycznie wypełnia plik:**

~5-6 stron markdownu z konkretnymi schemami JSON payloadów per event + 10 sekcji (mapowanie Twenty → SSOT, webhook adapter, smoke tests). **NIE duplikuje SSOT Event Contract Sortowni** — link i delegacja.

**Łączna objętość:** ~5-6 stron.

# Plik 5 — `DECISION_REGISTER.md`

**Cel:** pamięć kolektywna systemu. ADR-y dla decyzji STRUKTURALNIE NIEODWRACALNYCH. Nie ADR-y dla rutyny.

**Tryb dostępu agenta:** load przy pytaniach „dlaczego wybraliśmy X?" / przy retrospektywie / przy podobnej decyzji w przyszłości.

**Rytm zmian:** Sekcja A zamykana sekwencyjnie do cutoveru; Sekcja B przyrasta chronologicznie po cutoverze.

**Anty-wzorzec:** NIE jest dziennikiem każdej zmiany pola. ADR ma sens tylko dla:
- Zmian paradygmatu integracji
- Zmian modelu obiektów
- Zmian semantyki stage / eventu
- Zmian event runtime / outbox owner
- Zmian planu Twenty (Pro vs Organization)
- Zmian zakresu MVP

## Struktura sekcji

### Header

### Sekcja A — Open Decisions

Tabela z kolumnami:

| # | Decyzja | Klasa | **Blocks** (phase / step / cutover / none) | **Decision type** (ADR / preflight / implementation standard / known-fact) | Faza otwierająca | Rekomendacja / Kto rozstrzyga | Status |

Pozycje pochodzące z Części IV fundamentów (11 pozycji, większość typu known-fact lub implementation standard po zamknięciu D1-D6):

1. **Konwencja nazw pól** — Strukturalna / none / known-fact — zamknięte (mechanika Twenty)
2. **Model obiektów** — Strukturalna / none / known-fact — zamknięte (POC)
3. **idOid jako unique custom field** — Strukturalna / step / preflight — POC unique+null wymagany
4. **Ścieżka ingressu kanonicznego** — Strukturalna / step / implementation standard — adapter `crm:twenty_create_lead` (analogiczny do SSOT `crm:bitrix_create_lead`)
5. **Kryteria wejścia stage'ów + mapowanie na SSOT eventy** — Semantyczna / **cutover / ADR** — open, właściciel + handlowcy (mapping: `QUALIFIED → qualify_lead`, `WON → purchase`, `campaignRejected=true → rejected_lead`)
6. **Plan Twenty: Pro vs Organization** — Semantyczna+finansowa / **cutover / ADR** — open, właściciel
7. **Strategia środowisk** — Proceduralna / **cutover / ADR** — open, rekomendacja sandbox + produkcyjny
8. **Runbook cutover/rollback** — Proceduralna / **cutover / ADR** — open, właściciel
9. **Rekonsyliacja dokumentów po cutoverze** — Procedurowa / step / implementation standard — po Fazie 5
10. **Mapowanie SSOT events emitowanych z Twenty** — Semantyczna / **cutover / ADR** — open, owner Sortowni/Stape musi potwierdzić że Inteligentny Routing zawiera reguły dla `qualify_lead` / `rejected_lead` / `purchase` / `generate_lead (manual)` emitowanych z Twenty + że webhook adapter `inbound:twenty_webhook` istnieje lub zostanie utworzony
11. **Twenty native webhook OUT payload schema (preflight POC)** — Strukturalna / step / preflight — czy native webhook payload zawiera `data.before` / `data.after` / `data.diff`? Jeśli tak — webhook adapter w Sortowni może działać bez minimalnej 2-polowej pamięci. Jeśli nie — Stape Store na `last_stage` / `last_campaignRejected` per opportunity_id. Test w sandboxie.

**Reguła:** dopóki choć jedna pozycja **ADR** o `Blocks=cutover` ma status `open`, cutover NIE startuje. Pozycje typu `implementation standard` / `preflight` / `known-fact` blokują konkretny krok, nie całą fazę.

### Sekcja B — Closed Decisions (chronologicznie po cutoverze)

Format per ADR:

```
---
ADR-XXX
Data: YYYY-MM-DD
Tytuł: krótko
Kontekst: jaki problem
Rozważone opcje: A, B, C z trade-offami
Wybrana opcja: która i dlaczego
Konsekwencje: co się zmienia downstream (które pliki / którzy konsumenci)
Autor: <user_id>
---
```

Na start pusta. Po cutoverze: zamknięte ADR-y z Sekcji A migrują tutaj (każdy z full context).

### Reguły kiedy NIE pisać ADR

- Dodanie pola OPEN (lipowanie pola — log w `OPS_NOTES`)
- Zmiana labelu UI
- Rearrange views/columns
- Zmiana koloru/ikony
- Dodanie/usunięcie saved view
- Routine bug fix
- Operacyjna korekta (np. zmiana retention period z 30 na 60 dni — log w OPS, nie ADR)

### Co stanowi „implementation standard" zamiast ADR

Decyzje techniczne wynikające bezpośrednio z innych decyzji (np. trigger policy by source wynika z dokumentacji Twenty + Prawa 7c — nie wymaga osobnego ADR). Implementation standards żyją w `CONSTITUTION` lub `EVENT_CONTRACT`, nie w `DECISION_REGISTER`.

**Co fizycznie wypełnia plik:**

Sekcja A — 11 pozycji × 8 pól metadanych (z nowymi kolumnami Blocks i Decision type). Sekcja B — pusta na start.

**Łączna objętość:** ~3-4 strony na start, rośnie chronologicznie.

---

# Plik 6 — `CUTOVER_RUNBOOK.md`

**Cel:** w momencie cutoveru nie ma czasu na improwizację. Runbook = scenariusz: kto, co, w jakiej kolejności, kiedy się wycofujemy.

**Tryb dostępu agenta:** load w dzień cutoveru i w awarii.

**Rytm zmian:** przed cutoverem często (każdy dry-run wnosi poprawki); po cutoverze rzadko.

**Anty-wzorzec:** NIE jest pełnym opisem migracji z innych CRM (Twenty ma to natywnie w „Migrating from Other CRMs" guide). Trzyma TYLKO OWOCNI-specific kroki.

## Struktura sekcji

### 1. Header

Data planowanego cutoveru, wersja runbooka.

### 2. Pre-cutover (T-7 do T-1)

- **T-7**: dry-run pełnej procedury w sandboxie Twenty + Sortownia webhook adapter + smoke test outbound (5 scenarios z Plik 4 §9)
- **T-3**: komunikat do zespołu (Karol, Dawid + handlowcy)
- **T-1**: zamrożenie nowych pól / workflowów (no changes window)
- **T-1**: pełny snapshot Supabase legacy
- **T-1**: weryfikacja stanu Twenty (`DATA_MODEL.md`, workflow contracts, role agentów via native role assignment)
- **T-1**: **WORKFLOW OFF dla bulk operation gate** — dezaktywować WSZYSTKIE workflowy triggered by `Record is Created` / `Record is Updated` / `Record is Created or Updated` na obiektach migrowanych (Opportunity, Person, Company); pełna lista workflowów w `/ops/OPS_NOTES.md` Workflow Runtime Registry
- **T-1**: weryfikacja `Twenty native webhook OUT + Sortownia webhook adapter READY` checklist:
  ```
  [ ] Twenty native webhook OUT skonfigurowany (Settings → Developers → Webhooks → URL Sortowni, HMAC enabled)
  [ ] webhook adapter inbound:twenty_webhook w Sortowni gotowy (mapping logic per Plik 4 §5)
  [ ] Stape Store accessible dla 2-polowej pamięci (last_stage, last_campaignRejected per opportunity_id) — JEŚLI native webhook nie ma data.before
  [ ] Inteligentny Routing zawiera reguły dla qualify_lead / rejected_lead / purchase / generate_lead (manual)
  [ ] HMAC verification przetestowana — 1 webhook z poprawnym sig = 200, z błędnym = 401
  [ ] Adaptery (platform:google_ads, platform:meta_ads, analytics:ga4_mp, crm:twenty_update_person) gotowe + Pricing Key skonfigurowany
  [ ] Ratownik alerty skonfigurowane (klasy: auth / schema / quota / timeout / infrastructure)
  [ ] Loop prevention przetestowane (Sortownia backfill nie generuje recursion)
  ```

### 3. Monitoring i alerty (PRZED CUTOVEREM)

**Lokalizacja:** Ratownik w Sortowni (per SSOT orkiestracji — sekcja Ratownik).

**Progi i alerty:**
- **Latency**: zadanie pending → success > 4h dla `platform:*` adapterów → alert klasy `latency`
- **Quota**: Google Ads / Meta API quota exceeded → alert klasy `quota` z auto-pause Adaptera na N minut (per platform docs)
- **Auth**: HMAC failure z Twenty webhook OR Adapter auth failure (Twenty REST API key, Google Ads OAuth, Meta access token) → alert klasy `auth`
- **Schema**: webhook adapter dostaje payload bez znanego pola (np. nowy stage canonical nie zmapowany) → alert klasy `schema`
- **Volume anomaly**: >10× normal volume w 1h (np. CSV import workflow włączony omyłkowo) → alert klasy `volume_spike`
- **Volume drop**: 0 eventów `qualify_lead` w 24h (gdy normalnie 1-2) → alert klasy `volume_drop`
- **Reset**: alerty są acknowledged przez właściciela, anomalia loguje się do OPS_NOTES

Stape native rate limiting i Robot retry obsługują transient errors automatycznie — nie projektujemy własnego circuit-breakera.

### 4. Cutover (T-0) — sekwencja

- **Krok 1**: Zaproszenia handlowców do Twenty (wcześniej; aktywacja dziś)
- **Krok 2**: Aktywacja adaptera `crm:twenty_create_lead` w Sortowni (inbound canonical path — analogiczny do SSOT `crm:bitrix_create_lead`)
- **Krok 3**: Smoke test inbound — 1 lead testowy przez nowy flow → weryfikacja w Twenty (`idOid` ustawione, pola wypełnione, srcSystem=OWOCNI_SORTOWNIA)
- **Krok 4**: Przełączenie legacy pipeline (julia362 + better-bitrix → Supabase write path) do **read-only**. Doprecyzowanie: wyłączamy pipeline (julia362 IMAP watcher + better-bitrix GPT-4o processor); Supabase jako storage zachowuje historię, ale nowe rekordy nie wpływają. Bitrix24 (księgowy, osobny system) pozostaje aktywny.
- **Krok 5**: Wyłączenie julia362 (TWARDA DATA wpisana w komunikacie zespołu)
- **Krok 6**: **Aktywacja Twenty native webhook OUT + webhook adapter w Sortowni:**
  - Włączenie native Twenty webhook OUT (Settings → Developers → Webhooks; status: active)
  - Aktywacja webhook adapter `inbound:twenty_webhook` w Sortowni (mapping enabled)
  - Verify: 1 testowa zmiana stage CONTACTED → QUALIFIED → weryfikacja że webhook adapter rozpoznał, emit `qualify_lead`, Lista Zadań Stape ma 2-3 nowe zadania pending, Robot wykonał Adaptery, downstream platforms confirmed
- **Krok 7**: **Reaktywacja Twenty workflowów internal** (te które były OFF w T-1 dla bulk gate) — TYLKO simple internal (Search/Update bez external side-effect; outbound przez native webhook, NIE workflow)
- **Krok 8**: E2E test pełny (smoke test scenarios z Plik 4 §9 — 5 scenariuszy: qualify_lead / purchase / rejected_lead / manual generate_lead / noise filtering)
- **Krok 9**: Komunikat do zespołu: „system aktywny"
- **Krok 10**: Monitoring 4h (handlowiec dyżurny + właściciel + Sortownia/Stape logs + Ratownik alerts)

### 5. Rollback — warunki triggerujące

- **>=3 critical Ratownik alerts klasy auth/schema w 1h** (system nie potrafi interpretować webhooków poprawnie)
- **>24h IMAP ONGOING** (julia362 nadal odbiera mimo wyłączenia)
- **Twenty native webhook OUT delivery failure rate >20% przez 30 min** (Sortownia endpoint zwraca 5xx lub timeout)
- **Lista Zadań Stape: >50% zadań z `failed_final` w 1h** (downstream platforms odrzucają eventy systemowo)
- **Decyzja właściciela** (escape hatch)

### 6. Failure handling (delegujemy SSOT)

**NIE budujemy własnej webhook failure recovery procedure.** Per SSOT orkiestracji:
- **Ratownik** alertuje przy `failed_final` na Liście Zadań Stape (email diagnostyczny z klasą błędu: quota / auth / schema / timeout / infrastructure)
- **Robot** retry obsługuje transient failures automatycznie (exponential backoff)
- **Manual repair** via Stape UI po analizie błędu (właściciel decyduje czy retry zadanie ręcznie, czy skip)
- **Archiwizator** (cron 2×/dzień) kopiuje wszystko do GCS Ledger — biznesowa analiza ex-post

**Co MY robimy w cutoverze:**
- T+1 sprawdzamy `failed_final` count w Liście Zadań Stape (powinien być <2% wszystkich zadań w 24h)
- T+1 sprawdzamy Ratownik alerts log (każdy alert ma odpowiedź właściciela)
- T+3 sprawdzamy GCS Ledger że dane są zarchiwizowane poprawnie

### 7. Rollback — procedura (15 min target)

**WAŻNE:** *„Rollback restores operational intake path, not historical data state."* Records już utworzone/zmodyfikowane w Twenty zostają — rollback przywraca **ścieżkę pracy**, nie stan historyczny.

- **Krok 1**: Wyłączyć adapter `crm:twenty_create_lead` w Sortowni (inbound canonical OFF)
- **Krok 2**: Wyłączyć webhook adapter `inbound:twenty_webhook` w Sortowni (mapping disabled) ALBO wyłączyć Twenty native webhook OUT w Settings → Developers → Webhooks (status: inactive); efekt ten sam — Twenty webhooki nie przepływają do platform
- **Krok 3**: Reaktywować legacy pipeline (better-bitrix processor + Supabase write path); Supabase wraca do statusu primary storage dla nowych leadów
- **Krok 4**: Reaktywować julia362 (manual reactivation)
- **Krok 5**: **ZACHOWAĆ Twenty workspace** (NO DELETE — analiza w post-mortem)
- **Krok 6**: Pull-back z ledgera — które rekordy są tylko w Twenty (do manualnej obsługi w starym pipeline)
- **Krok 7**: Komunikat do zespołu: „rollback, pracujemy w starym systemie"

**Post-rollback (obowiązkowo):**
- Utworzenie `rollback_reconciliation_report.csv` (Z7) — wszystkie records w Twenty od cutoveru do rollbacku, status w starym systemie, action required per record
- **Mandatory reconciliation przed second cutover attempt** — bez tego drugi cutover nie startuje

### 8. Handoff WON → Bitrix24 (SOP dla handlowca, MVP-only)

- **Trigger**: `stage=WON` w Twenty (sygnał `purchase` event do platform reklamowych przez webhook adapter Sortowni; równolegle handlowiec wykonuje SOP)
- **Akcja handlowca**: ręcznie utworzyć Deal w Bitrix24 księgowy (osobny system od CRM operacyjnego Twenty)
- **Wypełnia**: link do Opportunity Twenty + `bizValueWon` (kwota z faktury) + dane Person/Company
- **Aktualizuje pole `bitrixDealId`** w Twenty (zdefiniowane w `DATA_MODEL.md`, OPEN, nullable) — manual przez handlowca
- **PHASE 2** (po retro Etapu 1): nowy SSOT adapter `crm:bitrix_create_deal` analogiczny do istniejącego `crm:bitrix_create_lead`. Trigger: webhook adapter Sortowni przy emisji `purchase` event dodaje zadanie `crm:bitrix_create_deal` do Listy Zadań Stape (per Inteligentny Routing rule dla `purchase`)

### 9. Kontakty awaryjne

- Developer: Karol / Dawid (telefony + emaile)
- Sortownia infrastructure: link/email
- Twenty support: link/email
- Właściciel (escape decision): tel

### 10. Post-cutover (T+1 do T+7)

- **T+1**: Sprawdzenie ledgera — każdy rekord verified
- **T+1**: Sprawdzenie SSOT eventów outbound — wszystkie 4 typy przeszły smoke test (qualify_lead, rejected_lead, purchase, generate_lead manual)
- **T+1**: Sprawdzenie Listy Zadań Stape (pending count powinien być <5%, failed_final <2%)
- **T+1**: Sprawdzenie Ratownik alerts log (każdy alert ma odpowiedź właściciela; brak open critical klas auth/schema)
- **T+3**: Quick check workflow credits Twenty (powinien być <5% — Twenty workflow zużywany TYLKO przez simple internal automations)
- **T+3**: Quick check Archiwizator → GCS Ledger (cron 2×/dzień zarchiwizował poprawnie)
- **T+7**: Retrospektywa Etapu 1
- **T+7**: Migracja gate decisions z `DECISION_REGISTER.A` do `.B` (chronologicznie) — pisze ADR-y per decyzja
- **T+7**: Decyzja o promocji agenta MCP z read-only do write (jeśli retro pozytywne)

**Co fizycznie wypełnia plik:**

~7-9 stron z konkretnymi krokami, ownerami per krok, threshold values.

---

# Katalog `/migration/`

## `/migration/README.md`

**Cel:** instrukcja użycia ledgera + **pre-import gate** (Z4 + Z14). Twenty CSV import natywnie deduplikuje po unique field; ledger to **dowód rekonsyliacji**, nie **silnik dedupy**.

### Struktura sekcji

#### 1. Header

#### 2. Kiedy używamy ledgera

- Per migracja: nowy plik CSV z datą w nazwie (`active_leads_YYYY_MM_DD.csv`)
- Plus snapshot pre-migration: `SUM(legacy_unique)` liczba
- Plus snapshot post-migration: `SUM(imported + merged + skipped + error)` liczba

#### 3. Pre-import gate (Z4 + Z14)

**Bulk operation gate** — uruchamiany przed KAŻDĄ bulk operation (CSV import, backfill, mass update, migration replay, API repair, testy masowe):

```
Pre-bulk-operation checklist:
[ ] Workflow disable list — wszystkie workflowy triggered by create/update na importowanym obiekcie
[ ] Expected record count — ile rekordów spodziewamy się dotknąć
[ ] Expected workflow runs = 0 unless explicitly approved
[ ] Owner approval — explicit zgoda właściciela na operację z N=<count>
[ ] Post-operation workflow reactivation checklist gotowy
[ ] Ledger entry — wpis do /migration/ albo /ops/OPS_NOTES.md (sekcja Bulk Operations Log)
[ ] Twenty native webhook OUT pause — czy wstrzymujemy delivery na czas operacji? (rekomendacja: TAK dla operacji >100 rekordów — Settings → Developers → Webhooks → status: inactive)
[ ] Komunikat do osoby odpowiedzialnej za Sortownię/Stape że Lista Zadań może otrzymać większy wolumen po reaktywacji webhook OUT
```

**Procedura aktywacji po operacji:**
1. Dry-run weryfikacja: czy state w Twenty jest zgodny z oczekiwaniami
2. Reaktywacja workflowów jeden po drugim (NIE wszystkie naraz)
3. Smoke test każdego workflow z 1-2 rekordami
4. Reaktywacja Twenty native webhook OUT (status: active) — webhook adapter Sortowni dostanie zaległe webhooki dla zmienionych rekordów
5. Monitoring Ratownik alerts przez pierwsze 1h (oczekiwany volume spike — może wymagać tymczasowo podniesionych progów)

#### 4. POC required przed pierwszą migracją

**`idOid` unique + null tolerance test** (D.2 preflight):
- Test 1: utworzyć 3 Opportunity z `Person.idOid=null` przez UI manual — czy Twenty accepts
- Test 2: utworzyć 2 Opportunity z `Person.idOid=<unique_value>` przez API — czy unique enforcement działa
- Test 3: import CSV z 5 rekordów (3 z null idOid, 2 z różnymi unique values) — czy import succeeds
- Test 4: drugi import CSV z 1 rekordem z duplikatem unique value — czy update zamiast duplikat

Jeśli któryś z testów fail → eskalacja do właściciela przed Fazą 3.

#### 5. Pięć reguł ledgera

1. **W TRAKCIE importu, nie po.** Każdy attempt = wiersz w ledgerze
2. **Każdy legacy record MUSI mieć wiersz.** Brak wiersza = brak dowodu
3. **Status `skipped` wymaga uzasadnienia** w `error_message` (NIE puste)
4. **Suma musi się zgadzać:** `SUM(legacy_unique) = SUM(imported + merged + skipped + error)`
5. **Retry nie nadpisuje poprzedniego attempt**; każdy retry = nowy wiersz

#### 6. Kolumny CSV (7 essential)

- `legacy_source` (np. `supabase_leads`, `manual_referral`)
- `legacy_id` (UUID Supabase)
- `id_oid` (z legacy lub minted przez Sortownię w trakcie migracji; w CSV snake_case per SSOT convention; mapowane na Twenty API field `idOid` przy imporcie — camelCase wymuszany przez Twenty)
- `twenty_opportunity_id`
- `status` (`imported` / `merged` / `skipped` / `error`)
- `error_message` (tylko jeśli `status=error` lub `skipped`)
- `verified_at` (timestamp ISO)

#### 7. Verification po migracji

- Każdy `id_oid` w Twenty MUSI mieć dokładnie 1 wiersz `status=imported` LUB `merged`
- Jeśli `id_oid` 2× ze statusem `imported` → bug deduplikacji (Twenty unique field nie zadziałało; eskalacja)
- Spot-check losowych 5% wierszy (open w Twenty UI, porównaj z legacy)
- **Relation check** — czy Person↔Company relacje zostały zachowane (Twenty „Import Relations Between Objects" guide)
- **Sortownia Profil Klienta check** — dla rekordów z legacy `id_oid`, weryfikacja że odpowiadający Profil Klienta istnieje w Sortowni; jeśli nie (legacy `id_oid` z innej Sortowni-instancji albo orphan) — wymagana akcja `system:identity_update` po stronie Sortowni

#### 8. Co Twenty robi natywnie (czego ledger NIE musi robić)

- Deduplikacja po unique field
- Restoration soft-deleted records (jeśli importujemy z tym samym `idOid`)
- Mapowanie kolumn (Twenty wykrywa nazwy kolumn CSV)
- Validation błędów przed zakończeniem importu

#### 9. Co Twenty NIE robi automatycznie (czego ledger MUSI dopilnować)

- Workflow triggers podczas importu — **MUSZĄ być OFF** (pre-import gate)
- Relation enforcement między obiektami (Person→Company) — manual mapping w CSV
- PII validation — czy emaile są maskowane w logach po imporcie

### `/migration/active_leads_YYYY_MM_DD.csv`

Plik CSV per migracja. Pierwsza: aktywne leady z Supabase do Twenty.

**Łączna objętość README:** ~2-3 strony.

---

# Katalog `/ops/`

## `/ops/OPS_NOTES.md`

**Cel:** operacyjna mapa „gdzie szukać" + **Twenty Verified Facts** + 3 registries + log incydentów + retention policy.

**Tryb dostępu agenta:** load przy pytaniach „gdzie znajdę X?" / „jakie są facts Twenty?" / debug.

**Rytm zmian:** rośnie organicznie. Sekcja Twenty Verified Facts kwartalnie review.

**Anty-wzorzec:** NIE jest dokumentem aspiracyjnym. NIE zawiera zasad (to CONSTITUTION). NIE zawiera kontraktów eventowych (to EVENT_CONTRACT).

### Struktura sekcji

#### 1. Header

#### 2. Top 3 częste problemy (pinned, dynamic)

Na start: pusta lub wynika z dry-runu cutoveru. Po cutoverze: aktualizowana po każdym incydencie.

#### 3. Lokalizacje krytyczne (mapa „gdzie szukać")

- Logi Twenty: Settings → Logs
- Workflow runs Twenty: workflow editor → runs tab + global Workflow Runs view
- **Twenty native webhook OUT delivery log**: Settings → Developers → Webhooks → per-webhook delivery history
- **Sortownia (Stape sGTM) logs**: <link Stape UI>
- **Lista Zadań Stape** (status, retry, failed_final per zadanie): <link Stape UI Tasks/Jobs>
- **Stape Store** (2-polowa pamięć webhook adapter: last_stage, last_campaignRejected per opportunity_id): <link Stape UI Store>
- **Inteligentny Routing config** (plik konfiguracyjny mapujący event_name → targets): <link / lokalizacja>
- **Pricing Key config** (Google Sheet → JSON, pobierany przez Adaptery): <link>
- **GCS Ledger (Archiwizator)**: <link bucket>
- **Ratownik alerts** (e-mail diagnostyczny / dashboard alertów): <link>
- n8n executions: n8n UI → Executions (jeśli n8n używane ad-hoc)
- Supabase legacy (read-only): <link>
- Bitrix24 (faktury): <link>
- PII storage policy: patrz sekcja 8 niżej
- Credentials/secrets: password manager (NIE w repo, NIE w Twenty Code/HTTP)
- API keys: Twenty Settings → Developers (per system: OWOCNI_SORTOWNIA_KEY, N8N_READ, TWENTY_UI_AGENT)

#### 4. Numery telefonów awaryjnych

Właściciel, Karol (developer), Dawid (developer), Sortownia infrastructure support, Twenty support.

#### 5. Twenty Verified Facts (Z9 — fakty platformowe Twenty żyją tutaj, nie w konstytucji)

| Fact | Source | Verified in workspace? | Last checked | Recheck trigger | Owner |
|---|---|---|---|---|---|
| Workflow credits Twenty Pro = 50/rok (yearly) or 5/mc (monthly) | docs.twenty.com/user-guide/billing/credits | tak (D.1) | 2026-05-28 | Twenty 3.0 release | Królu złoty |
| Code/HTTP actions are more expensive than basic internal operations (no exact numbers from docs) | docs + community | częściowo (POC TBD) | 2026-05-28 | empirical sandbox test | Karol |
| Audit logs: No on Pro, Yes on Organization | pricing table Twenty | tak | 2026-05-28 | pricing page update | Królu złoty |
| Row-level permissions: Organization only | pricing table Twenty | tak | 2026-05-28 | pricing page update | Królu złoty |
| SSO: Organization only | pricing table Twenty | tak | 2026-05-28 | pricing page update | Królu złoty |
| Dashboards: Beta / Early Access | docs | tak | 2026-05-28 | Twenty release notes | Karol |
| Formula fields: coming in Q1 2026, not yet released | docs + GitHub issue | tak | 2026-05-28 | Q1 2026 release | Karol |
| Native webhooks: HMAC SHA256 (X-Twenty-Webhook-Signature, X-Twenty-Webhook-Timestamp) | docs | tak | 2026-05-28 | Twenty 3.0 | Karol |
| Native webhooks: ALL event types to URL (no per-type filter in 2.8.0) | docs | tak | 2026-05-28 | Twenty 3.0 release | Karol |
| `data.updatedBy` in webhook payload from January 2026 (source, workspaceMemberId, name, context — but NOT apiKeyId) | GitHub issue #16915 | częściowo (sandbox test TBD) | 2026-05-28 | Twenty 3.0 release | Karol |
| `defineApplicationRole()`: exactly ONE per app | docs.twenty.com/developers/extend/apps/config/roles | tak | 2026-05-28 | Apps Framework release | Karol |
| Native role assignment to API keys / AI agents: Settings → Members → Roles (SEPARATE from Apps Framework) | docs | tak | 2026-05-28 | Twenty 3.0 | Karol |
| Custom fields: cannot currently be required (no native required toggle) | FAQ Twenty | tak | 2026-05-28 | Twenty roadmap "Expose non-nullable toggle" | Karol |
| Trigger policy: Record is Created for API/CSV/mailbox/calendar sync; Record is Created or Updated for manual | docs | tak | 2026-05-28 | Twenty 3.0 | Karol |
| CSV import + workflows: deactivate before bulk; 5000 runs/h limit | FAQ Twenty Workflows | tak | 2026-05-28 | Twenty 3.0 | Karol |
| createWorkflowVersion: FORBIDDEN by API key | empirical POC 2026-05-25 | tak | 2026-05-25 | next API release | Karol |
| `id` field: reserved in Twenty REST/GraphQL (cannot set custom UUID) | empirical POC 2026-05-25 | tak | 2026-05-25 | API change | Karol |
| Native MCP server: every Cloud workspace, OAuth-based | docs + pricing | tak | 2026-05-28 | Twenty 3.0 | Karol |
| `docs.twenty.com/llms.txt`: official AI agent documentation index | docs (fetched 2026-05-28) | tak | 2026-05-28 | Twenty release | Karol |
| Workflow notification action: NOT documented as native (no „notification" action listed in workflow-actions docs) | docs | częściowo (sandbox test TBD) | 2026-05-28 | Twenty 3.0 release notes | Karol |
| Apps Framework Skills & Agents: alpha | docs | tak | 2026-05-28 | alpha-to-beta transition | Karol |
| Apps Framework Connections: OAuth 2.0 only; non-OAuth API keys are future | docs | tak | 2026-05-28 | Connections roadmap | Karol |
| CSV import doesn't trigger workflows by default (confirmed via FAQ) — bulk import generates create/update events that trigger workflows IF workflows are enabled | FAQ Twenty | tak | 2026-05-28 | Twenty 3.0 | Karol |

#### 6. Workflow Runtime Registry

| Workflow | Trigger | Source | Object | Field scope | Side effect | PII class | Kill switch | Credit risk |
|---|---|---|---|---|---|---|---|---|

Na start: pusta. Rośnie organicznie po każdej zmianie schemy workflowów.

#### 7. Twenty → Sortownia signaling registry

Tabela 4 SSOT events emitowanych z Twenty + ich downstream destinations per Inteligentny Routing. **NIE jest** Event Runtime Registry (event runtime żyje w SSOT Sortowni — Lista Zadań Stape + Robot + Adaptery).

| SSOT event | Twenty trigger | Mapping rule (webhook adapter) | Inteligentny Routing targets (do uzgodnienia z owner Sortowni) | Stape Store key (jeśli native webhook nie ma data.before) |
|---|---|---|---|---|
| `qualify_lead` | `stage` zmienia się na QUALIFIED | `last_stage != "QUALIFIED"` AND `new_stage == "QUALIFIED"` | `['FIND_SOURCE_PLATFORM', 'analytics:ga4_mp']` per SSOT | `last_stage[opportunity_id]` |
| `purchase` | `stage` zmienia się na WON | `last_stage != "WON"` AND `new_stage == "WON"` | `['FIND_SOURCE_PLATFORM', 'analytics:ga4_mp']` per SSOT | `last_stage[opportunity_id]` |
| `rejected_lead` | `campaignRejected` zmienia się na true | `last_campaignRejected == false` AND `new_campaignRejected == true` | `['FIND_SOURCE_PLATFORM']` per SSOT (RESTATE downgrade) | `last_campaignRejected[opportunity_id]` |
| `generate_lead` (manual variant) | `_operation == "create"` + `Person.idOid == null` | new opportunity bez `id_oid` | `['system:WRITE_AKT_WLASNOSCI', 'crm:twenty_update_person']` per SSOT | n/a (initial state) |

**Transport**: Twenty native webhook OUT (HMAC SHA256), endpoint Sortowni `<sortownia>/inbound/twenty_webhook`. NIE pożera workflow credits Twenty.

**Loop prevention**: webhook adapter SKIP gdy `data.updatedBy.source == "API"` AND `data.updatedBy.name == "OWOCNI_SORTOWNIA_KEY"` (backfill `crm:twenty_update_person`).

**Smoke test status** (per smoke test scenarios Plik 4 §9): pre-cutover wymaga 5 scenarios PASSED (qualify_lead, purchase, rejected_lead, manual generate_lead, noise filtering).

#### 8. PII Logs & Retention Policy (Z15)

**Retention periods:**

| Data type | Where stored | Retention | Redaction |
|---|---|---|---|
| Raw Twenty webhook payload (full record) | Sortownia trusted internal logs (Stape) | 7 dni | Po 7 dniach: usuwane lub PII masked |
| SSOT event payload (whitelist per Plik 4 §6) | Lista Zadań Stape (Job rows) | per Stape retention policy (typowo 30-90 dni) | PII masked w log lines (full payload w Job row tylko) |
| Lista Zadań Stape status logs | Stape platform | per Stape policy | PII masked w log lines |
| GCS Ledger (Archiwizator, 2×/dzień cron) | GCS bucket | długoterminowo (per biznesowa analiza) | PII w pełni zachowane (bucket z owner-only access) |
| n8n execution logs (jeśli ad-hoc używane) | n8n | 7 dni | PII masked |
| Twenty native logs (Settings → Logs) | Twenty (platform) | per Twenty policy | per Twenty policy |
| Twenty native webhook OUT delivery log | Twenty (Settings → Developers → Webhooks) | per Twenty policy | nie zawiera PII payload (tylko status delivery) |

**PII fields requiring masking in log lines:**
- `email`, `phone`, `firstName`, `lastName`, `fullName`, `personalAddress`

**Debug export rules:**
- **NEVER share raw webhook payloads or SSOT event payloads with AI/LLMs (in chat, in tickets, in support requests) bez redaction**
- Sortownia/Stape powinno dostarczyć utility do redacted export (do uzgodnienia z owner Sortowni)
- Owner approval required for any export containing PII

#### 9. Known issues (stałe ostrzeżenia)

- **R-18 (Workflow concurrency / autosave)**: używać trigger `Record is Created or Updated` dla manual creation (autosave triggeruje workflow przed wypełnieniem pól)
- **Trigger policy by source** (Prawo 7c): dla API/CSV/sync użyj `Record is Created`; dla manual `Record is Created or Updated`; dla transitions `Record is Updated` z field monitoring
- **Twenty webhooks** wysyłają WSZYSTKIE event types do URL; filtrowanie semantyczne w webhook adapter Sortowni (`inbound:twenty_webhook`)
- **Workflow credits Pro = 50/rok**; outbound do Sortowni przez **native Twenty webhook OUT** (Settings → Developers → Webhooks; NIE pożera credits); Twenty workflows tylko simple internal
- **Twenty Pro** NIE ma audit logs i row-level permissions (Organization $19/u)
- **Custom fields** NIE mają natywnego required w 2.8.0; walidacja wartości eventów (np. `bizValueWon` przy `purchase`) po stronie Adaptera platformy tuż przed wysłaniem; **NIE w Sortowni webhook adapter** (to za wcześnie semantycznie)
- **Branches w Twenty workflows: parallel by default** — każda gałąź MUSI mieć Filter z mutually exclusive conditions
- **Twenty real-time autosave** — walidacja MUSI być po stronie Adaptera (downstream), NIE AT SAVE w Twenty
- **`apiKeyId` NIE jest exposed** w `data.updatedBy`; loop prevention przez kombinację `data.updatedBy.source == "API"` + `data.updatedBy.name == "OWOCNI_SORTOWNIA_KEY"`
- **`createWorkflowVersion`** zwraca FORBIDDEN przez API key — workflowów NIE da się definiować jako kod; snapshot JSON w git jako ratunek
- **Adapter `crm:twenty_create_lead`** — analogiczny do SSOT `crm:bitrix_create_lead`. Historycznie nazywany `crm:twenty_create_deal` lub `crm:twenty_create_opportunity` — to relikty, do zamiany. SSOT konwencja: event_name (`generate_lead`) → adapter (`<crm>:twenty_create_lead`).
- **Zakaz sekretów w Twenty Workflow Code i Workflow HTTP** (Prawo 7f) — external API keys w Sortownia runtime env / Stape credential store (NIE Twenty workflow)
- **Workflow „notification" action**: NIE jest udokumentowana jako natywna w Twenty workflow-actions docs. Failure surface dla walidacji = po stronie Adaptera platformy (per SSOT — Ratownik alert klasy schema/auth/quota)
- **Skills/Agents Twenty Apps Framework**: obecnie alpha — nie używać jako fundament Etapu 1
- **Apps Framework Connections**: obecnie OAuth 2.0 only — non-OAuth API keys są future, **NIE używać Apps Framework jako safe runtime config dla arbitrary API keys**
- **Native webhook payload schema** (data.before / data.after / data.diff) — wymaga preflight POC w sandboxie (Decyzja 11 w DECISION_REGISTER). Jeśli native webhook ma data.before — webhook adapter Sortowni działa bez 2-polowej pamięci; jeśli nie — Stape Store na `last_stage` / `last_campaignRejected` per opportunity_id
- **Terminal state machine** — NIE robimy enforcement po naszej stronie (per SSOT „akceptujemy burdel w raportach platform"). Idempotency delegowana platformom (Google Ads dedup po `order_id`, Meta po `event_id` Meta-side). W razie błędu handlowca (np. WON → potem rejected_lead) — duplikaty emitowane, ręczna korekta w GCS Ledger przy biznesowej analizie.

#### 10. Bulk Operations Log

Per bulk operation:
- Date
- Operation type (CSV import / API backfill / mass update / migration replay)
- Record count
- Workflows disabled (lista)
- Twenty native webhook OUT paused? (true/false)
- Owner approval (kto, kiedy)
- Ratownik alerts during/after operation (lista alertów + odpowiedzi)
- Outcome (success / failed / rolled back)

#### 11. Incydenty (chronologicznie, najnowsze na górze)

Na start: pusta. Pierwsza notatka = wnioski z dry-runu cutoveru.

Format per wpis:
```
---
## YYYY-MM-DD — Tytuł problemu
- Typ: error / warning / lesson
- Co się stało:
- Co zrobiliśmy:
- Co zadziałało (rozwiązanie):
- Jak naprawić następnym razem:
- Link do commitu/PR:
- Operator:
---
```

#### 12. Archiwizacja

Po roku: stare wpisy do `INCIDENT_NOTES_ARCHIVE_YYYY.md`. Twenty Verified Facts NIE archiwizowane — kwartalny review aktualizuje `Last checked` lub flaguje `recheck_overdue`.

**Co fizycznie wypełnia plik:**

Na start — sekcje 3 (lokalizacje), 4 (kontakty), 5 (Twenty Verified Facts wypełnione na podstawie pakietu fundamentów), 6 (pusta tabela Workflow Runtime Registry), 7 (4 SSOT eventy emitowane z Twenty + mapping rules), 8 (retention policy), 9 (known issues), 10 (pusta tabela Bulk Operations Log). Sekcje 2 i 11 puste, rosną w czasie.

---

# Podsumowanie objętości pakietu

| Plik | Objętość | Rytm zmian | Faza otwierająca |
|---|---|---|---|
| 0. README.md | ~1 strona | przy zmianie struktury repo | Faza 1 |
| 1. CRM_CONSTITUTION.md | 5-7 stron | kwartalnie | Faza 2 |
| 2. CRM_ARCHITECTURE_CURRENT.md | 5-7 stron | per decyzja architektoniczna | Faza 2 |
| 3. DATA_MODEL.md | 3 strony | per nowe pole / deaktywacja | Faza 2 |
| 4. EVENT_CONTRACT.md | 9 stron | per nowy event / pole w payloadzie | Faza 4 |
| 5. DECISION_REGISTER.md | 3-4 strony (start) | sekwencyjnie do cutoveru; chronologicznie po | przekrojowy |
| 6. CUTOVER_RUNBOOK.md | 7-9 stron | często przed cutoverem; rzadko po | Faza 5 |
| `/migration/README.md` | 2-3 strony | per migracja | Faza 3 |
| `/ops/OPS_NOTES.md` | rośnie organicznie | per incydent / nowy workflow / quarterly recheck | Faza 1 |

**Łącznie:** ~35-45 stron markdownu w stanie startowym. Po cutoverze: `DECISION_REGISTER.B` + `OPS_NOTES.11` + `Bulk Operations Log` rosną chronologicznie.
