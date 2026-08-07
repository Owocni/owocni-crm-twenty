# Bramka przed loadem Pipedrive — workflowy OFF + `no_emit`

Powiązane: `AUDIT_MIGRACJA.md` G6 · `EVENT_CONTRACT.md` §5.4 · INV-6 · NR-4.

## Stan prep (2026-08-04)

| Element | Status |
|---------|--------|
| Inventory ACTIVE workflowów | **DONE** → `pipedrive-staging/runs/…/gate/` |
| Lista MUST_OFF | **8** — **DEACTIVATED** (snapshot `gate/deactivated_snapshot.json`) |
| Native webhook Stape | żywy — chroniony przez `SKIP_LEGACY_IMPORT` |
| Adapter `SKIP_LEGACY_IMPORT` | **DEPLOYED** `twenty-inbound-webhook-sandbox` |
| Workflowy OFF na produkcji | **NIE** — 8× **ACTIVE** ponownie (2026-08-06, MCP activate) |

## MUST_OFF przed sample / full load

Wyłączyć (DATABASE_EVENT na Opportunity):

1. `lead · formularz · powiadom owner v3` — `opportunity.created`
2. `lead · mail · powiadom owner v1` — `opportunity.created`
3. `Track Stage Time v3` — `opportunity.updated`
4. `deal · stage QUALIFIED → Stape v14b` — `opportunity.updated` → **platformy**
5. `deal · campaign rejected · event do orkiestracji` — `opportunity.updated`
6. `Opp · guard SQL v6`
7. `Opp · guard odrzucony v1`
8. `Opp · zapamiętaj etap przed SQL v4e`

**Zostają ACTIVE (MANUAL):** Przyjmij SQL, Odrzuć, Scal, Quick Lead, Rozmowa\* — nie odpalają się przy REST create.

**Opcjonalnie:** `First Outbound Response v2` (MCMA) — nie potrzebne OFF przy samym imporcie people/opps.

Skrypt (dry-run / apply):

```bash
python3 integrations/tools/pipedrive_workflow_gate.py --run 20260804T065324Z
# za GO:
python3 integrations/tools/pipedrive_workflow_gate.py --apply-off
# po akceptacji loadu:
python3 integrations/tools/pipedrive_workflow_gate.py --apply-on
```

Jeśli GraphQL 403 → Twenty MCP: `deactivate_workflow_version` / `activate_workflow_version` z `gate/must_off.json`.

## `no_emit` (INV-6)

1. **Deploy** `twenty-inbound-webhook` z `SKIP_LEGACY_IMPORT`:
   - `srcSystem ∈ {PIPEDRIVE_LEGACY, BETTER_BITRIX_LEGACY}` **lub** niepusty `pipedriveId`
   - Opportunity: zero emit (`generate_lead` / `qualify_lead` / `purchase` / `rejected_lead`)
   - Person: zero mint `idOid` (skip ścieżki identity)
2. Import ustawia `srcSystem=PIPEDRIVE_LEGACY`, `bizSource=PIPEDRIVE_IMPORT`, `pipedriveId=…`, **bez** `idOid`.
3. Wiersz w `ops/OPS_NOTES.md` §5.3: `no_emit=TAK` przy sample i full load.
4. Smoke po sample: Stape task_queue **0** nowych eventów z importowanych rekordów.

Cold-start sam w sobie **nie wystarczy**: rekord bez `idOid` → adapter dziś mógłby iść w `generate_lead`; WON przy pustym state → `purchase`. Stąd jawny skip legacy.

## Checklist T-0 (tuż przed sample)

- [x] Review kolizji identity (krok 14) — ASK domknięty
- [x] Deploy inbound `SKIP_LEGACY_IMPORT`
- [x] OFF 8 workflowów
- [x] Wiersz OPS `no_emit=TAK` (gate)
- [ ] Sample 10–20 (krok 16) — czekamy na GO
- [ ] Po GO full → activate workflowów + wiersz OPS sample/full

## Rollback

Workflowy: `--apply-on`.  
Rekordy PD: `pipedrive_rollback_twenty.py` **tylko przed IMAP**.
