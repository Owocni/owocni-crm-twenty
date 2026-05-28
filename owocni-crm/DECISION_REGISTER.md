# DECISION_REGISTER — decyzje otwarte i ADR

**Last updated:** 2026-05-28

**Reguła:** Dopóki pozycja **ADR** z `Blocks=cutover` ma status **open**, cutover **nie startuje**.

---

## Sekcja A — Open decisions

| # | Decyzja | Klasa | Blocks | Type | Faza | Kto | Status |
|---|---------|-------|--------|------|------|-----|--------|
| 1 | Konwencja nazw pól (camelCase, prefiks id/biz) | Strukturalna | none | known-fact | 2 | — | **closed** |
| 2 | Model obiektów (Opportunity/Person/Company/Note) | Strukturalna | none | known-fact | 2 | — | **closed** (POC) |
| 3 | idOid unique + null tolerance | Strukturalna | step | preflight | 2 | Developer | **open** — sandbox test |
| 4 | Ingress kanoniczny: crm:twenty_create_lead | Strukturalna | step | impl. standard | 3 | Developer | **open** — implementacja Sortowni |
| 5 | Kryteria stage'ów + mapowanie eventów | Semantyczna | **cutover** | **ADR** | 4 | Właściciel + handlowcy | **open** |
| 6 | Twenty Pro vs Organization | Semantyczna+$$ | **cutover** | **ADR** | 4 | Właściciel | **open** |
| 7 | Sandbox + prod (bez duplikacji całego GTM/GCP) | Proceduralna | cutover | ADR | 5 | Właściciel | **closed** — env-guard + safe sink |
| 8 | Runbook cutover (data, rollback) | Proceduralna | cutover | ADR | 5 | Właściciel | **open** |
| 9 | Rekonsyliacja docs po cutoverze | Procedurowa | step | impl. standard | 5 | Właściciel | **open** |
| 10 | Routing SSOT + webhook adapter Sortowni | Semantyczna | cutover | ADR | 4 | Owner Sortowni | **open** |
| 11 | Native webhook payload (data.before?) | Strukturalna | step | preflight | 4 | Developer | **open** — POC test |

### Decyzja #7 — doprecyzowanie (zamknięta)

- Sandbox i produkcja zostają rozdzielone logicznie po `environment` (`sandbox` / `prod`).
- Dla `sandbox` outbound z Twenty trafia do safe sink (np. Google Sheets), bez wysyłki do produkcyjnych adapterów reklamowych.
- Nie wymagamy pełnej kopii infrastruktury GTM/GCP do testów CRM.

### Mapowanie eventów (do zamknięcia w #5)

| Twenty | Event SSOT |
|--------|------------|
| → QUALIFIED | qualify_lead |
| → WON | purchase |
| campaignRejected true | rejected_lead |
| → LOST | *(brak)* |

---

## Sekcja B — Closed decisions (ADR)

*Pusta na start. Po cutoverze: migracja zamkniętych z Sekcji A.*

---

## Kiedy NIE pisać ADR

Zmiana labelu, saved view, bugfix rutynowy, pole OPEN kosmetyczne.

---

## Zamknięte przez dokumentację SSOT (2026-05-28)

| Temat | Decyzja |
|-------|---------|
| lead_lost vs rejected_lead | LOST bez eventu; rejected_lead tylko campaignRejected |
| lead_won vs purchase | purchase |
| Outbound POC workflow vs native webhook | native webhook (D2) |
| Helpdesk w MVP | nie (Prawo 9) |
| julia362 | legacy, wyłączenie w cutover |

Szczegóły: `EVENT_CONTRACT.md`, `POC_MAPPING.md`.
