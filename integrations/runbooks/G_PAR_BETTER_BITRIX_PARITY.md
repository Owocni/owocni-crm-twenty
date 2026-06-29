---
doc_id: G_PAR_BETTER_BITRIX_PARITY
title: "G-PAR — parzystość Better-Bitrix vs Twenty (test plan)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-16
related:
  - ../../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md
  - E12_3_EMAIL_TEMPLATES_AND_TRAINING.md
  - SMOKE_MATRIX_EXECUTION.md
  - E12_EMAIL_SYNC_EVIDENCE.md
---

# G-PAR — parzystość Better-Bitrix vs Twenty

**Brama go-live** (`IMPLEMENTATION_PLAN` §5.4 NR-4): Twenty musi pokryć funkcje BB, których handlowcy używają dziś — bez tego cutover nie startuje.

**Środowisko testów:** Twenty sandbox + BB prod (read-only porównanie) + Stape sandbox.

**Evidence po PASS:** uzupełnij `E12_EMAIL_SYNC_EVIDENCE.md` §G-PAR.

---

## 0. Mapowanie pojęć (referencja)

| Better-Bitrix | Twenty | Uwaga |
|---------------|--------|--------|
| `stage_name: unsorted` | `NEW` | Nowy lead |
| `inquiry` | `CONTACTED` | Pierwszy kontakt |
| `negotiations` | `PROPOSAL` | Oferta / negocjacje |
| `lead_won` | `WON` + event `purchase` | Stage ≠ event_name |
| `lead_lost` | `LOST` | **Brak** eventu platform |
| Odrzucenie kampanii | `campaignRejected=true` → `rejected_lead` | ≠ LOST |
| `assigned_user_id` | Opportunity **Owner** | |
| `email_template` | Twenty Message templates | E12.3 |
| Auto-lead z `leads@` INBOX | Email Sync + Resolver T3 | julia362 do E12.4 |
| Kanban widok | Twenty Opportunities pipeline | |

---

## Macierz testów G-PAR

Dla każdego wiersza: **data**, **tester**, **ID rekordu**, **PASS/FAIL**, **link do logu**.

### PAR-1 — Pipeline / kanban

| ID | Scenariusz | BB (oczekiwane) | Twenty (test) | PASS |
|----|------------|-----------------|---------------|------|
| PAR-1.1 | Widok lejka | Kolumny stage widoczne | Pipeline Opportunities: NEW…LOST | ☐ |
| PAR-1.2 | Przeciągnięcie karty | Zmiana `stage_name` | Drag stage w UI | ☐ |
| PAR-1.3 | Filtr „moje leady” | Po `assigned_user` | Filtr po Owner | ☐ |
| PAR-1.4 | Nowy lead ręczny | Utworzenie karty | Opp + Person, `idOid` null → backfill (smoke #4) | ☐ |

### PAR-2 — Stage transitions → eventy (nakładka na smoke G1)

| ID | Scenariusz | BB / analytics | Twenty + inbound | Event SSOT | PASS |
|----|------------|----------------|------------------|------------|------|
| PAR-2.1 | Kwalifikacja | `qualify_lead` | `CONTACTED`→`QUALIFIED` | `qualify_lead` | ☐ (smoke #1 ✅) |
| PAR-2.2 | Wygrana | `lead_won` / won | → `WON` + amount | `purchase` | ☐ (smoke #2 ✅) |
| PAR-2.3 | Odrzucenie kampanii | `lead_rejected` | `campaignRejected` true | `rejected_lead` | ☐ (smoke #3 ✅) |
| PAR-2.4 | Przegrana | `lead_lost` | → `LOST` | **brak eventu** | ☐ |
| PAR-2.5 | Edycja opisu | Brak eventu | Pole opisowe | `SKIP_NO_RELEVANT_TRANSITION` | ☐ (smoke #5 ✅) |

**Uwaga:** PAR-2.1–2.3 i 2.5 mają dowód ze smoke matrix 2026-06-15. **PAR-2.4** wymaga jednego świeżego testu w UI Twenty (LOST → sprawdź brak taska `purchase`/`rejected_lead`).

### PAR-3 — Maile i timeline

| ID | Scenariusz | BB | Twenty | PASS |
|----|------------|-----|--------|------|
| PAR-3.1 | Skrzynka handlowca | Wątek w BB inbox | Email Sync + timeline na Person/Opp | ☐ |
| PAR-3.2 | `studio@` | Zapis wątku | Timeline Twenty | ☐ |
| PAR-3.3 | `leads@` | Auto-lead + wątek | Person/Opp + timeline (równolegle julia362) | ☐ |
| PAR-3.4 | Odpowiedź z Twenty | — | Wysłany mail widoczny w timeline | ☐ |
| PAR-3.5 | `kontakt@` | Poza BB auto-lead | **Brak** w Twenty (świadomie) | ☐ |

**Skrzynki do potwierdzenia (7/7):** marta@, gosia@, mariusz@, copywriting@, pomoc@, studio@, leads@.

### PAR-4 — `leads@` rozdział (E12.3b)

| ID | Scenariusz | Kryterium PASS | PASS |
|----|------------|----------------|------|
| PAR-4.1 | Nowy nadawca `leads@` | Opp ma Owner; Resolver T3 | ☐ |
| PAR-4.2 | Powracający nadawca | Link do istniejącego Opp; T1 | ☐ |
| PAR-4.3 | SOP handlowca | Checklist B2 podpisany | ☐ |
| PAR-4.4 | Duplikat BB+Twenty | Oba systemy do cutoveru — dokumentowane | ☐ |

Szczegóły procedury: `E12_3_EMAIL_TEMPLATES_AND_TRAINING.md` §FAZA B.

### PAR-5 — Szablony maili (E12.3 / ADR #17)

| ID | Scenariusz | PASS |
|----|------------|------|
| PAR-5.0 | Plan zastępczy zatwierdzony | ☑ `E12_3_EMAIL_TEMPLATE_STRATEGY.md` |
| PAR-5.1 | 19 szablonów w Sidecar (lub Twenty native) | ☐ |
| PAR-5.2 | Wyślij z Twenty używając pickera (nie copy z Notes) | ☐ |
| PAR-5.3 | Mapowanie + evidence | ☐ |

**Faza przejściowa (PARTIAL):** PAR-5 może mieć **PARTIAL** gdy Faza 0 dual działa (BB picker → sync Twenty) — udokumentowany SOP. **Cutover mailowy** wymaga PAR-5.2 PASS (Sidecar MVP).

### PAR-6 — Tożsamość i pola (E12.2)

| ID | Scenariusz | PASS |
|----|------------|------|
| PAR-6.1 | Nowy nadawca → `idOid` w Person | ☐ (E12.2 ✅) |
| PAR-6.2 | Parity mapa ↔ Person | ☐ (E12.2 ✅) |
| PAR-6.3 | T4 kolizja — brak auto-merge | ☐ (G7 ✅) |
| PAR-6.4 | Pola FROZEN (`idOid`, `campaignRejected`, …) | ☐ (G5 ✅) |

### PAR-7 — Rzeczy świadomie poza parzystością (NIE FAIL)

| Element | Status | Uzasadnienie |
|---------|--------|--------------|
| Helpdesk BB | Poza MVP | `ARCHITECTURE.md` |
| Faktury Bitrix z BB | Manual SOP | `bitrixDealId` ręcznie |
| GPT auto-treść leada (julia362) | Do wyłączenia E12.4 | Zastępuje Resolver + UI |
| `kontakt@` | NIE w CRM | SSOT |
| T5 dwa paid | Eskalacja admin | v1 |

---

## Procedura wykonania (kolejność)

```
1. PAR-6 (już PASS) — tylko potwierdzenie w evidence
2. PAR-2 — dokończ PAR-2.4 (LOST)
3. PAR-3 — każda skrzynka (checklist 7 wierszy)
4. PAR-4 + PAR-5 — razem z E12.3 runbookiem
5. PAR-1 — demo z handlowcem na sandbox
6. Podsumowanie → G-PAR PASS lub lista FAIL
```

**Szacowany czas:** 1–2 dni robocze (Dawid + 1 handlowiec na sesję testową).

---

## Kryterium PASS bramy G-PAR

G-PAR = **PASS** gdy:

- [ ] Wszystkie wiersze PAR-1 … PAR-5 mają **PASS** (PAR-6 = już PASS z E12.2)
- [ ] PAR-7 zaakceptowane przez właściciela (bez ukrytych regresów)
- [ ] Szkolenie C4 z `E12_3_…md` zakończone
- [ ] Evidence uzupełnione

**FAIL** któregokolwiek PAR-1…PAR-5 bez uzasadnionego wyjątku (PAR-7) = cutover **STOP**.

---

## Szablon wpisu evidence

```markdown
### G-PAR — YYYY-MM-DD

| ID | PASS | Tester | Dowód |
|----|------|--------|-------|
| PAR-2.4 | PASS | … | opp uuid, brak task_queue |
| PAR-3.1 | PASS | … | screenshot timeline marta@ |
```

---

## CROSS-REFERENCES

| Temat | Plik |
|-------|------|
| E12.3 checklist | `E12_3_EMAIL_TEMPLATES_AND_TRAINING.md` |
| Smoke eventów | `SMOKE_MATRIX_EVIDENCE_2026-06-15.md` |
| Identity PASS | `E12_EMAIL_SYNC_EVIDENCE.md` |
| Cutover | `IMPLEMENTATION_PLAN.md` §5.5 |
