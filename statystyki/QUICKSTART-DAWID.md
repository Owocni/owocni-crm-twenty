# Statystyki sprzedażowe — start dla Dawida

> **Ty jesteś tutaj:** pierwszy plik do przeczytania przed wdrożeniem w Twenty.  
> **Status:** plan roboczy (`statystyki/`), nie SSOT — po wdrożeniu część trafi do `owocni-crm/`.

---

## Ręcznie vs Cursor — co jest czym

| Etap | Jak | Kto |
|------|-----|-----|
| **Review dokumentacji** (teraz) | Czytanie plików na GitHubie | Właściciel + Ty |
| **ADR #18 open** | Edycja jednego pliku markdown (`DECISION_REGISTER.md`) | Ty lub Cursor na Twoją prośbę |
| **PF-0…PF-9** (preflight) | **Klikanie w Twenty** (sandbox): Settings, pola, testowy widget, workflow | **Ty ręcznie** — MCP może pomóc *odczytać*, zapis do Twenty wymaga aprobaty |
| **Kod adaptera** (`direct-email`) | PR w `integrations/` | **Cursor w promptach** — Ty review + deploy |
| **Dashboardy 52 widgety** | **Klikanie w UI Twenty** (nie da się sensownie z MCP) | **Ty ręcznie** wg spec |
| **Promocja do SSOT** | Commit `owocni-crm/METRICS.md` itd. | Po wdrożeniu — Cursor lub ręcznie |

**MCP Twenty nie zastąpi wdrożenia.** Przyspiesza research, kod i docs — **pola, workflow i dashboardy to praca w UI Twenty** (z checklistą obok).

---

## ADR #18 — o co chodzi (bez żargonu)

**Nie musisz podejmować nowej decyzji biznesowej.** Właściciel już powiedział, *co* chce mierzyć.

ADR to **karteczka w repozytorium**:

| | |
|---|---|
| **Co to** | Wpis w [`DECISION_REGISTER.md`](../owocni-crm/DECISION_REGISTER.md): „budujemy moduł statystyk według `statystyki/`" |
| **Po co** | Reguły repo (`AGENTS.md`): nowy moduł poza MVP = musi być zapisany, żeby za rok było wiadomo *dlaczego* to powstało |
| **Co robisz Ty** | Po akceptacji planu przez właściciela: **dodajesz ~15 linii** do DECISION_REGISTER (status *open*) |
| **Co robi właściciel** | Przegląda [`REVIEW-DLA-WLASCICIELA.md`](./REVIEW-DLA-WLASCICIELA.md) i mówi „OK" lub „zmień X" |
| **Zamknięcie** | Po działających dashboardach — ten sam wpis → *closed* + link do evidence |

To **nie blokuje cutoveru CRM**. To porządek w dokumentacji projektu.

---

## Czy dokumentacja jest gotowa do udostępnienia?

| | |
|---|---|
| **Plan do review właściciela** | **TAK — teraz** → wyślij [`REVIEW-DLA-WLASCICIELA.md`](./REVIEW-DLA-WLASCICIELA.md) |
| **Checklist PF / wdrożenie** | **NIE** — to dopiero **po** akceptacji planu |
| **SSOT `owocni-crm/`** | **NIE** — celowo po wdrożeniu |

**Kolejność:**

```
TERAZ     → udostępnij statystyki/ do weryfikacji (bez Twenty, bez kodu)
POTEM     → właściciel OK → ADR #18 open → sandbox → prod
NA KOŃCU  → przeniesienie do owocni-crm/ (SSOT)
```

Checklist w tym pliku **nie musi być ukończony**, żeby dokumentacja była gotowa do review — odwrotnie: **najpierw review, potem checklist**.

---

## TL;DR — co robić **po** akceptacji planu przez właściciela

```
1. ADR #18 open w DECISION_REGISTER (jeden wpis markdown)
2. PF-0 + PF-1 na Twenty sandbox (ręcznie)
3. PF-9: pola SELECT + lista bizProduct
4. Workflow + PF-M2 + mały PR adaptera (Cursor + ręczny deploy)
5. Dashboardy (ręcznie wg spec) → ADR closed → SSOT
```

**Nie zaczynaj od 52 widgetów** — jeden tab „30 dni" jako wzorzec.

---

## Dlaczego „36 widgetów” na „Oceny”?

To **nie jest 36 różnych metryk**. To **9 typów widgetów × 4 taby czasowe**:

| Tab | Różnica między tabami |
|-----|------------------------|
| 7 dni | Relative date = Past 7 days |
| 14 dni | Past 14 days |
| 30 dni | Past 30 days |
| 90 dni | Past 90 days |

Twenty **nie ma** jednego filtra „zakres dat” na cały dashboard — każdy widget kohortowy musi mieć własny relative date. Stąd klonowanie tabów.

**Rzeczywiste typy widgetów na „Oceny” = 7:**

| # | Metryka | Stock? (bez daty) |
|---|---------|-------------------|
| 1 | M1 Śr. cykl | nie |
| 2 | M2 Śr. 1. odpowiedź | nie |
| 3 | M3 Śr. czas do SQL | nie |
| 4 | M4 Win Rate | nie |
| 5 | M6 Świeże otwarte | nie |
| 6 | M7 SQL w pipeline | **tak** — identyczny we wszystkich tabach |
| 7 | M9 Otwarte w pipeline | **tak** — identyczny we wszystkich tabach |

**Można uprościć na start:** jeden tab „30 dni” (7 widgetów) → dodać 7/14/90 dopiero gdy wzorzec działa.

Pełna spec → [`DASHBOARD-WIDGETY-SPEC.md`](./DASHBOARD-WIDGETY-SPEC.md).

---

## Czy `direct-email` wymaga zmian w Sortowni / Robocie?

| System | Zmiana potrzebna? | Co dokładnie |
|--------|-------------------|--------------|
| **Twenty adapter** (`createLead.js`, ewent. `processWebhook.js`) | **TAK** | Przy Leads@ / `TWENTY_EMAIL` ustaw `bizSource = direct-email` zamiast dziś `INNE`. Utwórz pole SELECT w Twenty. |
| **Sortownia** (`SORTOWNIA_V2_POPRAWIONY.js`) | **NIE** (na ten moduł) | Dashboard M5 liczy z pola **Twenty**, nie z eventów GCS. |
| **Robot / GCS** | **NIE** | Metryki CRM-only — nie idą do payloadów SSOT. |
| **Opcjonalnie później** | | `biz_source` w payloadzie Sortowni do raportów GCS — osobna decyzja, nie blokuje dashboardów. |

**Dziś w kodzie** (`createLead.js`):

```javascript
if (resolveSrcSystem(taskData) === "TWENTY_EMAIL") return "INNE";
```

→ zmiana na wartość zgodną z enum Twenty: `direct-email` (po utworzeniu opcji w SELECT).

**Uwaga:** `biz_product: "web"` w `enqueueLeadsAtCreateLeadTask` to **produkt**, nie kanał — przy PF-9 rozważyć czy Leads@ powinien mieć pusty produkt do kwalifikacji, a nie `web`.

---

## Checklist — faza D1 (sandbox)

Odhaczaj po kolei. Szczegóły PF → [`WYTYCZNE-DASHBOARDY-SPRZEDAZ.md`](./WYTYCZNE-DASHBOARDY-SPRZEDAZ.md) §7.

### A. Twenty — fakty platformy

- [ ] **PF-0** — wersja Twenty w Settings; dopisz do `ops/OPS_NOTES.md` jeśli > 2.18.x
- [ ] **PF-1** — dashboard: filtr + Group by **Owner** na Opportunities działa
- [ ] **PF-5** — Ratio na `stage`→WON w Aggregate i Bar; relative date na custom DATE_TIME

### B. Kanon danych (PF-9)

- [ ] Wypisz **wszystkie** wartości `biz_product` z Sortowni / Pricing Key (plik: lista w komentarzu lub `statystyki/PF-9-bizProduct-list.md`)
- [ ] Utwórz `bizProduct` SELECT w Twenty — wartości 1:1 z kanonem
- [ ] Utwórz `bizSource` SELECT — wartości z [`BIZSOURCE-MAP.md`](./BIZSOURCE-MAP.md)
- [ ] Utwórz 6 pól metryk (bez `daysToQualified` — tylko `hoursToQualified`)

### C. Workflow

- [ ] **PF-3** — Track Stage Time: field-scoped trigger, `hoursToQualified`, brak pętli, zapis mimo read-only
- [ ] **PF-M2** — trigger na pierwszy outbound → `hoursToFirstResponse`
- [ ] **PF-4** — zapis pól metryk → adapter SKIP, zero EMITTED

### D. Adapter (mały PR)

- [ ] `resolveBizSourceForTask`: `TWENTY_EMAIL` → `direct-email`
- [ ] `mapBizSource`: UTM → google/facebook/organic/… wg BIZSOURCE-MAP
- [ ] Deploy worker + smoke jednego leada Leads@

### E. Jeden widget testowy

- [ ] M4 Win Rate, 30 dni — porównaj z ręcznym CSV (20 rekordów)

**Dopiero po PASS A–E:** pełne dashboardy (D2).

---

## Checklist — faza D2 (produkcja)

- [ ] ADR #18 **open** w DECISION_REGISTER (przed polami w prod)
- [ ] Pola + workflow na prod (snapshot JSON do gita)
- [ ] **Workflow OFF** → import legacy → workflow ON (`no_emit` w logu)
- [ ] Field-level read-only na polach metryk
- [ ] Dashboard „Zespół” (16 widgetów — można etapami)
- [ ] Dashboard „Oceny” — najpierw tab 30d, potem klon
- [ ] Promocja `METRICS.md` → `owocni-crm/METRICS.md`
- [ ] ADR #18 **closed** z evidence

---

## Mapa dokumentów

```
statystyki/
├── QUICKSTART-DAWID.md     ← TEN PLIK
├── DASHBOARD-WIDGETY-SPEC.md   ← co klikać w UI (52 widgety)
├── METRICS.md                  ← formuły (kanon liczb)
├── BIZSOURCE-MAP.md            ← enum kanałów + adapter
├── PLAN-MODUL-STATYSTYK.md     ← decyzje właściciela + architektura
├── WYTYCZNE-DASHBOARDY-SPRZEDAZ.md  ← research Twenty + PF tabela
└── track-stage-time.contract (1).md ← workflow stage time
```

---

## Czy dokumentacja wystarczy do wdrożenia?

| Obszar | Gotowość | Brakuje |
|--------|----------|---------|
| Formuły metryk M1–M9 | ✅ `METRICS.md` | — |
| Widgety dashboard | ✅ `DASHBOARD-WIDGETY-SPEC.md` | — |
| Workflow stage time | ✅ kontrakt B1–B5 | B1: `hours` zamiast `days` — już w kontrakcie |
| Workflow M2 (pierwszy mail) | ⚠️ szkic w spec §5.2 | **PF-M2** — trigger do potwierdzenia na instancji |
| Lista `bizProduct` | ⚠️ | **PF-9** — Ty musisz wyciągnąć z Sortowni |
| ADR #18 w repo | ❌ | Wkleić do DECISION_REGISTER przed prod |
| SSOT `owocni-crm/` | ❌ | Po wdrożeniu — świadomie na później |

**Wniosek:** wystarczy do **sandboxu i pierwszego dashboardu**. Produkcja = ADR #18 + PF-9 domknięte + PF-M2 PASS.

---

## Pytania? Eskaluj do właściciela gdy

- Lista produktów PF-9 nie zgadza się z tym, co handlowcy widzą w CRM
- Ratio / Group by Owner nie działa na Waszej wersji Twenty
- PF-M2 — Twenty nie daje triggera na outbound mail (wtedy plan B do omówienia)

---

*Ostatnia aktualizacja: 2026-07-09*
