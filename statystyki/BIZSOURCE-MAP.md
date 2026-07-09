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
| **`bizSource`** | **Skąd przyszedł lead** (atrybucja) | `google`, `direct-email` |

**Błąd do naprawienia:** adapter Leads@ ustawiał `biz_product: "web"` — to sugeruje **produkt „web"**, nie kanał. Lead z maila na skrzynkę to kanał **`direct-email`**; produkt nadal wynika z formularza / rozmowy / PF-9 (może być pusty do czasu kwalifikacji).

---

## 1. Enum `bizSource` (SELECT w Twenty)

Wartości API (małe litery, myślnik) — **zamknięta lista D-15:**

| API value | Etykieta UI (PL) | Znaczenie |
|-----------|------------------|-----------|
| `google` | Google Ads | Paid/search Google (utm, gclid) |
| `facebook` | Facebook / Meta | Paid social Meta |
| `organic` | Organic / strona | Ruch z witryny bez paid UTM (SEO, direct URL) |
| `referral` | Polecenie | Referral / partner / znany referrer |
| `direct-email` | Mail bezpośredni | Lead na skrzynkę (Leads@, Email Sync) — **nie mylić z „web"** |
| `manual` | Ręcznie / telefon | Handlowiec wpisał, telefon, spotkanie |
| `other` | Inne | Rozpoznane, ale bez dedykowanej kategorii |
| `unknown` | Nieznane | Brak danych atrybucyjnych |

**Nie używamy:** `web` jako kanału · `email` jako ogólnego (zastąpione przez `direct-email`).

---

## 2. Reguły mapowania (adapter inbound → Twenty)

Kolejność ma znaczenie — **pierwsze dopasowanie wygrywa.**

| Priorytet | Warunek wejścia | `bizSource` |
|-----------|-----------------|-------------|
| 1 | `inbound_channel = leads_at` LUB `src_action_source` zawiera `email_sync` LUB `src_system = TWENTY_EMAIL` przy create z maila | **`direct-email`** |
| 2 | `src_system = TWENTY_UI` i brak UTM (handlowiec) | `manual` |
| 3 | `attr_utm_source` / URL: google, gclid | `google` |
| 4 | facebook, fb, meta, fbclid | `facebook` |
| 5 | referral w UTM / znany partner | `referral` |
| 6 | Formularz ze strony, brak paid UTM | `organic` |
| 7 | Dane są, ale nie pasuje | `other` |
| 8 | Brak jakichkolwiek sygnałów | `unknown` |

### 2.1 `organic` vs `direct-email`

| Sytuacja | Kanał |
|----------|-------|
| Klient wypełnił formularz na owocni.pl | `organic` (lub `google`/`facebook` jeśli UTM paid) |
| Klient napisał **bezpośrednio na adres mailowy** firmy (Leads@) | **`direct-email`** |
| Handlowiec dodał kartę po rozmowie telefonicznej | `manual` |

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
