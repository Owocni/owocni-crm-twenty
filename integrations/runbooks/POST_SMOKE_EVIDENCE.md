---
doc_id: POST_SMOKE_EVIDENCE
title: "Faza 5 — evidence, DECISION_REGISTER, cutover readiness"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-02
---

# Faza 5 — po smoke: evidence i domknięcie

## 5.1 Zaktualizuj INTEGRATIONS_PARITY.md

Dla P1–P10 ustaw status **PASS** lub **OPEN** z datą i linkiem do dowodu (log, screenshot safe sink, commit).

## 5.2 DECISION_REGISTER — evidence

| ID | Co zamknąć | Dowód |
|----|------------|-------|
| ADR #14 | Event naming cleanup | Faza 1 logi + brak `lead_won` w nowych taskach |
| L-1 | srcSystem-SKIP removal | Smoke #4 PASS + sekwencja (1)(2)(3) wykonana |
| #12, #13 | Email/Resolver przed legacy off | Osobny plan G7 — nie mieszać z tą fazą |
| §5.8 | Cutover date | Nadal **bez daty** do PASS G1–G8 + G-PAR |

Format wpisu (przykład):

```markdown
- **Evidence (2026-06-XX):** smoke #4 PASS — link do logów / commit `abc123`
```

## 5.3 IMPLEMENTATION_PLAN §5.4

Zmień status bram z „do testu” na **PASS** tylko z dowodem:

| Brama | Warunek evidence |
|-------|------------------|
| G1 | Faza 1 + smoke 1–3 |
| G2 | Faza 2 preflight + smoke 5–7 |
| G3 | Smoke #4 część manual |
| G4 | Smoke #4 + pending-write |
| G6 | Smoke #8 |

## 5.4 Push i komunikacja

1. Commit: `integrations/` (adapter + runbooks + parity PASS).
2. Commit: `owocni-crm/DECISION_REGISTER.md` (evidence only).
3. Push `main`.
4. Krótki status dla Mariusza: które bramy PASS, które OPEN (G7, G8, G-PAR).

## 5.5 Co dalej (poza integrations)

| Temat | Gdzie |
|-------|-------|
| Sortownia ADD-1/ADD-2 (`by_*`) | `IMPLEMENTATION_PLAN` |
| FIX-2 `time_occurred` ms | Sortownia + Robot |
| Email Sync + Resolver | `IDENTITY_AND_INBOUND` §5.2 |
| Cutover window | dopiero po pełnym G1–G8 + G-PAR |

---

## Cutover — NIE startuj bez

- [x] Wszystkie 8 smoke PASS z datami (sandbox 2026-06-15 — `SMOKE_MATRIX_EVIDENCE_2026-06-15.md`)
- [ ] G-PAR (parzystość BB) PASS
- [ ] Szkolenie handlowców (`IMPLEMENTATION_PLAN` §5.6)
- [ ] Snapshot schemy Twenty w git
