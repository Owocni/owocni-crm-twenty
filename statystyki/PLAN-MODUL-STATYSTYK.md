---
doc_id: PLAN_STATYSTYKI
title: "Plan modułu statystyk sprzedażowych (KPI Dashboard)"
layer: research_plan
status: draft
owner: "Właściciel (semantyka) / Dawid (techniczny)"
last_updated: 2026-07-09
decisions_owner: "2026-07-09 — Email Sync; M2/M3 zawsze godz.; stock M9; kanały D-15 z direct-email"
default_trust: D:RESEARCH
---

# Plan modułu statystyk — tablica KPI w Twenty CRM

## 0. Cel i zakres tego dokumentu

**Cel biznesowy:** tablica KPI (dashboardy Twenty) z metrykami sprzedażowymi w przekroju **produkt × handlowiec × okres czasu**.

**Co robi ten plan:** mapuje Twoje wymagania na istniejący research, wskazuje luki i sprzeczności, proponuje architekturę i kolejność wdrożenia.

**Czego ten plan NIE robi:** nie zmienia SSOT (`owocni-crm/`), nie tworzy pól w Twenty, nie aktywuje workflow. To warstwa planowania przed decyzją właściciela i ADR.

---

## 1. Mapowanie wymagań → metryki

### 1.1 Trzy parametry czasowe (per produkt, per user)

| Twoje wymaganie | ID w researchu | Formuła (propozycja z researchu) | Jednostka | Gotowość |
|-----------------|----------------|----------------------------------|-----------|----------|
| Średni czas odpowiedzi na pierwszego maila | **M2** | `createdAt` → timestamp **pierwszego maila wychodzącego** powiązanego z rekordem | **godziny** (`hoursToFirstResponse`) | **D2** — Email Sync **gotowy** (właściciel 2026-07-09) |
| Średni czas do SQL | **M3** | `createdAt` → **pierwsze** wejście w `QUALIFIED` | **godziny** (`hoursToQualified`) — zawsze | **D2** |
| Średni czas całego cyklu sprzedaży (do Win) | **M1** | `createdAt` → wejście w `WON` (`stageClosedAt`, filtr `stage = WON`) | **dni** (`daysToClose`) | **D2** po polach + workflow |

**Wymiar „per user”:** Opportunity owner (relacja do Workspace Member). Wymaga potwierdzenia na instancji — **preflight PF-1** (czy dashboard filtruje i grupuje po owner).

**Wymiar „per produkt”:** pole `bizProduct` (SELECT, wartości = kanon Pricing Key z Sortowni). Pole zaprojektowane w `DATA_MODEL.md`, **jeszcze nieutworzone** — blokuje **PF-9** (odczyt SSOT Sortowni).

### 1.2 Pozostałe metryki

| Twoje wymaganie | ID | Formuła | Gotowość |
|-----------------|-----|---------|----------|
| Win Rate | **M4** | COUNT(WON) / COUNT(WON + LOST) w oknie po `stageClosedAt` | **TAK natywnie** (Ratio na polu `stage`) po zawężeniu filtrem |
| Win Rate per kanał (Google, Facebook, …) | **M5** | M4 grupowane po `bizSource` | Po utworzeniu pola kanału + PF-5 (Ratio w wykresie słupkowym) |
| Ilość leadów w pipeline (**stock — teraz**) | **M9** | COUNT, `stage is none of (WON, LOST)`, **bez filtra dat** | **TAK** — **decyzja właściciela: TAK** (2026-07-09) |
| Świeże otwarte w oknie (kohorta) | **M6** | COUNT(`createdAt` w oknie ∧ stage otwarty) | **TAK** — uzupełnia M9 (nie zastępuje) |
| Ilość leadów SQL w pipeline | **M7** | Wariant B (rekomendowany): `qualifiedAt` niepuste ∧ stage ∉ {WON, LOST} | **TAK** (Count + filtr) — **stock**, bez okna dat |

### 1.3 Metryki dodatkowe w researchu (poza Twoją listą)

| ID | Co mierzy | Po co |
|----|-----------|-------|
| **M8** | Napływ vs odpływ (COUNT/miesiąc: `createdAt` vs `stageClosedAt`) | Trend kurczenia/rozszerzania pipeline bez snapshotów historycznych |
| Widget higieny | COUNT rekordów z pustym `bizProduct` | Leady niewidoczne w przekrojach per produkt (NR-5 w METRICS) |

---

## 2. Decyzje właściciela (2026-07-09) — zamknięte

### 2.1 M2 i M3 — zawsze godziny ✅

**Decyzja (2026-07-09):** M2 i M3 wyłącznie w **godzinach** — bez przełączania na dni, bez pól tekstowych „3 dni i 5 godzin".

| Metryka | Pole | Dashboard suffix |
|---------|------|------------------|
| M2 | `hoursToFirstResponse` | ` h` |
| M3 | `hoursToQualified` | ` h` |

M1 (cykl do Win) zostaje w **dniach** (`daysToClose`) — inna skala biznesowa.

Pola **nie tworzymy:** `daysToQualified`, `qualifiedDurationLabel`, `firstResponseDurationLabel`.

### 2.2 Stock pipeline (M9) ✅

**Decyzja:** TAK — oprócz kohorty M6 potrzebny widget **stanu bieżącego**.

| ID | Pytanie | Widget |
|----|---------|--------|
| **M9** | Ile leadów jest **teraz** otwartych? | Count · `stage is none of (WON, LOST)` · **bez filtra dat** |
| **M6** | Ile **świeżych** z okna nadal leży? | Count · `createdAt` relative ∧ stage otwarty |

Oba na dashboardzie „Zespół" i w tabach „Oceny" (M9 bez okna dat — identyczna wartość we wszystkich tabach, jak M7).

### 2.3 M2 — Email Sync ✅

**Decyzja (właściciel):** Email Sync **już działa** w Twenty.

**Konsekwencja:** M2 wchodzi do **D2** razem z resztą — nie osobna faza D3. Nadal potrzebny:

- pola `firstResponseAt` + `hoursToFirstResponse`,
- workflow na **pierwszym mailu wychodzącym** powiązanym z Opportunity,
- preflight **PF-M2:** czy timeline/message API pozwala wykryć pierwszy outbound i powiązać z rekordem (test na instancji).

### 2.4 PF-9 — co to jest (wyjaśnienie dla właściciela)

**PF-9 to nie decyzja biznesowa — to checklist techniczny dla Dawida** przed kliknięciem „Utwórz pole SELECT" w Twenty.

#### Problem w jednym zdaniu

Pole `bizProduct` w Twenty musi być listą rozwijaną (SELECT). **Wartości tej listy są prawie nieodwracalne** — jak raz utworzysz `strony`, nie zmienisz tego łatwo na `web`. Musimy więc **najpierw odczytać z kodu Sortowni**, jakie produkty faktycznie istnieją, i skopiować je 1:1.

#### Dlaczego to ważne dla statystyk

Dashboard „per produkt" grupuje po `bizProduct`. Jeśli w Twenty wpiszemy `web`, a Sortownia wysyła `strony` — leady wpadną z pustym produktem i **znikną z wykresów** (albo trafią do widgetu higieny „bizProduct is empty").

#### Co już wiemy z kodu (Dawid domyka PF-9 — Ty nie musisz zgadywać)

Z `integrations/SORTOWNIA_V2_POPRAWIONY.js` wynika m.in.:

| Wartość `biz_product` | Skąd |
|------------------------|------|
| `strony` | formularz / URL stron |
| `logo` | formularz / URL logo |
| `nazwa` | formularz / URL naming |
| `strategia`, `konsultacje`, `copywriting` | inferencja z URL |
| `web` | domyślka w adapterze mailowym (Leads@) |

To **nie jest jeszcze kanon** — PF-9 = Dawid składa pełną listę + porównuje z regułami Pricing Key (`lead_strony`, `sql_logo`, …) i dopiero wtedy tworzy SELECT w Twenty.

#### A co z kanałem (Google, Facebook) — `bizSource`?

Win Rate per kanał (M5) potrzebuje pola w Twenty, np. `bizSource`.

- **Master atrybucji** = Sortownia (UTM: `attr_utm_source`, medium, campaign).
- **Twenty** = kopia (projekcja) zapisywana przy tworzeniu leada przez adapter.
- W payloadzie **prawdopodobnie nie ma** gotowego `biz_source` — adapter musi **zmapować** UTM → `google` / `facebook` / `organic` / …

**Twoja decyzja (D-15, zamknięte):** lista kanałów OK z korektą — lead z maila = **`direct-email`**, nie `web`. Pełna mapa → [`BIZSOURCE-MAP.md`](./BIZSOURCE-MAP.md).

| API value | Znaczenie |
|-----------|-----------|
| `google` | Google Ads |
| `facebook` | Meta |
| `organic` | Strona / SEO (formularz, bez paid UTM) |
| `referral` | Polecenie |
| **`direct-email`** | **Bezpośredni mail na skrzynkę (Leads@)** |
| `manual` | Telefon / ręczny wpis |
| `other` / `unknown` | Reszta |

**Uwaga:** `web` w starym kodzie adaptera to był **`biz_product`** (produkt), nie kanał — do rozplątania w PF-9.

#### Podsumowanie: co od Ciebie w PF-9?

| Od właściciela | Od Dawida (PF-9) |
|----------------|------------------|
| Lista kanałów marketingowych do M5 (Google, Facebook, …) | Pełna lista produktów z Sortowni |
| Etykiety PL w UI Twenty („Strony", „Logo" — opcjonalnie) | Mapa UTM → kanał w adapterze |
| — | Utworzenie pól SELECT z poprawnymi wartościami API |

### 2.5 Konflikt numeru ADR

W `DECISION_REGISTER.md` **ADR #17 = szablony maili**. Research dashboardów proponował ADR #17 dla analityki — **numer zajęty**. Przy promocji do SSOT: **nowy numer ADR** (np. **#18**) dla modułu statystyk.


---

## 3. Architektura (3 warstwy)

```
┌─────────────────────────────────────────────────────────────┐
│ WARSTWA 3: PREZENTACJA (wymienna, beta EA)                  │
│  Dashboard „Sprzedaż — Oceny”  — per handlowiec × produkt   │
│  Dashboard „Sprzedaż — Zespół” — agregaty, M8, lejek        │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│ WARSTWA 2: MECHANIZM WYPEŁNIANIA (wymienny)                 │
│  Dziś: workflow „Track Stage Time” (oficjalny przepis Twenty)│
│  Jutro: natywne formula fields (zapowiedź 2026)             │
│  M2: workflow na pierwszym mailu wychodzącym (D2, PF-M2)      │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│ WARSTWA 1: DANE (fundament)                                 │
│  Opportunity: qualifiedAt, hoursToQualified, stageClosedAt, │
│               daysToClose, bizProduct, bizSource              │
│  M2: firstResponseAt, hoursToFirstResponse                    │
│  CRM-only — NIGDY do payloadów SSOT (Prawo 6)               │
└─────────────────────────────────────────────────────────────┘
```

**Dlaczego nie GCS/Sortownia:** eventy SSOT obejmują qualify_lead, purchase, rejected_lead — **nie** LOST, CONTACTED, PROPOSAL ani czasy pipeline. Metryki operacyjne per handlowiec = domena Twenty (`ARCHITECTURE.md`, Prawo 6a).

---

## 4. Dashboardy — układ docelowy

### 4.1 Dashboard „Sprzedaż — Oceny”

- **Taby = okna czasowe:** 7 / 14 / 30 / 90 dni (relative filter per tab)
- **Oś X:** handlowiec (owner)
- **Group by:** `bizProduct` (słupki per produkt na handlowca)
- **Metryki:** M1, M2, M3, M4, M6, M7, M9
- M5 (WR per kanał): globalnie na tym dashboardzie (per handlowiec × kanał = zbyt rzadkie dane przy ~150 leadów/mc)

### 4.2 Dashboard „Sprzedaż — Zespół”

- Totale i rozbicie **per produkt** (bez osi handlowiec)
- M8 napływ/odpływ, lejek (Count per `stage`), widget higieny (`bizProduct` empty)
- Porównania między handlowcami **tylko** w „Oceny” (decyzja D-11: wszystko jawne w workspace)

### 4.3 Ograniczenia platformy (zaakceptowane)

| Ograniczenie | Obejście |
|--------------|----------|
| Brak filtra globalnego dashboardu | Ten sam zestaw widgetów × 4 taby z relative date |
| Dashboardy widoczne dla całego workspace | Świadoma decyzja D-11; ochrona = read-only pól metryk |
| Brak tabel / gauge | Aggregate KPI + Bar/Line tam, gdzie wymiar kategorii |
| Strefa czasowa = oglądającego | Fakt platformy; dokumentować w OPS_NOTES |

Szczegóły widgetów (52 szt.) → [`DASHBOARD-WIDGETY-SPEC.md`](./DASHBOARD-WIDGETY-SPEC.md).

---

## 5. Pola do utworzenia (delta względem dziś)

| Pole | Typ | Kto pisze | Metryki |
|------|-----|-----------|---------|
| `qualifiedAt` | DATE_TIME | Workflow B1 | M3, M7 |
| `hoursToQualified` | NUMBER | Workflow B1 | M3 (Average, godz.) |
| `stageClosedAt` | DATE_TIME | Workflow B2/B3 | M1, M4, M5, M8 |
| `daysToClose` | NUMBER | Workflow B2/B3 | M1 |
| `bizProduct` | SELECT | Formularz/adapter | wymiar wszystkich |
| `bizSource` | SELECT | Adapter inbound | M5 — enum: `BIZSOURCE-MAP.md` |
| `firstResponseAt` | DATE_TIME | Workflow M2 | M2 |
| `hoursToFirstResponse` | NUMBER | Workflow M2 | M2 (Average, godz.) |

Workflow: kontrakt w `track-stage-time.contract (1).md` — gałęzie B1–B5, trigger **tylko** na zmianę `stage`.

**Istniejące już w modelu:** `stage`, `srcSystem`, `createdAt` (natywne), `campaignRejected` (nie wyklucza z pipeline — NR-2).

---

## 6. Decyzje właściciela (D0) — checklist przed D1

| ID | Pytanie | Status w researchu |
|----|---------|-------------------|
| D-1 | Wartości `bizProduct` — kanon z Sortowni (PF-9) | Otwarte do PF-9 |
| D-2 | Pole i mapa kanału (`bizSource` / inna nazwa) | Kierunek: projekcja z Sortowni |
| D-3 | Definicja SQL w pipeline (M7) | **Rozstrzygnięte: wariant B** |
| D-4 | Mianownik Win Rate | **Rozstrzygnięte: WON/(WON+LOST)** |
| D-5 | Legacy z Bitrix w metrykach czasowych | **Rozstrzygnięte: filtr `srcSystem`** |
| D-6 | M1 tylko WON czy też LOST | Rekomendacja: główny = WON |
| D-7 | Nazwa pola zamknięcia: `stageClosedAt` | Rekomendacja: tak (≠ natywne `closeDate`) |
| D-8 | `qualifiedAt`: pierwsze vs ostatnie wejście SQL | **Rozstrzygnięte: pierwsze** |
| D-9 | Gałąź czyszcząca przy reopen | **Rozstrzygnięte: B4/B5** |
| D-10 | Historia wielkości pipeline | **Rozstrzygnięte: bez snapshotów** |
| D-11 | Widoczność per handlowiec | **Rozstrzygnięte: wszystko jawne** |
| **D-12** | M3: format czasu | **Zamknięte: zawsze godziny** (jak M2) |
| **D-13** | Stock pipeline (M9) | **Zamknięte: TAK** |
| **D-14** | ADR modułu statystyk | **#18** (#17 zajęte) |
| **D-15** | Lista kanałów M5 | **Zamknięte** — `BIZSOURCE-MAP.md` (`direct-email`) |

---

## 7. Plan wdrożenia (fazy)

```
D0 ──► Decyzje właściciela (§6) + ADR #18 (analytics)
         │
D1 ──► Preflight sandbox (PF-0 … PF-9)
         │  PASS: owner, workflow, Ratio, SKIP adaptera, legacy import
         ▼
D2 ──► Produkcja
         │  1. Pola (+ opisy Settings) — w tym M2 i M3
         │  2. Workflow Track Stage Time + workflow M2 (first outbound)
         │  3. Workflow OFF → import → workflow ON (Prawo 7c)
         │  4. Field-level read-only dla handlowców
         │  5. Early Access ON → dashboardy (M1–M7, M9, M2)
         │  6. Promocja METRICS.md → owocni-crm/ + OPS_NOTES delta
```

### Warunki NO-GO (skrót)

1. PF-1 fail — nie da się grupować per handlowiec  
2. PF-3 fail — workflow retriggeruje się po zapisie własnych pól  
3. PF-4 fail — adapter emituje event po zapisie pól metryk  
4. PF-7 fail — import nie ustawia `srcSystem = BETTER_BITRIX_LEGACY`  
5. PF-5 fail — Ratio nie zgadza się z ręcznym CSV  
6. PF-9 fail — brak kanonu `bizProduct` / atrybucji  

Pełna tabela PF → `WYTYCZNE-DASHBOARDY-SPRZEDAZ.md` §7.

### Relacja do cutoveru CRM

**Zero sprzężenia z G1–G8.** Jedyny wspólny punkt: workflow OFF podczas importu (globalna dyscyplina).

---

## 8. Co promować do SSOT (po D0 + akceptacji)

| Artefakt | Docelowa lokalizacja | Kiedy |
|----------|---------------------|-------|
| `METRICS.md` | `owocni-crm/METRICS.md` | Po D0, razem z ADR |
| Delta 6 pól | `owocni-crm/DATA_MODEL.md` §5.1 | Po D0 |
| Kontrakt workflow | `workflows/track-stage-time.contract.md` | Przed aktywacją workflow |
| Fakty platformowe §1 | `owocni-crm/ops/OPS_NOTES.md` §5.1 | Po PF-0 |
| ADR analytics | `owocni-crm/DECISION_REGISTER.md` | D0 open → D2 closed z evidence |
| Ten plan | `statystyki/PLAN-MODUL-STATYSTYK.md` | Zostaje jako historia planowania lub archiwum |

**Nie promować:** konfiguracji widget-po-widgecie jako osobnego SSOT (prezentacja ≠ kanon liczb).

---

## 9. Weryfikacja po wdrożeniu

| Test | Dowód |
|------|-------|
| M4 Ratio = ręczne przeliczenie 20 rekordów | Zrzut + arkusz |
| AVG dashboardu = AVG z CSV tych samych filtrów | Porównanie |
| `stageClosedAt` niepuste ⇒ stage terminalny (próbka) | Zapytanie API po 30 dniach |
| 100% legacy ma `srcSystem = BETTER_BITRIX_LEGACY` | Zapytanie przed włączeniem workflow |
| Adapter: zapis pól metryk → SKIP, zero EMITTED | Log PF-4 |

---

## 10. Podsumowanie dla właściciela

| Obszar | Werdykt |
|--------|---------|
| Czy da się to zrobić w Twenty? | **Tak** — z custom polami + workflow (oficjalny wzorzec Twenty) + dashboardy EA |
| Ile metryk „z pudełka” bez pól? | **2–3** (M4, częściowo M6/M7 po definicji) |
| Co blokuje start? | **PF-9** (Dawid: kanon `bizProduct` + wdrożenie `bizSource` w adapterze) |
| Co odroczone? | **Nic** z Twojej listy — M2 wchodzi do D2 (Email Sync gotowy) |
| Koszt operacyjny | Niski (workflow ~standardowe kroki; pomiar PF-6); dashboardy beta — akceptacja ograniczeń §4.3 |
| Ryzyko dla cutoveru | **Brak** — moduł nie dotyka eventów SSOT |

**Następny krok:** ADR #18 + D1 sandbox według [`DASHBOARD-WIDGETY-SPEC.md`](./DASHBOARD-WIDGETY-SPEC.md) §7.

---

## LEGENDA

`[D:CORE]` decyzja OWOCNI · `[D:VERIFIED]` fakt z platformy · `[D:RESEARCH]` rekomendacja / ten plan · `[D:OPEN]` świadomie otwarte.
