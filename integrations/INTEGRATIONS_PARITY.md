---
doc_id: INTEGRATIONS_PARITY
title: "INTEGRATIONS_PARITY — zgodność kodu integrations/ z SSOT"
layer: runbook
status: active
edit_scope: content_and_structure
owner: "Dawid (wykonawca techniczny)"
last_verified: 2026-07-10
recheck_trigger: "zmiana integrations/*.js / cloud-functions/* / zamknięcie ADR #14 / nowy adapter Stape lub GCP"
default_trust: D:CORE
related:
  - README.md
  - ../owocni-crm/EVENT_CONTRACT.md
  - ../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../owocni-crm/DECISION_REGISTER.md
  - ../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md
---

# INTEGRATIONS_PARITY — docs ↔ kod

Checklista zgodności między kanonicznym SSOT a kodem w `integrations/`.

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** co jest w repo, czego brakuje w repo (Stape UI), jakie są luki vs SSOT, kolejność domykania.

**NIE czytaj:** `integrations/archive/` (snapshot historyczny).

**Kanoniczny kod:** `integrations/SORTOWNIA_V2_POPRAWIONY.js`, `integrations/GoogleCloudRobot.js`.

---

## 1. Co jest w tym repo vs poza repo

| Komponent | W repo `integrations/`? | Gdzie żyje docelowo | SSOT |
|---|---|---|---|
| Sortownia paid / `generate_lead` / oid_init | **TAK** (`SORTOWNIA_V2_POPRAWIONY.js`) | Stape sGTM tag (deploy z tego pliku) | `EVENT_CONTRACT`, `IDENTITY` |
| Robot / adaptery platform | **TAK** (`GoogleCloudRobot.js`) | GCP Cloud Function | `ARCHITECTURE`, `EVENT_CONTRACT` |
| Adapter `inbound:twenty_webhook` | **TAK** (`cloud-functions/twenty-inbound-webhook/` + legacy Stape) | **Sandbox:** GCP CF via Stape stub; **prod:** legacy full tag lub przyszły prod CF | `EVENT_CONTRACT` §5.4 |
| Adapter `crm:twenty_create_lead` | **TAK** (`cloud-functions/twenty-crm-worker/`) | GCP CF via Stape stub | `ARCHITECTURE` §5.3 | **PASS sandbox** |
| Adapter `crm:twenty_update_person` | **TAK** (`CRM_TWENTY_UPDATE_PERSON.sGTM.js`) | Stape tag + Scheduler — **deploy sandbox PASS** | `EVENT_CONTRACT` §6.1 |
| env-guard sandbox/prod | **TAK (prep)** | `shared/envGuard.js` + `ENV_GUARD.sGTM.js` + pole `environment` w task_queue | `ARCHITECTURE` §5.4 |
| Identity Resolver T1–T5 | **TAK** (`INBOUND_TWENTY_WEBHOOK.sGTM.js` inline) | Stape tag `inbound_twenty_webhook` — **deploy sandbox PASS** | `IDENTITY` §5.2 |

> **Wniosek:** dokumentacja opisuje system cały; repo ma dziś **fragment runtime**. To normalne — ale wymaga jawnej checklisty (ten plik).

---

## 2. Macierz zgodności (stan 2026-07-10)

| ID | Wymaganie SSOT | Plik SSOT | Stan kodu | Status | Następny krok |
|---|---|---|---|---|---|
| P1 | Kanon eventów: `purchase`, `rejected_lead` (zakaz `lead_won` jako event_name) | `EVENT_CONTRACT` §5.2 | Robot: alias legacy → kanon (normalize) | **PASS sandbox** | Evidence: smoke #1–3, S2 Robot |
| P2 | ADR #14 cleanup nazw w Robot + docs orkiestracji | `DECISION_REGISTER` #14 | Robot zaktualizowany; Google Docs — osobno | **W toku** | Przegląd docs orkiestracji |
| P3 | Loop-prevention: pending-write Stape, **nie** `srcSystem`-SKIP | `EVENT_CONTRACT` NR-6, INV-3 | `INBOUND_*` + `CRM_TWENTY_UPDATE_PERSON.sGTM.js` | **PASS sandbox** | Smoke #4 + pending-write TTL |
| P4 | Manual create: `idOid IS NULL` → `generate_lead` + backfill | `EVENT_CONTRACT` §5.4, §6.1 | inbound + worker Stape | **PASS sandbox** | Smoke #4 evidence |
| P5 | Transition detection: Stape Store `last_stage` / `last_campaignRejected` + fingerprint | `EVENT_CONTRACT` §5.4 | GCP `processWebhook.js` | **PASS sandbox** | Smoke #1–3, #5–#7 |
| P12 | GCP inbound CF (`twenty-inbound-webhook`, build `gcp-v5`) | `MIGRATE_TWENTY_CRM_TO_GCP` § Faza 2 | `cloud-functions/twenty-inbound-webhook/` | **PASS sandbox** | Log `build_id: 2026-07-10-gcp-v5` |
| P13 | `qualify_lead` gate: `bizSqlConfirmed` + `SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM` | `EVENT_CONTRACT` §5.3 | inbound CF + workflow SQL | **PASS sandbox** | Workflow „Przyjmij jako SQL" |
| P14 | `campaignRejected` guard: `SKIP_CAMPAIGN_REJECTED` + workflow revert | `EVENT_CONTRACT` §5.3 | inbound CF + guard workflow | **PASS sandbox** | `TWENTY_WORKFLOWS_REJECT_AND_GUARD.md` |
| P15 | `biz_value` purchase: łańcuch pól + `enrichPurchaseBizValues` | `EVENT_CONTRACT` §5.7 | inbound CF + `GoogleCloudRobot.js` | **PASS sandbox** | `normalizeBizValue.test.js` |
| P6 | VBB gate: `identity_status` + `vbb_eligible` | `IDENTITY` §5.10 | Resolver: T3 `vbb_eligible=false`; Robot pełny gate — do testu prod | **Częściowy PASS** | T3 w evidence E12.2; Robot przed cutover |
| P7 | `srcSystem` = raportowe, nie SKIP | `DATA_MODEL` NR-4 | inbound: brak srcSystem-SKIP w kodzie | **OPEN** | L-1 krok 3 jeśli SKIP dodany później |
| P8 | Wskaźniki `by_*` + profil pod `id_oid` | `IDENTITY` §5.8 | multi-key `identity_map` + `twenty_person_{id}` guard | **PASS sandbox*** | Osobne kolekcje `by_*` = backlog ADD-2 |
| P9 | `time_occurred` epoch ms (FIX-2) | `IMPLEMENTATION_PLAN` §5.7 | Sortownia: mieszane formaty | **OPEN** | Ujednolicić w Sortowni |
| P10 | env-guard sandbox/prod | `ARCHITECTURE` §5.4 | Robot `envGuard` + dual-sheet routing | **PASS sandbox** | S2 + smoke matrix |
| P11 | Formularz → Twenty Person+Opp (`crm:twenty_create_lead`) | `BUILD_CRM_TWENTY_CREATE_LEAD` | Sortownia enqueue + worker write | **PASS sandbox** | Runbook §9; idempotencja email OK |

---

## 3. Co zrobiono w tej iteracji (2026-07-10)

1. **Dokumentacja SSOT** zsynchronizowana z runtime GCP: `EVENT_CONTRACT`, `DATA_MODEL`, `ARCHITECTURE`, `integrations/README`, `TWENTY_PATHS`, `INTEGRATIONS_PARITY` (P12–P15).
2. **Nowy runbook:** `TWENTY_WORKFLOWS_REJECT_AND_GUARD.md` (SQL, odrzucenie, guard).
3. **Runbooki operacyjne:** `MIGRATE_TWENTY_CRM_TO_GCP` (gcp-v5/v7), `KANBAN_CARD_SPEC`, `SANDBOX_PHASE1`, `PREFLIGHT`, `BUILD_INBOUND` — GCP path + `biz_value`.
4. **`META-PODLACZENIE.md`** — dopisek zakresu (Meta ≠ Twenty pipeline).

## 3b. Co zrobiono w iteracji (2026-06-02)

1. **Archiwum:** `integrations/archive/pre-ssot-alignment-2026-06-02/` — snapshot przed zmianami.
2. **Robot (`GoogleCloudRobot.js`):**
   - normalizacja legacy `event_name` → SSOT (`lead_won`→`purchase`, `lead_rejected`→`rejected_lead`),
   - warunki biznesowe przepięte na kanoniczne nazwy po normalizacji.
3. **Sortownia paid (`SORTOWNIA_V2_POPRAWIONY.js`):**
   - normalizacja `event_name` na wejściu (gdy CRM/legacy wyśle starą nazwę).
   - pole `environment` w `task_queue`.
4. **Twenty (prep, bez deploy):**
   - `INBOUND_TWENTY_WEBHOOK.js`, `CRM_TWENTY_*.stub.js`, `TWENTY_PATHS.md`, `shared/envGuard.js`.

**Deploy Stape/GCP:** dopiero po preflight payloadów Twenty (patrz `runbooks/WHY_NOT_FULL_RUNTIME_YET.md`).

---

## 4. Checklista PASS przed cutover (integrations)

- [x] **P1** Wszystkie nowe taski w kolejce używają wyłącznie kanonicznych `event_name`. (sandbox smoke 2026-06-15)
- [ ] **P2** Brak `lead_won` / `lead_rejected` w kodzie produkcyjnym (poza warstwą aliasów legacy).
- [x] **P3–P5** Adapter `inbound:twenty_webhook` zaimplementowany w Stape i przetestowany (smoke matrix 8/8).
- [x] **P4** Smoke #4 PASS (manual create + backfill, bez drugiego mint).
- [x] **E12.2** Identity Resolver T1/T3/T4/NR-3 PASS sandbox (`E12_EMAIL_SYNC_EVIDENCE.md`, `verify_identity_e2e.py`).
- [ ] **P7** `srcSystem`-SKIP — w inbound brak; monitorować przy zmianach (L-1).
- [x] **P10** Sandbox nie trafia do prod adapterów reklamowych.
- [x] Eksport/tag Stape dla adapterów Twenty zapisany w repo (`.sGTM.js` 2026-06-15).
- [x] **`crm:twenty_create_lead`** — deploy Stape + Faza B sandbox PASS (`BUILD_CRM_TWENTY_CREATE_LEAD.md` §9, 2026-06-30).

---

## 5. Kolejność prac (zgodna z Twoją decyzją #17)

1. Domknąć decyzje kierunkowe w `DECISION_REGISTER` (evidence z testów).
2. **Ten plik** — aktualizować po każdej zmianie w `integrations/`.
3. Robot + Sortownia paid — dalsze poprawki (FIX-2, ADD-* wg `IMPLEMENTATION_PLAN`).
4. Stape: `inbound:twenty_webhook` + `crm:twenty_*` — implementacja, test, **eksport do repo**.
5. Cutover dopiero po G1–G8 + G-PAR PASS.

---

## 6. CROSS-REFERENCES

| Temat | Gdzie |
|---|---|
| MUST-PASS gates | `../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` §5.4 |
| Event catalog | `../owocni-crm/EVENT_CONTRACT.md` §5.2 |
| Archiwum kodu (NIE SSOT) | `archive/README.md` |
