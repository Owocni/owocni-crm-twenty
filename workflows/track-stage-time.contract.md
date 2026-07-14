# CONTRACT — workflow `track-stage-time`

> ADR #18 · Owner: Dawid · Obiekt: Opportunity · Status: **ACTIVE (v3)**

| Pozycja | Wartość |
|---|---|
| Nazwa | Track Stage Time v3 |
| workflowId | `23b2a240-a769-4629-8d6f-1804859eb305` |
| versionId | `c9c7f6e0-ceac-48cb-897c-6544a693ad5e` |
| Trigger | `opportunity.updated`, pola: `stage`, `id`, `createdAt` |
| Łańcuch | **Trigger → CODE → UPDATE** (bez FILTER — filtry na output CODE nie działają) |
| logicFunctionId | `c88d0267-8cf2-46f0-b2cf-1786cd64f34c` |

## Pola zapisywane

| Pole | Gałąź | Jednostka |
|------|-------|-----------|
| `qualifiedAt` | B1 | timestamp |
| `hoursToQualified` | B1 | godziny (M3) |
| `stageClosedAt` | B2, B3 | timestamp |
| `daysToClose` | B2, B3 | dni (M1) |

## Gałęzie (jeden CODE)

| # | Warunek | Update |
|---|---------|--------|
| B1 | `stage = QUALIFIED` ∧ `qualifiedAt` empty | SQL timestamp + hours; terminal → null w CODE |
| B2 | `stage = WON` | terminal timestamp + days |
| B3 | `stage = LOST` | terminal timestamp + days |
| B4 | stage ∈ {NEW,CONTACTED,PROPOSAL} ∧ terminal set | clear terminal w CODE |
| B5 | QUALIFIED ∧ SQL set ∧ terminal set | clear terminal w CODE |

**Ograniczenie:** Twenty `UPDATE_RECORD` pomija `null` — B4/B5 mogą nie wyczyścić pól terminalnych w DB.

## Testy (sandbox 2026-07-09)

| Ścieżka | Wynik |
|---------|-------|
| NEW → WON | `stageClosedAt`, `daysToClose` ✅ |
| WON → LOST | terminal odświeżony ✅ |
| NEW → QUALIFIED (+ bizSqlConfirmed) | `qualifiedAt`, `hoursToQualified` ✅ (primary: workflow SQL v5 zapisuje atomowo; Track Stage Time = backup przy samym dragu) |

Snapshot: `workflows/snapshots/track-stage-time-v3.json`
