# CONTRACT — workflow `track-stage-time`

> Lokalizacja docelowa: `/workflows/track-stage-time.contract.md` (Prawo 7a: workflow z Code = pełny mini-kontrakt).
> Wzorzec źródłowy: oficjalny how-to Twenty „Track How Long Opportunities Stay in Each Stage" + „Formula Fields" (docs.twenty.com, weryfikacja 2026-07-08; potwierdzony niezależnie przez audyt zewn. tego samego dnia). Odchylenia od wzorca: wyłącznie te opisane w WYTYCZNE §3 (diff od `createdAt`, 2 miejsca dziesiętne, wspólne pole terminalne) + gałęzie czyszczące B4/B5 (D-9).
> Nazwa pola `stageClosedAt` = robocza do decyzji D-7. Macierz gałęzi = rekomendowana kombinacja D-8 (first-entry) + D-9 (gałąź czyszcząca); finalizacja po decyzjach właściciela.

| Pozycja | Wartość |
|---|---|
| Nazwa | Track Stage Time |
| Obiekt | Opportunity |
| Trigger | Record Updated, **wyłącznie pole `stage`** (field-scoped) |
| Side-effect | zapis/czyszczenie 4 pól CRM-only tego samego rekordu; ZERO wywołań zewnętrznych, ZERO sekretów (Prawo 7f — zgodny) |
| Gałęzie | 5, równoległe, Filter z warunkami wzajemnie wykluczającymi (Prawo 7d; dowód rozłączności niżej) |
| Kill-switch | dezaktywacja workflow w UI (1 klik); pola pozostają, przestają się aktualizować |
| Owner | Dawid |
| Snapshot | JSON do gita przed aktywacją i po każdej zmianie (Prawo 7g) |
| Kredyty | jakościowo: kroki standardowe minimalne, Code więcej (`verified_fact` docs); **kwoty jednostkowe niepotwierdzone w publicznych docs** — hipoteza z wklejki właściciela ~0,13–0,45 kredytu/mc przy ~150 leadach; pomiar realny = PF-6 (Settings → Billing, breakdown per workflow) |

## Input (per run)
Rekord Opportunity po zmianie `stage`: `id`, `stage`, `createdAt`, `qualifiedAt`, `stageClosedAt` (+ mapowania do Code node).

## Logika

Code node (wspólny szkielet — wykonuje się tylko w gałęziach zapisujących B1–B3):

```javascript
export const main = async (params: { createdAt: string }): Promise<object> => {
  const now = new Date();
  const created = new Date(params.createdAt);
  const days = Math.round(((now.getTime() - created.getTime()) / 86_400_000) * 100) / 100;
  const hours = Math.round(((now.getTime() - created.getTime()) / 3_600_000) * 100) / 100;
  return { now: now.toISOString(), days, hours };
};
```

Gałąź B1 używa `hours` (M3); B2/B3 używają `days` (M1).

Macierz gałęzi (Filter → [Code] → Update Record):

| # | Filter (rozłączne) | Update Record |
|---|---|---|
| B1 | `stage = QUALIFIED` ∧ `qualifiedAt` PUSTE | `qualifiedAt` = `{{code.now}}` · `hoursToQualified` = `{{code.hours}}` · wyczyść `stageClosedAt` + `daysToClose` |
| B2 | `stage = WON` | `stageClosedAt` = `{{code.now}}` · `daysToClose` = `{{code.days}}` |
| B3 | `stage = LOST` | `stageClosedAt` = `{{code.now}}` · `daysToClose` = `{{code.days}}` |
| B4 | `stage` ∈ {NEW, CONTACTED, PROPOSAL} ∧ `stageClosedAt` NIEPUSTE | wyczyść `stageClosedAt` + `daysToClose` (bez Code) |
| B5 | `stage = QUALIFIED` ∧ `qualifiedAt` NIEPUSTE ∧ `stageClosedAt` NIEPUSTE | wyczyść `stageClosedAt` + `daysToClose` (bez Code) |

**Dowód rozłączności:** B1⊥B5 (warunek `qualifiedAt` puste/niepuste), B4 nie zawiera QUALIFIED ani terminali, B2/B3 = terminale rozłączne z resztą. Uwaga historyczna: formuła z audytu zewn. (jedna gałąź czyszcząca obejmująca QUALIFIED) nakładała się na B1 — odrzucona (Prawo 7d).
**Wariant przy D-8 = last-entry:** B1 bez warunku `qualifiedAt PUSTE` (przejmuje czyszczenie terminala), B5 znika → 4 gałęzie.
**Wariant przy D-9 = SOP:** B4/B5 znikają; czyszczenie ręczne wykonuje rola z prawem zapisu (Dawid/admin) wg SOP w szkoleniu.

## Idempotencja / pętle / interakcje
- **Brak samowyzwalania:** workflow pisze pola ≠ `stage`, trigger jest field-scoped na `stage` (weryfikacja PF-3).
- **Duplikat triggera:** B1 jest naturalnie jednorazowe (`qualifiedAt` puste tylko raz); B2/B3 nadpisują te same pola świeżym `now` — semantyka last-entered terminala (METRICS §4).
- **Webhook OUT po zapisie pól:** adapter Sortowni → `SKIP_NO_RELEVANT_TRANSITION` (stage bez zmiany w Stape Store); zero eventów (weryfikacja PF-4). Odporne też na out-of-order delivery (oba webhooki niosą ten sam nowy stage). Dodatkowe SKIP-y w logach = oczekiwane.
- **Import / backfill / replay:** workflow **OFF** (Prawo 7c, INV-6, G6); wpis w OPS log operacji masowych z `no_emit=TAK`. Import ustawia `srcSystem = BETTER_BITRIX_LEGACY`.
- **Legacy:** workflow celowo BEZ warunku legacy i pisze dla wszystkich rekordów — timestampy legacy są potrzebne (Win Rate). Wykluczenie legacy z metryk **czasowych** robi filtr widgetów po `srcSystem` (METRICS konw. 5). Odrzucony wariant konsultanta #2 „days albo null zgodnie z D-5 w gałęziach" — dublował warunek w 3 miejscach kodu.
- **Reopen z terminala:** obsługuje B4/B5 (niezmiennik: `stageClosedAt` niepuste ⇒ stage terminalny). Ręczne korekty pól (w tym błędny klik w QUALIFIED przy first-entry) = wyłącznie rola z prawem zapisu — handlowcy mają read-only.

## Walidacja po stronie konsumenta (Prawo 7b)
Konsumenci (dashboard/scoring) traktują `null` jako „zdarzenie nie zaszło" (METRICS NR-5). Brak walidacji at-save — zgodnie z INV-9.

## Failure modes
| Tryb | Skutek | Reakcja |
|---|---|---|
| Run failed (Twenty) | pola nieustawione dla tego przejścia | odwracalne: korekta pól przez rolę z prawem zapisu lub ponowny zapis stage; monitor Workflow Runs |
| Kredyty wyczerpane | runy wstrzymane | pula wspólna z AI chat/agentami — realny wektor wyczerpania to AI, nie ten workflow; alert z billingu; dokup paczki / czasowa dezaktywacja (metryki degradują się do stanu „od-do", nie psują danych) |
| Update mimo read-only nie działa (PF-3 FAIL) | workflow nie zapisuje pól chronionych | fallback: pola edytowalne + dyscyplina (opis w Settings „pisze wyłącznie workflow") do czasu rozwiązania |
| Zmiana enuma stage (FROZEN) | gałęzie martwe | zmiana enuma i tak wymaga ADR (INV-8) — kontrakt aktualizowany w tej samej zmianie (Prawo 1b) |

## Testy powiązane (preflight)
PF-3 (field-scoped trigger; brak retriggera; **zapis mimo read-only**; **czyszczenie pola do pustego**; Filter z 2–3 warunkami AND), PF-4 (SKIP w adapterze), PF-6 (pomiar kredytów).

## Rejestr
1 wiersz w OPS_NOTES workflow registry: `Track Stage Time · Opportunity · Record Updated(stage) · internal-only (4 pola CRM-only, gałęzie B1–B5) · Dawid · kill-switch: deactivate · snapshot: <link git>`.
