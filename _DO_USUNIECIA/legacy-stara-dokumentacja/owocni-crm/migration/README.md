# Migration — ledger i import

**Faza:** 3 (po zamknięciu `DATA_MODEL.md`)

---

## Zasady

1. Ledger **w trakcie** importu, nie po.
2. Każdy legacy record = wiersz w CSV.
3. `SUM(legacy) = SUM(imported + merged + skipped + error)`.
4. **Workflow OFF** przed bulk import (gate).
5. Opcjonalnie: pause native webhook OUT przy >100 rekordów.

---

## Kolumny CSV (`active_leads_YYYY_MM_DD.csv`)

| Kolumna | Opis |
|---------|------|
| legacy_source | np. supabase_leads |
| legacy_id | UUID Supabase |
| id_oid | z legacy lub mint przy migracji |
| twenty_opportunity_id | po imporcie |
| status | imported / merged / skipped / error |
| error_message | jeśli error/skipped |
| verified_at | ISO timestamp |

---

## Preflight przed pierwszym importem

- [ ] **AUDIT_MIGRACJA** (kroki 1–7, fault-only) — `../AUDIT_MIGRACJA.md`
- [ ] Test idOid unique + null (3× null, 2× unique) — sandbox
- [ ] Import 3–5 rekordów próbnych
- [ ] Backup Supabase

## Import ≠ ruch operacyjny (gate z audytu migracji krok 4)

Bulk import **nie może** wyzwalać: eventów do platform (`purchase`, `qualify_lead`, …), mint `id_oid` poza planem, workflow Twenty, alertów outbound.  
Szczegóły i tabela fault: `../AUDIT_MIGRACJA.md` krok 4.

---

## Źródło danych

Supabase (`leads`, `companies`, powiązane tabele) — **nie** Bitrix24 API.

POC import: `../twenty/snapshots/002-sample-import-stats.json`.
