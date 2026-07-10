# PF-9 — kanon `bizProduct` i `bizSource` (Twenty SELECT)

> **Status:** `[D:VERIFIED]` z kodu worker + Sortownia (2026-07-09). Użyj **dokładnie** tych wartości API przy tworzeniu pól SELECT w Twenty.

---

## `bizProduct` — wartości SELECT (Opportunity)

Worker `createLead.js` → `mapBizProductToTwenty()` — **to jest kanon wartości w Twenty**:

| API value (Twenty) | Etykieta UI (sugerowana PL) | Sortownia slug / źródło |
|--------------------|----------------------------|-------------------------|
| `WEB` | Strony / strona | `strony`, `strona`, `web` |
| `LOGO` | Logo | `logo` |
| `NAME` | Naming / nazwa | `nazwa`, `naming`, `nazwy` |
| `MARKETING` | Marketing / strategia | `marketing`, `strategia`, `konsultacje` |
| `COPYWRITING` | Copywriting | `copywriting`, `nazwa/teksty`, `teksty` |
| `OPAKOWANIE` | Opakowanie | `opakowanie`, `packaging` |
| `INNE` | Inne / nieustalone | brak slug, Leads@ bez produktu |

**Zakaz:** opcji `default` w SELECT.

**Uwaga:** payload Sortowni używa slugów **małymi literami** (`strony`, `logo`); Twenty przechowuje **wielkie litery** wg tabeli — mapowanie robi worker, nie ręcznie.

### Pricing Key (Sortownia / Robot)

Prefiksy: `lead_`, `sql_`, `won_`, `rejected_` + slug produktu, np. `lead_strony`, `sql_logo`.

Źródła kodu: `integrations/SORTOWNIA_V2_POPRAWIONY.js` (`normalizeBizProductSlug`, `inferBizProductFromUrl`), `createLead.js` (`mapBizProductToTwenty`).

---

## `bizSource` — wartości SELECT (Opportunity)

Kanon: [`BIZSOURCE-MAP.md`](./BIZSOURCE-MAP.md). Twenty SELECT wymaga **UPPER_SNAKE_CASE** — worker `createLead.js` → `mapBizSource()`:

| API value | Etykieta UI (PL) |
|-----------|----------------|
| `GOOGLE` | Google Ads |
| `FACEBOOK` | Facebook / Meta |
| `ORGANIC` | Organic / strona |
| `REFERRAL` | Polecenie |
| `DIRECT_EMAIL` | Mail bezpośredni (Leads@) |
| `MANUAL` | Ręcznie / telefon |
| `OTHER` | Inne |
| `UNKNOWN` | Nieznane |

**Legacy w enum:** `GOOGLE_ADS`, `FORM`, `POLECENIE`, `INNE` — backfill opcjonalny przed M5.

---

## Pola metryk (CRM-only, bez prefiksu `biz`)

| API name | Type | Opis Settings (skrót) |
|----------|------|------------------------|
| `qualifiedAt` | DATE_TIME | Pierwsze wejście w QUALIFIED. Tylko workflow. |
| `hoursToQualified` | NUMBER | Godziny do SQL. Tylko workflow. |
| `stageClosedAt` | DATE_TIME | Faktyczne zamknięcie WON/LOST. ≠ `closeDate`. |
| `daysToClose` | NUMBER | Dni do zamknięcia. Tylko workflow. |
| `firstResponseAt` | DATE_TIME | Pierwszy mail wychodzący. |
| `hoursToFirstResponse` | NUMBER | Godziny do pierwszej odpowiedzi. |

Field-level: **read-only** dla ról handlowców.

---

## Dowód PF-9

| Check | PASS gdy |
|-------|----------|
| SELECT `bizProduct` | 7 opcji jak w tabeli |
| SELECT `bizSource` | 8 opcji jak w tabeli |
| Nowy lead Leads@ | `bizSource = direct-email`, produkt ≠ wymuszony `web` |
| Formularz strony | `bizSource = organic` lub `google`/`facebook` z UTM |
