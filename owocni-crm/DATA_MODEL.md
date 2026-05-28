# DATA_MODEL — pola krytyczne Twenty CRM

**Status:** Etap 1 MVP  
**Last updated:** 2026-05-28  
**Pełna konstytucja pól:** `CRM_CONSTITUTION.md` Prawa 3–4

Tylko pola **krytyczne** (systemowe / eventowe / integracyjne). Standardowe pola Twenty (firstName, email) — przez MCP / Settings UI.

---

## Opportunity — pola krytyczne

| Field (API) | Type | Unique | Owner | Empty | Used by | Freeze? | Description (Twenty UI) |
|-------------|------|--------|-------|-------|---------|---------|-------------------------|
| `idOid` | TEXT | YES | Sortownia (mint) | null przy manual | Wszystkie SSOT eventy; upsert ingress | **FROZEN** | Cross-system id_oid; mint Sortownia przy generate_lead |
| `stage` | SELECT | NO | Handlowiec | default NEW | qualify_lead, purchase | **FROZEN** | NEW / CONTACTED / QUALIFIED / PROPOSAL / WON / LOST |
| `campaignRejected` | BOOLEAN | NO | Handlowiec (przycisk/akcja) | false | rejected_lead | **FROZEN** | Odrzucenie wzorzec kampanii — NIE to samo co LOST (potwierdzone użycie przez sprzedaż) |
| `rejectionReason` | SELECT | NO | Handlowiec | null | rejected_lead (raport) | **FROZEN** | Powód odrzucenia kampanii — raportowo |
| `bizProduct` | SELECT/TEXT | NO | Formularz/adapter | null | payload SSOT | **FROZEN** | Produkt (web, logo, …) |
| `bizSource` | SELECT/TEXT | NO | Formularz/adapter | null | payload SSOT | OPEN | Źródło leada |
| `bizValueWon` | CURRENCY | NO | Handlowiec przy WON | null | purchase (raport GCS) | **FROZEN** | Wartość wygranej — raportowo; VBB/VBO z Pricing Key |
| `srcSystem` | SELECT | NO | Adapter / UI | TWENTY_UI | loop prevention | **FROZEN** | OWOCNI_SORTOWNIA / TWENTY_UI / BETTER_BITRIX_LEGACY |
| `lastOrchestrationEventAt` | DATETIME | NO | Workflow/adapter | null | audit | OPEN | Ostatni event do Sortowni |
| `lastOrchestrationEventId` | TEXT | NO | Workflow/adapter | null | audit | OPEN | id_event ostatniego eventu |
| `bitrixDealId` | TEXT | NO | Handlowiec (manual SOP) | null | handoff Bitrix24 | OPEN | Deal księgowy po WON — MVP manual |

### Stage LOST

- **Nie emituje** eventu SSOT do platform.
- `lossCategory` / `lossDescription` — opcjonalnie pola CRM-only (analiza wewnętrzna).

---

## Person — pola krytyczne

| Field | Type | Unique | Owner | Empty | Freeze? |
|-------|------|--------|-------|-------|---------|
| `idOid` | TEXT | YES | Sortownia | null = manual create | **FROZEN** |

---

## Company

Brak custom fields w Etapie 1 MVP.

---

## Reguły operacyjne

1. **FROZEN** — zmiana tylko z ADR w `DECISION_REGISTER.md`.
2. Każde nowe pole: 6 pytań (kto, kiedy, po co, decyzja biznesowa, kategoria, Twenty vs poza).
3. **Required** — Twenty 2.8.0 nie wspiera required na custom fields; walidacja przy emisji eventu / w Adapterze platformy.
4. **Konwencja:** camelCase w API; prefiks `id`/`biz` dla pól orkiestracji; snake_case w payloadach SSOT.
5. **POC + operacje:** pole `campaignRejected` zweryfikowane live i potwierdzone w realnym użyciu przez sprzedaż.

---

## Preflight (Faza 2 gate)

- [ ] `idOid` unique + wiele rekordów z `null` — test w sandboxie
- [ ] Opisy pól wypełnione w Twenty Settings (MCP)
