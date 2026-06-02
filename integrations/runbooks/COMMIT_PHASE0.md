---
doc_id: COMMIT_PHASE0
title: "Faza 0 — commit i push lokalnych zmian"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-02
---

# Faza 0 — commit lokalny (przed testami sandbox)

## Co commitować (propozycja 2 commitów)

### Commit A — integrations (punkt 17)

```
integrations/
├── archive/
├── INTEGRATIONS_PARITY.md
├── README.md
├── GoogleCloudRobot.js
├── SORTOWNIA_V2_POPRAWIONY.js
├── INBOUND_TWENTY_WEBHOOK.stub.js
├── fixtures/
└── runbooks/
```

**Message (propozycja):**

```
Align integrations event names with EVENT_CONTRACT (ADR #14).

Archive pre-SSOT snapshots, add parity checklist and runbooks,
normalize lead_won/lead_rejected to purchase/rejected_lead in Robot and Sortownia.
```

### Commit B — dokumentacja decyzji (jeśli gotowe)

Pliki (jeśli zmienione lokalnie):

- `owocni-crm/DECISION_REGISTER.md` (§5.8 ustalenia 2026-06-02)
- `owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` (OQ-P3)
- `owocni-crm/ARCHITECTURE.md` (ścieżki formularzy — jeśli dotyczy)

**Message (propozycja):**

```
Record 2026-06-02 decision directions for cutover blockers and L-1 sequence.
```

## Po push

1. Oznacz w `INTEGRATIONS_PARITY.md` §3 datę commita.
2. Przejdź do [SANDBOX_PHASE1_ROBOT_EVENTS.md](./SANDBOX_PHASE1_ROBOT_EVENTS.md).

## Uwaga

Nie commituj `.env`, kluczy Stape, pełnych webhooków z PII — patrz `fixtures/.gitignore`.
