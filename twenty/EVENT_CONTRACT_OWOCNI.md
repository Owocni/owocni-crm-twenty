# EVENT CONTRACT OWOCNI — Mapowanie Twenty CRM ↔ Orkiestracja Stape

> **LEGACY (2026-05-28):** SSOT operacyjny → `../owocni-crm/EVENT_CONTRACT.md`. Różnice: `purchase` zamiast `lead_won`; LOST bez eventu; `rejected_lead` tylko `campaignRejected`; outbound przez native webhook OUT, nie Workflow HTTP.

**Status:** zatwierdzony, SSOT dla nazewnictwa zdarzeń *(zastąpiony przez owocni-crm/)*
**Wersja:** v1.0
**Data:** 2026-05-04
**Właściciel:** Królu złoty (OWOCNI.PL)
**Powiązany dokument:** `owocni_crm_architektura_v0.7.2_FINAL.md`

---

## 1. Cel dokumentu

Ten dokument jest **SSOT (single source of truth) dla nazewnictwa pól** w komunikacji między Twenty CRM (system sprzedaży) a orkiestracją Stape sGTM (system atrybucji marketingowej VBB/VBO).

Definiuje:

- Które pola Twenty mają **identyczną nomenklaturę** z Event Contract orkiestracji
- Które pola mają **różną nomenklaturę** i wymagają translation w workflow
- Które pola Event Contract **NIE żyją w Twenty** (są w Stape Profile Klienta / Akt Własności)
- Pełne schemy webhook payloadów Twenty → Sortownia
- Zasady translation w Twenty workflow Code action

Dokument jest **zsynchronizowany z trzema źródłami prawdy:**

1. Event Contract orkiestracji (dokument właściciela "Fundamenty orkiestracji II.2")
2. Architektura Twenty CRM v0.7.2 (`owocni_crm_architektura_v0.7.2_FINAL.md`)
3. CRM domain spec (adapter `crm:twenty_create_deal` z lookup logiki)

W przypadku rozbieżności: Event Contract orkiestracji wygrywa dla nazewnictwa wire-format. Twenty architektura wygrywa dla nazewnictwa Twenty internal fields.

---

## 2. Architektoniczna zasada

**Twenty internal fields używają prefix-camelCase convention (idOid, bizProduct, bizValue, bizSource). Webhook payload Twenty → Sortownia używa Event Contract snake_case (id_oid, biz_product, biz_value, biz_source). Translation jest DETERMINISTYCZNA przez funkcję `camelToSnake()` w Twenty workflow Code action — bez hardcoded mapping table.**

**Powód (revised v0.7.3):**

- Twenty hard-egzekwuje camelCase + alphanumeric only (PR #10699 merged 11.03.2025) — underscore w field names blokowany
- Prefix camelCase mirroruje Event Contract prefix system (`biz` → `biz_`, `id` → `id_`) — translation 1:1 deterministyczna
- Self-documenting schema: pole z prefiksem `bizX`/`idX` w Twenty MÓWI "to leci do orkiestracji jako biz_x/id_x"
- Pure CRM custom fields (bez prefiksu, np. `needsFollowUp`, `lastFollowUpDraftAt`) wizualnie odróżniają się od outbound — granica CRM ↔ orkiestracja widoczna w schemie
- Sprzedawca nigdy nie widzi technical name — widzi `label` (np. "Kwota Sprzedaży" zamiast `bizValue`). Cognitive load tylko po stronie devów/AI agents

**Konsekwencja praktyczna:**

Twenty workflow "Outbound Event to Orchestration" zawiera Code action który **automatycznie konwertuje** wszystkie outbound fields do snake_case przez `camelToSnake()`:

```javascript
const camelToSnake = s => s.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
const outboundFields = ['idOid', 'bizProduct', 'bizValue', 'bizSource']
const eventPayload = Object.fromEntries(
  outboundFields.map(f => [camelToSnake(f), deal[f]])
)
// + hardcoded src_system="crm", generated id_event/time_*, mapped event_name
```

Reszta systemu (Sortownia, Robot, Adaptery) widzi tylko Event Contract names i nie wie że źródłem był CRM zwany Twenty. Dodanie nowego outbound field = dodaj do `outboundFields` array (jedna linia, no mapping table update).

---

## 3. System prefixów Event Contract

Z dokumentu właściciela:

| Prefix | Znaczenie | Przykłady |
|---|---|---|
| `id_` | Identyfikatory ("numery seryjne") | id_event, id_oid, id_crm_lead, order_id |
| `time_` | Pola czasu | time_occurred_iso_utc, time_occurred_unix_s, time_occurred_unix_us, time_ingested_iso_utc |
| `biz_` | Atrybuty biznesowe | biz_product, biz_value, biz_currency, biz_name, biz_email, biz_phone, biz_model, biz_type, biz_level, biz_authority, biz_message_content |
| `hash_` | Zahashowane PII | hash_email_sha256, hash_phone_sha256 |
| `attr_` | Atrybucja marketingowa | attr_gclid, attr_gbraid, attr_wbraid, attr_fbc, attr_fbp, attr_ga_client_id, attr_utm_*, attr_event_id |
| `ctx_` | Kontekst i zachowanie | ctx_page_url, ctx_referrer, ctx_ip, ctx_user_agent, ctx_time_on_page_ms, ctx_pricing_view, ctx_newsletter_signup |
| `consent_` | Flagi zgody | consent_ad_storage, consent_ad_user_data, consent_ad_personalization, consent_analytics_storage |
| `src_` | Atrybuty źródła systemowego | src_system, src_action_source |
| `sys_` | Metadane systemowe | sys_schema_version |

**Wyjątek bez prefixu:** `event_name` — nadrzędne pole semantyczne, nie ma prefixu (zgodnie ze standardem GA4).

---

## 4. Mapowanie pól: Twenty ↔ Event Contract

### 4.1 Pola które ŻYJĄ w Twenty (translation w webhook)

| Twenty internal | Event Contract | Typ | Komentarz translation |
|---|---|---|---|
| `Person.idOid` | `id_oid` | TEXT (ULID 26 chars) | Deterministic: `camelToSnake('idOid') = 'id_oid'`. Wartość ULID identyczna |
| `Deal.idOid` | `id_oid` | TEXT (ULID 26 chars) | Frozen at creation. Denormalized copy z Person.idOid w momencie tworzenia deala |
| `Deal.id` (Twenty UUID natywne) | `id_crm_lead` | UUID natywne Twenty | Wartość Twenty's record UUID jest semantycznym `id_crm_lead` w Event Contract orkiestracji |
| `Deal.bizProduct` | `biz_product` | SELECT [web/logo/name/marketing] | Deterministic: `camelToSnake('bizProduct') = 'biz_product'` |
| `Deal.bizSource` | `biz_source` | SELECT [form/polecenie/google_ads/inne] | Deterministic: `camelToSnake('bizSource') = 'biz_source'`. Lead acquisition source dla VBO segmentation |
| `Deal.bizValue` | `biz_value` | CURRENCY | Deterministic translation. Tylko dla event `lead_won`. Twenty: kwota wonu deala. |
| (hardcoded "PLN") | `biz_currency` | TEXT | Twenty nie ma multi-currency, wszystkie kwoty PLN. Webhook hardcoded |
| `Person.name.firstName` + `Person.name.lastName` | `biz_name` | TEXT (concatenated) | **NOWE w v0.7.4:** PII w payload Twenty → Sortownia. Concatenation: `${firstName} ${lastName}`.trim(). Resolved przez Twenty workflow Code action z `Deal.pointOfContact` relation |
| `Person.emails.primaryEmail` | `biz_email` | EMAIL | **NOWE w v0.7.4:** PII w payload. Z `Deal.pointOfContact.emails.primaryEmail`. Sortownia używa do hash/normalize w Profile Klienta |
| `Person.phones.primaryPhoneNumber` | `biz_phone` | PHONE | **NOWE w v0.7.4:** PII w payload. Z `Deal.pointOfContact.phones.primaryPhoneNumber`. Może być null jeśli klient nie podał |
| `Deal.lastOrchestrationEventAt` | (NIE w webhookcie) | DateTime | Twenty internal — kiedy ostatnio wysłano event. Audit/debug only |
| `Deal.lastOrchestrationEventId` | (matches `id_event` ostatniego webhooka) | TEXT (ULID) | Twenty internal — last sent id_event dla idempotency tracking |

### 4.2 Pola GENEROWANE w Twenty workflow Code action runtime

Te pola **nie są przechowywane w Twenty schema** — są tworzone na żywo gdy workflow wysyła webhook.

| Event Contract field | Generated value | Logika translation |
|---|---|---|
| `id_event` | UUID v4 (36 chars) | `crypto.randomUUID()` w Code action per webhook (Block B preflight: weryfikacja dostępności w Twenty Code action runtime) |
| `event_name` | "qualify_lead" / "lead_won" / "lead_rejected" | Z mapowania `Deal.stage` (sekcja 6) |
| `src_system` | "crm" (hardcoded) | Stała w Code action — KRYTYCZNE dla loop prevention |
| `time_occurred_iso_utc` | `new Date().toISOString()` | Czas zmiany stage w ISO 8601 UTC |
| `time_occurred_unix_s` | `Math.floor(Date.now() / 1000)` | Konwersja na Unix seconds |
| `time_occurred_unix_us` | `Date.now() * 1000` | Konwersja na Unix microseconds (millisecond precision × 1000) |

**Walidacja czasu:** zgodnie z Event Contract — jeśli `time_occurred_iso_utc > now + 1h` zastąp wartością `now`. Implementacja w Code action.

### 4.3 Pola Event Contract które NIE ŻYJĄ w Twenty

Te pola żyją w **Stape Profile Klienta** lub **Akt Własności** (Stape Store). Twenty ich nie zna. Adaptery w orkiestracji odczytują je przy webhookach do platform (Google/Meta/GA4).

**Atrybucja (`attr_*`) — wszystkie w Stape:**

- `attr_gclid`, `attr_gbraid`, `attr_wbraid` (Google click IDs)
- `attr_fbc`, `attr_fbp` (Meta click IDs)
- `attr_ga_client_id` (GA4 client cookie)
- `attr_utm_source`, `attr_utm_medium`, `attr_utm_campaign`, `attr_utm_content`, `attr_utm_term`
- `attr_event_id` (deduplikacja Meta CAPI z Pixel)

**Kontekst (`ctx_*`) — wszystkie w Stape (web events tylko):**

- `ctx_page_url`, `ctx_referrer`
- `ctx_ip`, `ctx_user_agent`
- `ctx_time_on_page_ms`, `ctx_pricing_view`
- `ctx_newsletter_signup`

CRM events (qualify_lead, lead_won, lead_rejected) **z definicji nie mają kontekstu web** — sprzedawca pracuje w CRM, nie na stronie. Stąd `src_action_source = "system_generated"` (nie "website") dla wszystkich CRM events.

**Hashe PII (`hash_*`) — wszystkie w Stape:**

- `hash_email_sha256`, `hash_phone_sha256`

Stape oblicza w Etapie A (Odbiór Danych), trzyma w Profilu Klienta. Twenty nie haszuje.

**Zgody (`consent_*`) — wszystkie w Stape:**

- `consent_ad_storage`, `consent_ad_user_data`, `consent_ad_personalization`, `consent_analytics_storage`

Consent state żyje w Profilu Klienta. Twenty nie zarządza zgodami (sprzedawca nie ma do tego UI).

**Atrybuty biznesowe poza productLine/wonAmount — w Stape:**

- `biz_name` — Sortownia ma w Profilu Klienta z formularza. Twenty ma `Person.name` ale to nie jest źródło prawdy dla orkiestracji
- `biz_email` — j.w., Sortownia z formularza
- `biz_phone` — j.w.
- `biz_model` (ecommerce/b2b/local/online) — z formularza
- `biz_type` (new/redesign/...) — z formularza
- `biz_level` (basic/premium) — derived przez Stape z pól formularza
- `biz_authority` (owner/assistant) — z formularza
- `biz_message_content` — z formularza

**Powód:** PII i atrybuty biznesowe wpisuje klient w formularzu na owocni.pl. Sortownia przechwytuje, zapisuje w Profil Klienta. Adapter `crm:twenty_create_deal` POST-uje minimum do Twenty (Person.firstName, Person.lastName, Person.emails, Person.phones). Twenty NIE jest source of truth dla tych pól — Stape Profile Klienta jest. Twenty trzyma tylko **operacyjną kopię** dla sprzedawcy.

**Inne:**

- `order_id` — Stape Akt Własności (Google Ads only). Twenty nie generuje, nie wysyła
- `src_action_source` — set przez adapter platforma (Meta) tuż przed wysyłką
- `sys_schema_version` — Stape internal, nie dotyka Twenty

---

## 5. Webhook payload schemas Twenty → Sortownia

Twenty workflow "Outbound Event to Orchestration" emituje 3 typy webhooków. Wszystkie z hardcoded `src_system: "crm"` dla loop prevention.

### 5.1 qualify_lead (Twenty stage `qualified`)

```json
{
  "event_name": "qualify_lead",
  "id_event": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "id_oid": "01HX5T9VKM7P3R2NQABCDEF456",
  "id_crm_lead": "550e8400-e29b-41d4-a716-446655440000",
  "src_system": "crm",
  "time_occurred_iso_utc": "2026-05-04T10:30:01Z",
  "time_occurred_unix_s": 1746374001,
  "time_occurred_unix_us": 1746374001000000,
  "biz_product": "web"
}
```

**Pola:**

- `event_name`: "qualify_lead" (hardcoded dla tego workflow path)
- `id_event`: UUID v4 generated w Code action (`crypto.randomUUID()`)
- `id_oid`: z `Deal.idOid` (frozen)
- `id_crm_lead`: z `Deal.id` (Twenty natywne UUID)
- `src_system`: "crm" (hardcoded)
- `time_*`: 3 formaty czasu, computed runtime
- `biz_product`: z `Deal.bizProduct`

### 5.2 lead_won (Twenty stage `won`)

```json
{
  "event_name": "lead_won",
  "id_event": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "id_oid": "01HX5T9VKM7P3R2NQABCDEF456",
  "id_crm_lead": "550e8400-e29b-41d4-a716-446655440000",
  "src_system": "crm",
  "time_occurred_iso_utc": "2026-05-04T10:30:01Z",
  "time_occurred_unix_s": 1746374001,
  "time_occurred_unix_us": 1746374001000000,
  "biz_product": "web",
  "biz_value": 25000,
  "biz_currency": "PLN"
}
```

**Dodatkowe pola dla lead_won:**

- `biz_value`: z `Deal.bizValue` (literalnie, kwota faktury)
- `biz_currency`: "PLN" (hardcoded)

**Uwaga nazewnictwa (revised v0.7.4):** Event Contract orkiestracji as-is używa `lead_won` (NIE GA4 standard `purchase` ani `closed_won`). Twenty internal stage to `won`, ale event_name w webhooku to `lead_won`. Decyzja v0.7.4 oparta na dokumencie SSOT orkiestracji — honor as-is, nawet jeśli `lead_won` nie jest w GA4 standard recommended events. (W GA4 standard byłby `close_convert_lead`, ale dokument orkiestracji explicit mówi `lead_won` — refactor na GA4 standard jest osobny project).

### 5.3 lead_rejected (Twenty stage `lost`)

```json
{
  "event_name": "lead_rejected",
  "id_event": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "id_oid": "01HX5T9VKM7P3R2NQABCDEF456",
  "id_crm_lead": "550e8400-e29b-41d4-a716-446655440000",
  "src_system": "crm",
  "time_occurred_iso_utc": "2026-05-04T10:30:01Z",
  "time_occurred_unix_s": 1746374001,
  "time_occurred_unix_us": 1746374001000000,
  "biz_product": "web"
}
```

**Pola:** identyczne jak qualify_lead, różni się tylko `event_name`.

**Uwaga `lostReason`:** Twenty ma `Deal.lostReason` jako kategoria A field (sprzedawca wpisuje powód), ale Event Contract dla `lead_rejected` NIE ma dedykowanego pola na reason. Zgodnie z dokumentem: `lead_rejected` to "totalnie nie nasz target — nie chcemy tego typu zapytań" — orkiestracja traktuje wszystkie odrzucone tak samo (downgrade do 0.01 zł). `lostReason` żyje tylko w Twenty dla wewnętrznej analizy biznesowej (Lost Reason Distribution metric, Dashboard 2).

---

## 6. Mapowanie event_name (Twenty stage → Event Contract)

| Twenty `Deal.stage` | Event Contract `event_name` | Czy emitujemy webhook? |
|---|---|---|
| `new` | — | NIE (wewnętrzne dla CRM) |
| `contacted` | — | NIE (wewnętrzne) |
| `qualified` | `qualify_lead` | TAK |
| `proposal` | — | NIE (wewnętrzne, oferta wysłana ale brak konwersji) |
| `won` | **`lead_won`** | TAK (z biz_value, biz_currency) |
| `lost` | **`lead_rejected`** | TAK |

**Uwaga 1:** `generate_lead` NIE jest emitowane przez Twenty. To zdarzenie powstaje w Sortowni gdy formularz przychodzi. Twenty tworzy się gdy adapter `crm:twenty_create_deal` POST-uje do Twenty REST API — to jest **konsekwencja** generate_lead, nie generate_lead samo w sobie.

**Uwaga 2 (revised v0.7.4):** Twenty stage `won` mapuje się na `lead_won` (zgodnie z dokumentem SSOT orkiestracji as-is, NIE GA4 standard `purchase`). To jest **różnica nomenklatury** — Twenty UI pokazuje "won" (sprzedawca rozumie), webhook wysyła "lead_won" (orkiestracja rozumie).

**Uwaga 3 (revised v0.7.4):** Twenty stage `lost` zawsze mapuje się na `lead_rejected`. Nie ma 3 wariantów (lost po new vs lost po proposal). Z dokumentu orkiestracji: tylko 3 eventy CRM istnieją (qualify_lead, lead_won, lead_rejected). Konsekwencja: `Deal.lostReason` w Twenty służy tylko wewnętrznej analizie biznesowej, nie wpływa na orkiestrację.

---

## 7. Translation rules (Twenty workflow Code action)

Translation odbywa się w Twenty workflow "Outbound Event to Orchestration" w **jednym Code action** (lub jednym workflow z conditional branching per stage).

**Pseudokod Code action:**

```javascript
// Input: deal record + previous stage value
const deal = $input.deal;
const prevStage = $input.previousStage;

// Map stage to event_name (revised v0.7.4 — match Bitrix-era orchestration nomenclature)
const eventNameMap = {
  'qualified': 'qualify_lead',
  'won': 'lead_won',
  'lost': 'lead_rejected'
};

const eventName = eventNameMap[deal.stage];
if (!eventName) {
  // No event for new/contacted/proposal — skip webhook
  return { skip: true };
}

// Skip if oid is null (manual lead edge case)
if (!deal.idOid) {
  // Log warning, but don't fail
  return { skip: true, reason: 'no_oid' };
}

// Generate id_event UUID v4 (revised v0.7.4 — was ULID, changed for compat with Bitrix-era flow)
const idEvent = crypto.randomUUID(); // standard Web Crypto API

// Resolve Person record (linked to Deal via Twenty relation)
// REVISED v0.7.4: PII is included in payload (was excluded in v0.7.3 — corrected based on
// SSOT contract of orchestration, which expects full payload for src_system=crm too;
// loop prevention is enforced by adapter, not by missing PII)
const person = deal.pointOfContact || {};

// Build base payload (deterministic camelToSnake() for outbound fields with prefix)
const camelToSnake = s => s.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
const outboundFields = ['idOid', 'bizProduct', 'bizSource'];
const businessFields = Object.fromEntries(
  outboundFields.map(f => [camelToSnake(f), deal[f]])
);

const now = new Date();
const payload = {
  // Core identifiers
  event_name: eventName,
  id_event: idEvent,
  id_crm_lead: deal.id,
  src_system: 'crm',
  
  // Time fields
  time_occurred_iso_utc: now.toISOString(),
  time_occurred_unix_s: Math.floor(now.getTime() / 1000),
  time_occurred_unix_us: now.getTime() * 1000,
  
  // Business attributes (deterministic from Twenty schema)
  ...businessFields,
  
  // PII fields (revised v0.7.4 — included in payload per SSOT contract)
  biz_name: person.name ? `${person.name.firstName || ''} ${person.name.lastName || ''}`.trim() : null,
  biz_email: person.emails?.primaryEmail || null,
  biz_phone: person.phones?.primaryPhoneNumber || null
};

// Add lead_won-specific fields (was 'purchase' in v0.7.3 — revised to 'lead_won' v0.7.4)
if (eventName === 'lead_won') {
  payload.biz_value = deal.bizValue;
  payload.biz_currency = 'PLN';
}

return { payload, idEvent };
```

**Workflow flow:**

```
Trigger: Record Updated on Deal
Filter: stage in (qualified, won, lost) AND stage != prevStage
  ↓
Code action: build payload (powyżej)
  ↓
Filter: skip if payload.skip
  ↓
HTTP Request action:
  URL: <Sortownia webhook URL>?token=<32-char-token>
  Method: POST
  Headers: Content-Type: application/json
  Body: payload
  ↓
Update Record:
  Deal.lastOrchestrationEventAt = now
  Deal.lastOrchestrationEventId = idEvent
```

**ULID generation w Twenty Code action:** wymaga sprawdzenia w preflight (Block B). Jeśli Code action nie ma natywnej biblioteki ULID, fallback to UUID v4 (spójne z formatem ID — 36 chars, ale walidacja w Sortowni musi to zaakceptować).

---

## 8. Edge cases

### 8.1 Manual lead w Twenty UI (Deal.idOid = null)

Sprzedawca tworzy deal manualnie (lead z polecenia, telefon) bez touchpointu z formularza. `Person.idOid = null`, `Deal.idOid = null`.

**Zachowanie webhook:** Code action sprawdza `if (!deal.idOid)` i **skip**. Webhook nie wysyła. Deal istnieje w Twenty normalnie (sprzedaż, raporty, audit), ale nie uczestniczy w VBB/VBO orkiestracji.

**To jest świadome ograniczenie architektury, nie bug.** Manual leads nie są paid leads, więc nie ma czego attributować do platform.

### 8.2 Idempotency

- `id_event` jest ULID generowany per webhook attempt (NIE per stage change)
- Sortownia używa `id_event` jako idempotency key — duplicate id_event ignored
- Jeśli Twenty workflow retry'uje webhook z powodu network error, **nowy id_event** jest generowany — Sortownia widzi to jako 2 oddzielne attempts
- Dla rzeczywistej idempotency: Sortownia powinna używać kombinacji `(id_oid, event_name, time_occurred_unix_s)` jako wtórny idempotency key gdy id_event się różni

**Decision pending właściciela:** czy Sortownia ma deduplication logic na `(id_oid, event_name)` w oknie 5 min, czy każdy webhook jest unique?

### 8.3 Retry policy

- Twenty workflow HTTP Request action: 3 attempts native retry z exponential backoff
- Po 3 nieudanych: workflow **fails**, ale nie aktualizuje `Deal.lastOrchestrationEventAt`
- Health Check Dashboard 3 (Stale Deals C-section) wykrywa: `Deal.stage in (qualified, won, lost) AND lastOrchestrationEventAt is null OR > 5 min after stage change`
- Manual investigation przez właściciela

**Brak Ratownika po stronie Twenty** — Twenty polega na Health Check Dashboard. Ratownik (Stape Worker monitor) wykrywa failed adapters po stronie orkiestracji, nie webhook delivery problems do Sortowni.

### 8.4 generate_lead NIE jest emitowane przez Twenty

`generate_lead` powstaje w Sortowni przy form submit lub Meta IF webhook. Sortownia mintuje `id_oid`, tworzy Profile Klienta, routing dla `generate_lead` → adapter `crm:twenty_create_deal` → POST do Twenty REST API.

W tym momencie Twenty Deal jest tworzony, ale generate_lead już został wysłany do platform przez Sortownię. Twenty NIE emituje generate_lead — to byłoby duplikatem.

**Twenty's first emission:** qualify_lead (gdy sprzedawca przesuwa stage z `contacted/new` → `qualified`).

### 8.5 Loop prevention safeguarding

Twenty webhook ZAWSZE ma `src_system: "crm"` w payload.

Adapter `crm:twenty_create_deal` w Sortowni sprawdza w pierwszym kroku: `if (src_system == "crm") → status="skipped_loop_prevention"`.

Bez tego safeguard'u Sortownia mogłaby zinterpretować qualify_lead z Twenty i routing odpowiednio włączyłby `crm:twenty_create_deal` → tworzy NOWY Deal w Twenty → infinite loop.

**Hardcoded src_system="crm" w Twenty Code action jest krytycznym bezpiecznikiem.**

### 8.6 Korekta wsteczna w Twenty

Sprzedawca może wycofać stage (np. `won` → `proposal` z powodu cancellacji). Twenty workflow Record Updated trigger wykryje zmianę stage.

**Pytanie:** czy Twenty emituje "reverse" event do orkiestracji?

**Odpowiedź:** NIE. Event Contract orkiestracji zna 3 sygnały (qualify_lead, lead_won, lead_rejected) — nie ma "reverse" ani "cancel". Adapter w orkiestracji `RESTATE` może nadpisać wartość, ale Twenty nie wie jak to zrobić.

**Workflow filter:** `stage in (qualified, won, lost) AND stage != previousStage` — filtruje TYLKO przejścia DO tych stages. Przejścia OD (np. won → proposal) nie aktywują webhook.

**Konsekwencja:** jeśli sprzedawca cofnie stage z won → proposal, **orkiestracja o tym nie wie**. Google Ads pamięta lead_won event (które adapter zmapował na lokalną platform-specific conversion event), nie zostanie wycofane. To jest świadome ograniczenie — manualna korekta po stronie orkiestracji wymagana w edge cases.

**Edge case mitygacja:** w `INCIDENT_NOTES.md` notatka "co zrobić gdy cofamy won" — manual signal do właściciela żeby zaktualizował Akt Własności w Stape.

### 8.7 Walidacja czasu (time skew)

Z Event Contract: "jeśli `time_occurred_iso_utc > now + 1h` – zastąp wartością `now`; jeśli `< now − 7 dni` – oznacz `_meta.stale_event=true`".

W Twenty workflow Code action computed `now` jest zawsze "current". Skew nie powinien wystąpić w normalnym flow. Edge case: workflow opóźniony (np. n8n queue stuck 1+ godzina).

**Decision:** Twenty workflow generuje time_* w momencie HTTP Request, nie w momencie stage change. Gdyby workflow był opóźniony, time_occurred byłby aktualny (czyli nieprawdziwy). To jest akceptowalne dla CRM events (nie web events) bo orkiestracja używa biz events offline.

---

## 9. Konsekwencje dla migracji Bitrix → Twenty

### 9.1 Adapter rename

W Sortowni:

- Stary: `crm:bitrix_create_lead`
- Nowy: `crm:twenty_create_deal`

Logika identyczna (loop prevention, idempotency, mapowanie pól), ale:

- Endpoint: Twenty REST API zamiast Bitrix REST API
- Auth: Twenty API key zamiast Bitrix webhook URL
- Idempotency: `external_id = id_oid` (Twenty ma mechanism dla custom UUIDs przy create — sprawdzić w preflight)
- Field mapping (sekcja 9.2 niżej)

### 9.2 Mapowanie pól adaptera (Sortownia → Twenty REST API)

Adapter `crm:twenty_create_deal` przy generate_lead POST-uje do Twenty:

| Source (Sortownia payload) | Twenty REST API target |
|---|---|
| `id_oid` | `Person.idOid` + `Deal.idOid` (oba fields) |
| `id_event` (od Sortowni) | (nie zapisywane — to id_event generate_lead, nie webhookowy) |
| `event_name = "generate_lead"` | (nie zapisywane — adapter wie że robi create) |
| `src_system` | (nie zapisywane — Twenty internal) |
| `biz_name` (jeśli !=null) | `Person.name` (split na firstName/lastName przez Twenty) |
| `biz_email` | `Person.emails[0]` |
| `biz_phone` | `Person.phones[0]` |
| `biz_product` | `Deal.bizProduct` |
| `biz_message_content` | `Deal.description` (lub Deal.notes — standard Twenty field) |
| `biz_model`, `biz_type`, `biz_level`, `biz_authority` | NIE zapisywane w Twenty (żyją w Stape) |
| `attr_*`, `ctx_*`, `hash_*`, `consent_*` | NIE zapisywane w Twenty |
| `time_occurred_iso_utc` | `Deal.createdAt` (Twenty ustawia automatycznie, ale można override) |

Adapter ustawia także:

- `Deal.stage = "new"` (default Twenty)
- `Deal.amount = null` (sprzedawca wpisze później)
- `Deal.owner = <round-robin assignment>` (do uzgodnienia: czy adapter w Sortowni przypisuje ownera, czy Twenty robi to przez własny workflow przy stage=new)

### 9.3 Migracja historycznych danych Bitrix → Twenty

**Zasada:** migracja jest po stronie Stape, NIE Twenty.

- Wszystkie historyczne Profile Klienta w Stape mają `id_crm_lead = bitrix_lead_X`
- Skrypt migracyjny (jednorazowy):
  1. Eksport historycznych deali z Bitrix
  2. Import do Twenty przez REST API (każdy dostaje nowy Twenty UUID)
  3. Update Profile Klienta w Stape: `id_crm_lead` change z `bitrix_X` na `twenty_UUID`
  4. id_oid pozostaje nietknięte (był od początku w Stape)
- Twenty nie wie nic o starym Bitrixie. Nie ma `legacyBitrixId` field. Migracja jest niewidoczna z perspektywy Twenty schema

**Edge case:** historyczne deale z Bitrixa które Twenty importuje, otrzymują `Deal.idOid` z Profil Klienta jeśli istnieje. Jeśli historyczny lead nie ma id_oid (sprzed orkiestracji v1), `Deal.idOid = null` i deal istnieje out-of-band (sekcja 8.1).

---

## 10. Walidacje na granicy CRM ↔ orkiestracja

### 10.1 Po stronie Twenty (przed wysyłką webhook)

- **id_oid format:** `Deal.idOid` musi być ULID (26 chars, Base32 Crockford). Walidacja regex w Twenty field settings + sprawdzenie w Code action przed POST
- **stage transition:** workflow filter sprawdza `stage in (qualified, won, lost) AND stage != previousStage`. Bez tego workflow odpalałby przy każdym update Deal'a
- **biz_value > 0** dla event `lead_won`: jeśli `Deal.bizValue` null lub 0 przy stage=won, **fail workflow** (sprzedawca musiał uzupełnić — ADR-007 conditional required)
- **time skew check** (sekcja 8.7)

### 10.2 Po stronie Sortowni (przed processing)

- **src_system check:** if `src_system == "crm"` → loop prevention dla adapter `crm:twenty_create_deal`
- **id_oid existence:** Sortownia sprawdza czy `id_oid` istnieje w Profile Klienta. Jeśli nie, error (Twenty nie powinien wysłać webhook bez znanego oid)
- **id_event uniqueness:** Sortownia sprawdza czy `id_event` jest unique w oknie 24h. Duplicate → success_idempotent (nie processuje ponownie)
- **time_occurred ranges:** zgodnie z Event Contract (Meta <62 dni, Google <55 dni, GA4 <72h). Outside range → log + degraded handling

### 10.3 Po stronie adapterów (przed wysyłką do platform)

- **consent_* gate:** każdy adapter sprawdza odpowiednie consent (consent_ad_user_data dla Google EC, consent_meta_allowed dla Meta CAPI, consent_analytics_storage dla GA4 MP)
- **PII normalization:** email lowercase+trim, phone E.164. Twenty NIE robi tego (Stape responsibility)
- **Hashing:** SHA-256 hex lowercase. Twenty NIE liczy.

---

## 11. Open questions

| # | Pytanie | Status |
|---|---|---|
| 1 | Czy Twenty Code action obsługuje natywną generację UUID v4? | Walidacja w preflight Block B. Fallback: UUID v4 |
| 2 | Czy Twenty REST API obsługuje custom UUID przy create record (dla idempotency external_id = id_oid)? | Walidacja w preflight Block B. Fallback: Twenty generuje UUID, adapter `crm:twenty_create_deal` zwraca do Sortowni nowy UUID jako `id_crm_lead` w Profile Klienta |
| 3 | Czy adapter w Sortowni przypisuje Twenty owner (round-robin), czy Twenty robi to własnym workflow? | Decyzja właściciela. Rekomendacja: Twenty workflow przy stage=new (workflow Record Created on Deal), bo round-robin logic to zmienna business logic która powinna żyć w Twenty (CRM job) |
| 4 | Sortownia deduplication na `(id_oid, event_name)` w oknie 5 min? | Decyzja właściciela. Rekomendacja: tak, dla obrony przed Twenty workflow retry race conditions |
| 5 | Edge case korekta wsteczna w Twenty (won → proposal) — jak to rozwiązać manual w orkiestracji? | INCIDENT_NOTES.md notatka, manual reconcile przez właściciela |

---

## 12. Changelog

**v1.0 (2026-05-04):** Pierwsza wersja dokumentu. SSOT nazewnictwa Twenty CRM ↔ orkiestracja Stape. Synchronizowane z Event Contract orkiestracji (dokument właściciela "Fundamenty orkiestracji II.2") + Twenty architektura v0.7.2 + CRM domain spec adaptera.

---

**Filozofia:** *Twenty jest CRM-em, orkiestracja jest layer'em atrybucji. Każde z nich ma własne idiomy. Translation jest świadomym, kontrolowanym kosztem za clean separation of concerns.*

Translation reguły są **w jednym miejscu** (Twenty workflow Code action). Bez rozproszonych "magic strings". Bez naruszenia bus factor = 1 — właściciel widzi cały mapping w jednym miejscu, jedna lokalizacja do debug.

---

## 8. Biz Message Content Mapping (NOWE w v0.7.4)

### 8.1 Kontekst

`biz_message_content` to treść pierwszej wiadomości od klienta z formularza na owocni.pl. To **podstawa komunikacji** — sprzedawca otwierając Deal w Twenty MUSI od razu widzieć co klient napisał. Bitrix-era flow zapisywał to do `COMMENTS` field na Lead (single string field, no formatting, no timeline integration). **Twenty 2.0 ma lepsze rozwiązanie natywnie:** `Note` entity z `noteTargets[]` array dla multi-target relations (Opportunity + Person).

### 8.2 Mapping flow

```
biz_message_content (z Sortowni → adapter)
  ↓
adapter `crm:twenty_create_deal` Step 4:
  POST /rest/notes
  ↓
Twenty Note {
  title: "Pierwsza wiadomość — [biz_product]",
  body: biz_message_content,
  noteTargets: [
    { opportunityId: <newly created Deal id> },
    { personId: <Person id (linked to Deal)> }
  ]
}
```

Sortownia (Custom Code w sGTM) odczytuje treść z payload formularza. Fallback chain (zgodnie z dokumentem orkiestracji): `biz_message_content` → `biz_message` → `message` → `description`. Adapter może otrzymać pole pod różnymi nazwami i normalizes.

### 8.3 Obsługa pustego biz_message_content

Jeśli klient nie wpisał treści wiadomości (puste pole formularza, edge case), adapter **NIE tworzy Note** (skip Step 4). Brak Note jest acceptable — sprzedawca widzi Deal bez treści, ale ma wszystkie inne dane (Person, Company, biz_product, biz_source).

### 8.4 UI w Twenty po stronie sprzedawcy

Sprzedawca otwiera nowy Deal w Twenty UI → widzi w timeline natywne:

```
┌─ Note ────────────────────────────────────────┐
│ Pierwsza wiadomość — Strona internetowa       │
│                                                │
│ Cześć, potrzebuję strony dla mojego biznesu... │
│ [pełna treść z formularza]                    │
│                                                │
│ Linked: Jan Kowalski • OWOCNI Sp. z o.o.      │
│ 5 minutes ago                                  │
└────────────────────────────────────────────────┘
```

Note jest też dostępna z Person record — sprzedawca otwierając Person widzi historię wszystkich Note linked z tym kontaktem.

### 8.5 Co NIE jest wysyłane jako biz_message_content

`biz_message_content` jest zarezerwowany dla **pierwszej wiadomości z formularza generate_lead**. NIE używamy go dla:

- Notes ręcznie dodawanych przez sprzedawcę w Twenty (CRM-internal, nie wraca do orkiestracji)
- Email body z syncowanej skrzynki IMAP (osobny flow, Twenty natywny)
- Treści SMS/calls (osobne Activity types)
- Follow-up draft AI-generated (Follow-up Architecture, osobny flow)

Wyłącznie pierwszy kontekst komunikacji z formularza.

### 8.6 Twenty 2.0 advantages vs Bitrix-era flow

| Aspekt | Bitrix-era (COMMENTS field) | Twenty 2.0 (Note entity) |
|---|---|---|
| Storage | Single string field na Lead | Pełna entity z relations |
| Formatting | Plain text | Rich text / Markdown supported |
| Timeline integration | Manual UI rendering | Native timeline w Person + Deal |
| Multi-target | Not supported | `noteTargets[]` array |
| Attachments | Not supported | Supported |
| Search | Limited | Full-text search natywnie |
| API access | `Lead.COMMENTS` field GET | `/rest/notes` z filters/relations |

**Twenty 2.0 robi to LEPIEJ niż Bitrix.** Migracja przynosi **uplift functionality**, nie regression.

### 8.7 Loop prevention dla Note

Note jest CRM-internal. **NIE jest re-emitowany** do orkiestracji jako event (np. brak `note_created` event_name). Konsekwencja: 
- Sprzedawca dodający manual Note → nic nie leci do Sortowni (correct, CRM-internal action)
- Adapter `crm:twenty_create_deal` Step 4 tworzący Note z biz_message_content → nic nie leci do Sortowni (correct, internal data persistence)
- Konstytucja punkt 13: Note jest po stronie CRM granicy, NIE narusza CRM ↔ orkiestracja boundary

