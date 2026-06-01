# DATA_MODEL — pola krytyczne Twenty CRM

**Status:** Etap 1 MVP  
**Last updated:** 2026-05-29 (prefiksy pól custom §Reguły)  
**Pełna konstytucja pól:** `CRM_CONSTITUTION.md` Prawa 3–4

Tylko pola **krytyczne** (systemowe / eventowe / integracyjne). Standardowe pola Twenty (firstName, email) — przez MCP / Settings UI.

---

## Opportunity — pola krytyczne

| Field (API) | Type | Unique | Owner | Empty | Used by | Freeze? | Description (Twenty UI) |
|-------------|------|--------|-------|-------|---------|---------|-------------------------|
| `idOid` | TEXT | YES | Sortownia (mint) | null przy manual | Wszystkie SSOT eventy; upsert ingress | **FROZEN** | Cross-system id_oid; mint Sortownia przy generate_lead |
| `stage` | SELECT | NO | Handlowiec | default NEW | qualify_lead, purchase | **FROZEN** | NEW / CONTACTED / QUALIFIED / PROPOSAL / WON / LOST |
| `campaignRejected` | BOOLEAN | NO | Handlowiec (przycisk/akcja) | false | rejected_lead | **FROZEN** | **UI label:** „Odrzuć leada”. **Opis pola:** Informuje kanały reklamowe, że takich leadów nie szukamy. To nie to samo co stage LOST („przegrany deal”). API name: `campaignRejected`. |
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
4. **Konwencja nazw:** camelCase w API Twenty; snake_case w payloadach SSOT (`EVENT_CONTRACT.md`). Prefiksy poniżej — tylko dla pól **kontraktu integracyjnego**, nie dla każdego custom fieldu.
5. **POC + operacje:** pole `campaignRejected` zweryfikowane live i potwierdzone w realnym użyciu przez sprzedaż.

### Prefiksy pól custom (ADR #1, Prawo 3 i 6 w `CRM_CONSTITUTION.md`)

**Po co:** granica odpowiedzialności między Twenty (stan sprzedaży) a Sortownią/Stape (tożsamość, eventy). Twenty **nie wymusza** prefiksów — to dyscyplina zespołu przy review nowych pól.

| Prefiks / wzorzec | Znaczenie | Przykłady | Kto ustawia |
|-------------------|-----------|------------|-------------|
| `id*` | Tożsamość cross-system (`id_oid`) | `idOid` | Sortownia (mint); backfill do Twenty |
| `biz*` | Klasyfikacja lub wartość idąca do payloadów SSOT / raportów GCS | `bizProduct`, `bizSource`, `bizValueWon` | Formularz, adapter, handlowiec |
| `lastOrchestration*` (lub przyszły `orch*`) | Audyt ostatniego eventu do Sortowni | `lastOrchestrationEventAt`, `lastOrchestrationEventId` | Workflow / adapter |
| `bitrix*` / `legacy*` | Most migracyjny lub handoff poza Twenty | `bitrixDealId` | Handlowiec (SOP) / migracja |
| `src*` | Źródło zapisu (loop prevention) | `srcSystem` | Adapter / UI |
| **bez prefiksu** | Semantyka CRM, flagi akcji, stage — bez obowiązku w payloadzie klasyfikacyjnym | `campaignRejected`, `rejectionReason`; natywne `stage` | Handlowiec |

**Kiedy NIE dodawać prefiksu**

- Pole służy wyłącznie analizie wewnętrznej w Twenty (np. `lossCategory`, `lossDescription`).
- To flaga/akcja z jasnym **UI label** dla handlowca — nie przemianowywać na `bizCampaignRejected` (API: `campaignRejected`, label: „Odrzuć leada”).
- Pole standardowe Twenty (`firstName`, `email`) — bez zmian.

**Czego unikać**

- Globalnego prefiksu `owocni_` / `crm_` na wszystkim — w Twenty i tak custom = nasze; tylko szum w API.
- Podwójnych prefiksów (`bizBizValue`).
- Prefiksu bez `description` w Settings Twenty — handlowiec widzi label, integrator czyta API name.

**Review nowego pola (skrót):** (1) Czy idzie do eventu SSOT? → rozważ `biz*`. (2) Czy to id_oid / deduplikacja? → `id*`. (3) Czy tylko CRM? → bez prefiksu. (4) Czy FROZEN? → wpis w tabeli Opportunity/Person powyżej + ADR.

---

## Preflight (Faza 2 gate)

- [ ] `idOid` unique + wiele rekordów z `null` — test w sandboxie
- [ ] Opisy pól wypełnione w Twenty Settings (MCP)
