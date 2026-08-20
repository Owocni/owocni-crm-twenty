---
doc_id: DATA_MODEL
title: "DATA_MODEL — pola krytyczne Twenty CRM, frozen policy, prefiksy"
layer: core_ssot
status: active
edit_scope: structure_only
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-08-10
recheck_trigger: "Twenty release / zmiana schematu pól / powstanie generatora schemy / wdrożenie lead claim"
default_trust: D:VERIFIED
related:
  - CRM_CONSTITUTION
  - EVENT_CONTRACT
  - IDENTITY_AND_INBOUND
unfreeze_authority: "Właściciel + ADR (dla pól FROZEN)"
---

# DATA_MODEL — pola krytyczne Twenty CRM

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** semantyce i ownership pól krytycznych Opportunity/Person; polityce FROZEN (3 warstwy: typ / API name / wartości SELECT); prefiksach (`id*`/`biz*`/`src*`); 6 pytaniach przed nowym polem; wartościach stage (NEW/CONTACTED/QUALIFIED/PROPOSAL/WON/LOST); rozróżnieniu „pole→event" vs „pole CRM-only"; polach metryk analytics (§5.1.1, formuły → `METRICS.md`).

**Ten plik NIE decyduje o:** standardowych polach Twenty (firstName, email → MCP/Settings); mapowaniu pól na eventy (→ `EVENT_CONTRACT.md`); pełnym eksporcie schematu (→ `generated/`, gdy pipeline istnieje); tożsamości (→ `IDENTITY_AND_INBOUND.md`).

**Zawsze czytaj razem z:** `EVENT_CONTRACT.md` (które pole wyzwala który event), `CRM_CONSTITUTION.md` (Prawa 3, 4, 6).

**Najgroźniejszy błąd:** ręczny DATA_MODEL deklaruje, że prawda jest w `generated/`, którego dziś NIE MA → agent traci jedyne źródło typów pól.

**Przy konflikcie:** typ/nazwa/frozen pola — ten plik jest właścicielem. Fakt platformowy (np. „custom fields nie-required") → `ops/OPS_NOTES.md`.

**Zmiana wymaga:** dla pól FROZEN — właściciel + ADR (zmiana typu = nieodwracalna migracja DDL). Dodanie opcji do SELECT ≠ zmiana typu (patrz §1).

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | **NIE pisać „prawda techniczna jest w `generated/`" dopóki generator nie istnieje.** `generated/` jest dziś scaffoldem; TEN plik = pełny ręczny SSOT pól krytycznych `[D:VERIFIED]`. | Generatora nie ma — odesłanie tam = utrata jedynego źródła typów. | Agent działa na pustym scaffoldzie. | Powstanie pipeline'u + ADR | tu / `generated/` |
| NR-2 | NIE zmieniać **typu / API name / wartości SELECT** pola FROZEN bez ADR. | Zły typ = nieodwracalny bez migracji DDL; zmiana API name łamie adapter/webhooki/zapytania/import. | Nieodwracalna migracja danych. | Właściciel + ADR | tu (§1 frozen) |
| NR-3 | NIE mylić **„dodanie opcji SELECT"** (Metadata API, tanie) z **„zmianą typu"** (DDL, drogie). | Fałszywy strach przed rozszerzeniem SELECT blokuje tanie operacje. | Niepotrzebny ADR lub zablokowana zmiana. | — | tu |
| NR-4 | **`srcSystem` = pole raportowe (proweniencja), NIGDY mechanizm loop-prevention** `[D:CORE]`. Opisuje „skąd lead", nie służy do SKIP w adapterze. | Trwałe pole jako SKIP wycisza legalne późniejsze zdarzenia (cicha awaria atrybucji). | Eventy nie wychodzą do platform, niewidoczne. | Właściciel + ADR | `EVENT_CONTRACT.md` (loop-prevention = pending-write Stape) |
| NR-5 | `lossCategory` / `lossDescription` — **CRM-only, NIGDY do payloadu** SSOT. | Podpięcie = wyciek powodu przegranej do platform reklamowych. | Wyciek danych wrażliwych biznesowo. | Właściciel + ADR | tu |

---

## 2. PURPOSE

Kontrakt pól krytycznych (systemowych / eventowych / integracyjnych) na natywnych obiektach Twenty. Semantyka i ownership ręcznie (pełny SSOT `[D:VERIFIED]`); technika docelowo z `generated/`, gdy pipeline powstanie. Status: Etap 1 MVP.

---

## 3. SCOPE

### Pokrywa
- Pola krytyczne Opportunity (11) i Person (idOid).
- Polityka FROZEN (3 warstwy), prefiksy, 6 pytań, preflight.
- Wartości stage (enum) — wchłonięte ze STAGE_MAPPING.

### Nie pokrywa
- Standardowych pól Twenty (firstName, email → MCP / Settings UI).
- Mapowania pól na eventy (→ `EVENT_CONTRACT.md`).
- Pełnego eksportu schematu (→ `generated/`, future).

---

## 4. CANONICAL DEFINITIONS

- **FROZEN** = zamrożone: **typ + API name + (dla SELECT) wartości mapujące się na eventy/logikę**; zmiana wymaga ADR. **UI label NIE jest zamrożony domyślnie** (zmiana wyświetlanej nazwy jest tania, nie rusza API ani typu) — wyjątek: label niosący znaczenie operacyjne uzgodnione z handlowcami (np. „Odrzuć leada") wymaga uzgodnienia zespołowego, ale to nie ADR techniczny.
- **Wartości stage (enum `stage`):** `NEW / CONTACTED / QUALIFIED / PROPOSAL / CONTRACT_SENT / PAYING / WON / LOST` (etykiety UI od 2026-07-06 — patrz runbook kanban).
- **Pole→event** vs **pole CRM-only:** pole→event zasila payload SSOT lub wyzwala business event (semantyka → `EVENT_CONTRACT.md`); pole CRM-only służy wyłącznie analizie wewnętrznej w Twenty i NIGDY nie idzie do payloadu.

---

## 5. BODY — pola, frozen policy, prefiksy

### 5.1 Opportunity — pola krytyczne

| Field (API) | Type | Unique | Owner | Empty | Used by | Freeze? | Description (Twenty UI) |
|---|---|---|---|---|---|---|---|
| `idOid` | TEXT | YES | Sortownia (mint) | null przy manual | Wszystkie SSOT eventy; upsert ingress | **FROZEN** | Cross-system id_oid; mint Sortownia przy generate_lead |
| `stage` | SELECT | NO | Handlowiec | default NEW | qualify_lead (→QUALIFIED), purchase (→WON) | **FROZEN** | Etykiety UI: Nowy / Rozeznanie / Przyjęty SQL / Wysłano ofertę / Wysłano umowę / Wpłaca / Wygrany / Przegrany. Wartości API: NEW, CONTACTED, QUALIFIED, PROPOSAL, CONTRACT_SENT, PAYING, WON, LOST |
| `campaignRejected` | BOOLEAN | NO | Handlowiec (przycisk/akcja) | false | rejected_lead | **FROZEN** | **UI label:** „Odrzuć leada". **Opis:** Informuje kanały reklamowe, że takich leadów nie szukamy. To nie to samo co stage LOST („przegrany deal"). API name: `campaignRejected`. |
| `rejectionReason` | SELECT | NO | Handlowiec | null | rejected_lead (raport) | **FROZEN** | Powód odrzucenia kampanii — raportowo. Sprzężony z `campaignRejected`. |
| `bizProduct` | SELECT/TEXT | NO | Formularz/adapter | null | payload SSOT | **FROZEN** | Produkt (web, logo, …) |
| `bizSource` | SELECT/TEXT | NO | Formularz/adapter | null | payload SSOT | OPEN | Źródło leada. Import PD: stała **`PIPEDRIVE_IMPORT`** (ADR #20). |
| `bizValueWon` | CURRENCY | NO | Handlowiec przy WON | null | purchase (`biz_value` w payloadzie) | **FROZEN** | Wartość wygranej — **źródło raportowe** dla `purchase`; preferowane nad `bizValueDisplay`. Łańcuch fallback → `EVENT_CONTRACT.md` §5.7 |
| `amount` | CURRENCY | NO | Twenty / handlowiec | 0 PLN default | purchase (fallback `biz_value`) | OPEN | Natywne pole Twenty; **0 PLN nie liczy się** jako wartość wygranej — adapter przechodzi dalej w łańcuchu §5.7 |
| `srcSystem` | SELECT | NO | Adapter / UI | TWENTY_UI | proweniencja / raportowo | **FROZEN** | OWOCNI_SORTOWNIA / TWENTY_UI / BETTER_BITRIX_LEGACY / TWENTY_EMAIL / **PIPEDRIVE_LEGACY** (ADR #20). Pole raportowe (skąd lead) — NIE mechanizm loop-prevention (patrz NR-4). |
| `pipedriveId` | TEXT | NO | Import PD | null | rollback / most migracji | OPEN | System ID dealu z Pipedrive. Unikalność w stagingu/adapterze. |
| `legacyCreatedAt` | DATETIME | NO | Import PD | null | audyt timeline | OPEN | Oryginalny `add_time` z PD (obok `createdAt=add_time`). |
| `legacyPipedriveStageName` | TEXT | NO | Import PD | null | audyt remap stage | OPEN | Oryginalna nazwa stage PD, gdy brak 1:1 do Twenty. |
| `lastOrchestrationEventAt` | DATETIME | NO | Workflow/adapter | null | audit | OPEN | Ostatni event do Sortowni. Jedyny ślad audytowy emisji po stronie Twenty (brak audit logu na Pro). |
| `lastOrchestrationEventId` | TEXT | NO | Workflow/adapter | null | audit | OPEN | id_event ostatniego eventu. Ślad audytowy emisji (j.w.). |
| `bitrixDealId` | TEXT | NO | Handlowiec (manual SOP) | null | handoff Bitrix24 | OPEN | Deal księgowy po WON — MVP manual. Most handoff WON→Bitrix24 (CONSTITUTION Prawo 9). |

#### Kanban card (OPEN — od 2026-07-06)

| Field (API) | Type | Owner | Used by | Freeze? | Description |
|---|---|---|---|---|---|
| `lastContactAt` | DATETIME | Adapter / workflow | Kanban, follow-up | OPEN | Ostatni kontakt (lead lub odpowiedź klienta) |
| `bizLastContactLabel` | TEXT | Adapter / workflow | Kanban kafelek | OPEN | `Godzin: N` / `Dni: N` |
| `bizProjectType` | SELECT | Formularz | Nazwa leada, raport | OPEN | NEW / REDESIGN |
| `bizIntent` | SELECT | Formularz | Nazwa leada, raport | OPEN | CENNIK / EKSPERT |
| `bizValueMin` / `bizValueMax` | CURRENCY | Formularz | Widełki, raport | OPEN | Dolna/górna widełka PLN |
| `bizValueDisplay` | TEXT | Adapter / handlowiec | Kanban kafelek | OPEN | Tekst wartości na kafelku (np. `1222 PLN`, `0 PLN`, widełki). **UI-only** — adapter używa jako **ostatni fallback** `biz_value` dla `purchase` (parser liczby). Nie zastępuje `bizValueWon` w raportowaniu |
| `bizSqlConfirmed` | BOOLEAN | Workflow „Przyjmij jako SQL" | false / null | qualify_lead (gate) | OPEN | `true` po potwierdzeniu SQL w workflow MANUAL. Bez tego przejście do QUALIFIED → `SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM` |
| `bizSqlConfirmedAt` | DATETIME | Workflow SQL | null | raport / audyt | OPEN | Timestamp potwierdzenia SQL |
| `bizLastNonSqlStage` | TEXT/SELECT | Workflow Track Stage Time | null | guard odrzuconego leada | OPEN | Ostatni etap przed SQL — cel cofnięcia przy próbie QUALIFIED/WON na `campaignRejected=true` |
| `bizCardEmail` / `bizCardPhone` | TEXT | Adapter | Kanban kafelek | OPEN | Denormalizacja kontaktu na kartę |
| `metaLeadgenId` | TEXT | Meta Lead webhook | null | CAPI SQL (`lead_id`), idempotencja inbound | OPEN | `leadgen_id` z Meta Instant Form — unikalny |
| `metaAdId` | TEXT | Meta Lead webhook | null | raport M5 / atrybucja reklamy | OPEN | `ad_id` z webhooka Lead Ads |
| `metaAdgroupId` | TEXT | Meta Lead webhook | null | raport zestawu reklam | OPEN | `adgroup_id` tylko z webhooka (nie z retrieval) |

Specyfikacja widoku → `integrations/runbooks/KANBAN_CARD_SPEC.md`.

#### Wartość wygranej vs kafelek (kotwica operacyjna)

| Pole | Warstwa | Kiedy wypełniać | Wpływ na `purchase` |
|---|---|---|---|
| `bizValueDisplay` | UI kanban | Przy tworzeniu leada (adapter), ręcznie na karcie | Fallback (krok 5) — parser `1222 PLN` → `1222` |
| `bizValueWon` | Raport / integracja | Przy wygranej (pole walutowe lub workflow) | Preferowane źródło `biz_value` |
| `amount` | Twenty native | Opcjonalnie | Fallback (krok 2); `0` ignorowane |

Pełny łańcuch → `EVENT_CONTRACT.md` §5.7.

#### Analytics — pola metryk (CRM-only, ADR #18)

Pola **CRM-only** (NR-5 w `METRICS.md`) — wypełnia workflow / GCP worker; zapis read-only dla ról handlowców (Roles → See Field). **NIGDY do payloadów eventów.**

| Field (API) | Type | Owner | Empty | Used by | Freeze? | Description (Twenty UI) |
|---|---|---|---|---|---|---|
| `qualifiedAt` | DATETIME | Workflow Track Stage Time v3 | null | M3, M7 | OPEN | Pierwsze wejście w QUALIFIED (SQL od) |
| `hoursToQualified` | NUMBER | Workflow Track Stage Time v3 | null | M3 | OPEN | Godziny od `createdAt` do SQL (2 dec.) |
| `stageClosedAt` | DATETIME | Workflow Track Stage Time v3 | null | M1, M4, M8 odpływ | OPEN | Faktyczne zamknięcie WON/LOST — ≠ natywne `closeDate` |
| `daysToClose` | NUMBER | Workflow Track Stage Time v3 | null | M1 | OPEN | Dni od `createdAt` do zamknięcia (2 dec.) |
| `firstResponseAt` | DATETIME | GCP `advanceNewToContacted.js` | null | M2 | OPEN | Timestamp pierwszego maila wychodzącego |
| `hoursToFirstResponse` | NUMBER | GCP `advanceNewToContacted.js` | null | M2 | OPEN | Godziny do pierwszej odpowiedzi (2 dec.) |

Kanon formuł → `METRICS.md`. Kontrakty → `../workflows/track-stage-time.contract.md`, `../workflows/first-outbound-response.contract.md`.

#### Lead claim / routing — planowane (TIME TO LEAD) — OPEN / NIE WDROŻONE

**Źródło decyzji:** `/Volumes/Samsung_T5/Rozdzielanie-leadow-wstep.md` (v1.2, 2026-08-10).  
**Semantyka:** CRM-only / orkiestracja — **NIGDY do payloadów eventów reklamowych** (jak NR-5).  
**Nie mylić:** `bizIntent` (CENNIK/EKSPERT) ≠ `bizLeadIntentClass` (HOT_FIT/STANDARD/LOW_INTENT) ≠ native `engagement` (HOT/COLD).

| Field (API) | Type | Owner (plan) | Empty | Used by | Freeze? | Description |
|---|---|---|---|---|---|---|
| `bizLeadIntentClass` | SELECT | Classifier / adapter | null | Sloty, SLA, routing | OPEN | `HOT_FIT` / `STANDARD` / `LOW_INTENT` |
| `bizClaimState` | SELECT | Claim orchestrator | `UNASSIGNED` | Pętla T+0/3min/3h | OPEN | `UNASSIGNED` / `RESERVED` / `FIRST_ATTEMPT_VERIFIED` / `WORKING` / `REASSIGN_REQUIRED` |
| `bizReservationId` | TEXT | Claim orchestrator | null | Atomowy claim | OPEN | Zwycięski reservation id (idempotency) |
| `bizReservedAt` | DATETIME | Claim orchestrator | null | TTL 3 min | OPEN | Start rezerwacji |
| `bizReservedUntil` | DATETIME | Claim orchestrator | null | TTL 3 min | OPEN | Koniec rezerwacji |
| `bizReservedByWorkspaceMemberId` | TEXT | Claim orchestrator | null | Audyt claim | OPEN | Kto trzyma rezerwację |
| `bizClaimPrimaryWorkspaceMemberId` | TEXT | Router | null | Primary assign | OPEN | Primary przed verified attempt |
| `bizFirstAttemptAt` | DATETIME | Outbound / call hook | null | Wyjście z puli | OPEN | Verified first attempt = **mail lub start rozmowy** na leadzie |
| `bizFirstAttemptChannel` | SELECT | Outbound / call hook | null | Audyt | OPEN | `EMAIL` / `CALL` |
| `bizFailoverCount` | NUMBER | Claim orchestrator | 0 | Metryki | OPEN | Ile razy wygasła rezerwacja |
| `bizManagerAlertedAt` | DATETIME | Claim orchestrator | null | T+3 h | OPEN | Eskalacja manager |
| `bizRoutingRule` | SELECT lub TEXT | Router | null | Audyt | OPEN | np. `HARD_ROBERT_META` / `HARD_MACIEJ_COPY` / `POOL_MARTA_GOSIA` / `MANUAL` / `CONTINUITY` |

**Capacity / urlop (Workspace Member lub obiekt `SalesCapacity` 1:1):** `bizVacationOn`, `bizInClaimPool`, `bizMaxSlotsHot` / `Standard` / `Low` (domyślnie 1/2/3), `bizLastQualifiedAssignAt`.  
**Zajętość (zaakceptowane v1.3):** `bizRepAvailability` (`AVAILABLE` / `IN_CALL` / `BUSY_OTHER`), `bizBusyUntil` — status „rozmowa trwa” **blokuje** auto-przekazanie już wziętych leadów i **pauzuje** TTL/failover; verified attempt = mail **lub** call.  
Ewa: `bizInClaimPool=false` (tylko ręczne). Marta/Gosia: `true`. Robert/Maciej: hard-route poza pulą ogólną.

**Kolejność wdrożenia:** (1) intent class + capacity → (2) availability / „rozmowa trwa” → (3) claim state + reservation TTL → (4) verified mail|call → (5) fairness + vacation → (6) failover/manager timers → (7) UI claim.  
**Bloker procesowy (otwarte):** overflow przy braku slotów — pytania tylko w `Rozdzielanie-leadow-wstep.md` §8.

#### Message — kierunek (CRM-only, ADR #19 / E12.5)

Pole **CRM-only** na obiekcie systemowym Message — materializacja reguły firmy z `MCMA.direction`. **NIGDY do payloadów eventów.** Bez prefiksu (`biz*`/`id*`/`src*` = kontrakt integracyjny).

| Field (API) | Type | Owner | Empty | Used by | Freeze? | Description (Twenty UI) |
|---|---|---|---|---|---|---|
| `direction` | SELECT | Writer backfill + GCP `messageDirectionEnrich` (MCMA webhook/poll) | null (maile bez MCMA) | Widoki 📥/📤/🔧 | OPEN (wartości 1:1 z enumem platformy) | **UI:** Kierunek. Wartości API: `INCOMING` → „Przychodzący", `OUTGOING` → „Wychodzący". Reguła: OUTGOING jeśli **jakakolwiek** asocjacja ma OUTGOING, inaczej INCOMING. Workflow UPDATE Message = zablokowany (`Object cannot be updated by automation`). |
| `ourMailboxes` | MULTI_SELECT | Writer backfill + GCP `messageDirectionEnrich` | [] | Widoki 📥/📤 Marta·Gosia·Mariusz·Robert·Ewa (soft filter) | OPEN | **UI:** Nasze skrzynki. Wartości: MARTA/GOSIA/MARIUSZ/STUDIO/LEADS/COPYWRITING/POMOC/OBSLUGA/ROBERT/EWA. Źródło: `MessageParticipant.handle` ∈ naszych adresów. **Nie ACL** — filtr widoku, da się zdjąć. |

Runbook → `integrations/runbooks/E12_5_MAIL_DIRECTION_VIEWS.md`. ADR → `DECISION_REGISTER.md` #19.

#### Stage LOST
- **Nie emituje** eventu SSOT do platform (semantyka → `EVENT_CONTRACT.md`).
- `lossCategory` / `lossDescription` — opcjonalne pola **CRM-only** (analiza wewnętrzna). **NIGDY do payloadu** (NR-5).

### 5.2 Person — pola krytyczne

| Field | Type | Unique | Owner | Empty | Freeze? |
|---|---|---|---|---|---|
| `idOid` | TEXT | YES | Sortownia | null = manual create | **FROZEN** |
| `pipedriveId` | TEXT | NO | Import PD | null | OPEN — System ID osoby z Pipedrive (rollback). |

### 5.3 Company

| Field | Type | Unique | Owner | Empty | Freeze? |
|---|---|---|---|---|---|
| `accountOwner` / `accountOwnerId` | RELATION → WorkspaceMember (natywne Twenty) | NO | Workflow SQL → stempel; continuity routing odczyt | null | OPEN — **semantyka Owocni:** sprzedawca, który doprowadził relację do SQL. **Nie Ewa.** Ustawiane tylko gdy puste (nie nadpisujemy). Continuity: nowy lead firmy / Person wraca do tego ownera (kill-switch `CONTINUITY_ROUTING_ENABLED`). |
| `pipedriveId` | TEXT | NO | Import PD | null | OPEN — System ID org z Pipedrive (rollback). |
| `nip` | TEXT | **YES** | Enrichment worker (GUS) / handlowiec | null | OPEN — klucz enrichmentu + KSeF; unique od utworzenia (⛔N14). |
| `regon` | TEXT | NO | Enrichment worker (GUS) | null | OPEN |
| `krs` | TEXT | NO | Enrichment worker (GUS/KRS) | null | OPEN — puste dla JDG. |
| `registrationDate` | DATE | NO | Enrichment worker (GUS raport) | null | OPEN — data założenia. |
| `legalName` | TEXT | NO | Enrichment worker | null | OPEN — nazwa rejestrowa do faktury; `name` = display. |
| `legalForm` | TEXT | NO | Enrichment worker | null | OPEN |
| `pkd` | TEXT | NO | Enrichment worker | null | OPEN — TEXT nie MULTI_SELECT (okres przejściowy PKD). |
| `shareCapital` | CURRENCY | NO | Enrichment worker (KRS) | null | OPEN — puste dla JDG = OK. |
| `vatStatus` | SELECT {`CZYNNY`,`ZWOLNIONY`,`NIEZAREJESTROWANY`} | NO | Enrichment worker (MF) | null | OPEN — wartości UPPERCASE (kanon SELECT workspace). |
| `registeredAddress` | ADDRESS | NO | Enrichment worker | null | OPEN — **siedziba = faktura**; nie pisać w `address`. |
| `boardMembers` | TEXT | NO | Enrichment worker (KRS) | null | OPEN — tylko jawny odpis. |
| `enrichedAt` | DATE_TIME | NO | Enrichment worker | null | OPEN — audyt ostatniego sukcesu. |
| `enrichmentSource` | TEXT | NO | Enrichment worker | null | OPEN — np. `gov-direct 2026-08-06`. |

Źródło decyzji pól: ENRICH_COMPANY_PL_BUTTON §3.1 · utworzone Metadata API 2026-08-06 (G1).

### 5.3b Faktura (custom object `faktura` / `faktury`)

Lustro Fakturowni. Writer = worker GCP (`issue_invoice`). SoR dokumentów = Fakturownia.

| Field | Type | Unique | Owner | Empty | Freeze? |
|---|---|---|---|---|---|
| `kind` | SELECT {PROFORMA,VAT,ADVANCE,FINAL,CORRECTION} | NO | Form / webhook | null | OPEN |
| `invoiceNumber` | TEXT | NO | Fakturownia | null | OPEN |
| `status` | SELECT {DRAFT,ISSUED,PARTIAL,PAID} | NO | Fakturownia | null | OPEN |
| `ksefStatus` | SELECT {NONE,PROCESSING,OK,ERROR} | NO | worker / webhook | null | OPEN |
| `issueDate` / `paymentTo` | DATE | NO | Fakturownia | null | OPEN |
| `amountGross` | CURRENCY | NO | Fakturownia | null | OPEN — nie → biz_value |
| `ksefNumber` | TEXT | NO | gov_id | null | OPEN |
| `fakturowniaId` | TEXT | **YES** | Fakturownia `id` | null | OPEN — upsert key |
| `company` | RELATION → Company | NO | worker | null | OPEN — external_id |
| `opportunity` | RELATION → Opportunity | NO | trigger / picker | null | OPEN — puste legalne |
| `issuedBy` | RELATION → WorkspaceMember | NO | trigger metadata | null | OPEN |
| `fromInvoice` | RELATION → Faktura | NO | copy_invoice_from | null | OPEN |
| `fakturowniaUrl` / `pdfUrl` / `upoUrl` / `ksefVerificationLink` | LINKS | NO | Fakturownia | null | OPEN |

Utworzono Metadata API 2026-08-07 · FAKTUROWNIA_INTEGRACJA §5.

### 5.4 Reguły operacyjne

1. **FROZEN — 3 warstwy nazewnictwa Twenty** (co dokładnie jest zamrożone):
   - **Typ pola** (`FieldMetadataType`, np. TEXT/SELECT/BOOLEAN) — zamrożony ZAWSZE; zmiana = migracja DDL. Tylko ADR.
   - **API name** (`name`, np. `campaignRejected`) — zamrożony ZAWSZE; zmiana łamie adapter Sortowni / webhooki / zapytania. Tylko ADR.
   - **UI label** (`labelSingular/Plural`) — **NIE zamrożony** domyślnie; zmiana wyświetlanej nazwy jest tania i niegroźna (nie rusza API ani typu). Wyjątek: label niosący znaczenie operacyjne uzgodnione z handlowcami (`campaignRejected` → „Odrzuć leada") — zmiana wymaga uzgodnienia, ale to nie ADR techniczny.
   - **Wartości SELECT** (lista stage NEW/.../LOST) — zamrożone gdy mapują się na eventy/logikę. Tylko ADR.

   Czyli: FROZEN w tabeli = „typ + API name + (dla SELECT) wartości zamrożone, ADR wymagany". UI label pozostaje edytowalny, chyba że wiersz mówi inaczej.
2. **Każde nowe pole: 6 pytań** (kto wypełnia, kiedy, po co, czy wpływa na decyzję biznesową, jaka kategoria, Twenty vs poza).
3. **Required** — Twenty 2.8.0 nie wspiera required na custom fields `[D:VERIFIED]`; **business required ≠ Twenty save-time required** — walidacja przy emisji eventu / w Adapterze platformy, nie przy save (CONSTITUTION Prawo 7b, INV-9).
4. **Konwencja nazw — trzy warstwy (nie mylić):**
   - **API name** (`name`): camelCase w Twenty (`idOid`, `campaignRejected`); snake_case w payloadach SSOT (`EVENT_CONTRACT.md`). To samo pole, dwie warstwy nazewnicze — NIE dwa pola.
   - **UI label**: dowolny, ludzki, edytowalny w Settings. Nie wpływa na API.
   - **Typ**: `FieldMetadataType`, zmiana = migracja (Metadata API), nie edycja nazwy.
   Prefiksy dotyczą **API name** pól kontraktu integracyjnego, nie labeli i nie każdego custom fieldu. Zmiany label/name/typ idą przez **Metadata API** (konfiguracja), nie Core API (rekordy).
5. **POC + operacje:** pole `campaignRejected` zweryfikowane live i potwierdzone w realnym użyciu przez sprzedaż `[D:VERIFIED]`.

### 5.5 Decyzje typu pola wymagające znacznika odchylonego

**bizSource = SELECT** `[D:RESEARCH]`
- Decyzja: znormalizowany SELECT, rozszerzalny przez Metadata API.
- Powód: wolny TEXT = chaos atrybucji („Facebook"/„FB"/„Meta" jako 3 źródła); pole zasila wydatki reklamowe.
- Obalony kontrargument: „SELECT = migracja DDL przy nowym kanale" — FAŁSZ. Dodanie opcji do SELECT = operacja Metadata API, nie DDL. Migracja grozi tylko przy zmianie TYPU pola.
- Status: rekomendacja researchu + obalenie kosztu; niezweryfikowane na instancji → preflight.

**bizProduct = SELECT** `[D:RESEARCH]`
- Decyzja: znormalizowany SELECT (web, logo, …), rozszerzalny przez Metadata API.
- Powód: spójna klasyfikacja produktu w payloadach/raportach.
- Obalony kontrargument: jak wyżej — rozszerzenie listy = Metadata API, nie DDL.
- Status: rekomendacja researchu; preflight.

**Dwa wymiary (nie mylić):** (a) *decyzja o typie* = SELECT `[D:RESEARCH]`; (b) *status operacyjny* = NIE tworzyć tych pól w Twenty przed preflight — ale **OPISANE tu już teraz** (dokumentacja ≠ utworzenie pola; pole zostaje w tabeli z adnotacją „do utworzenia po preflight").

### 5.6 Prefiksy pól custom (Prawa 3 i 6 w CRM_CONSTITUTION)

**Po co:** granica odpowiedzialności między Twenty (stan sprzedaży) a Sortownią/Stape (tożsamość, eventy). Twenty **nie wymusza** prefiksów — to dyscyplina zespołu przy review.

| Prefiks / wzorzec | Znaczenie | Przykłady | Kto ustawia |
|---|---|---|---|
| `id*` | Tożsamość cross-system (`id_oid`) | `idOid` | Sortownia (mint); backfill do Twenty |
| `biz*` | Klasyfikacja/wartość idąca do payloadów SSOT / raportów GCS | `bizProduct`, `bizSource`, `bizValueWon` | Formularz, adapter, handlowiec |
| `lastOrchestration*` (lub przyszły `orch*`) | Audyt ostatniego eventu do Sortowni | `lastOrchestrationEventAt`, `lastOrchestrationEventId` | Workflow / adapter |
| `bitrix*` / `legacy*` | Most migracyjny lub handoff poza Twenty | `bitrixDealId` | Handlowiec (SOP) / migracja |
| `src*` | Proweniencja zapisu (raportowo) | `srcSystem` | Adapter / UI |
| **bez prefiksu** | Semantyka CRM, flagi akcji, stage | `campaignRejected`, `rejectionReason`; natywne `stage` | Handlowiec |

**Kiedy NIE dodawać prefiksu:** pole tylko do analizy wewnętrznej (`lossCategory`, `lossDescription`); flaga/akcja z jasnym UI label (`campaignRejected` API, „Odrzuć leada" label — nie przemianowywać na `bizCampaignRejected`); pole standardowe Twenty (`firstName`, `email`).

**Czego unikać:** globalnego `owocni_`/`crm_` na wszystkim (custom = nasze i tak; tylko szum w API); podwójnych prefiksów (`bizBizValue`); prefiksu bez `description` w Settings.

**Review nowego pola (skrót):** (1) idzie do eventu SSOT? → rozważ `biz*`. (2) id_oid / deduplikacja? → `id*`. (3) tylko CRM? → bez prefiksu. (4) FROZEN? → wpis w tabeli + ADR.

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| Formuły metryk M1–M9 (pola §5.1.1) | `METRICS.md` |
| Które pole wyzwala który event; LOST vs rejected_lead | `EVENT_CONTRACT.md` |
| Zasada granicy CRM↔orkiestracja (prefiksy), Prawa 3/4/6 | `CRM_CONSTITUTION.md` |
| Loop-prevention (dlaczego srcSystem ≠ SKIP) | `EVENT_CONTRACT.md` (pending-write Stape) |
| Workflowy SQL / odrzucenie / guard | `integrations/runbooks/TWENTY_WORKFLOWS_REJECT_AND_GUARD.md` |
| Fakt „custom fields nie-required" (recheck) | `ops/OPS_NOTES.md` |
| Pełny eksport schematu (future) | `generated/` (gdy pipeline) |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-D1 | bizSource/bizProduct = SELECT — potwierdzenie na instancji | Dawid | nie | preflight (sandbox) |
| OQ-D2 | UI label pól kontraktowych edytowalny bez zgody? | Właściciel | nie | uzgodnienie zespołowe |

---

## 8. VERIFICATION / RECHECK (Preflight — gate przed cutoverem)

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| `idOid` unique + wiele rekordów z `null` — test w sandboxie | Preflight | Dawid | sandbox |
| Opisy pól wypełnione w Twenty Settings (MCP) | Preflight | Dawid | Settings |
| bizSource/bizProduct utworzone jako SELECT (po decyzji) | Preflight | Dawid | Settings/Metadata API |
| custom fields nie-required (walidacja poza save-time) | Twenty release | Dawid | docs/instancja |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-08-20 | Semantyka natywnego `Company.accountOwner` = sprzedawca SQL (continuity, nie Ewa) | Dawid / agent | ADR #21 / RULE_CONTINUITY |
| 2026-07-10 | `bizSqlConfirmed`, `bizSqlConfirmedAt`, `bizLastNonSqlStage`; `amount` w łańcuchu purchase; rozróżnienie `bizValueDisplay` vs `bizValueWon`; § wartość wygranej | Dawid / agent | Workflow SQL/odrzucenie/guard + fix biz_value |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:VERIFIED` (pełny ręczny SSOT pól; brak generatora dziś). Inline = odchylenie.
