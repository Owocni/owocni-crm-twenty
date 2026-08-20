---
doc_id: RULE_CONTINUITY_IMPL_CHECKLIST
title: "Continuity / Account Owner — plan wdrożenia (kod + checklista)"
layer: runbook
status: DONE
owner: "Dawid"
last_verified: 2026-08-20
contract: "/Volumes/Samsung_T5/RULE_CONTINUITY_IMPLEMENTATION_CONTRACT.md"
runtime: integrations/cloud-functions/twenty-crm-worker/workers/createLead.js
related:
  - LEAD_OWNER_ROUTING_PLAN.md
  - CUTOVER_TWENTY_TEAM_PLAN.md
  - TWENTY_WORKFLOWS_REJECT_AND_GUARD.md
  - ../../owocni-crm/DATA_MODEL.md
---

# Continuity — plan wdrożenia

**Kontrakt:** `RULE_CONTINUITY_IMPLEMENTATION_CONTRACT.md` v2.0-lean (2026-08-20).  
**Charakter:** nieblokujące ulepszenie routingu.

**Status 2026-08-20: DONE** — kod, deploy (flaga ON), workflow AO v13, smoke T4 + C6 PASS.

---

## Stan produkcyjny (sandbox)

| Element | Stan |
|---------|------|
| Worker | `twenty-crm-worker-sandbox` rev `00049-vej`, build `2026-08-20-gcp-v13-continuity` |
| Flag | `CONTINUITY_ROUTING_ENABLED=true` |
| Workflow AO | **v13 ACTIVE** `8722d7da-1284-43de-a639-d4a107601755` / version `a81e8259-7a9e-4611-b36e-3a4a3d5d95de` |
| Owner pool | Marta / Gosia / Maciej / Robert — **bez Ewy** |
| SQL v5 | bez `ownerId` |
| Snapshot | `workflows/snapshots/account-owner-on-sql-v1.json` (v13) |

---

## Checklista

### A. Preflight

- [x] A1. SQL v5 nie zapisuje `ownerId`.
- [x] A2. Sandbox: SQL → Opp.owner zostaje handlowcem (AO workflow nie rusza ownera Opp).
- [x] A3. REST: `companies.accountOwnerId`.
- [x] A4. Continuity UUID bez Ewy.

### B. Kod + testy (LLM)

- [x] `config.js`, `resolveContinuityOwner.js`, `twentyRest.js`, `createLead.js`
- [x] Unit T1–T3/T5 PASS (15/15)
- [x] SSOT: DATA_MODEL, ADR #21, parity P18
- [x] Snapshot workflow + deploy.sh env

### C. Deploy + smoke

- [x] C1. Deploy CF (najpierw OFF, potem ON)
- [x] C2. Smoke create_lead / endpoint (build_id continuity)
- [x] C3. Workflow AO v13 (FIND z `fieldMetadataId` company.id)
- [x] C4. T4: pusty AO → stamp handlowca; niepusty → brak nadpisania
- [x] C5. `CONTINUITY_ROUTING_ENABLED=true`
- [x] C6. Live continuity: Person na firmie AO=Gosia; hash WEB→Marta; `resolveOwnerIdForNewOpportunity` → **Gosia** (PASS). Opp `CONTINUITY C6 returning lead` owner=Gosia.
- [x] C7. Timebox OK

### D. Rollback

1. `CONTINUITY_ROUTING_ENABLED=false` + `./deploy.sh`
2. Dezaktywować workflow AO v13
3. Nie kasować `Company.accountOwner`

### E. Cleanup (opcjonalnie)

Testowe rekordy w Twenty z prefixem `CONTINUITY*` — można usunąć po cutoverze.
