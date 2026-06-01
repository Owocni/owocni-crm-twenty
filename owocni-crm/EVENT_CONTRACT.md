---
doc_id: EVENT_CONTRACT
title: "EVENT_CONTRACT — Twenty CRM ↔ Sortownia (mapowanie, adapter, cold-start)"
layer: core_ssot
status: active
edit_scope: structure_only
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-05-31
recheck_trigger: "Twenty release / zmiana kanonu eventów / zmiana adaptera Sortowni / preflight webhook payload"
default_trust: D:CORE
related:
  - DATA_MODEL
  - CRM_CONSTITUTION
  - IDENTITY_AND_INBOUND
  - ops/OPS_NOTES
supersedes:
  - STAGE_MAPPING
---

# EVENT_CONTRACT — Twenty CRM ↔ Sortownia

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** mapowaniu zmian w Twenty → nazwy business eventów SSOT (`qualify_lead`, `purchase`, `rejected_lead`, `generate_lead`); rozróżnieniu LOST ≠ rejected_lead; zakazie `lead_won` jako event_name; mechanice adaptera Sortowni (transition detection, cold-start, loop-prevention, idempotency); transporcie (native webhook OUT); rozpoznaniu manual-create (`idOid IS NULL`). Wchłania STAGE_MAPPING (WON=stage, purchase=event, SQL≡QUALIFIED).

**Ten plik NIE decyduje o:** pełnych definicjach SSOT orkiestracji (→ dokumentacja orkiestracji, poza tym repo); JSON schema (→ `generated/`, future); Pricing Key / Robot / Adapterach platform (→ SSOT Sortowni); typach pól (→ `DATA_MODEL.md`); tożsamości/kanałach (→ `IDENTITY_AND_INBOUND.md`); konkretnych nazwach nagłówków HMAC (→ `ops/OPS_NOTES.md`).

**Zawsze czytaj razem z:** `DATA_MODEL.md` (pola), `CRM_CONSTITUTION.md` (INV-3/4/5/6, Prawo 5), `ops/OPS_NOTES.md` (fakty platformowe, HMAC).

**Najgroźniejszy błąd:** uznać native webhook za business event i emitować eventy bez adaptera / shadow-state / idempotencji — albo wskrzesić martwą gałąź „porównaj before/after".

**Przy konflikcie:** event/trigger/adapter — ten plik jest właścicielem. Fakt platformowy (HMAC nazwa, credits, event-name webhooka) → `ops/OPS_NOTES.md` (rozstrzyga instancja/docs).

**Zmiana wymaga:** ADR (kanon eventów = `[D:CORE]`). Nazwy eventów nie negocjuje się w kodzie CRM.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | **native webhook ≠ business event.** Webhook = techniczny sygnał stanu; business event powstaje w adapterze Sortowni (mapper). | Emisja bez adaptera = eventy bez kontekstu przejścia. | Fałszywe/zgubione eventy do platform. | Właściciel + ADR | tu §4 |
| NR-2 | **native webhook NIE niesie before/after** — transition detection WYŁĄCZNIE przez Stape Store (`last_stage`, `last_campaignRejected`). Gałąź „porównaj before/after" jest martwa — NIE implementować. | Payload Twenty = `{event, data, timestamp}`, `data` = stan aktualny (`[D:VERIFIED]` docs webhooks v2.8.0). | Wskrzeszenie martwej gałęzi = błędna detekcja przejść. | nowy dowód z instancji | tu §4 |
| NR-3 | **`lead_won`/`closed_won`/`WON` zakazane jako `event_name`** (WON jako stage w UI dozwolone). | Niezgodność z SSOT orkiestracji. | Chaos w adapterach, brak routingu. | Właściciel + ADR | tu §2 |
| NR-4 | **import / backfill / replay → no_emit** (NIGDY sygnał do platform). | Sygnał do platformy nieodwracalny. | Wydane budżety, zatruta atrybucja. | Właściciel + ADR | tu §4.1 + `audits/AUDIT_MIGRACJA.md` |
| NR-5 | **webhook endpoint odbiera WSZYSTKIE wspierane obiekty — adapter MUSI filtrować typ obiektu/zdarzenia przed mapowaniem.** NIE traktować webhooka jako Opportunity-only. | Zdarzenia obcych obiektów zmapują się jako fałszywe eventy. | Nieodwracalny fałszywy sygnał do platform. | Właściciel + ADR | tu §4 |
| NR-6 | **Loop-prevention: efemeryczny pending-write w Stape, NIGDY `srcSystem`-SKIP** `[D:CORE]`. Sortownia przy zapisie do Twenty zapisuje krótkotrwały znacznik (rekord + TTL); webhook w oknie → SKIP tej operacji; po TTL znika sam. Zakaz: `SKIP gdy srcSystem==OWOCNI_SORTOWNIA`. | Trwałe pole wycisza legalne późniejsze zdarzenia handlowca (cicha awaria atrybucji). | Legalne qualify_lead/purchase/rejected_lead nie wychodzą, niewidoczne bez audytu. | Właściciel + ADR | CRM_CONSTITUTION INV-3 |
| NR-7 | **Idempotencja z istniejącej detekcji przejść (Stape Store), bez osobnego event_ledger.** | Duplikat webhooka dla tego samego stanu → `last_stage`/`last_campaignRejected` bez zmiany → brak przejścia → SKIP naturalnie. | Zbędna warstwa = over-engineering. | — | tu §6 |
| NR-8 | **⚠ TRANSITION EXCEPTION — backfill idOid** `[D:OPEN]`. Patrz §6.1 — sekwencja (1)(2)(3) obowiązkowa; usunięcie srcSystem-SKIP przed smoke test #4 PASS = rozdwojenie tożsamości (nieodwracalne). | Stary anti-loop backfillu stoi dziś na srcSystem-SKIP. | Drugi mint idOid = rozdwojenie tożsamości klienta. | Dawid / smoke test #4 | tu §6.1 |
| NR-9 | `lossCategory`/`lossDescription` NIGDY do payloadu eventu (CRM-only). | Wyciek powodu przegranej do platform. | Wyciek danych biznesowych. | Właściciel + ADR | `DATA_MODEL.md` |

---

## 2. PURPOSE

Definiuje, jak techniczna zmiana w Twenty staje się business eventem SSOT, jak skonfigurowany jest transport (native webhook OUT) i jak adapter Sortowni mapuje sygnał (z loop-prevention, cold-start, idempotency). Jedyny SSOT warstwy CRM dla mapowania eventów. Wersja 1.0.

---

## 3. SCOPE

### Pokrywa
- Mapowanie zmian w Twenty → nazwy eventów SSOT (`qualify_lead`, `purchase`, `rejected_lead`, `generate_lead` manual).
- Konfigurację Twenty native webhook OUT (transport).
- Reguły adaptera `inbound:twenty_webhook` (transition, cold-start, loop-prevention, idempotency, filtr obiektu).
- LOST vs rejected_lead; SQL ≡ QUALIFIED; zakazane nazwy eventów; smoke testy.

### Nie pokrywa
- Pełnych definicji SSOT eventów w orkiestracji (→ dokumentacja orkiestracji).
- Inteligentnego Routingu, Pricing Key, Robota, Adapterów platform (→ SSOT Sortowni).
- Konkretnych nazw nagłówków HMAC (→ `ops/OPS_NOTES.md`).

---

## 4. CANONICAL DEFINITIONS

| Pojęcie | Mechanizm | Event |
|---|---|---|
| **Przegrany deal** (klient nie kupił) | Stage LOST | **żaden** |
| **Odrzucony wzorzec kampanii** (nadal można sprzedawać) | `campaignRejected = true` | `rejected_lead` |
| **Wygrany** | Stage WON | `purchase` |

- **WON** = stage handlowy w CRM. **purchase** = event_name integracyjny. `WON`/`closed_won`/`lead_won` NIE mogą być `event_name` (dozwolone: `WON` jako nazwa stage/statusu w UI).
- **SQL ≡ QUALIFIED** — jeden stage, różnica wyłącznie językowa/UI (handlowcy mówią „SQL", Twenty pokazuje „QUALIFIED"). Bez osobnego kroku SQL w Etapie 1 (ADR #5 closed 2026-05-29). Operacyjna definicja „kiedy QUALIFIED" testowana na ludziach (test pary handlowców), nie zamrażana tutaj.
- **native webhook** = techniczny sygnał `{event, data, timestamp}`, `data` = stan aktualny rekordu, BEZ diffu before/after.

---

## 5. BODY

### 5.1 Transport outbound (native webhook OUT)

**Mechanizm docelowy:** Twenty **native webhook OUT** (Settings → Developers → Webhooks).

| Parametr | Wartość |
|---|---|
| Auth | HMAC SHA256 — **konkretne nazwy nagłówków + signed-string → `ops/OPS_NOTES.md` § Twenty Verified Facts** (`[D:VERIFIED]`, dom faktu platformowego) |
| Koszt credits | native webhook nie zużywa workflow credits — szczegół + status epistemiczny → `ops/OPS_NOTES.md` |
| Target | `https://<sortownia>/inbound/twenty_webhook` |
| Obiekty | Opportunity, Person (create + update) — adapter filtruje typ (NR-5) |

**NIE używać w produkcji:** Twenty Workflow → HTTP Request do Sortowni (limit Pro workflow credits — patrz `ops/OPS_NOTES.md`; przy ~150 leadach/mc całością ruchu × 3 eventy ≈ 5400/rok native webhook jest jedyną opcją).

**POC (25–26.05):** Workflow Code + HTTP → webhook.site — tylko dowód techniczny, do zastąpienia przed cutoverem.

### 5.2 Event catalog (kanoniczny — NIE usuwać żadnego)

**Dozwolone `event_name`:** `generate_lead`, `qualify_lead`, `rejected_lead`, `purchase`, `consent_update`.
**Zakazane jako `event_name`:** `lead_won`, `closed_won`, `won`, `WON` (NR-3).

| event_name | Powstaje gdy | Uwaga |
|---|---|---|
| `generate_lead` | Formularz owocni.pl (przez Sortownię) **lub** manual create (`idOid IS NULL`) | Lead z polecenia / telefonu rozpoznany przez brak tożsamości |
| `qualify_lead` | przejście stage **do** QUALIFIED | Tylko transition do QUALIFIED |
| `purchase` | przejście stage **do** WON | NIE `lead_won` |
| `rejected_lead` | `campaignRejected` false → true | NIE zależy od stage LOST |
| `consent_update` | aktualizacja zgody (kanał SSOT) | Zachowany z katalogu — nie usuwać jako „nieznany" |

> `oid_init` (jeśli występuje w katalogu Sortowni) — zachować, nie usuwać. „Nie rozpoznaję" ≠ „do usunięcia"; usunięcie eventu z katalogu = potencjalna luka w routingu.

### 5.3 Trigger conditions (mapowanie Twenty → SSOT, KANONICZNE)

| Zmiana w Twenty | Event SSOT | Uwagi |
|---|---|---|
| `stage` → QUALIFIED | `qualify_lead` | Tylko przejście **do** QUALIFIED |
| `stage` → WON | `purchase` | NIE `lead_won` — zgodność z SSOT orkiestracji |
| `campaignRejected` false → true | `rejected_lead` | NIE zależy od stage LOST |
| `stage` → LOST | **brak eventu** | Analiza tylko w CRM; brak sygnału do platform |
| `Person.idOid` null (przy create LUB update) | `generate_lead` (manual) | Detekcja przez brak tożsamości, NIE typ operacji — manual może przyjść jako update (R-18) |
| Formularz owocni.pl | `generate_lead` | Przez Sortownię — nie z Twenty |

**Mapowanie kanoniczne — język handlowy → stage → event** (wchłonięte ze STAGE_MAPPING):

| Język handlowy (legacy) | Stage Twenty | Event SSOT | Komentarz |
|---|---|---|---|
| Zapytania | NEW / CONTACTED | brak | Praca handlowa bez emisji |
| Odpowiedzi | CONTACTED | brak | Jak wyżej |
| Kwalifikowany (SQL) | QUALIFIED | `qualify_lead` | SQL = odpowiednik QUALIFIED |
| Analiza | PROPOSAL (lub custom, jeśli ADR) | brak | CRM-only |
| Wpłaca | PROPOSAL/WON transition | brak | CRM-only operacyjne |
| Obsługa | WON + obsługa post-sale | `purchase` przy wejściu do WON | Event tylko na przejściu do WON |
| Przegrany | LOST | brak | Brak eventu reklamowego |
| Odrzucony kampanijnie | `campaignRejected=true` | `rejected_lead` | UI: „Odrzuć leada" (API: `campaignRejected`). ≠ LOST |

**Tabela decyzyjna LOST vs rejected_lead (kotwica 1:1):**

| Stan w CRM | Emitować `rejected_lead`? | Uzasadnienie |
|---|---|---|
| `campaignRejected=true` | TAK | Odrzucenie kampanijne |
| `stage=LOST`, `campaignRejected=false` | NIE | Przegrana sprzedaż, nie odrzucenie kampanijne |
| `stage=LOST`, `campaignRejected=true` | TAK | Triggerem jest `campaignRejected`, nie LOST |
| `lostReason`/`lossDescription` uzupełniony | NIE (samo z siebie) | Pole analityczne CRM-only |

### 5.4 Transition detection + adapter Sortowni (`inbound:twenty_webhook`)

1. **Weryfikacja HMAC** (nazwy nagłówków + signed-string → `ops/OPS_NOTES.md`).
2. **Filtr typu obiektu/zdarzenia** PRZED mapowaniem (NR-5) — webhook odbiera wszystkie obiekty; obce → SKIP_UNSUPPORTED_OBJECT.
3. **Loop prevention:** SKIP gdy operacja jest echem własnego zapisu Sortowni — przez **efemeryczny pending-write w Stape** (NR-6), NIE przez `srcSystem`.
4. **Wykrycie przejścia:** payload NIE niesie diffu (`data` = stan aktualny — NR-2). Detekcja przejść WYŁĄCZNIE z pamięci Stape Store: `last_stage`, `last_campaignRejected` per `opportunity_id`.
5. **Emit do Inteligentnego Routingu lub SKIP** (z reason code — §5.6).

**Pseudologika mapowania:**

```
# Manual create może dotrzeć jako create LUB update (R-18: "manual create →
# trigger Created or Updated, nie Created only"). NIE warunkujemy generate_lead
# na czystym create — rozpoznajemy manual przez brak tożsamości (idOid IS NULL),
# nie przez typ webhooka. Pole _operation NIE istnieje w payloadzie Twenty.
if (create OR update) AND person.idOid IS NULL → generate_lead (manual)   # mint idOid; NIE event przejścia
elif stage → QUALIFIED (transition) → qualify_lead
elif stage → WON (transition) → purchase
elif campaignRejected false→true → rejected_lead
else → SKIP
```

#### Cold-start (brak stanu poprzedniego w Stape Store) — kotwica 1:1, 4 wiersze

Detekcja przejść opiera się wyłącznie na Stape Store; payload nie niesie before/after. Adapter MUSI mieć jawne zachowanie, gdy stanu poprzedniego brak:

| Sytuacja | Zachowanie adaptera |
|---|---|
| Brak `last_stage`/`last_campaignRejected` w Stape Store | NIE emituj eventu przejścia |
| Pierwsze zdarzenie po cutoverze dla istniejącego rekordu | Zapisz stan początkowy, NIE wysyłaj sygnału |
| Kolejna zmiana po zapisanym stanie początkowym | Dopiero TERAZ wykrywaj przejście i emituj |
| Backfill / import / replay | Tryb `no_emit` — tylko zapis stanu, zero sygnałów do platform |

**Uzasadnienie:** bez reguły cold-start pierwszy webhook każdego rekordu albo zostałby zgubiony (brak punktu odniesienia → przejście niewidoczne), albo potraktowany jak świeże przejście (fałszywy `qualify_lead`/`purchase`). To NIE edge case — dotyczy KAŻDEGO pierwszego zdarzenia rekordu po cutoverze; reguła obowiązkowa.

**Spójność z regułą importu:** wiersz „Backfill / import / replay → `no_emit`" to ta sama zasada co „import ≠ event outbound" (`audits/AUDIT_MIGRACJA.md` krok 4; `ARCHITECTURE.md` backup path). Jedna reguła w dwóch miejscach — import historyczny NIGDY nie emituje do platform (NR-4, INV-6).

### 5.5 Inbound kanoniczny (granica — szczegóły w ARCHITECTURE)

Formularz → Sortownia `generate_lead` → adapter `crm:twenty_create_lead` → Twenty REST/GraphQL. Szczegóły: `ARCHITECTURE.md`. Inbound spoza Sortowni (Email Sync, telefon, manual) → `IDENTITY_AND_INBOUND.md` (ADR #12, #13).

### 5.6 Loop-prevention + idempotency + reason codes

- **Loop-prevention = efemeryczny pending-write w Stape** (NR-6): Sortownia przy zapisie do Twenty zapisuje krótkotrwały znacznik „spodziewam się webhooka dla rekordu Y przez N s"; webhook w oknie → SKIP; po TTL znacznik znika. `srcSystem` = pole raportowe (proweniencja), NIGDY mechanizm SKIP (`DATA_MODEL.md`, INV-3).
- **Idempotencja:** z istniejącego Stape Store (NR-7) — duplikat webhooka dla tego samego stanu → brak zmiany `last_stage`/`last_campaignRejected` → brak przejścia → SKIP naturalnie. Bez osobnego event_ledger.
- **Reason codes adaptera (obserwowność — kompensuje brak audit logu na Pro):**

| Reason code | Znaczenie |
|---|---|
| `SKIP_DUPLICATE_DELIVERY` | Powtórna dostawa tego samego webhooka |
| `SKIP_ECHO_OWN_WRITE` | Echo własnego zapisu Sortowni (pending-write w oknie) |
| `SKIP_COLD_START_BASELINE` | Pierwsze zdarzenie rekordu — zapis stanu początkowego, bez emisji |
| `SKIP_NO_RELEVANT_TRANSITION` | Zmiana bez przejścia istotnego dla eventu |
| `SKIP_DUPLICATE_BUSINESS_EVENT` | Stan się nie zmienił (np. campaignRejected true→true) |
| `SKIP_UNSUPPORTED_OBJECT` | Zdarzenie obiektu spoza zakresu (filtr typu, NR-5) |
| `EMITTED` | Event wyemitowany do Inteligentnego Routingu |

### 6.1 TRANSITION EXCEPTION — backfill idOid (`[D:OPEN]`)

Docelowy runtime NIE używa `srcSystem` jako loop-prevention. ALE przejście ma SEKWENCJĘ — stary anti-loop backfillu (manual create → mint → `crm:twenty_update_person` → webhook) stoi dziś na `srcSystem`-SKIP. Kolejność obowiązkowa:

1. **(1)** pending-write Sortowni obejmuje operację backfill idOid →
2. **(2)** smoke test #4 PASS (manual create → backfill → brak drugiego `generate_lead`) →
3. **(3)** dopiero wtedy usuń `srcSystem`-SKIP dla tej ścieżki.

**Usunięcie przed krokiem (2) = pętla LUB drugi mint idOid = rozdwojenie tożsamości klienta (nieodwracalne).** To NIE rozszerza się na stage/campaignRejected i NIE jest finalną architekturą — to guard migracyjny dla jednej ścieżki. Warunek zamknięcia: Dawid / smoke test #4. Wyjątek dotyczy WYŁĄCZNIE backfillu — invariant „loop-prevention nigdy na trwałym polu" (INV-3) obowiązuje wszędzie indziej.

### 6.2 Failure / retry (failure modes odwracalne)

Failure modes pending-write (webhook po TTL, przed zapisem, retry, edycja w oknie) są **odwracalne** (skutek: opóźnienie/ponowienie). Backfill idOid jest wyjątkowo w NEGATIVE RULES (NR-8/§6.1), bo NIEODWRACALNY (rozdwojenie tożsamości). Szczegóły TTL i trybów → preflight.

### 6.3 Test matrix (brama go/no-go — NIE ilustracja)

Minimum scenariuszy przed cutoverem (PASS wymagany):

| # | Scenariusz | Oczekiwany wynik |
|---|---|---|
| 1 | CONTACTED → QUALIFIED | `qualify_lead` (EMITTED) |
| 2 | QUALIFIED → WON (+ opcjonalnie bizValueWon) | `purchase` (EMITTED) |
| 3 | campaignRejected false → true | `rejected_lead` (EMITTED) |
| 4 | Manual create Opportunity (idOid null) → backfill | `generate_lead` + backfill; **brak drugiego `generate_lead`** (brama L-1/§6.1) |
| 5 | Zmiana opisu bez stage/rejected | SKIP (`SKIP_NO_RELEVANT_TRANSITION`) |
| 6 | campaignRejected true → true | SKIP (`SKIP_DUPLICATE_BUSINESS_EVENT`) |
| 7 | Duplicate webhook (ten sam stan) | SKIP (`SKIP_DUPLICATE_DELIVERY`/idempotencja) |
| 8 | Import rekordu w stage=QUALIFIED | **no_emit** (żaden sygnał do platform) |

### 6.4 Examples — rozróżnienie warstw nazewniczych

- **Event webhooka Twenty** (warstwa platformy, np. `*.created`/`*.updated`) ≠ **business event SSOT** (`qualify_lead`, `purchase`, …). Konkretna nazwa eventu webhooka Twenty jest niejednoznaczna w źródłach → `ops/OPS_NOTES.md` (recheck na instancji).

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| Typy/nazwy/frozen pól; `srcSystem`=proweniencja; lossCategory CRM-only | `DATA_MODEL.md` |
| Konkretne nazwy nagłówków HMAC + signed-string; credits; event-name webhooka | `ops/OPS_NOTES.md` |
| Zasada „jedna jawna ścieżka", granica CRM↔orkiestracja, INV-3/4/5/6 | `CRM_CONSTITUTION.md` |
| Inbound spoza Sortowni, kanały, Resolver T1–T5 | `IDENTITY_AND_INBOUND.md` |
| Granice systemów, diagramy in/out, backup Sheets | `ARCHITECTURE.md` |
| Import ≠ event (side-effect guard) | `audits/AUDIT_MIGRACJA.md` |
| STAGE_MAPPING (wchłonięty) | `archive/STAGE_MAPPING.md` (stub — deprecated) |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-E1 | TRANSITION EXCEPTION backfill idOid — usunięcie srcSystem-SKIP dopiero po smoke #4 PASS | Dawid | **cutover** | smoke test #4 (§6.3) |
| OQ-E2 | Nazwa eventu webhooka Twenty (`*.created/updated`) — niejednoznaczna w źródłach | Dawid | nie | instancja / `ops/OPS_NOTES.md` |
| OQ-E3 | Czy Opportunity webhook payload niesie `Person.idOid` (czy follow-up query) | Dawid | nie | sandbox |

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Test matrix 1–8 PASS (brama go/no-go) | Preflight/cutover | Dawid | runtime PASS/FAIL |
| Smoke #4 (backfill bez drugiego generate_lead) przed usunięciem srcSystem-SKIP | Preflight | Dawid | runtime |
| Payload webhooka = `{event, data, timestamp}` bez diffu | Preflight | Dawid | instancja v2.8.0 |
| Stape Store utrzyma 2-polową pamięć per opportunity_id | Preflight | Dawid | Stape limits |

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
