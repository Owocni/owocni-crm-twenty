---
doc_id: METRICS
title: "METRICS — kanoniczne definicje metryk sprzedażowych (formuły, kohorty, pola źródłowe)"
layer: core_ssot
status: active
edit_scope: content_and_structure
owner: "Właściciel (semantyka) / Dawid (techniczny)"
last_verified: 2026-07-09
recheck_trigger: "zmiana definicji metryki / nowe pole źródłowe / natywne formula fields w Twenty / wdrożenie scoringu"
default_trust: D:CORE
related:
  - DATA_MODEL
  - EVENT_CONTRACT
  - DECISION_REGISTER
  - ops/OPS_NOTES
---

# METRICS — kanon metryk sprzedażowych

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** formule każdej metryki (licznik, mianownik, kohorta czasowa, pola źródłowe); jednostkach; semantyce znaczników (first vs last entered); co wchodzi / nie wchodzi do pipeline'u. Każdy konsument liczb (dashboard, API, scoring, BI, eksport) liczy WEDŁUG tego pliku albo się myli.

**Ten plik NIE decyduje o:** typach/nazwach pól (→ `DATA_MODEL.md` §5.1.1); mechanizmie wypełniania pól (→ `../workflows/track-stage-time.contract.md`, M2 → GCP `advanceNewToContacted.js`); układzie dashboardów (→ `../statystyki/DASHBOARD-WIDGETY-SPEC.md` — prezentacja, nie SSOT); semantyce eventów (→ `EVENT_CONTRACT.md`).

**Zawsze czytaj razem z:** `DATA_MODEL.md` (pola `qualifiedAt`, `hoursToQualified`, `hoursToFirstResponse`, `stageClosedAt`, `daysToClose`, `bizProduct`, `bizSource`).

**Najgroźniejszy błąd:** policzyć metrykę „podobnie" innym kanałem (np. z eventów GCS) — GCS nie widzi LOST ani przejść CONTACTED/PROPOSAL; wynik będzie inny i oba będą wyglądać na prawdziwe. Drugi: pomylić `stageClosedAt` (fakt) z natywnym `closeDate` (prognoza).

**Przy konflikcie:** definicja metryki — ten plik. Wartość pola na rekordzie → instancja.

**Zmiana wymaga:** właściciel + ADR (definicja metryki = klasa semantyczna: utrwala się w decyzjach i porównaniach okres-do-okresu).

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja |
|---|---|---|---|
| NR-1 | NIE liczyć metryk z eventów SSOT (GCS/Sortownia) jako zamiennika pól Twenty. | Eventy istnieją tylko dla qualify_lead/purchase/rejected — brak LOST i etapów pośrednich. | Dwie „prawdy" o tej samej liczbie. |
| NR-2 | `campaignRejected=true` NIE wyklucza z pipeline'u ani z mianownika Win Rate. | Odrzucenie kampanijne ≠ przegrana (EVENT_CONTRACT §4); deal nadal sprzedawalny. | Zaniżone pipeline, zawyżony WR. |
| NR-3 | Pola źródłowe metryk NIGDY do payloadów eventów (CRM-only). | Granica CRM↔orkiestracja (CONSTITUTION Prawo 6). | Wyciek danych operacyjnych do platform. |
| NR-4 | Kohorta czasowa metryki = pole daty wskazane w §5, nie „jakakolwiek data". W szczególności: NIE filtrować faktycznych zamknięć po natywnym `closeDate` (prognoza). | Zamiana pola daty w filtrze zmienia wynik o dziesiątki %. | Nieporównywalne raporty. |
| NR-5 | Rekordy z `null` w polu źródłowym są POZA metryką (nie liczą się jako 0). Higiena: dashboard „Zespół" utrzymuje widget Count `bizProduct is empty`. | Null = zdarzenie nie zaszło / dane sprzed cutoveru (decyzja D-5). | Sztuczne zaniżenie średnich; leady-widma niewidoczne w przekrojach. |

---

## 2. PURPOSE

Jeden kanon formuł metryk sprzedażowych dla wszystkich konsumentów — dashboardów Twenty, przyszłego scoringu, eksportów i BI. Prezentacja jest wymienna; formuły nie.

---

## 3. SCOPE

### Pokrywa
Metryki M1–M9, wymiary wspólne (produkt / sprzedawca / kanał / czas), konwencje liczenia, semantykę znaczników, known-edges.

### Nie pokrywa
Scoringu (osobny projekt; pola M2/M3 są jego prekursorami), pól (→ DATA_MODEL), mechanizmu wypełniania (→ kontrakt workflow), układu dashboardów.

---

## 4. CANONICAL DEFINITIONS

- **Wymiary wspólne:** per sprzedawca = Opportunity owner (PF-1); per produkt = `bizProduct` (PF-9); per kanał = `bizSource` (enum → `../statystyki/BIZSOURCE-MAP.md`, D-15); zakres dat = kolumna „Kohorta" w §5.
- **Jednostki czasu (D-12, właściciel 2026-07-09):** M2 i M3 **zawsze godziny** (`hoursToFirstResponse`, `hoursToQualified`). M1 **dni** (`daysToClose`). Godziny = (Δ ms) / 3 600 000, zaokr. 0,01.
- **Powierzchnie i dostęp (D-11 ROZSTRZYGNIĘTE, właściciel 2026-07-08): wszystko jawne.** Przekroje per handlowiec żyją na dashboardzie „Oceny" (taby-okna czasowe), wspólnym dla workspace; „Zespół" pokazuje agregaty zbiorcze/per produkt. Ochrona ZAPISU pól metryk zostaje (read-only + workflow). Kanon formuł obowiązuje każdą powierzchnię identycznie.
- **`stageClosedAt`** (nazwa finalna → D-7) = **faktyczne** wejście w stage terminalny (WON/LOST). ≠ natywne `closeDate` (prognozowana data zamknięcia).
- **Semantyka znaczników (per pole, decyzje D-8/D-9):** `qualifiedAt` = **pierwsze** wejście w QUALIFIED — zapis jednorazowy, ping-pong stage'ów nie nadpisuje. `stageClosedAt` = **ostatnie** wejście w terminal; niezmiennik „niepuste ⇒ stage ∈ {WON, LOST}" utrzymywany gałęzią czyszczącą workflow (D-9).

---

## 5. BODY — KANON METRYK

| ID | Metryka | Formuła | Kohorta (filtr dat) | Populacja (filtr) | Jednostka |
|---|---|---|---|---|---|
| **M1** | Średni czas cyklu sprzedaży | AVG(`daysToClose`) | `stageClosedAt` w oknie | `stage = WON` ∧ `srcSystem is not BETTER_BITRIX_LEGACY` (wariant „do przegranej": `stage = LOST` ∧ jw.) | dni (2 dec.) |
| **M2** | Średni czas 1. odpowiedzi | AVG(`hoursToFirstResponse`); per rekord = pierwszy mail **wychodzący** − `createdAt` | `createdAt` w oknie | niepuste `hoursToFirstResponse` | **godziny** (2 dec.) |
| **M3** | Średni czas do SQL | AVG(`hoursToQualified`); per rekord = pierwsze `qualifiedAt` − `createdAt` | `qualifiedAt` w oknie | niepuste `qualifiedAt` ∧ legacy ≠ | **godziny** (2 dec.) |
| **M4** | Win Rate | COUNT(stage=WON) / COUNT(stage ∈ {WON, LOST}) — w Twenty: Ratio(stage→WON) na populacji zawężonej filtrem | `stageClosedAt` w oknie | `stage is any of (WON, LOST)` | % |
| **M5** | Win Rate per kanał | M4 grupowane po `bizSource` | jak M4 | jak M4 | % |
| **M6** | Świeże otwarte (kohorta okienkowa) | COUNT | `createdAt` w oknie | `stage is none of (WON, LOST)` — rejected zostaje (NR-2) | szt. |
| **M7** | SQL w pipeline | COUNT | — (stock) | `qualifiedAt` niepuste ∧ `stage is none of (WON, LOST)` (D-3 wariant B) | szt. |
| **M8** | Napływ vs odpływ | dwie serie COUNT/miesiąc: napływ `createdAt` · odpływ `stageClosedAt`, obie ∧ legacy ≠ | miesiąc | jw. | szt./mies. |
| **M9** | Otwarte w pipeline (stock) | COUNT | — (stock) | `stage is none of (WON, LOST)` (D-13) | szt. |

**Konwencje obowiązujące wszystkie metryki:**
1. Dni (M1) = (timestamp − `createdAt`) / 86 400 000 ms, zaokr. 0,01. Godziny (M2, M3) = / 3 600 000 ms, zaokr. 0,01.
2. Punkt startu cyklu = `createdAt` rekordu Opportunity (dla paid ≈ moment formularza; dla manual = moment wpisania — świadome uproszczenie).
3. Semantyka znaczników per pole → §4 (first dla `qualifiedAt`, last dla `stageClosedAt`). Korekta błędnie ustawionego znacznika = wyłącznie rola z prawem zapisu (Dawid/admin) — pola read-only dla handlowców (Roles).
4. Strefa czasowa prezentacji = strefa oglądającego (ograniczenie bety dashboardów Twenty; wartości na granicach dób mogą się różnić między użytkownikami — fakt → OPS_NOTES).
5. **Legacy (D-5):** rekordy importowane z better-bitrix mają `srcSystem = BETTER_BITRIX_LEGACY`. Metryki czasowe M1/M3 wykluczają legacy filtrem po `srcSystem`. Legacy wchodzi do M4/M5 (Win Rate), jeśli zamyka się po cutoverze.
6. **Stan vs historia (D-10).** Metryki stanu: **M7**, **M9**. M6 = kohorta okienkowa. M8 = trend bez snapshotów.

**Known-edge M2:** Email Sync backfill → pierwszy outbound może być starszy niż `createdAt` → clamp ≥0 (implementacja GCP `advanceNewToContacted.js`).

---

## 6. CROSS-REFERENCES

| Temat | Gdzie |
|---|---|
| Pola źródłowe: typy, opisy, freeze | `DATA_MODEL.md` §5.1.1 |
| M3/WON/LOST: workflow Track Stage Time | `../workflows/track-stage-time.contract.md` |
| M2: pierwsza odpowiedź (GCP primary) | `../workflows/first-outbound-response.contract.md` |
| Układ widgetów (nie formuły) | `../statystyki/DASHBOARD-WIDGETY-SPEC.md` |
| Status wdrożenia sandbox D2 | `../statystyki/IMPLEMENTATION-STATUS.md` |
| Dlaczego LOST nie ma eventu | `EVENT_CONTRACT.md` §4 |
| Dashboard capabilities (Ratio, AVG) | `ops/OPS_NOTES.md` §5.1 |
| ADR #18 (zamknięty) | `DECISION_REGISTER.md` §5.4 |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Status |
|---|---|---|
| OQ-M1 | D-3: M7 wariant B (qualifiedAt + otwarty) | **Zamknięte** — wdrożone w dashboardach |
| OQ-M2 | D-6: M1 tylko WON czy + LOST | Otwarte — domyślnie WON (§5) |
| OQ-M3 | M2 trigger + clamp | **Zamknięte** — GCP worker, test PASS |
| OQ-M4 | Natywne formula fields Twenty | Otwarte — recheck_trigger |
| OQ-M5 | Nazwa `stageClosedAt` | **Zamknięte** — pole utworzone |

---

## 8. VERIFICATION / RECHECK

| Co | Kiedy | Kto | Dowód |
|---|---|---|---|
| PF-5 AVG/Ratio vs REST | D2 sandbox 2026-07-09 | Dawid | `../statystyki/PF-5-EVIDENCE-2026-07-09.md` |
| PF-4 adapter SKIP po zapisie metryk | D2 sandbox 2026-07-09 | Dawid | `detectBusinessEvent.test.js` |
| Smoke Leads@ → `DIRECT_EMAIL` | 2026-07-09 | Dawid | opp `87a54e8b-…` |
| Funnel test7858 (6 pól metryk) | 2026-07-09 | Dawid | opp `72f62296-…` |
| Widget M4 na próbce ≥20 rekordów | Po imporcie legacy | Dawid | backlog PF-7 |
| `stageClosedAt` ⇒ stage terminalny | D2+30 dni | Dawid | zapytanie API |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-07-09 | Promocja do SSOT `owocni-crm/`; ADR #18 closed; D2 sandbox PASS | Dawid + właściciel | akceptacja dashboardów |
| 2026-07-09 | D-12: M3 godziny; M2 GCP; D-15 kanały | właściciel | decyzje planu |
| 2026-07-08 | Kotwica M2; audyt; `stageClosedAt`; D-8/D-9 | Claude + audyt | red team przed D0 |

---

## LEGENDA ZNACZNIKÓW
`[D:CORE]` decyzja OWOCNI (zmiana: właściciel+ADR) · `[D:VERIFIED]` fakt z platformy · `[D:RESEARCH]` rekomendacja · `[D:OPEN]` świadomie otwarte. Default pliku: `D:CORE`.
