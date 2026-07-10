---
doc_id: BIZSOURCE_MAP
title: "Mapa kanałów bizSource (Twenty) — enum + reguły adaptera"
layer: research_plan
status: draft
owner: "Właściciel (semantyka) / Dawid (implementacja)"
last_updated: 2026-07-09
default_trust: D:RESEARCH
decision: "D-15 zamknięte 2026-07-09"
---

# bizSource — kanon kanałów (M5: Win Rate per kanał)

## 0. Rozróżnienie produkt vs kanał

| Pole | Co oznacza | Przykład |
|------|------------|----------|
| **`bizProduct`** | **Co sprzedajemy** (Pricing Key) | `strony`, `logo`, `nazwa` |
| **`bizSource`** | **Skąd przyszedł lead** (atrybucja) | `GOOGLE`, `DIRECT_EMAIL` |

**Błąd do naprawienia:** adapter Leads@ ustawiał `biz_product: "web"` — to sugeruje **produkt „web"**, nie kanał. Lead z maila na skrzynkę to kanał **`direct-email`**; produkt nadal wynika z formularza / rozmowy / PF-9 (może być pusty do czasu kwalifikacji).

---

## 1. Enum `bizSource` (SELECT w Twenty)

Wartości API (**UPPER_SNAKE_CASE** — wymóg Twenty SELECT) — **zamknięta lista D-15:**

| API value | Etykieta UI (PL) | Znaczenie |
|-----------|------------------|-----------|
| `GOOGLE` | Google Ads | Paid/search Google (utm, gclid) |
| `FACEBOOK` | Facebook / Meta | Paid social Meta |
| `ORGANIC` | Organic / strona | Ruch z witryny bez paid UTM (SEO, direct URL) |
| `REFERRAL` | Polecenie | Referral / partner / znany referrer |
| `DIRECT_EMAIL` | Mail bezpośredni | Lead na skrzynkę (Leads@, Email Sync) — **nie mylić z produktem „web"** |
| `MANUAL` | Ręcznie / telefon | Handlowiec wpisał, telefon, spotkanie |
| `OTHER` | Inne | Rozpoznane, ale bez dedykowanej kategorii |
| `UNKNOWN` | Nieznane | Brak danych atrybucyjnych |

**Legacy (zachowane w enum):** `FORM`, `POLECENIE`, `GOOGLE_ADS`, `INNE`.

**Nie używamy:** `web` jako kanału · `email` jako ogólnego (zastąpione przez `DIRECT_EMAIL`).

---

## 2. Reguły mapowania (adapter inbound → Twenty)

Kolejność ma znaczenie — **pierwsze dopasowanie wygrywa.**

| Priorytet | Warunek wejścia | `bizSource` |
|-----------|-----------------|-------------|
| 1 | `inbound_channel = leads_at` LUB `src_action_source` zawiera `email_sync` LUB `src_system = TWENTY_EMAIL` przy create z maila | **`DIRECT_EMAIL`** |
| 2 | `src_system = TWENTY_UI` i brak UTM (handlowiec) | `MANUAL` |
| 3 | `attr_utm_source` / URL: google, gclid | `GOOGLE` |
| 4 | facebook, fb, meta, fbclid | `FACEBOOK` |
| 5 | referral w UTM / znany partner | `REFERRAL` |
| 6 | Formularz ze strony, brak paid UTM | `ORGANIC` |
| 7 | Dane są, ale nie pasuje | `OTHER` |
| 8 | Brak jakichkolwiek sygnałów | `UNKNOWN` |

### 2.1 `organic` vs `direct-email`

| Sytuacja | Kanał |
|----------|-------|
| Klient wypełnił formularz na owocni.pl | `ORGANIC` (lub `GOOGLE`/`FACEBOOK` jeśli UTM paid) |
| Klient napisał **bezpośrednio na adres mailowy** firmy (Leads@) | **`DIRECT_EMAIL`** |
| Handlowiec dodał kartę po rozmowie telefonicznej | `MANUAL` |

---

## 3. Zmiany w kodzie (Dawid — D2)

| Plik | Zmiana |
|------|--------|
| `integrations/cloud-functions/twenty-inbound-webhook/...` | Przy create/update Opportunity: ustaw `bizSource` wg §2 |
| `enqueueLeadsAtCreateLeadTask` | Usunąć mylenie: `biz_product: "web"` jako domyślka kanału; ustawić `bizSource: direct-email` na rekordzie Twenty (produkt osobno) |
| `integrations/SORTOWNIA_V2_POPRAWIONY.js` | Opcjonalnie: `biz_source` w payloadzie (raport GCS) — **osobna decyzja**; M5 liczy się w Twenty |

---

## 4. Backfill (opcjonalnie)

Istniejące deale z Leads@ / Email Sync: jednorazowy skrypt lub widok filtr + bulk update → `bizSource = direct-email` (workflow OFF / no_emit jeśli masowa operacja).

---

## 5. Weryfikacja

| Test | Oczekiwane |
|------|------------|
| Nowy mail na Leads@ → Opportunity | `bizSource = direct-email` |
| Formularz strony z utm_source=google | `bizSource = google` |
| Ręczny lead w CRM | `bizSource = manual` |
| Widget M5 | Słupek `direct-email` oddzielony od `organic` |

---

## CHANGELOG

| Data | Zmiana |
|------|--------|
| 2026-07-09 | D-15 zamknięte; `direct-email` zamiast ogólnego `email`; wyjaśnienie web≠kanał |
