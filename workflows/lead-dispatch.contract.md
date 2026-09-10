# CONTRACT — lead dispatcher v2.0 — RETIRED 2026-09-04

> Owner: Dawid · Status: **RETIRED** · Do not re-enable.

Przydział „Biorę” / least-loaded / failover / sweep / limit 3 / alerty managera — **wycofane**.

**Jedyny przydział (nowe karty, GCP `createLead.js`):**
1. Copywriting i NAME (naming) → Maciej (pierwszeństwo niezależnie od źródła, w tym FB).
2. FACEBOOK / MARKETING → Robert (jak wcześniej w hash).
3. Pozostali: suma `charCode` `idOid` parzysta → Gosia, nieparzysta → Marta.
4. Continuity (`CONTINUITY_ROUTING_ENABLED`) — powrót klienta **nie** przelicza ownera istniejącej karty; nowa karta może dostać poprzedniego ownera SQL.

Istniejące Opportunity, historia, `bizAckAt` — nietknięte (archiwum). Mail / import / kolejny list nie uruchamia ponownego przydziału (SKIP po `idOid` / otwartej karcie osoby).

| Było | Teraz |
|---|---|
| `LEAD_DISPATCHER_ENABLED=true` | zawsze `false` (kod + `deploy.sh`) |
| `start_lead_dispatcher.sh go` | odmowa; tylko `retire` |
| `deploy_workflow_lead_ack.py` | deaktywuje Biorę, nie tworzy |
| Sweep na poll Scheduler `*/5` | no-op `retired_biore` |
| Przycisk Biorę | DEACTIVATED |
| Widok „Do wzięcia” | usunięty |

Pola `bizAckAt` / `bizAssignedAt` / `bizLeadIntentClass` zostają na Opportunity jako nieaktywne archiwum.
