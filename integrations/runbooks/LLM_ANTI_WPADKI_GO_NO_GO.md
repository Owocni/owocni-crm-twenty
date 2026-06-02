---
doc_id: LLM_ANTI_WPADKI_GO_NO_GO
title: "LLM Anti-Wpadki — Go/No-Go"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-02
related:
  - ./NEXT_STEPS.md
  - ../../owocni-crm/EVENT_CONTRACT.md
  - ../../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md
  - ../../owocni-crm/DECISION_REGISTER.md
---

# LLM Anti-Wpadki — Go/No-Go (1 strona)

Ten checklist używaj PRZED każdą zmianą, deployem i zdjęciem guardów.

## 1) Twarde No-Go (zatrzymaj pracę)

- [ ] LLM zgaduje payload Twenty zamiast pracować na przechwyconym payloadzie sandbox.
- [ ] Ktoś chce usunąć `srcSystem`-SKIP przed PASS smoke #4 (L-1).
- [ ] Sandbox może wysłać dane do produkcyjnych adapterów reklamowych.
- [ ] Zmiana `event_name` poza kanonem (`generate_lead`, `qualify_lead`, `purchase`, `rejected_lead`, `consent_update`, `oid_init`).
- [ ] Brak evidence (log/screenshot/commit) dla kroku oznaczonego jako PASS.

Jeśli choć 1 pozycja = TAK, status: **NO-GO**.

---

## 2) Go Preconditions (muszą być spełnione)

- [ ] Pracujesz na SSOT: `owocni-crm/*.md` + `integrations/*.js` (bez `archive/` i `_DO_USUNIECIA/`).
- [ ] Masz aktualny runbook fazy (`NEXT_STEPS.md`) i jasno wskazany etap 0/1/2/3/4/5.
- [ ] Wiesz, która brama jest celem zmiany (G1..G8, G-PAR).
- [ ] Dla webhooków Twenty masz surowe payloady z sandbox + potwierdzony HMAC.
- [ ] Każda zmiana ma rollback lub przynajmniej „safe sink” na sandbox.

Jeśli wszystkie pozycje = TAK, możesz przejść do implementacji: **GO**.

---

## 3) Minimalny rytm pracy z LLM (bezpieczny)

1. **Plan kroku** (jeden etap, jeden cel bramkowy).
2. **Zmiana kodu/docs** (mała, izolowana).
3. **Test sandbox** (fixture/smoke).
4. **Evidence** (log + wpis w parity/decision register).
5. **Dopiero potem** kolejny krok.

Zakaz „hurtowych” zmian bez testów pośrednich.

---

## 4) Quick Risk Matrix

| Ryzyko | Objaw | Mitigacja |
|---|---|---|
| Zła interpretacja webhook payload | Eventy nie emitują się lub emitują błędnie | Faza 2 preflight + capture JSON + OQ-E2/OQ-E3 |
| Pętla / drugi mint `idOid` | Dwa `generate_lead` dla manual create | L-1 sekwencja 1-2-3 + smoke #4 PASS |
| Wyciek sandbox → prod | Testy wysyłają do Ads API prod | env-guard + safe sink + osobne flagi env |
| Drift docs vs runtime | Kod działa inaczej niż SSOT | `INTEGRATIONS_PARITY.md` aktualizowany po każdym etapie |
| Fałszywe „PASS” | Brak dowodu testu | wpis evidence + link do logu/commita |

---

## 5) Definition of Done dla etapu (LLM)

Etap jest zakończony tylko gdy:

- [ ] Kod i dokumentacja są spójne,
- [ ] test sandbox przeszedł,
- [ ] evidence zapisane,
- [ ] status w parity/gates zaktualizowany.

Brak jednego elementu = etap **niezamknięty**.

---

## 6) Szybkie referencje

- Sekwencja prac: `integrations/runbooks/NEXT_STEPS.md`
- Testy eventów: `integrations/runbooks/SMOKE_MATRIX_EXECUTION.md`
- Build webhook adaptera: `integrations/runbooks/BUILD_INBOUND_TWENTY_WEBHOOK.md`
- Bramy go/no-go: `owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` §5.4
- Krytyczny wyjątek L-1: `owocni-crm/EVENT_CONTRACT.md` §6.1
