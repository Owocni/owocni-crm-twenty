# Plan działań — OWOCNI CRM na Twenty (SSOT-first)

**Status:** aktywny od 2026-05-28  
**Źródło kierunku:** mail szefa + `OWOCNI_CRM_fundamenty.md` + `OWOCNI_CRM_pakiet_plikow.md`  
**Zasada:** najpierw jeden zestaw prawdy (7 plików), potem egzekucja w Twenty/Sortowni.

---

## Faza A — Fundament dokumentacji (TERAZ)

| # | Zadanie | Plik | Status |
|---|---------|------|--------|
| A1 | Struktura repo + routing agentów | `README.md` | w toku |
| A2 | Konstytucja (role, 9 praw) | `CRM_CONSTITUTION.md` | w toku |
| A3 | Architektura stan obecny → docelowy | `CRM_ARCHITECTURE_CURRENT.md` | w toku |
| A4 | Model danych (pola krytyczne) | `DATA_MODEL.md` | w toku |
| A5 | Kontrakt eventów Twenty ↔ Sortownia | `EVENT_CONTRACT.md` | w toku |
| A6 | Rejestr decyzji otwartych | `DECISION_REGISTER.md` | w toku |
| A7 | Runbook cutover + ops + migration | `CUTOVER_RUNBOOK.md`, `/ops/`, `/migration/` | w toku |
| A8 | Mapowanie POC → SSOT | `POC_MAPPING.md` | w toku |
| A9 | Rekonsyliacja HTML analizy migracji | `../twenty/analiza-migracja-twenty.html` | kolejny |

**Brama wyjścia Fazy A:** brak sprzeczności między `EVENT_CONTRACT.md` a `analiza-migracja-twenty.html` w nazwach eventów i ścieżce outbound.

---

## Faza B — Rekonsyliacja z istniejącymi docs (po A)

| # | Zadanie | Uwagi |
|---|---------|-------|
| B1 | Legacy kontrakt usunięty; SSOT = `owocni-crm/EVENT_CONTRACT.md` + routing w root `README.md` | **done** |
| B2 | Zarchiwizować snapshoty POC jako dowód Fazy 1, nie jako SSOT | `twenty/snapshots/` bez zmian |
| B3 | Weryfikacja z właścicielem: kryteria stage'ów (ADR #5) | wymaga handlowców |
| B4 | Preflight POC: native webhook payload (`data.before`?) | Decyzja #11 |
| B5 | **AUDIT_AKK tura A** — kroki 1–7, fault-only | `AUDIT_AKK.md` — tylko P1 do domknięcia |
| B6 | **AUDIT_AKK tura B** — kroki 8–9 (Twenty + Stape) | po domknięciu P1 (#12–#14) |
| B7 | Przygotować szkice pod **AUDIT_MIGRACJA** | `migration/README.md`, `STAGE_MAPPING.md` — pełny audyt przed importem |

---

## Faza C — Egzekucja techniczna (po zamknięciu A + B1)

Zgodnie z bramą 5-fazową z fundamentów:

| Faza | Co robimy | Zależności |
|------|-----------|------------|
| **1 Sandbox** | Już częściowo zrobione (POC workspace) | — |
| **2 Schema prod** | Pola FROZEN w Twenty UI + opisy | Pliki 1–3 gotowe |
| **3 Import** | Pełny import + ledger CSV | Plik 3 + `/migration/` |
| **4 Eventy** | Native webhook OUT + adapter Sortowni | Plik 4 + smoke testy |
| **5 Cutover** | Wyłączenie julia362, handlowcy na Twenty | Plik 6 + ADR cutover |

**Nie robimy w Fazie C (MVP):** Helpdesk, MCP write, dashboardy jako fundament, workflow HTTP outbound w Twenty.

---

## Kluczowe decyzje już przyjęte (nie negocjować w kodzie)

1. **Inbound kanoniczny:** Sortownia `generate_lead` → adapter `crm:twenty_create_lead` → Twenty API.
2. **Outbound:** Twenty **native webhook OUT** → Sortownia `inbound:twenty_webhook` (NIE Workflow HTTP — limit 50 credits/rok).
3. **Eventy SSOT z CRM:** `qualify_lead`, `purchase`, `rejected_lead` (+ `generate_lead` przy manual create).
4. **Stage LOST:** brak automatycznego eventu do platform.
5. **`campaignRejected`:** wyłącznie → `rejected_lead` (nie stage LOST).
6. **julia362:** legacy, twarda data wyłączenia w cutover.

---

## Różnice POC vs SSOT (do naprawy w egzekucji)

| POC (25–26.05) | SSOT docelowy |
|----------------|---------------|
| Workflow Code + HTTP → webhook.site | Native webhook OUT → Sortownia |
| `lead_won` | `purchase` |
| `lead_lost` (stage LOST) | brak eventu |
| `lead_rejected` | `rejected_lead` |
| `qualify_lead` | `qualify_lead` (bez zmian) |

Szczegóły: `POC_MAPPING.md`.

---

## Następny krok po Fazie A

1. Review pakietu SSOT z szefem (30 min) — potwierdzenie mapowania eventów i braku helpdesku w MVP.
2. Preflight w sandbox: native webhook payload schema.
3. Rozpocząć Fazę 4 (adapter Sortowni) dopiero po zamknięciu ADR #5 (kryteria stage'ów).
