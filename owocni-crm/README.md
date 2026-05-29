# OWOCNI CRM — Repo routing

**Purpose:** Operacyjny pakiet dokumentów SSOT dla CRM OWOCNI.PL na Twenty CRM + integracja ze Sortownią (Stape).  
**Status:** Pre-cutover — Faza A (dokumentacja SSOT) w toku.  
**Owner:** Królu złoty (OWOCNI.PL).  
**Last updated:** 2026-05-29

---

## Jak używać tego repo

1. **Zacznij tutaj** (`README.md`).
2. Pytania o reguły / kto decyduje → `CRM_CONSTITUTION.md`.
3. Skąd dane płyną / granice systemów → `CRM_ARCHITECTURE_CURRENT.md`.
4. Jakie pola istnieją i czy można je zmieniać → `DATA_MODEL.md`.
5. Jakie eventy emituje Twenty i jak → `EVENT_CONTRACT.md`.
6. Co jest jeszcze otwarte / ADR → `DECISION_REGISTER.md`.
7. Jak przeprowadzić cutover → `CUTOVER_RUNBOOK.md`.
8. Fakty platformowe Twenty / incydenty → `ops/OPS_NOTES.md`.
9. Import historyczny → `migration/README.md`.
10. Tożsamość klienta + inbound (kanały, resolver T1–T5) → `IDENTITY_AND_INBOUND.md`.
11. Wymagania operacyjne sprzedaży (MVP vs Etap 2/3) → `SALES_OPS_REQUIREMENTS.md`.
12. Mapowanie stage i nomenklatury eventów → `STAGE_MAPPING.md`.
13. Plan stres-testów (Red Team) przed cutoverem → `STRESS_TEST_PLAN.md`.
14. Audyt konsystencji SSOT (AKK, fault-only, kroki 1–10) → `AUDIT_AKK.md`.
15. Audyt migracji (przed dry-run importu) → `AUDIT_MIGRACJA.md`.

**Pełna wersja konstytucji i bram fazowych:** `../twenty/OWOCNI_CRM_fundamenty (1).md` (materiał źródłowy szefa — rekonsyliować z plikami tutaj).

---

## Task → file routing

| Zadanie / pytanie | Primary file | Secondary files |
|-----------------|--------------|-----------------|
| Czy mogę dodać pole X do Opportunity? | `DATA_MODEL.md` | `CRM_CONSTITUTION.md` (Prawa 3, 4) |
| Jak emitować purchase / qualify_lead / rejected_lead? | `EVENT_CONTRACT.md` | `CRM_ARCHITECTURE_CURRENT.md` §7 |
| Czy AI agent może to zrobić? | `CRM_CONSTITUTION.md` (Prawo 8, Rola 6) | `DECISION_REGISTER.md` |
| Co się dzieje przy cutoverze? | `CUTOVER_RUNBOOK.md` | `migration/README.md` |
| Dlaczego nie Workflow HTTP do Sortowni? | `ops/OPS_NOTES.md` (Twenty Verified Facts) | `CRM_ARCHITECTURE_CURRENT.md` §8 |
| Jak wpadają leady ze strony? | `CRM_ARCHITECTURE_CURRENT.md` §5.1 | `EVENT_CONTRACT.md` §3 |
| Co z julia362? | `CRM_ARCHITECTURE_CURRENT.md` §2 | `CUTOVER_RUNBOOK.md` krok 5 |
| Tożsamość, id_oid, inbound (mail/telefon/formularz)? | `IDENTITY_AND_INBOUND.md` | `DECISION_REGISTER.md` #12/#13 |
| Jak mapować SQL/QUALIFIED/WON i nazwy eventów? | `STAGE_MAPPING.md` | `EVENT_CONTRACT.md` |
| Jakie są wymagania sprzedażowe poza rdzeniem migracji? | `SALES_OPS_REQUIREMENTS.md` | `DECISION_REGISTER.md` #15 |
| Jak testujemy edge case'y przed cutoverem? | `STRESS_TEST_PLAN.md` | `CUTOVER_RUNBOOK.md` |
| Backup formularzy → Google Sheets | `CRM_ARCHITECTURE_CURRENT.md` §3.1 | `STRESS_TEST_PLAN.md` S0 |
| Czy SSOT jest wewnętrznie spójny (auto-audyt)? | `AUDIT_AKK.md` (kroki 1–7 teraz) | `DECISION_REGISTER.md` #14, #16 |
| Czy SSOT zgadza się z Twenty 2.8.0 / Stape? | `AUDIT_AKK.md` (kroki 8–9 preflight) | `ops/OPS_NOTES.md` |
| Czy migracja jest bezpieczna? | `AUDIT_MIGRACJA.md` (przed importem) | `migration/README.md` |
| Co z POC (webhook.site, lead_won)? | `POC_MAPPING.md` | `EVENT_CONTRACT.md` |
| Review SSOT (~30 min) | `CHECKLIST_REVIEW.html` | — (single source of truth) |
| Helpdesk w MVP? | `CRM_CONSTITUTION.md` (Prawo 9) | — **poza MVP** |
| SSOT orkiestracji (Sortownia, Robot, Routing) | [Orkiestracja — Google Docs](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an) | `CRM_ARCHITECTURE_CURRENT.md` §7 |
| Kod Sortowni (paid) | [SORTOWNIA_V2_POPRAWIONY.js](https://github.com/AdrianKrauza/owocni/blob/main/SORTOWNIA_V2_POPRAWIONY.js) | `IDENTITY_AND_INBOUND.md` §8 |
| Kod Robota (GCP) | [GoogleCloudRobot.js](https://github.com/AdrianKrauza/owocni/blob/main/GoogleCloudRobot.js) | `AUDIT_AKK.md` krok 9 |

---

## AI write access status

- **Default:** read-only (native role assignment w Twenty Settings → Members).
- **Promocja do write:** dopiero po retrospektywie Etapu 1 + zgoda właściciela.
- **MCP write** jest technicznie dostępny w Twenty Cloud — wyłączony polityką governance, nie limitacją platformy.

---

## Co ten pakiet NIE jest

- Nie zastępuje [docs.twenty.com](https://docs.twenty.com) (terminy natywne Twenty).
- Nie jest pełnym Event Contract SSOT orkiestracji — patrz [dokumentacja orkiestracji (Google Docs)](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an) oraz kod: [Sortownia](https://github.com/AdrianKrauza/owocni/blob/main/SORTOWNIA_V2_POPRAWIONY.js), [Robot](https://github.com/AdrianKrauza/owocni/blob/main/GoogleCloudRobot.js).
- Nie jest automatycznym eksportem z Twenty UI — aktualizacja ręczna przy każdej zmianie systemu (Prawo 1).

## Instrukcja dla LLM

**Entry point:** `../README.md` (sekcja „Instrukcja dla LLM / agentów AI”).

**Zasada:** Czytaj pliki z tego katalogu (`owocni-crm/`) jako SSOT. Folder `../twenty/` = archiwum POC — nie nadpisuj decyzji z `EVENT_CONTRACT.md` ani `IDENTITY_AND_INBOUND.md` danymi ze snapshotów.

**Priorytet przy konflikcie:** `IDENTITY_AND_INBOUND.md` > `EVENT_CONTRACT.md` > `CRM_ARCHITECTURE_CURRENT.md` > `DECISION_REGISTER.md` (otwarte ADR) > `../twenty/*`.

---

## Legacy / archiwum (nie SSOT)

| Plik | Status |
|------|--------|
| `../twenty/snapshots/` | POC 25–26.05 — `lead_won` itd. przestarzałe; patrz `../twenty/snapshots/README.md` |
| `../twenty/analiza-migracja-twenty.html` | Analiza operacyjna — rekonsyliować z plikami tutaj |
| `../twenty/OWOCNI_CRM_fundamenty (1).md` | Materiał źródłowy szefa |
| Usunięte `EVENT_CONTRACT_OWOCNI*.md` | Zastąpione przez `EVENT_CONTRACT.md` w tym katalogu |
