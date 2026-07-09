# Statystyki sprzedażowe — paczka robocza

> Moduł KPI dashboardów w **Twenty CRM** (produkt × handlowiec × czas).  
> **Dla wdrożenia:** zacznij od **[QUICKSTART-DAWID.md](./QUICKSTART-DAWID.md)**.

| | |
|---|---|
| **Status** | Plan roboczy — nie SSOT |
| **Blokuje cutover CRM?** | Nie |
| **Kto wdraża** | Dawid (technicznie) + akceptacja właściciela |

---

## Szybka nawigacja (GitHub)

| Chcę… | Otwórz |
|-------|--------|
| **Wysłać właścicielowi do akceptacji planu** | [REVIEW-DLA-WLASCICIELA.md](./REVIEW-DLA-WLASCICIELA.md) |
| **Wiedzieć co robić po akceptacji (wdrożenie)** | [QUICKSTART-DAWID.md](./QUICKSTART-DAWID.md) |
| **Skonfigurować widgety w Twenty** | [DASHBOARD-WIDGETY-SPEC.md](./DASHBOARD-WIDGETY-SPEC.md) |
| **Sprawdzić formułę metryki** | [METRICS.md](./METRICS.md) |
| **Ustawić kanały (Google, direct-email…)** | [BIZSOURCE-MAP.md](./BIZSOURCE-MAP.md) |
| **Zrozumieć decyzje biznesowe** | [PLAN-MODUL-STATYSTYK.md](./PLAN-MODUL-STATYSTYK.md) |
| **Fakty o Twenty + preflight PF-0…9** | [WYTYCZNE-DASHBOARDY-SPRZEDAZ.md](./WYTYCZNE-DASHBOARDY-SPRZEDAZ.md) |
| **Workflow czasu w stage** | [track-stage-time.contract (1).md](./track-stage-time.contract%20(1).md) |

---

## Metryki w skrócie

| ID | Co mierzy | Jednostka |
|----|-----------|-----------|
| M1 | Cykl do Win | dni |
| M2 | Czas 1. odpowiedzi mailowej | **godziny** |
| M3 | Czas do SQL | **godziny** |
| M4 | Win Rate | % |
| M5 | Win Rate per kanał | % |
| M6 | Świeże otwarte (okno czasowe) | szt. |
| M7 | SQL w pipeline (teraz) | szt. |
| M8 | Napływ vs odpływ / miesiąc | szt. |
| M9 | Wszystkie otwarte (teraz) | szt. |

---

## Dashboardy

| Nazwa | Po co | Widgetów |
|-------|-------|----------|
| **Sprzedaż — Oceny** | Porównanie handlowców; taby 7/14/30/90 dni | 7 typów × 4 taby = 28–36* |
| **Sprzedaż — Zespół** | Totale firmy, produkty, kanały, trend | 16 |

\*Pełna liczba zależy od tego, czy M7/M9 liczysz jako Bar czy Aggregate — patrz spec.

---

## Zasady

- Metryki z **pól Twenty**, nie z eventów GCS ([`AGENTS.md`](../AGENTS.md)).
- Pola metryk **CRM-only** — nie w payloadach Sortowni.
- Wdrożenie produkcyjne po **ADR #18** w [`DECISION_REGISTER.md`](../owocni-crm/DECISION_REGISTER.md).

---

## Po wdrożeniu (promocja do SSOT)

1. `METRICS.md` → `owocni-crm/METRICS.md`
2. Pola → delta `owocni-crm/DATA_MODEL.md`
3. ADR #18 → closed z evidence
4. Fakty Twenty → `owocni-crm/ops/OPS_NOTES.md`
