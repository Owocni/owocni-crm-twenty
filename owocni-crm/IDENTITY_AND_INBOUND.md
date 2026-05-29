# IDENTITY_AND_INBOUND — tożsamość klienta i wejście leadów

**Status:** SSOT (canonical) — zastępuje `OWOCNI_CRM_SSOT_1_*`, `OWOCNI_CRM_SSOT_3_*`, `INBOUND_EDGE_CASES.md`  
**Wersja:** 2026-05-28  
**Platforma:** Twenty CLOUD + Stape (Sortownia / Identity Resolver / Robot)  
**Blokuje cutover:** ADR #12, ADR #13  
**Kod (repo `AdrianKrauza/owocni`):**
- Sortownia (paid, sGTM): [SORTOWNIA_V2_POPRAWIONY.js](https://github.com/AdrianKrauza/owocni/blob/main/SORTOWNIA_V2_POPRAWIONY.js)
- Robot (GCP): [GoogleCloudRobot.js](https://github.com/AdrianKrauza/owocni/blob/main/GoogleCloudRobot.js)

**Orkiestracja (SSOT poza tym pakietem):** [Google Docs — konfiguracja techniczna](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an)

**Dla LLM:** czytaj sekcje 1–6 (zasady + macierz T1–T5 + kanały). Sekcja 8 = backlog implementacji.  
**Dla człowieka:** sekcja 7 = „dziś vs docelowo” w prostym języku.

---

## Spis treści

1. [Zasada nadrzędna](#1-zasada-nadrzędna)
2. [Architektura warstw](#2-architektura-warstw)
3. [Identity Resolver — poziomy pewności T1–T5](#3-identity-resolver--poziomy-pewności-t1t5)
4. [Macierz decyzyjna (email × phone)](#4-macierz-decyzyjna-email--phone)
5. [Kanały wejścia — zamknięta lista](#5-kanały-wejścia--zamknięta-lista)
6. [Przepływy per kanał](#6-przepływy-per-kanał)
7. [Dziś vs docelowo (FAQ)](#7-dziś-vs-docelowo-faq)
8. [Implementacja: Stape Store, Sortownia, backlog](#8-implementacja-stape-store-sortownia-backlog)
9. [Twenty — narzędzia natywne i ograniczenia](#9-twenty--narzędzia-natywne-i-ograniczenia)
10. [VBB gate (sygnały reklamowe)](#10-vbb-gate-sygnały-reklamowe)
11. [Reguły procesowe (nie kod)](#11-reguły-procesowe-nie-kod)
12. [Kolejność wdrożenia i bramki DO TESTU](#12-kolejność-wdrożenia-i-bramki-do-testu)
13. [Słownik (dla LLM)](#13-słownik-dla-llm)
14. [Pytania otwarte](#14-pytania-otwarte)

---

## 1. Zasada nadrzędna

### 1.1 Jedna prawda o tożsamości

**`id_oid` w Stape (Profil Klienta) jest JEDYNYM źródłem prawdy** o tym, kim jest klient — niezależnie od kanału wejścia.

Twenty jest **projekcją** (widok handlowca). Twenty **nie rozstrzyga** tożsamości samodzielnie — nie ma identity graph (CDP).

### 1.2 Automat vs człowiek

> **Automat robi wszystko, co jest deterministyczne. Człowiek tylko tam, gdzie system ma ≥2 sensowne interpretacje.**

- **NIE** probabilistyczny merge (imię + firma).
- **NIE** pełny silnik auto-merge w Sortowni paid.
- **TAK** cienka warstwa **Identity Resolver** (osobny handler) z regułami T1–T5.
- **TAK** człowiek wybiera **z kandydatów** (T4), nie dowolny merge bez ograniczeń.

### 1.3 Rekord ≠ id_oid

Rekord w Twenty może istnieć **bez** przypisanego `id_oid` — stan jawny: `identity_status: needs_review` lub `unresolved`. To nie jest „czarna dziura”, tylko nazwany stan.

---

## 2. Architektura warstw

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

**Przepływ prawdy:** zawsze **ku górze** (Twenty → Stape). Nigdy Stape pyta Twenty „kim jest klient”.

---

## 3. Identity Resolver — poziomy pewności T1–T5

| Tier | Kod | Warunek | Akcja | `identity_status` | VBB |
|------|-----|---------|-------|-------------------|-----|
| **T1** | `auto_link` | Email **lub** phone trafia w **dokładnie 1** `id_oid` | Przypisz istniejący `id_oid` + wskaźnik | `verified` | wg profilu |
| **T2** | `auto_link_strong` | Email **i** phone trafiają w **ten sam** `id_oid` | Jak T1 + log strong match | `verified` | wg profilu |
| **T3** | `auto_mint` | Brak trafienia email **i** brak trafienia phone (po normalizacji) | Nowy ULID `id_oid` + wskaźniki | `verified` | `false` do paid touch |
| **T4** | `needs_review` | Email → profil A, phone → profil B **lub** ≥2 kandydatów | **Nie** łącz; flaga w Twenty; kolejka | `needs_review` | **off** |
| **T5** | `merge_review_critical` | Łączenie dotyka **dwóch paid** `id_oid` z sygnałem do platform | Blokada auto; tylko admin | `needs_review` | **off** |

**Reguła złota:** auto tylko przy **0 lub 1** kandydacie. Przy 2+ → **T4**, bez wyjątków.

**Trigger resolvera:** webhook Twenty (`record.created` / `record.updated` / merge) **oraz** ręczny zapis pól email/phone w Twenty.

---

## 4. Macierz decyzyjna (email × phone)

Po normalizacji (`normalizeEmail`, `normalizePhone` E.164 — ta sama logika co w Sortowni):

| Trafienie email w Stape | Trafienie phone w Stape | Wynik |
|-------------------------|-------------------------|--------|
| 0 | 0 | **T3** auto_mint |
| 1 | 0 | **T1** auto_link |
| 0 | 1 | **T1** auto_link |
| 1 | 1, **ten sam** id_oid | **T2** auto_link_strong |
| 1 | 1, **różne** id_oid | **T4** needs_review |
| 2+ | * | **T4** + alert techniczny (duplikat wskaźników) |

**Nie automatyzujemy:**

- Ten sam telefon, dwa różne maile (Jan vs Anna) → T4
- Adresy generyczne (`kontakt@`, `biuro@`) → T4 lub link do **Company**, nie Person
- Phone wyciągnięty regexem z treści maila (niepewny) → ignoruj
- Dopasowanie tylko po imieniu/firmie → nigdy

---

## 5. Kanały wejścia — zamknięta lista

| Kanał | Pierwszy obserwator (docelowo) | id_oid | Resolver |
|-------|--------------------------------|--------|----------|
| Formularz **paid** (web, gclid/fbc) | Sortownia (real-time) | **automat** (Sortownia) | Nie dotyka — paid path |
| Formularz **nie-paid** / organic | Sortownia `generate_lead` jeśli event jest | automat jeśli event | T1–T3 jeśli przez Twenty |
| Mail → **`leads@`** | Twenty Email Sync | Resolver T1–T4 | T3 dla nowego nadawcy |
| Mail → **`studio@`** | Twenty Email Sync | Resolver | T3/T4 |
| Mail → **skrzynki handlowców** (`marta@`, `gosia@`, `mariusz@`, `copywriting@`, `pomoc@`) | Twenty Email Sync (Etap 1.2) | Resolver | T3/T4 |
| Mail → **`kontakt@`** | **NIE obsługiwana** | — | Kanał-sierota: skrzynka istnieje, spam w backlogu; **bez** Email Sync i **bez** leadów w Twenty |
| **Telefon** | Handlowiec (Twenty) | Po zapisie numeru → resolver | T1–T4 |
| Polecenie / ręczne dodanie | Handlowiec | Po zapisie PII → resolver | T1–T3 typowo |

### Legacy (julia362) — do wyłączenia

| Fakt | Wartość |
|------|---------|
| Serwer | `julia362.mikrus.xyz`, `app2.js` |
| Nasłuch IMAP (7 skrzynek) | `copywriting@`, `pomoc@`, `studio@`, `marta@`, `gosia@`, `mariusz@`, `leads@` |
| **Auto-tworzenie NOWEGO leada** | Tylko **`leads@` + INBOX** (better-bitrix + GPT) |
| **`kontakt@`** | **Nie** na liście watchera julia362; **osobna skrzynka** (patrz §5.1) |
| Wyłączenie | Po ADR #12/#13 + Email Sync + Resolver działają — `CUTOVER_RUNBOOK` |

### 5.1 Decyzje planowe — mail (2026-05-28, aktualizacja ról)

**Status:** zamknięte na poziomie planu.  
**Owner techniczny (wdrożenie):** **Dawid** — Twenty, GTM, sGTM, Stape/Sortownia, aktualizacje w Sortowni i docs orkiestracji.  
**Mariusz i Krzysztof** — przełożeni; uzgodnienia biznesowe/architektoniczne, nie wykonawcy wdrożenia.

#### `kontakt@owocni.pl` — **nie obsługujemy**

| Fakt | Ustalenie |
|------|-----------|
| Skrzynka | **Istnieje** — osobna skrzynka, **bez przekierowania** |
| Backlog | Spam i reklamy od miesięcy — **nie** importujemy, **nie** tworzymy leadów |
| julia362 | **Nie** nasłuchuje |
| Twenty Email Sync | **NIE** — świadomie **poza** zakresem |
| W SSOT | Kanał oznaczony jako **„nie obsługiwany”** (nie pytamy resolvera ani handlowców o ten inbox) |

#### Twenty Email Sync — zakres (Etap 1.2)

**Decyzja:** wszystkie skrzynki sprzedawców + **`leads@`** + **`studio@`** → Twenty (odpowiedzi, wątki, timeline).  
**Faza:** **Etap 1.2** w ramach Etapu 1 (po rdzeniu 1.1: schema, paid inbound, webhook OUT) — od początku **planujemy** z miejscem na Email Sync, cutover dopiero gdy 1.2 gotowe.

| Skrzynka | Email Sync w Twenty |
|----------|---------------------|
| `leads@owocni.pl` | **TAK** (Etap 1.2) |
| `studio@owocni.pl` | **TAK** (Etap 1.2) |
| `marta@`, `gosia@`, `mariusz@` | **TAK** (Etap 1.2) |
| `copywriting@`, `pomoc@` | **TAK** (Etap 1.2) |
| `kontakt@owocni.pl` | **NIE** — nie obsługiwana |

**IMAP:** `mail.owocni.pl`. Docelowo: podsumowania wątków i zadania wg priorytetów w Twenty (szczegóły Etap 1 vs 2 → ADR #15).

#### Role wdrożenia

| Obszar | Owner |
|--------|--------|
| Twenty (schema, Email Sync, webhook OUT, UI) | **Dawid** |
| GTM / sGTM / Sortownia / Stape / Robot integracja | **Dawid** |
| Aktualizacja nazw eventów w docs orkiestracji + kod Robot | **Dawid** (ADR #14) |
| Uzgodnienia z przełożonymi | Dawid ↔ **Mariusz**, **Krzysztof** |
| Harmonogram / plan prac | **Dawid** (+ Cursor); ten repo SSOT |

---

## 6. Przepływy per kanał

### 6.1 Formularz paid (bez zmian)

```
Formularz → Sortownia (oid_init → generate_lead) → id_oid + verified + vbb_eligible
         → adapter crm:twenty_create_lead → Twenty
```

Sortownia Etap A: **nie przepisujemy** logiki Owner / Akt / 90 dni.

### 6.2 Mail (Twenty Email Sync + Resolver)

```
1. Mail wpada → Twenty Email Sync (~5 min) → Person/Opportunity
2. Webhook → Identity Resolver
3. Lookup Stape: by_email[from], opcjonalnie by_phone (tylko z pola, nie z body)
4. T1/T2/T3 → zapis id_oid na polu Twenty + wskaźniki Stape
5. T4 → flaga „Tożsamość do rozstrzygnięcia” — handlowiec wybiera kandydata
```

Handlowiec **nie przepisuje** leada od zera — sync tworzy rekord; człowiek tylko przy **T4**.

### 6.3 Telefon (ręczny)

```
Handlowiec wpisuje numer (+ email jeśli zna)
→ webhook field updated → Resolver (ta sama macierz §4)
```

Bez integracji telefonii — resolver działa **w momencie zapisu pola**.

### 6.4 Scenariusz 3-dniowy (przykład)

| Dzień | Zdarzenie | Wynik |
|-------|-----------|--------|
| 1 | Formularz paid, mail firmowy | Sortownia → `id_oid=A`, verified |
| 2 | Handlowiec dodaje telefon prywatny | Phone: 0 trafień → dopisz do A; email już na A → **T1/T2** |
| 3 | Mail z prywatnego Gmaila | Email: 0; jeśli Twenty ma additional email → **T1**; jeśli konflikt → **T4** (jeden klik: „dopnij do A”) |

---

## 7. Dziś vs docelowo (FAQ)

| Kanał | **Dziś** | **Docelowo** |
|-------|----------|--------------|
| Formularze strony | Sortownia + często mail na `leads@` | Sortownia → Twenty; paid bez zmian |
| Mail `leads@` | julia362 → GPT → **auto-lead** Supabase | Twenty sync + **Resolver** (T1–T3 auto, T4 człowiek) |
| Mail `studio@` itd. | Mail zapisany; **brak auto-leada** dla nowego klienta | Twenty sync + **T3 auto_mint** dla nowego nadawcy |
| `kontakt@` | Osobna skrzynka, spam; **nie obsługujemy** w Twenty | Bez zmian — poza CRM |
| Telefon | Ręcznie w legacy CRM | Ręcznie w Twenty + Resolver |

**julia362 OFF** dopiero gdy Email Sync + Resolver + reguły kanałów działają (ADR #12/#13).

---

## 8. Implementacja: Stape Store, Sortownia, backlog

### 8.1 Podział odpowiedzialności

| Komponent | Odpowiedzialność |
|-----------|------------------|
| **Sortownia Etap A** | Tylko **paid**: `oid_init`, `generate_lead`, Owner, Akt, task_queue |
| **Identity Resolver** | T1–T5, lookup wskaźników, mint nie-paid, flagi — **osobny handler** |
| **Robot (GCF)** | VBB gate w adapterach (`vbb_eligible`) |
| **Twenty** | Email Sync, UI, merge (ograniczony), webhook OUT |

### 8.2 Model danych Stape (ADD)

**Profil** (klucz dokumentu = `id_oid`):

```yaml
id_oid: string          # ULID, klucz profilu
canonical_oid: string   # na start == id_oid; przy łączeniu = zwycięzca
identity_status: enum   # verified | needs_review | unresolved
vbb_eligible: bool
identifiers:            # denormalizacja (opcjonalnie)
  emails: string[]
  phones_e164: string[]
  ga_client_id: string
  id_crm_lead: string
# + istniejące pola paid: owner, assist, order_id, AktTimestamp, attr_gclid, ...
```

**Wskaźniki** (osobne dokumenty):

```
identity_map/by_email/{email_normalized}  → { id_oid }
identity_map/by_phone/{phone_e164}        → { id_oid }
identity_map/by_ga/{ga_client_id}          → { id_oid }
identity_map/by_crm/{twenty_record_id}    → { id_oid }
```

Lookup: wskaźnik → `id_oid` → profil. Dopinięcie drugiego emaila = **nowy wskaźnik**, bez nowego profilu.

**Migracja:** obecny multi-key write w `SORTOWNIA_V2_POPRAWIONY.js` (profil pod email/phone/ga) → wskaźniki + profil pod `id_oid`.

### 8.3 Czego NIE robimy w Sortowni paid

- Automatyczny silnik merge nie-paid
- Probabilistyczne dopasowanie
- Lookup telefonu dla kanału mailowego w logice paid (telefon idzie przez Resolver po Twenty)

### 8.4 Backlog kodu Sortowni

Klasy: **FIX** = dotyka działającego paid (osobny commit + regresja). **ADD** = nowe, izolowane.

| ID | Klasa | Opis | Ryzyko |
|----|-------|------|--------|
| **ADD-2** | ADD | Pola `canonical_oid`, `identity_status`, `vbb_eligible` na profilu | Niskie |
| **ADD-1** | ADD | Wskaźniki `by_*` + profil pod `id_oid` + migracja | Średnie |
| **ADD-3** | ADD | Identity Resolver (webhook Twenty, macierz T1–T5, idempotencja, retry) | Średnie |
| **FIX-2** | FIX | Ujednolicić `AktTimestamp` (epoch ms); parser tolerancyjny | Średnie |
| **FIX-1** | FIX | `assist` zawsze null — Opcja A (pełna) lub B (jawny deferral w SSOT) | Średnie |

**Kolejność:** ADD-2 → ADD-1 → ADD-3 → (Email Sync + testy) → FIX-2 → FIX-1. **FIX i ADD nie w jednym commicie.**

### 8.5 UI człowieka (T4) — odporność na błędy

Przy `needs_review` handlowiec widzi **1–3 kandydatów** z Stape (nie dowolny search):

- **„To ten sam klient”** → resolver dopina wskaźnik (nie merge dwóch paid)
- **„To nowy klient”** → T3 mint (jeśli brak)
- **„Eskaluj”** → T5 / admin

Każda decyzja → audyt (`who`, `when`, `tier`, `chosen_id_oid`).  
**Reconciliation** 1×/dobę: Twenty PII vs Stape wskaźniki → rozjazd = alert.

---

## 9. Twenty — narzędzia natywne i ograniczenia

### Wykorzystujemy

- **Email Sync** (IMAP `mail.owocni.pl`) — **hub mailowy sprzedaży**: wszystkie skrzynki §5.1, odpowiedzi z Twenty, timeline, (docelowo) podsumowania i zadania wg priorytetów
- **Merge rekordów** (od 1.3) — tylko w UI T4, z ograniczeniami
- **Additional emails/phones** na Person — dopinanie identyfikatorów

### Ograniczenia (DO TESTU)

1. Email podlinkowany tylko do **jednego** kontaktu — duplikat additional email → cichy routing do starszego rekordu
2. Merge może być **nieodwracalny** — szkolenie + reguły §11
3. Webhook przy **merge** — czy payload ma oba ID? (bramka cutover)

---

## 10. VBB gate (sygnały reklamowe)

Wysyłka do Google/Meta tylko gdy:

```
identity_status == verified  AND  vbb_eligible == true
```

Inaczej task → `skipped_no_oid` (świadomy skip, nie `failed`).

| Źródło | Typowo |
|--------|--------|
| paid + click-ID | verified + vbb_eligible true |
| nie-paid przed resolverem | needs_review / unresolved → off |
| po T1/T2/T3 | verified; vbb_eligible wg paid touch |
| T4/T5 | off |

Bramka w **adapterach Robot**, nie w Sortowni paid.

---

## 11. Reguły procesowe (nie kod)

1. **Generyczne maile** (`kontakt@`, `biuro@`) → powiązanie z **Company**, nie additional email osoby
2. **Nie merguj** różnych osób tej samej firmy (asystent ≠ szef)
3. **Paid telefon bez kontekstu** → akceptowany under-merge; identyfikacja później
4. **`campaignRejected`** — zachować semantykę Bitrix; ≠ stage LOST
5. **Dwa paid id_oid** → T5, ręczna korekta platform — nigdy auto

---

## 12. Kolejność wdrożenia i bramki DO TESTU

| Krok | Co | Blokuje |
|------|-----|---------|
| 0 | Pomiar fragmentacji Identity Map (ile duplikatów id_oid) | Priorytety |
| 1 | ADD-2 pola profilu | — |
| 2 | ADD-1 wskaźniki + migracja | Resolver |
| 3 | ADD-3 Identity Resolver v1 | Nie-paid auto |
| 4 | Twenty Email Sync (skrzynki, reguły auto-create) | julia362 OFF |
| 5 | UI T4 (kandydaci) | Operacje |
| 6 | VBB gate w adapterach | Sygnały |
| 7 | Reconciliation cron | Utrzymanie |
| 8 | FIX-2, FIX-1 (osobno, regresja paid) | Stabilność paid |

**DO TESTU (P0 przed cutover):**

- [ ] Webhook Twenty przy merge — payload z oboma ID
- [ ] Resolver T4 nie wysyła VBB
- [ ] T3 mint + backfill pola `id_oid` w Twenty
- [ ] `kontakt@` — prawdziwa skrzynka vs alias
- [ ] S1/S1b w `STRESS_TEST_PLAN.md` — cross-channel PASS/FAIL

---

## 13. Słownik (dla LLM)

| Termin | Znaczenie |
|--------|-----------|
| `id_oid` | Kanoniczny identyfikator klienta w Stape (ULID) |
| `canonical_oid` | Zwycięzca przy łączeniu dwóch id_oid (reguła kotwicy platformowej) |
| `identity_status` | `verified` \| `needs_review` \| `unresolved` |
| `vbb_eligible` | Czy wolno wysłać sygnał VBB do Google/Meta |
| **Identity Resolver** | Handler Stape: macierz T1–T5, osobny od Sortowni paid |
| **Sortownia Etap A** | sGTM tag — tylko paid orchestration |
| **Profil Klienta** | Dokument Stape pod kluczem `id_oid` |
| **Wskaźnik** | Dokument `by_email` / `by_phone` → wskazuje na `id_oid` |
| **T1–T5** | Poziomy pewności resolvera (§3) |
| **Projekcja** | Twenty CRM — widok operacyjny, nie master tożsamości |
| **julia362** | Legacy IMAP watcher → better-bitrix (wyłączyć po cutover) |

---

## 14. Pytania otwarte (planowanie / implementacja)

**Zamknięte planowo (2026-05-28):** `kontakt@` (§5.1), zakres Email Sync (§5.1), ścieżki per kanał (§5–6), plan ADR #13 (§8.4).

1. Niezawodność Email Sync przy wielu skrzynkach (wolumen ~80 leadów/m) — **test operacyjny**, nie blokada planu
2. Format `time_occurred_iso_utc` — ISO vs epoch (FIX-2)
3. Assist: implementacja pełna vs jawny deferral (FIX-1)
4. Stape Store — wydajność wzorca wskaźnik → profil (2 odczyty)
5. **Podsumowania maili / zadania priorytetowe w Twenty** — część Etap 1.2+ (ADR #15)

---

**Powiązane pliki:** `DECISION_REGISTER.md` (#12, #13), `DATA_MODEL.md`, `CRM_ARCHITECTURE_CURRENT.md`, `STRESS_TEST_PLAN.md`, `CHECKLIST_REVIEW.html` (blok 6), `CUTOVER_RUNBOOK.md`
