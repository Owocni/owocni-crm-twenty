# STRESS_TEST_PLAN — Red Team dla SSOT CRM

**Status:** Draft (pre-cutover gate)  
**Powiązane decyzje:** `DECISION_REGISTER.md` #12, #13, #14, #15, #16  
**Cel:** zweryfikować, że eventy i `idOid` nie mieszają się między kanałami.

---

## 1. Zakres testów

1. Inbound wielokanałowy (`formularz`, `kontakt@`, telefon, manual).
2. Deduplikacja cross-channel (ten sam klient: mail + telefon).
3. Event semantics (`purchase`, `rejected_lead`, brak dla LOST).
4. Environment guard (`sandbox` nie trafia do produkcyjnych adapterów).
5. Loop prevention i backfill `idOid`.

---

## 2. Scenariusze krytyczne

### S1 — Mail i telefon tego samego klienta

- Wejście: klient pisze na `kontakt@`, potem dzwoni.
- Oczekiwanie: jeden byt klienta, bez niekontrolowanej duplikacji, stabilne `idOid`.

### S2 — Manual create bez `idOid`

- Wejście: handlowiec tworzy Opportunity ręcznie.
- Oczekiwanie: `generate_lead (manual)` -> mint `idOid` -> backfill w SLA.

### S3 — LOST vs rejected

- Wejście: `stage=LOST` i osobno `campaignRejected=true`.
- Oczekiwanie: brak eventu dla LOST; `rejected_lead` tylko dla `campaignRejected=true`.

### S4 — WON mapping

- Wejście: przejście do `WON`.
- Oczekiwanie: event `purchase` (nigdy `lead_won` / `closed_won`).

### S5 — Sandbox guard

- Wejście: pełna ścieżka eventu z sandboxu.
- Oczekiwanie: bez dotykania produkcyjnych adapterów, tylko safe sink.

---

## 3. Kryteria PASS / FAIL

### PASS

- 100% testów S1–S5 przechodzi.
- Brak rekordu produkcyjnego bez `idOid` > SLA.
- Brak event_name poza kanonem.
- Brak wycieku sandbox -> produkcja.

### FAIL

- Jakikolwiek konflikt deduplikacji prowadzący do rozjechania `idOid`.
- Event `rejected_lead` emitowany od samego LOST.
- Event `lead_won`/`closed_won` pojawia się w integracji.

---

## 4. Dowody testów

- Snapshots/logi z testów.
- Wyniki checklisty review.
- Aktualizacja `DECISION_REGISTER.md` (zamknięcie ADR po PASS).
