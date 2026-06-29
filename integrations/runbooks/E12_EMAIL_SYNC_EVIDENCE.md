---
doc_id: E12_EMAIL_SYNC_EVIDENCE
title: "E12 — Email Sync + Identity Resolver — dowody PASS sandbox"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-16
related:
  - E12_EMAIL_SYNC_EXECUTION.md
  - BUILD_IDENTITY_RESOLVER.md
  - ../INTEGRATIONS_PARITY.md
  - E12_4_OWOCNI_MAIL_RESET_PLAN.md
---

# E12 — Evidence (sandbox)

## E12.1 Email Sync

| Element | Status | Dowód |
|---------|--------|-------|
| 7 skrzynek podłączonych | PASS | Email Sync aktywny; Person z kanału EMAIL w Twenty |
| `kontakt@` poza zakresem | PASS | Świadomie niepodłączony (`IDENTITY` §5.4) |
| julia362 równolegle | PASS | Nie wyłączony (E12.4 czeka na G7 + G-PAR) |

---

## E12.2 Identity Resolver — PASS sandbox (2026-06-16)

**Kontener:** `https://uinpcbwf.eug.stape.io` (GTM-5ZM8KQ5S)  
**Tagi:** `inbound_twenty_webhook`, `crm_twenty_update_person` (publish 2026-06-16)  
**Skrypt weryfikacji:** `integrations/tools/verify_identity_e2e.py`

### Wynik automatyczny

| Data | PASS | FAIL | Uwagi |
|------|------|------|-------|
| 2026-06-16 | **40/40** | 0 | Pierwszy pełny PASS po publish mint-guard + worker |
| 2026-06-16 | 43–44/44 | 0–1 | T4 + NR-3 + E2E; sporadyczny flake T3 w długim suite (izolowany T3 PASS ~2 s) |

### Scenariusze potwierdzone

| ID | Scenariusz | Wynik | Przykład |
|----|------------|-------|----------|
| E2E-1 | T3 mint + `identity_map` + worker backfill | PASS | `paulina@eco-corn.pl`, `ania_95@op.pl` |
| E2E-2 | T1 reuse `id_oid` (email w mapie) | PASS | `admin@europc.net.pl` |
| E2E-3 | SKIP gdy `Person.idOid` ustawione | PASS | `anna.daniszewska@besthouse.com.pl` |
| E2E-4 | NR-3 mint-guard (2× równoległy webhook) | PASS | `paulina@eco-corn.pl` — jeden `id_oid`, klucz `twenty_person_{id}` |
| E2E-5 | Parity `Person.idOid` ↔ `identity_map` | PASS | Europc, Anna, Kuptoner, mg@ice-storm |
| G7-T4 | Email→A, phone→B → brak auto-PATCH | PASS | `0111729d-…` — `T4_NEEDS_REVIEW`, brak taska backfill |
| G7-VBB | T3 → `vbb_eligible=false` | PASS | wszystkie mint T3 w mapie |

### Kontrakt techniczny (potwierdzony)

- `identity_map` multi-key: `email`, `phone`, `id_oid`, `twenty_person_{personId}`
- Task backfill: `twenty_person_{personId}_identity_backfill` (idempotentny)
- Worker: `backfill_completed_at` po PATCH Twenty
- `last_resolver`: `identity:twenty_resolver`

### Znane ograniczenia v1 (świadome, nie bloker sandbox)

| Element | Status |
|---------|--------|
| T4 flaga w Twenty UI | Tylko log `T4_NEEDS_REVIEW` — UI w Etapie 2 |
| T5 (dwa paid) | Nie implementowane |
| fail-closed przy Stape down | Nie testowane automatycznie (G7 częściowy OPEN) |
| Tag `identity_twenty_resolver` | PAUZA — logika w inbound |

---

## G7 identity-safety — status

| Warunek G7 | Status |
|------------|--------|
| T1/T3 auto link/mint | **PASS** sandbox |
| T4 brak auto-PATCH | **PASS** sandbox (2026-06-16) |
| NR-3 mint-guard | **PASS** sandbox |
| T5 / dwa paid | N/A v1 |
| Stape down → fail-closed | **OPEN** (test manualny/destrukcyjny) |
| VBB gate w Robot (P6) | **Do testu** przed prod |

---

## E12.3 — eksport szablonów BB (FAZA A1)

| Data | Wynik | Dowód |
|------|-------|-------|
| 2026-06-16 | **19/19** wyeksportowane (CRM + helpdesk + bez kategorii) | `exports/bb_email_templates/bb_email_templates_2026-06-16.md` |

| Scope | Liczba | Uwagi |
|-------|--------|-------|
| `crm` (tag sales/website/logo/…) | 6 | |
| `helpdesk` | 4 | Migrujemy do Twenty mimo poza MVP Helpdesk |
| `needs_review` (brak tagu) | 9 | Oznaczyć MUST przed A2 |

Skrypt powtarzalny: `python3 integrations/tools/export_bb_email_templates.py`

### A1.3–A1.4 + przygotowanie A2 (2026-06-16)

| Artefakt | Status |
|----------|--------|
| Priorytety MUST/NICE | 9 MUST + 10 NICE — `bb_email_templates_migration_2026-06-16.md` |
| Mapowanie kategorii BB→Twenty | w tym samym pliku |
| Asystent importu UI | ~~deprecated~~ — spike Notes odrzucony |
| **Strategia zastępcza** | [E12_3_EMAIL_TEMPLATE_STRATEGY.md](./E12_3_EMAIL_TEMPLATE_STRATEGY.md) — ADR #17 |
| Notes spike | ☑ **usunięte** 19/19 z sandboxa |
| Podpisy BB (10) | `bb_email_signatures_2026-06-16.json` — A2.4 OPEN |

**Następny krok:** ~~Faza 0 (dual SOP + test timeline) → spike Template Sidecar~~ → **Owocni Mail App PASS** (§G-PAR PAR-5.2).

---

## G-PAR — Owocni Mail App (PAR-5.2) — PASS sandbox (2026-06-16)

**Środowisko:** `https://zany-maroon-panther.twenty.com`  
**App:** `apps/owocni-mail-twenty/` (Owocni Mail)  
**Tester:** Dawid

### PAR-5.2 — wysyłka z pickera bez BB

| Pole | Wynik |
|------|--------|
| Ścieżka | Person → ⌘K → **Szablony maili** → wybór szablonu → edycja wizualna → **Wyślij email** |
| Better-Bitrix | **Nie używany** |
| Szablon wczytuje się | **PASS** |
| Edytor wizualny (edycja + sync treści) | **PASS** |
| Wysyłka maila | **PASS** |
| Panel zamyka się po wysłaniu | **PASS** |
| Snackbar potwierdzenia | **PASS** |
| Czas &lt; 60 s | **PASS** (subiektywnie — bez pomiaru stoperem) |

### PAR-5.1 — szablony w Twenty

| Pole | Wynik |
|------|--------|
| Liczba szablonów | **19/19** (`seed_mail_templates_to_twenty.py`) |
| Picker lista + filtr | **PASS** |
| Stabilność pickera (brak crashy) | **PASS** |

### P1 / P2 — infrastruktura wysyłki

| Element | Status |
|---------|--------|
| `GET /mail/send-readiness` → `canSend: true` | PASS |
| `POST /mail/send-template` + `htmlBody` z edytora | PASS |
| Draft sync iframe → `POST /mail/editor-draft` | PASS |
| Strona **Owocni Mail** (main-page, bez `twenty-sdk/ui`) | PASS |

### PAR-5.3 — szkolenie

| Element | Status |
|---------|--------|
| Evidence (ten dokument) | **PASS** 2026-06-16 |
| SOP wysłany do handlowców | **OPEN** — planowane później |
| Szkolenie 15 min | **OPEN** |

### Uwagi / świadomie odłożone

- Tematy w szablonach bez `subjectTemplate` — częściowy fallback z nazwy; uzupełnienie **nie blokuje** cutoveru.
- Timeline Person po wysyłce — **nie weryfikowane** w tym teście (do sprawdzenia przy szkoleniu).
- Prod Twenty — **OPEN** (test dotyczył sandboxa).

**Wniosek:** **PAR-5.2 PASS** na sandboxie. MVP Owocni Mail gotowy do szkolenia handlowców i ewentualnego sync na prod.

---

## Następny etap (po PAR-5.2)

| Etap | Runbook | Status |
|------|---------|--------|
| **PAR-5.3** szkolenie + SOP | [E12_4_P4_CUTOVER_INSTRUCTIONS.md](./E12_4_P4_CUTOVER_INSTRUCTIONS.md) | **OPEN** |
| **Prod sync** Owocni Mail App | `yarn twenty dev --once` na prod | **OPEN** |
| **G-PAR** pełny parity BB | [G_PAR_BETTER_BITRIX_PARITY.md](./G_PAR_BETTER_BITRIX_PARITY.md) | OPEN |
| **E12.3b** `leads@` | [E12_3_EMAIL_TEMPLATES_AND_TRAINING.md](./E12_3_EMAIL_TEMPLATES_AND_TRAINING.md) §FAZA B | OPEN |
| **E12.4** julia362 OFF | po G-PAR PASS | OPEN |

Sekcje evidence uzupełnione: **§G-PAR PAR-5.2** (2026-06-16).

---

## E12.3c — Twenty native email composer — izolacja Owocni Mail (2026-06-16)

**Cel:** ustalić, czy lag + React #185 przy Reply pochodzi z Owocni Mail App, czy z Twenty core.

| Krok | Wynik |
|------|--------|
| Email sync zakończony | PASS |
| Reply otwiera edytor | PASS (funkcjonalnie) |
| React **#185** w konsoli (wielokrotnie) | **FAIL** |
| Lag / Firefox „strona spowalnia przeglądarkę” | **FAIL** |
| **Uninstall Owocni Mail** → ponowny Reply | **Nadal #185 + lag** |

**Wniosek:** problem **nie** był spowodowany przez Owocni Mail App. Twenty support **naprawił** composer (2026-06) — P1b PASS.

**Środowisko:** `https://zany-maroon-panther.twenty.com`, Firefox, sandbox Owocni.

**Następny krok:** ~~zgłoszenie do Twenty support~~ → **PAR-5.2 PASS** (§E12_EMAIL_SYNC_EVIDENCE.md). Cutover: szkolenie (PAR-5.3), potem prod + G-PAR.

---

## CROSS-REFERENCES

| Temat | Plik |
|-------|------|
| Runbook wykonawczy | `E12_EMAIL_SYNC_EXECUTION.md` |
| Build resolver | `BUILD_IDENTITY_RESOLVER.md` |
| Macierz parity | `INTEGRATIONS_PARITY.md` |
| Bramy G1–G8 | `owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` §5.4 |
| E12.3 + szkolenie | `E12_3_EMAIL_TEMPLATES_AND_TRAINING.md` |
| G-PAR test plan | `G_PAR_BETTER_BITRIX_PARITY.md` |
