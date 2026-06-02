---
doc_id: INTEGRATIONS_PARITY
title: "INTEGRATIONS_PARITY — zgodność kodu integrations/ z SSOT"
layer: runbook
status: active
edit_scope: content_and_structure
owner: "Dawid (wykonawca techniczny)"
last_verified: 2026-06-02
recheck_trigger: "zmiana integrations/*.js / zamknięcie ADR #14 / nowy adapter Stape"
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
| Adapter `inbound:twenty_webhook` | **TAK (prep)** (`INBOUND_TWENTY_WEBHOOK.js`) | Stape HTTP tag — deploy po preflight | `EVENT_CONTRACT` §5.4 |
| Adapter `crm:twenty_create_lead` | **TAK (stub)** (`CRM_TWENTY_CREATE_LEAD.stub.js`) | Stape tag | `ARCHITECTURE` §5.3 |
| Adapter `crm:twenty_update_person` | **TAK (stub)** (`CRM_TWENTY_UPDATE_PERSON.stub.js`) | Stape tag | `EVENT_CONTRACT` §6.1 |
| env-guard sandbox/prod | **TAK (prep)** | `shared/envGuard.js` + `ENV_GUARD.sGTM.js` + pole `environment` w task_queue | `ARCHITECTURE` §5.4 |
| Identity Resolver T1–T5 | **NIE (jeszcze)** | Stape — osobny handler | `IDENTITY` §5.2 |

> **Wniosek:** dokumentacja opisuje system cały; repo ma dziś **fragment runtime**. To normalne — ale wymaga jawnej checklisty (ten plik).

---

## 2. Macierz zgodności (stan 2026-06-02)

| ID | Wymaganie SSOT | Plik SSOT | Stan kodu | Status | Następny krok |
|---|---|---|---|---|---|
| P1 | Kanon eventów: `purchase`, `rejected_lead` (zakaz `lead_won` jako event_name) | `EVENT_CONTRACT` §5.2 | Robot: alias legacy → kanon (normalize) | **W toku** | Sandbox: task_queue z `purchase` / `rejected_lead` |
| P2 | ADR #14 cleanup nazw w Robot + docs orkiestracji | `DECISION_REGISTER` #14 | Robot zaktualizowany; Google Docs — osobno | **W toku** | Przegląd docs orkiestracji |
| P3 | Loop-prevention: pending-write Stape, **nie** `srcSystem`-SKIP | `EVENT_CONTRACT` NR-6, INV-3 | Kod prep w `INBOUND_*` + `CRM_TWENTY_UPDATE_PERSON` | **OPEN** | Preflight TTL + smoke |
| P4 | Manual create: `idOid IS NULL` → `generate_lead` + backfill | `EVENT_CONTRACT` §5.4, §6.1 | `INBOUND_TWENTY_WEBHOOK.js` + update_person stub | **OPEN** | Smoke #4 na sandboxie |
| P5 | Transition detection: Stape Store `last_stage` / `last_campaignRejected` | `EVENT_CONTRACT` §5.4 | `INBOUND_TWENTY_WEBHOOK.js` (klucze `twenty:opp:`) | **OPEN** | Preflight payload + test |
| P6 | VBB gate: `identity_status` + `vbb_eligible` | `IDENTITY` §5.10 | Robot: częściowo (consent); pełny gate — weryfikacja | **Do testu** | Test T4/T5 bez emisji VBB |
| P7 | `srcSystem` = raportowe, nie SKIP | `DATA_MODEL` NR-4 | Adapter Twenty **poza repo** | **OPEN** | Usunąć SKIP po L-1 + smoke #4 |
| P8 | Wskaźniki `by_*` + profil pod `id_oid` | `IDENTITY` §5.8 | Sortownia: multi-key write (legacy) | **OPEN** | ADD-1/ADD-2 w `IMPLEMENTATION_PLAN` |
| P9 | `time_occurred` epoch ms (FIX-2) | `IMPLEMENTATION_PLAN` §5.7 | Sortownia: mieszane formaty | **OPEN** | Ujednolicić w Sortowni |
| P10 | env-guard sandbox/prod | `ARCHITECTURE` §5.4 | Robot `envGuard` + Sortownia `environment` field | **W toku** | Test fixture sandbox bez prod API |

---

## 3. Co zrobiono w tej iteracji (2026-06-02)

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

- [ ] **P1** Wszystkie nowe taski w kolejce używają wyłącznie kanonicznych `event_name`.
- [ ] **P2** Brak `lead_won` / `lead_rejected` w kodzie produkcyjnym (poza warstwą aliasów legacy).
- [ ] **P3–P5** Adapter `inbound:twenty_webhook` zaimplementowany w Stape i przetestowany (smoke matrix).
- [ ] **P4** Smoke #4 PASS (manual create + backfill, bez drugiego mint).
- [ ] **P7** `srcSystem`-SKIP usunięty dopiero po smoke #4 (L-1).
- [ ] **P10** Sandbox nie trafia do prod adapterów reklamowych.
- [ ] Eksport/tag Stape dla adapterów Twenty zapisany w repo (opcjonalnie, zalecane przed cutover).

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
