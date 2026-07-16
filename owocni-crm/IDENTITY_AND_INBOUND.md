---
doc_id: IDENTITY_AND_INBOUND
title: "IDENTITY_AND_INBOUND — tożsamość klienta (id_oid) i kanały wejścia"
layer: core_ssot
status: active
edit_scope: structure_only
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-06-08
recheck_trigger: "Twenty release (merge/email sync) / zmiana resolvera / preflight Stape"
default_trust: D:CORE
related:
  - DATA_MODEL
  - EVENT_CONTRACT
  - CRM_CONSTITUTION
  - runbooks/IMPLEMENTATION_PLAN
---

# IDENTITY_AND_INBOUND — tożsamość i wejście leadów

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** Resolver tożsamości T1–T5; macierz decyzyjna email × phone (2D); zamknięta lista kanałów wejścia; `id_oid` jako jedyne źródło prawdy o tożsamości (Stape master, Twenty projekcja); VBB gate; kiedy człowiek rozstrzyga konflikt (T4/T5); reguły procesowe; słownik tożsamości.

**Ten plik NIE decyduje o:** mapowaniu eventów (→ `EVENT_CONTRACT.md`); polach Twenty (→ `DATA_MODEL.md`); backlogu implementacji (→ `runbooks/IMPLEMENTATION_PLAN.md`); granicach systemów (→ `ARCHITECTURE.md`).

**Zawsze czytaj razem z:** `EVENT_CONTRACT.md` (loop-prevention, generate_lead), `DATA_MODEL.md` (`idOid`), `CRM_CONSTITUTION.md` (INV-7 fail-closed).

**Najgroźniejszy błąd:** agresywne skrócenie gubi logikę T1–T5 i waterfall free-mail — albo **auto-merge** zamiast propozycji (§5.9); 3 bramki techniczne G8 nadal `[D:OPEN]`.

**Przy konflikcie:** tożsamość/kanał — ten plik jest właścicielem. Pole `idOid` (typ/frozen) → `DATA_MODEL.md`.

**Zmiana wymaga:** ADR dla reguł tożsamości (T1–T5, fail-closed, merge). **Blokuje cutover:** ADR #12, ADR #13.

---

## 1. NEGATIVE RULES (reguły tożsamości — NIE skracać, NIE backlog)

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | NIE skracać T1–T5, zamkniętej listy kanałów, `kontakt@` jako świadomie nieobsługiwanego, VBB gate, T4/T5 human review. | To reguły tożsamości, nie backlog. | Utrata logiki resolvera = błędne sklejanie/rozdwojenie tożsamości. | Właściciel + ADR | tu |
| NR-2 | **GA = sygnał, NIE klucz tożsamości** — nie wolno mintować `id_oid` z GA; GA nie wchodzi do macierzy jako trzecia oś. | `ga_client_id` identyfikuje przeglądarkę, nie osobę (współdzielony, czyszczony, gubiony). | Fałszywe sklejenie/rozdwojenie tożsamości. | Właściciel + ADR | §4 |
| NR-3 | Dwa maile tego samego nadawcy NIE mogą stworzyć dwóch `id_oid` (concurrency mint-guard). | Race przy równoległym mincie. | Duplikat tożsamości. | Właściciel + ADR | §8 |
| NR-4 | **Stape Store niedostępny podczas resolve → fail-closed (NIE mintuj, kolejkuj).** | Fail-open = duplikat `id_oid` = rozdwojenie tożsamości (nieodwracalne). Reguła o skutku tożsamościowym, nie parametr runtime. | Jeden klient, dwa profile, zepsuta atrybucja. | Właściciel + ADR | CRM_CONSTITUTION INV-7 |
| NR-5 | **NIGDY auto-merge tożsamości.** System **nie scala** sam — może **proponować** merge handlowcowi, gdy `company_domain_key` wskazuje tę samą firmę (corporate mail). **NIGDY** propozycji merge dla free-mail (waterfall §5.8.2). Wykonanie merge = **ręczne** w Twenty (T4) + aktualizacja Stape. | Auto-merge = nieodwracalne sklejenie; free-mail = fałszywe propozycje. | Sklejone tożsamości / utrata leadów firmowych. | Właściciel + ADR | §5.9, §5.8.2 |
| NR-6 | **Dwa paid `id_oid` → T5, ręczna korekta, NIGDY auto.** | Sygnał do platform z dwóch paid profili = nieodwracalny. | Błędna atrybucja platform. | Właściciel + ADR | §11, §3 (T5) |

---

## 2. PURPOSE

Master identity systemu: `id_oid` w Stape (Profil Klienta) jest jedynym źródłem prawdy o tym, kim jest klient — niezależnie od kanału wejścia. To, czego Twenty nie zrobi (brak identity graph / CDP). Wersja 2026-05-29. **Platforma:** Twenty CLOUD + Stape (Sortownia / Identity Resolver / Robot).

---

## 3. SCOPE

### Pokrywa
- Resolver T1–T5, macierz email × phone, zamknięta lista kanałów, VBB gate, human review (T4/T5), reguły procesowe §11, słownik §13.
- Stan tożsamości po stronie Stape (master) i Twenty (projekcja).

### Nie pokrywa
- Mapowania eventów (→ `EVENT_CONTRACT.md`), pól Twenty (→ `DATA_MODEL.md`), backlogu implementacji (→ `runbooks/IMPLEMENTATION_PLAN.md`).

---

## 4. CANONICAL DEFINITIONS

- **`id_oid`** = kanoniczny identyfikator klienta w Stape (ULID); jedyne źródło prawdy o tożsamości.
- **Twenty = projekcja** (widok handlowca) — NIE rozstrzyga tożsamości samodzielnie (brak identity graph).
- **Rekord ≠ id_oid** — rekord w Twenty może istnieć bez `id_oid`: stan jawny `identity_status: needs_review` lub `unresolved` (nazwany stan, nie czarna dziura).
- **Automat vs człowiek:** automat robi wszystko deterministyczne (T1–T3 link/mint po **tym samym emailu/telefonie**); człowiek przy ≥2 interpretacjach (T4) **oraz** przy **propozycji merge firmowego** (ten sam `company_domain_key`, różne osoby — np. asystent + szef). **NIGDY** auto-merge; **NIGDY** propozycji merge na free-mail. Merge w UI = decyzja handlowca/admina.

---

## 5. BODY

### 5.1 Architektura warstw

```
╔══════════════════════════════════════════════════════════════════╗
║  WARSTWA TOŻSAMOŚCI — Stape / Profil Klienta (MASTER)           ║
║  id_oid (canonical) · identity_status · vbb_eligible             ║
║  wskaźniki: by_email · by_phone · by_ga · by_crm_lead          ║
╚══════════════════════════════════════════════════════════════════╝
         ▲                              ▲
         │ paid (automat)               │ nie-paid (resolver T1–T5)
         │                              │ + człowiek (T4/T5)
   ┌─────┴──────────┐            ┌──────┴───────────────────────┐
   │  SORTOWNIA     │            │  IDENTITY RESOLVER            │
   │  Etap A (paid) │            │  (webhook Twenty → Stape)     │
   │  oid_init      │            │  auto_link · auto_mint · flag │
   │  generate_lead │            └──────▲───────────────────────┘
   └─────▲──────────┘                   │
         │                        ┌─────┴──────────┐
   formularz paid                 │  TWENTY         │
   (web + click-ID)               │  Email Sync     │
                                  │  ręczny telefon │
                                  │  merge UI (T4)  │
                                  └────────────────┘
```

**Przepływ prawdy:** zawsze **ku górze** (Twenty → Stape). Nigdy Stape nie pyta Twenty „kim jest klient".

### 5.2 Identity Resolver — poziomy pewności T1–T5

| Tier | Kod | Warunek | Akcja | `identity_status` | VBB |
|------|-----|---------|-------|-------------------|-----|
| **T1** | `auto_link` | Email **lub** phone trafia w **dokładnie 1** `id_oid` | Przypisz istniejący `id_oid` + wskaźnik | `verified` | wg profilu |
| **T2** | `auto_link_strong` | Email **i** phone trafiają w **ten sam** `id_oid` | Jak T1 + log strong match | `verified` | wg profilu |
| **T3** | `auto_mint` | Brak trafienia email **i** brak trafienia phone (po normalizacji) | Nowy ULID `id_oid` + wskaźniki | `verified` | `false` do paid touch |
| **T4** | `needs_review` | Email → profil A, phone → profil B **lub** ≥2 kandydatów | **Nie** łącz; flaga w Twenty; kolejka | `needs_review` | **off** |
| **T5** | `merge_review_critical` | Łączenie dotyka **dwóch paid** `id_oid` z sygnałem do platform | Blokada auto; tylko admin | `needs_review` | **off** |

**Reguła złota:** auto tylko przy **0 lub 1** kandydacie. Przy 2+ → **T4**, bez wyjątków.

**Trigger resolvera:** webhook Twenty (event `created` / `updated` — konkretna nazwa eventu webhooka Twenty → `ops/OPS_NOTES.md`, recheck na instancji) **oraz** ręczny zapis pól email/phone w Twenty. Resolver rozstrzyga po email/phone; `ga_client_id` NIE jest triggerem rozstrzygania tożsamości (sygnał atrybucji — patrz §5.3 „Rola GA").

### 5.3 Macierz decyzyjna (email × phone)

Po normalizacji (`normalize_email` §5.8.1, `normalizePhone` E.164 — ta sama logika co w Sortowni).

**Klucze rozstrzygające tożsamość: WYŁĄCZNIE email i phone.** Macierz jest świadomie dwuwymiarowa. `ga_client_id` NIE jest kluczem — patrz nota „Rola GA".

| Trafienie email w Stape | Trafienie phone w Stape | Wynik |
|---|---|---|
| 0 | 0 | **T3** auto_mint |
| 1 | 0 | **T1** auto_link |
| 0 | 1 | **T1** auto_link |
| 1 | 1, **ten sam** id_oid | **T2** auto_link_strong |
| 1 | 1, **różne** id_oid | **T4** needs_review |
| 2+ | * | **T4** + alert techniczny (duplikat wskaźników) |

#### Rola GA client_id (degradacja — NIE klucz tożsamości)

`ga_client_id` identyfikuje **przeglądarkę**, nie osobę: bywa współdzielony, czyszczony (nowe cookie = nowy client_id dla tej samej osoby), gubiony. Dlatego:
- **GA nigdy nie rozstrzyga tożsamości samodzielnie** — nie wchodzi do macierzy jako trzecia oś.
- **GA wolno użyć WYŁĄCZNIE jako sygnał potwierdzający** już ustalone dopasowanie po email/phone (np. „email trafia w A, GA tego samego zdarzenia też wskazuje A" → wzmocnienie + log; samo GA→A bez email/phone NIE wystarcza do auto_link).
- **GA→profil C przy email→A, phone→B:** GA się **ignoruje** dla rozstrzygnięcia; decyduje wyłącznie kolizja email vs phone (tu: różne → **T4**). GA zostaje zapisany pod `id_oid` jako atrybut atrybucji, ale nie jest głosem w rozstrzyganiu.
- Powód: `ga_client_id` (jak `attr_gclid`, `attr_fbc`, `lead_id`) jest zapisywany **pod** `id_oid` w Profilu — jest własnością już-ustalonej tożsamości, nie jej źródłem.

**Nie automatyzujemy:** ten sam telefon, dwa różne maile (Jan vs Anna) → T4; adresy generyczne (`kontakt@`, `biuro@`) → T4 lub link do **Company**, nie Person; phone wyciągnięty regexem z treści maila → ignoruj; dopasowanie tylko po imieniu/firmie → nigdy.

### 5.4 Kanały wejścia — zamknięta lista

| Kanał | Pierwszy obserwator (docelowo) | id_oid | Resolver |
|---|---|---|---|
| Formularz **paid** (web, gclid/fbc) | Sortownia (real-time) | **automat** (Sortownia) | Nie dotyka — paid path |
| Formularz **nie-paid** / organic | Sortownia `generate_lead` jeśli event jest | automat jeśli event | T1–T3 jeśli przez Twenty |
| Mail → **`leads@`** | Twenty Email Sync | Resolver T1–T4 | T3 dla nowego nadawcy |
| Mail → **`studio@`** | Twenty Email Sync | Resolver | T3/T4 |
| Mail → **skrzynki handlowców** (`marta@`, `gosia@`, `mariusz@`, `copywriting@`, `pomoc@`) | Twenty Email Sync (Etap 1.2) | Resolver | T3/T4 |
| Mail → **`kontakt@`** | **NIE obsługiwana** | — | Kanał-sierota: skrzynka istnieje, spam w backlogu; **bez** Email Sync i **bez** leadów w Twenty |
| **Telefon** | Handlowiec (Twenty) | Po zapisie numeru → resolver | T1–T4 |
| Polecenie / ręczne dodanie | Handlowiec | Po zapisie PII → resolver | T1–T3 typowo |

#### Legacy (julia362) — do wyłączenia

| Fakt | Wartość |
|---|---|
| Serwer | `julia362.mikrus.xyz`, `app2.js` |
| Nasłuch IMAP (7 skrzynek) | `copywriting@`, `pomoc@`, `studio@`, `marta@`, `gosia@`, `mariusz@`, `leads@` |
| **Auto-tworzenie NOWEGO leada** | Tylko **`leads@` + INBOX** (better-bitrix + GPT) |
| **`kontakt@`** | **Nie** na liście watchera; **osobna skrzynka** (patrz §5.5) |
| Wyłączenie | Po ADR #12/#13 + Email Sync + Resolver działają (`runbooks/IMPLEMENTATION_PLAN.md`) |

### 5.5 Decyzje planowe — mail (2026-05-28, role)

**Status:** zamknięte na poziomie planu. **Owner techniczny (wdrożenie):** **Dawid**. **Mariusz i Krzysztof** — przełożeni; uzgodnienia biznesowe/architektoniczne, nie wykonawcy.

**`kontakt@owocni.pl` — nie obsługujemy:** skrzynka istnieje (osobna, bez przekierowania); backlog = spam od miesięcy (nie importujemy, nie tworzymy leadów); julia362 nie nasłuchuje; Twenty Email Sync — **NIE** (świadomie poza zakresem); w SSOT oznaczony „nie obsługiwany" (nie pytamy resolvera ani handlowców o ten inbox).

**Twenty Email Sync — zakres (Etap 1.2):** wszystkie skrzynki sprzedawców + `leads@` + `studio@` → Twenty (odpowiedzi, wątki, timeline). Faza Etap 1.2 (po rdzeniu 1.1: schema, paid inbound, webhook OUT); cutover dopiero gdy 1.2 gotowe.

**Model operacyjny (parzystość BB, C13):** każdy handlowiec ma własną skrzynkę w Twenty (Email Sync); dodatkowo skrzynka ogólna `leads@` (główny kanał rozdziału) — wątki muszą trafiać do właściwego leada/handlowca (Opportunity owner). Wdrożenie: reguły Twenty lub proces operacyjny przy pierwszym kontakcie (szczegóły w runbooku Etap 1.2); wymaganie biznesowe zamknięte.

| Skrzynka | Email Sync w Twenty |
|---|---|
| `leads@owocni.pl` | **TAK** (Etap 1.2) — ogólna, rozdział wątków |
| `studio@owocni.pl` | **TAK** (Etap 1.2) |
| `marta@`, `gosia@`, `mariusz@` | **TAK** (Etap 1.2) |
| `copywriting@`, `pomoc@` | **TAK** (Etap 1.2) |
| `kontakt@owocni.pl` | **NIE** — nie obsługiwana |

**IMAP:** `mail.owocni.pl`. Docelowo: podsumowania wątków i zadania wg priorytetów w Twenty (Etap 1 vs 2 → ADR #15).

**Role wdrożenia:** Twenty (schema, Email Sync, webhook OUT, UI), GTM/sGTM/Sortownia/Stape/Robot, aktualizacja nazw eventów w docs orkiestracji + kod Robot (ADR #14) → **Dawid**. Uzgodnienia z przełożonymi: Dawid ↔ Mariusz, Krzysztof. Harmonogram/plan: Dawid (+ Cursor).

### 5.6 Przepływy per kanał

**Formularz paid:** `Formularz → Sortownia (oid_init → generate_lead) → id_oid + verified + vbb_eligible → adapter crm:twenty_create_lead → Twenty`. Sortownia Etap A: **nie przepisujemy** logiki Owner / Akt / 90 dni.

**Mail (Twenty Email Sync + Resolver):** mail → Email Sync (~5 min) → Person/Opportunity → webhook → Resolver → lookup Stape (by_email[from], opcjonalnie by_phone tylko z pola, nie z body) → T1/T2/T3 zapis id_oid + wskaźniki; T4 → flaga „Tożsamość do rozstrzygnięcia". Handlowiec **nie przepisuje** leada od zera — człowiek tylko przy T4.

**Telefon (ręczny):** handlowiec wpisuje numer (+ email jeśli zna) → webhook field updated → Resolver (ta sama macierz §5.3). Bez integracji telefonii — resolver działa w momencie zapisu pola.

**Scenariusz 3-dniowy:** D1 formularz paid, mail firmowy → `id_oid=A`, verified. D2 handlowiec dodaje telefon prywatny → phone 0 trafień → dopisz do A; email już na A → T1/T2. D3 mail z prywatnego Gmaila → email 0; jeśli additional email → T1; konflikt → T4 (jeden klik „dopnij do A").

### 5.7 Dziś vs docelowo (FAQ — dla człowieka)

| Kanał | Dziś | Docelowo |
|---|---|---|
| Formularze strony | Sortownia + często mail na `leads@` | Sortownia → Twenty; paid bez zmian |
| Mail `leads@` | julia362 → GPT → auto-lead Supabase | Twenty sync + Resolver (T1–T3 auto, T4 człowiek) |
| Mail `studio@` itd. | Mail zapisany; brak auto-leada dla nowego klienta | Twenty sync + T3 auto_mint dla nowego nadawcy |
| `kontakt@` | Osobna skrzynka, spam; nie obsługujemy | Bez zmian — poza CRM |
| Telefon | Ręcznie w legacy CRM | Ręcznie w Twenty + Resolver |

**julia362 OFF** dopiero gdy Email Sync + Resolver + reguły kanałów działają (ADR #12/#13).

### 5.8 Model danych Stape + implementacja

**Podział odpowiedzialności:** Sortownia Etap A (tylko paid: `oid_init`, `generate_lead`, Owner, Akt, task_queue) · Identity Resolver (T1–T5, lookup wskaźników, mint nie-paid, flagi — osobny handler) · Robot/GCF (VBB gate w adapterach) · Twenty (Email Sync, UI, merge ograniczony, webhook OUT).

**Profil** (klucz = `id_oid`):
```yaml
id_oid: string          # ULID, klucz profilu
canonical_oid: string   # na start == id_oid; przy łączeniu = zwycięzca
identity_status: enum    # verified | needs_review | unresolved
vbb_eligible: bool
identifiers:
  emails: string[]
  phones_e164: string[]
  ga_client_id: string
  id_crm_lead: string
# + istniejące pola paid: owner, assist, order_id, AktTimestamp, attr_gclid, ...
```

**Wskaźniki** (osobne dokumenty): `by_email/{email_normalized}` · `by_phone/{phone_e164}` · `by_ga/{ga_client_id}` · `by_crm/{twenty_record_id}` · opcjonalnie `by_company_domain/{company_domain_key}` (tylko lookup propozycji merge, nie auto-link) → każdy `→ { id_oid }`. Lookup: wskaźnik → `id_oid` → profil. Dopinięcie drugiego emaila = **nowy wskaźnik**, bez nowego profilu (albo merge ręczny — §5.9). Migracja: obecny multi-key write (profil pod email/phone/ga) → wskaźniki + profil pod `id_oid`.

#### 5.8.1 Normalizacja PII — `normalize_email(biz_email) → email_normalized`

Stabilna reguła (Sortownia + Identity Resolver — **identyczna implementacja**):

1. `trim` + `lowercase`
2. Usuń **wszystkie** whitespace (także w środku adresu)
3. Jeśli nie ma **dokładnie jednego** `@` → ustaw `sys_invalid_email=true` i **nie używaj** emaila do resolve/merge
4. Domenę przetwórz jako IDN → **punycode** (np. `ąę.pl` nie psuje matchingu)

**Plus-addressing (tylko tam, gdzie 100% bezpieczne):**

- Jeśli domena ∈ `{gmail.com, googlemail.com}`:
  - usuń wszystko po `+` w local-part
  - usuń kropki w local-part (Gmail je ignoruje)
- **Reszty providerów nie ruszaj** (KISS — zero niespodzianek na egzotycznych serwerach)

Wyjście: `email_normalized` (klucz wskaźnika `by_email`) + flagi pomocnicze.

#### 5.8.2 Domena firmowa — `company_domain_key` (merge proposals v2.0)

**Cel:** wykryć, że `jan@stocznia-gdynia.pl` i `biuro@stocznia-gdynia.pl` to **ta sama firma** (asystent + szef) — i **zaproponować** handlowcowi merge do jednego `id_oid`. **Nie** łączyć automatycznie.

**Krok A — registrable domain (eTLD+1, nie „ostatnie 2 segmenty"):**

```
compute_registrable_domain(email_domain) → domain_reg   # Public Suffix List (PSL)
```

Przykłady:
- `mail.firma.pl` → `firma.pl`
- `firma.co.uk` → `firma.co.uk` (nie `co.uk`)

**Krok B — `is_free_mail(domain_reg)`** (SSOT v1.0.0 — **bez substring**):

| Krok | Warunek | Wynik |
|------|---------|--------|
| **0** | `domain_reg` ∈ `never_block` (`orange.com`, `telekom.de`, …) | **corporate** — nigdy nie blokuj |
| **1** | `domain_reg` **dokładnie** w `domains` JSON (918 pozycji) | **STOP** — free mail |
| **2 (opcjonalnie)** | `patterns_enabled` ∧ wzorzec zakotwiczony `^…$` (np. Microsoft ccTLD) | **STOP** — free mail |
| **Wynik** | pozostałe (np. `jan@stocznia-gdynia.pl`, `livechat.com`) | **corporate** — możliwy merge proposal |

**🔴 ZAKAZ:** reguła „domena **zawiera** ciąg” (`gmail`, `live`, `me.com`, `terra`, …) — false-positive na `acme.com`, `livechat.com`, `terravita.pl`, `claims.com`. Usunięta w v1 (2026-07-15).

Listy kanoniczne: `data/free_mail_domains_v1.json` · runtime: `integrations/shared/isFreeMail.js` · generator: `integrations/tools/gen_free_mail.py` · pełny SSOT: `data/SSOT_free-mail-domains_v1.md`.

**Krok C — `company_domain_key`:**

```
is_free_mail == true  → company_domain_key = null   (NIE łącz po domenie, NIE proponuj merge)
is_free_mail == false → company_domain_key = domain_reg   (można proponować merge firmowy)
```

**Przypadki biznesowe:**

| Scenariusz | Resolver | Merge proposal |
|------------|----------|----------------|
| Ten sam `email_normalized` | T1/T2 auto_link | nie dotyczy |
| Dwa maile, ta sama `company_domain_key`, różne osoby | T3 mint ×2 (osobne leady) | **TAK** — UI: „Ta sama firma — scalić kontakty?" |
| Dwa maile `@gmail.com` / `@wp.pl` | T3 mint ×2 | **NIE** — free mail |
| Email vs phone → różne `id_oid` | T4 needs_review | merge proposal **nie zastępuje** T4 |

**Czego NIE robimy w Sortowni paid:** automatyczny silnik merge nie-paid; probabilistyczne dopasowanie; lookup telefonu dla kanału mailowego w logice paid.

**UI człowieka (T4):** przy `needs_review` handlowiec widzi 1–3 kandydatów z Stape (nie dowolny search): „To ten sam klient" → resolver dopina wskaźnik; „To nowy klient" → T3 mint; „Eskaluj" → T5/admin. **Propozycja merge firmowego** (§5.8.2): gdy istnieje inny `id_oid` z tym samym `company_domain_key`, Twenty pokazuje sugestię — handlowiec **może scalić** nowy lead z istniejącym rekordem (jeden `id_oid` / `canonical_oid`). System **nigdy** nie wykonuje tego merge sam. Każda decyzja → audyt (`who`, `when`, `tier`, `chosen_id_oid`, `merge_reason`). **Reconciliation** 1×/dobę: Twenty PII vs Stape wskaźniki → rozjazd = alert.

> **Backlog kodu Sortowni (ADD-2/ADD-1/ADD-3/FIX-2/FIX-1) + kolejność wdrożenia → `runbooks/IMPLEMENTATION_PLAN.md`.** Tutaj pozostaje wskaźnik; backlog implementacji nie jest treścią tożsamości.

### 5.9 Merge — polityka v2.0 (propozycje, nie auto) `[D:CORE]`

**Zasada nadrzędna:** system **nigdy sam nie scala** tożsamości (`id_oid`). Merge = **wyłącznie ręczna** akcja handlowca/admina w Twenty (+ synchronizacja `canonical_oid` / wskaźników w Stape).

**Co system MOŻE robić automatycznie:**

- T1/T2 **auto_link** — ten sam `email_normalized` lub ten sam phone (ta sama osoba)
- T3 **auto_mint** — brak trafienia
- **Propozycja merge firmowego** — gdy dwa leady mają ten sam `company_domain_key` (corporate mail, §5.8.2) i **różne** emaile/osoby (np. asystent pisał, szef wpłaca)

**Czego system NIGDY nie robi:**

- Auto-merge po domenie firmowej
- Propozycja merge dla free-mail (`wp.pl`, `gmail.com`, … — waterfall §5.8.2)
- Auto-merge przy kolizji email vs phone (T4)
- Auto-merge dwóch paid `id_oid` z sygnałem do platform (**T5** — tylko admin)

**Twenty — narzędzia natywne (3 bramki techniczne `[D:OPEN]`):**

**Wykorzystujemy:** Email Sync (IMAP `mail.owocni.pl`); **Merge rekordów (od v1.3)** — tylko ręcznie w UI po propozycji lub decyzji T4; Additional emails/phones na Person.

**Ograniczenia (DO TESTU — bramki G8, NIE backlog):**
1. Email podlinkowany tylko do **jednego** kontaktu — duplikat additional email → cichy routing do starszego rekordu.
2. **Merge może być nieodwracalny** — szkolenie: kiedy **TAK** (ta sama firma, świadome scalenie), kiedy **NIE** (free mail, różne firmy).
3. **Webhook przy merge — czy payload niesie oba ID?** `[D:OPEN]` — **bramka cutoveru** (przepięcie wskaźników Stape).

> **Trzy bramki techniczne merge pozostają `[D:OPEN]`:** (a) webhook payload; (b) nieodwracalność + SOP przepięcia `canonical_oid`; (c) T5 przy dwóch paid. **Polityka biznesowa merge v2.0 jest zamknięta (2026-06-08):** propozycje corporate OK, auto-merge zakazane, free-mail wyłączone.

### 5.10 VBB gate (sygnały reklamowe)

Wysyłka do Google/Meta tylko gdy:
```
identity_status == verified  AND  vbb_eligible == true
```
Inaczej task → `skipped_no_oid` (świadomy **skip ≠ fail**).

| Źródło | Typowo |
|---|---|
| paid + click-ID | verified + vbb_eligible true |
| nie-paid przed resolverem | needs_review / unresolved → off |
| po T1/T2/T3 | verified; vbb_eligible wg paid touch |
| T4/T5 | off |

Bramka w **adapterach Robot**, nie w Sortowni paid.

### 5.11 Reguły procesowe (NEGATIVE RULES — nie kod, nie skracać)

1. **Generyczne maile** (`kontakt@`, `biuro@`) → powiązanie z **Company**, nie additional email osoby.
2. **Merge firmowy (asystent + szef):** dozwolona **propozycja** i **ręczne** scalenie po `company_domain_key` (§5.8.2) — jeden `id_oid` dla firmy; **nigdy** auto. **Zakaz** propozycji/merge po free-mail.
3. **Paid telefon bez kontekstu** → akceptowany under-merge; identyfikacja później.
4. **`campaignRejected`** — zachować semantykę Bitrix; ≠ stage LOST.
5. **Dwa paid id_oid** → T5, ręczna korekta platform — nigdy auto.

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| Mapowanie eventów, loop-prevention, generate_lead (manual) | `EVENT_CONTRACT.md` |
| Pole `idOid` (typ/frozen), srcSystem | `DATA_MODEL.md` |
| INV-7 fail-closed, granica CRM↔orkiestracja | `CRM_CONSTITUTION.md` |
| Backlog kodu Sortowni (ADD/FIX), kolejność wdrożenia, parzystość BB | `runbooks/IMPLEMENTATION_PLAN.md` |
| Nazwa eventu webhooka Twenty (recheck) | `ops/OPS_NOTES.md` |
| Listy free-mail + exact match (v1) | `data/free_mail_domains_v1.json`, `shared/isFreeMail.js`, §5.8.2 |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-I1 | Webhook Twenty przy merge — payload z oboma ID? | Dawid | **cutover** | preflight / instancja |
| OQ-I2 | Merge nieodwracalny — reguła przepięcia `canonical_oid` | Dawid | **cutover** | preflight + §11 |
| OQ-I3 | T5 przy dwóch paid id_oid — ścieżka admin | Dawid | **cutover** | preflight |
| OQ-I4 | Niezawodność Email Sync przy wielu skrzynkach (~80 leadów/mc kanałem mailowym, nie mylić z ~150/mc całością — `ARCHITECTURE.md`) | Dawid | nie | test operacyjny |
| OQ-I5 | Format `time_occurred_iso_utc` — ISO vs epoch (FIX-2) | Dawid | nie | implementacja |
| OQ-I6 | Stape Store — wydajność wzorca wskaźnik → profil (2 odczyty) | Dawid | nie | preflight |

---

## 8. VERIFICATION / RECHECK (DO TESTU — P0 przed cutover)

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Webhook Twenty przy merge — payload z oboma ID | Preflight | Dawid | instancja |
| Resolver T4 nie wysyła VBB | Preflight | Dawid | runtime |
| T3 mint + backfill pola `id_oid` w Twenty | Preflight | Dawid | runtime |
| `kontakt@` — prawdziwa skrzynka vs alias | Preflight | Dawid | instancja |
| Cross-channel scenariusze (plan testów) | Preflight | Dawid | PASS/FAIL |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-07-15 | Free-mail v1: exact match 918 domen; **KILL substring**; zakotwiczone patterns (opt-in); `never_block`; canary | Właściciel | livechat.com / acme.com / terravita.pl |
| 2026-06-08 | Merge policy v2.0: propozycje corporate, zakaz auto-merge i free-mail; §5.8.1 normalize_email; §5.8.2 company_domain_key + PSL | Właściciel | Asystent+szef ta sama firma |

---

## SŁOWNIK (dla LLM — one-term-per-concept)

| Termin | Znaczenie |
|--------|-----------|
| `id_oid` | Kanoniczny identyfikator klienta w Stape (ULID) |
| `canonical_oid` | Zwycięzca przy łączeniu dwóch id_oid (reguła kotwicy platformowej) |
| `identity_status` | `verified` \| `needs_review` \| `unresolved` |
| `vbb_eligible` | Czy wolno wysłać sygnał VBB do Google/Meta |
| **Identity Resolver** | Handler Stape: macierz T1–T5, osobny od Sortowni paid |
| **Sortownia Etap A** | sGTM tag — tylko paid orchestration |
| **Profil Klienta** | Dokument Stape pod kluczem `id_oid` |
| `company_domain_key` | eTLD+1 z corporate mail; null dla free-mail; klucz propozycji merge firmowego |
| `merge_proposal` | Sugestia UI: ta sama firma, różne osoby — handlowiec decyduje o scaleniu |
| **Wskaźnik** | Dokument `by_email` / `by_phone` → wskazuje na `id_oid` |
| **T1–T5** | Poziomy pewności resolvera (§5.2) |
| **Projekcja** | Twenty CRM — widok operacyjny, nie master tożsamości |
| **julia362** | Legacy IMAP watcher → better-bitrix (wyłączyć po cutover) |
| **owner** | Homonim. **(a) pole paid:** pierwszy kanał (first-touch), para z `assist`, wejście do reguł 90 dni / VBB (§5.8). **(b) Opportunity owner:** handlowiec przypisany do leada w Twenty (§5.6). (a) ≠ (b): inny system, inny byt. Poza tym plikiem `owner` bywa też meta-kolumną tabel (kto zapisuje pole) i kolumną ról (kto odpowiada) — patrz glosariusz `CRM_CONSTITUTION.md`. |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:CORE`. Inline = odchylenie.
