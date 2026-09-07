---
doc_id: LEAD_DISPATCHER_START
title: "Lead Dispatcher v2.0 — RETIRED"
layer: runbook
status: retired
owner: Dawid
last_verified: 2026-09-04
related:
  - LEAD_DISPATCHER_PLAN.md
  - ../../workflows/lead-dispatch.contract.md
audience: "wdrożenie + LLM / agent"
---

# Lead Dispatcher — RETIRED 2026-09-04

**Nie włączaj ponownie.** `go` / `prepare` usunięte ze skryptu, żeby kolejny deploy nie odtworzył Biorę.

Jedyny przydział nowych klientów: GCP `createLead.js` → copywriting=Maciej, parzysty `idOid`=Gosia, nieparzysty=Marta.

```bash
# Jedyna dozwolona komenda (deaktywuje WF Biorę, jeśli wróciłby):
./integrations/tools/start_lead_dispatcher.sh retire
```

Worker `deploy.sh` **zawsze** wstawia `LEAD_DISPATCHER_ENABLED=false` i nie wysyła sweep-on-poll — flaga w `.env.deploy=true` jest ignorowana.

Scheduler `twenty-crm-worker-sandbox` `*/5` zostaje (poczta, create_lead). Sweep dyspozytora na pollu nie biegnie.

Pola Twenty dyspozytora: archiwum, bez kasowania wartości.
