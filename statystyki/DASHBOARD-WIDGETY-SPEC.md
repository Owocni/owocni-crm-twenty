---
doc_id: DASHBOARD_WIDGETY_SPEC
title: "Specyfikacja widgetów dashboardów sprzedażowych (Twenty EA)"
layer: research_plan
status: draft
owner: "Dawid (implementacja) / Właściciel (akceptacja UI)"
last_updated: 2026-07-09
default_trust: D:RESEARCH
related:
  - PLAN-MODUL-STATYSTYK.md
  - METRICS.md
  - BIZSOURCE-MAP.md
---

# Specyfikacja widgetów — gotowa do klikania w Twenty

> **Status:** plan wykonawczy (nie SSOT). Kanon formuł → `METRICS.md`.  
> **Wymaganie:** Early Access → Dashboards włączone w Settings → Updates.

## 0. Bilans widgetów

| Dashboard | Taby | Widgetów łącznie | Uwagi |
|-----------|------|-------------------|--------|
| **Sprzedaż — Oceny** | 4 (7/14/30/90 dni) | **36** | 9 typów × 4 taby; M7/M9 stock — kopia identyczna w każdym tabie |
| **Sprzedaż — Zespół** | 1 (brak tabów) | **16** | KPI + wykresy globalne i per produkt |
| **Razem** | — | **52** | + 2× Rich Text (nagłówki sekcji) = opcjonalnie 54 |

Zmiana definicji metryki = edycja wszystkich kopii widgetu (4× na „Oceny") — akceptowalne; trzymać zgodność z `METRICS.md`.

---

## 1. Wymagania wstępne (przed pierwszym widgetem)

### 1.1 Pola Opportunity (utworzyć w Settings)

| API name | Typ | Freeze | Opis skrót |
|----------|-----|--------|------------|
| `qualifiedAt` | DATE_TIME | OPEN | Pierwsze wejście w QUALIFIED |
| `hoursToQualified` | NUMBER (2 dec.) | OPEN | Godziny od `createdAt` do SQL |
| `stageClosedAt` | DATE_TIME | OPEN | Faktyczne zamknięcie WON/LOST |
| `daysToClose` | NUMBER (2 dec.) | OPEN | Dni od `createdAt` do zamknięcia |
| `firstResponseAt` | DATE_TIME | OPEN | Pierwszy mail wychodzący |
| `hoursToFirstResponse` | NUMBER (2 dec.) | OPEN | Godziny do pierwszej odpowiedzi |
| `bizProduct` | SELECT | FROZEN | Produkt — wartości z PF-9 |
| `bizSource` | SELECT | OPEN | Kanał — wartości z `BIZSOURCE-MAP.md` |

**Nie tworzymy:** `daysToQualified`, `qualifiedDurationLabel`, `firstResponseDurationLabel` — M2/M3 **zawsze w godzinach** (decyzja właściciela 2026-07-09).

### 1.2 Workflow

| Nazwa | Trigger | Kontrakt |
|-------|---------|----------|
| Track Stage Time | Record Updated · `stage` only | `track-stage-time.contract (1).md` (B1: zapisuje `hoursToQualified`) |
| First Outbound Response | Message/thread created lub Record Updated (mail) | **do utworzenia** — PF-M2 |

### 1.3 Uprawnienia

- Pola metryk (6 + 2 SELECT): **read-only** dla ról handlowców.
- Dashboardy: **jawne** dla workspace (D-11).

### 1.4 Filtr legacy (metryki czasowe M1–M3)

Na wszystkich widgetach średnich czasów:

```
srcSystem is not BETTER_BITRIX_LEGACY
```

---

## 2. Dashboard „Sprzedaż — Oceny"

**Cel:** porównanie handlowców × produkt w oknach czasowych.  
**Taby (nazwy dokładne):**

| Tab | Relative date na widgetach kohortowych |
|-----|----------------------------------------|
| `7 dni` | Past 7 days |
| `14 dni` | Past 14 days |
| `30 dni` | Past 30 days |
| `90 dni` | Past 90 days |

**Wspólna konfiguracja wykresów słupkowych (M1–M4, M6):**

- Source: **Opportunities**
- Chart: **Bar**
- X-axis: **Owner** (handlowiec — PF-1 potwierdza pole)
- Group by: **`bizProduct`**
- Filtr dodatkowy na każdym widgecie: według tabeli poniżej

### 2.1 Widgety per tab (9 szt. × 4 taby = 36)

| # | ID | Tytuł widgetu | Typ | Y / agregacja | Kohorta (pole daty) | Populacja (filtry AND) | Uwagi |
|---|-----|---------------|-----|---------------|---------------------|------------------------|-------|
| W-O-1 | M1 | Śr. cykl sprzedaży | Bar | **Average** `daysToClose` · suffix „ dni" | `stageClosedAt` relative = tab | `stage = WON` · legacy ≠ | |
| W-O-2 | M2 | Śr. czas 1. odpowiedzi | Bar | **Average** `hoursToFirstResponse` · suffix „ h" | `createdAt` relative = tab | `hoursToFirstResponse` is not empty | |
| W-O-3 | M3 | Śr. czas do SQL | Bar | **Average** `hoursToQualified` · suffix „ h" | `qualifiedAt` relative = tab | `qualifiedAt` is not empty · legacy ≠ | **zawsze godziny** |
| W-O-4 | M4 | Win Rate | Bar | **`stage`** · **Ratio → WON** · suffix „%" | `stageClosedAt` relative = tab | `stage is any of (WON, LOST)` | PF-5: Ratio w bar |
| W-O-5 | M6 | Świeże otwarte (okno) | Bar | **Count** all | `createdAt` relative = tab | `stage is none of (WON, LOST)` | `campaignRejected` zostaje |
| W-O-6 | M7 | SQL w pipeline | Bar | **Count** all | **brak** (stock) | `qualifiedAt` is not empty · `stage is none of (WON, LOST)` | identyczny we wszystkich tabach |
| W-O-7 | M9 | Otwarte w pipeline | Bar | **Count** all | **brak** (stock) | `stage is none of (WON, LOST)` | identyczny we wszystkich tabach |
| W-O-8 | — | Kontekst: lejek handlowca | Bar | **Count** all | brak | opcjonalnie filtr owner w przyszłości | X=`stage` · sort Position · **bez** Group by — jeden słupek na stage globalnie w tabie; alternatywa: pominąć na „Oceny" |
| W-O-9 | — | *(rezerwa M5)* | — | — | — | — | M5 tylko na „Zespół" (za mało danych per handlowiec × kanał) |

**Układ wizualny taba (sugerowany):**

```
Rząd 1: [M9 stock] [M7 stock]     ← KPI liczby (można Aggregate zamiast Bar)
Rząd 2: [M1] [M2] [M3]            ← czasy (bary)
Rząd 3: [M4] [M6]                 ← WR + kohorta
```

Dla W-O-6 i W-O-7 **preferowany typ Aggregate (kafelek)** zamiast Bar — czytelniejsze KPI; Bar zostaw jeśli chcesz rozbicie per handlowiec bez Group by produktu.

**Wariant KPI (zalecany) dla M7/M9 na „Oceny":**

| # | Tytuł | Typ | Y | Filtry |
|---|-------|-----|---|--------|
| W-O-6b | SQL w pipeline | **Aggregate** | Count | `qualifiedAt` not empty · stage otwarty · opcjonalnie **Filter owner is not empty** — patrz PF-1 |
| W-O-7b | Otwarte w pipeline | **Aggregate** | Count | stage otwarty |

Aby mieć **per handlowiec** na stock: Bar · X=Owner · Y=Count · filtry stock · **bez** Group by.

### 2.2 Checklist klonowania tabów

1. Zbuduj pełny tab **„30 dni"** jako wzorzec.
2. Zduplikuj tab → zmień nazwę i **wyłącznie** relative date na widgetach W-O-1…W-O-5.
3. W-O-6, W-O-7 (stock): **nie zmieniaj** daty między tabami.
4. Powtórz dla 7 / 14 / 90 dni.

---

## 3. Dashboard „Sprzedaż — Zespół"

**Cel:** totale firmy, per produkt, kanały, trend — **bez osi handlowiec**.

### 3.1 Sekcja A — KPI globalne (Aggregate)

| # | ID | Tytuł | Y | Filtry | Relative date |
|---|-----|-------|---|--------|---------------|
| W-Z-1 | M9 | Otwarte w pipeline (teraz) | Count | stage otwarty | brak |
| W-Z-2 | M7 | SQL w pipeline (teraz) | Count | qualifiedAt + stage otwarty | brak |
| W-Z-3 | M1 | Śr. cykl (90 dni) | Average `daysToClose` | WON · legacy ≠ | `stageClosedAt` Past 90 days |
| W-Z-4 | M2 | Śr. 1. odpowiedź (90 dni) | Average `hoursToFirstResponse` | pole not empty | `createdAt` Past 90 days |
| W-Z-5 | M3 | Śr. czas do SQL (90 dni) | Average `hoursToQualified` | qualifiedAt + legacy ≠ | `qualifiedAt` Past 90 days |
| W-Z-6 | M4 | Win Rate (90 dni) | Ratio stage→WON | WON+LOST | `stageClosedAt` Past 90 days |
| W-Z-7 | M6 | Świeże otwarte (90 dni) | Count | createdAt 90d + stage otwarty | `createdAt` Past 90 days |
| W-Z-8 | HIG | Leady bez produktu | Count | `bizProduct is empty` | brak |

### 3.2 Sekcja B — per produkt (Bar · X = `bizProduct`)

| # | ID | Tytuł | Y | Filtry kohorty | Relative |
|---|-----|-------|---|----------------|----------|
| W-Z-9 | M1 | Cykl per produkt | Average `daysToClose` | WON · legacy ≠ | `stageClosedAt` Past 90 days |
| W-Z-10 | M2 | 1. odpowiedź per produkt | Average `hoursToFirstResponse` | hours not empty | `createdAt` Past 90 days |
| W-Z-11 | M3 | Czas do SQL per produkt | Average `hoursToQualified` | qualifiedAt · legacy ≠ | `qualifiedAt` Past 90 days |
| W-Z-12 | M4 | Win Rate per produkt | Ratio stage→WON | WON+LOST | `stageClosedAt` Past 90 days |
| W-Z-13 | M9 | Otwarte per produkt | Count | stage otwarty | brak |
| W-Z-14 | M7 | SQL per produkt | Count | qualifiedAt + otwarty | brak |

### 3.3 Sekcja C — kanały i trend

| # | ID | Tytuł | Typ | Oś X | Y | Filtry |
|---|-----|-------|-----|------|---|--------|
| W-Z-15 | M5 | Win Rate per kanał | Bar | `bizSource` | Ratio stage→WON | WON+LOST · `stageClosedAt` Past 90 days |
| W-Z-16 | M8a | Napływ (miesięcznie) | Bar | `createdAt` (Month) | Count | legacy ≠ |
| W-Z-17 | M8b | Odpływ (miesięcznie) | Bar | `stageClosedAt` (Month) | Count | WON+LOST · legacy ≠ |
| W-Z-18 | — | Lejek (kształt pipeline) | Bar | `stage` (Position) | Count | brak |

W-Z-16 i W-Z-17 obok siebie — **ta sama skala Y** (ręcznie wyrównać max).

---

## 4. Macierz filtrów (kanon — kopiuj 1:1)

| Metryka | Pole kohorty | Relative na „Oceny" | Populacja |
|---------|--------------|---------------------|-----------|
| M1 | `stageClosedAt` | = tab | `stage=WON` · `srcSystem ≠ LEGACY` |
| M2 | `createdAt` | = tab | `hoursToFirstResponse` not empty |
| M3 | `qualifiedAt` | = tab | `qualifiedAt` not empty · `srcSystem ≠ LEGACY` |
| M4 | `stageClosedAt` | = tab | `stage any of WON,LOST` |
| M5 | `stageClosedAt` | 90d na Zespół | jak M4 |
| M6 | `createdAt` | = tab | stage otwarty |
| M7 | — | brak | `qualifiedAt` not empty · stage otwarty |
| M8 napływ | `createdAt` | Month | `srcSystem ≠ LEGACY` |
| M8 odpływ | `stageClosedAt` | Month | WON+LOST · `srcSystem ≠ LEGACY` |
| M9 | — | brak | stage otwarty |

---

## 5. Workflow — zmiany względem draftu

### 5.1 Track Stage Time — gałąź B1 (M3)

Code node liczy **godziny** (nie dni):

```javascript
const hours = Math.round(((now.getTime() - created.getTime()) / 3_600_000) * 100) / 100;
return { now: now.toISOString(), hours };
```

Update B1: `qualifiedAt` = now · `hoursToQualified` = `{{code.hours}}`

### 5.2 Workflow „First Outbound Response" (M2) — szkic

| Element | Wartość |
|---------|---------|
| Trigger | Do ustalenia w PF-M2 (Message created / Email linked to Opportunity) |
| Warunek | Pierwszy outbound · `hoursToFirstResponse` puste |
| Update | `firstResponseAt` · `hoursToFirstResponse` = (firstOutbound − `createdAt`) / 3_600_000 |
| Known-edge | wartość < 0 → clamp 0 lub null (METRICS) |

---

## 6. Adapter — `bizSource` (skrót)

Pełna mapa → [`BIZSOURCE-MAP.md`](./BIZSOURCE-MAP.md).

| Wejście | `bizSource` |
|---------|-------------|
| Leads@ / Email Sync / `inbound_channel=leads_at` | **`direct-email`** |
| UTM google / gclid | `google` |
| UTM facebook / fbclid | `facebook` |
| Brak UTM, ruch organiczny | `organic` |
| Referral znany | `referral` |
| Telefon / ręczny CRM | `manual` |
| Nierozpoznane | `other` lub `unknown` |

**Ważne:** `web` **nie jest kanałem** — to była myląca domyślka `biz_product` w adapterze mailowym (produkt ≠ kanał).

---

## 7. Kolejność prac Dawida (D1 → D2)

```
□ PF-0  Wersja Twenty + OPS_NOTES
□ PF-1  Owner na wykresach (filter + group by)
□ PF-9  Lista bizProduct + BIZSOURCE-MAP zatwierdzona
□ PF-2  Utworzenie 8 pól + opisy Settings
□ PF-3  Workflow Track Stage Time (hoursToQualified)
□ PF-M2 Workflow pierwszej odpowiedzi
□ PF-4  Adapter SKIP po zapisie pól metryk
□ PF-5  Ratio + Average na sandboxie
□ PF-7  Import legacy + srcSystem
□ PF-6  Kredyty (opcjonalnie)
□ D2    Dashboard „Zespół" (wzorzec 16 widgetów)
□ D2    Dashboard „Oceny" (tab 30d → klon 7/14/90)
□ D2    Weryfikacja §8 METRICS.md (CSV vs dashboard)
```

---

## 8. Weryfikacja po zbudowaniu

| Widget | Test |
|--------|------|
| M4 / M5 Ratio | 20 rekordów ręcznie vs widget |
| M1–M3 Average | Eksport CSV tych samych filtrów vs dashboard |
| M9 stock | Liczba = widok Kanban „wszystkie otwarte" |
| M7 stock | Liczba = Kanban filtr „qualifiedAt not empty" + otwarte |
| `bizSource=direct-email` | Nowy lead z Leads@ ma kanał, nie `web` |

---

## LEGENDA

Szczegóły formuł → `METRICS.md` · Plan faz → `PLAN-MODUL-STATYSTYK.md` · Kanały → `BIZSOURCE-MAP.md`
