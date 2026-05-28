# OWOCNI CRM — Repo routing

**Purpose:** Operacyjny pakiet dokumentów SSOT dla CRM OWOCNI.PL na Twenty CRM + integracja ze Sortownią (Stape).  
**Status:** Pre-cutover — Faza A (dokumentacja SSOT) w toku.  
**Owner:** Królu złoty (OWOCNI.PL).  
**Last updated:** 2026-05-28

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
| Co z POC (webhook.site, lead_won)? | `POC_MAPPING.md` | `EVENT_CONTRACT.md` |
| Review SSOT ze szefem (~30 min) | `CHECKLIST_REVIEW_SZEF.html` | — (single source of truth) |
| Helpdesk w MVP? | `CRM_CONSTITUTION.md` (Prawo 9) | — **poza MVP** |
| SSOT orkiestracji (Sortownia, Robot, Routing) | Dokumentacja orkiestracji (poza tym pakietem) | `CRM_ARCHITECTURE_CURRENT.md` §7 |

---

## AI write access status

- **Default:** read-only (native role assignment w Twenty Settings → Members).
- **Promocja do write:** dopiero po retrospektywie Etapu 1 + zgoda właściciela.
- **MCP write** jest technicznie dostępny w Twenty Cloud — wyłączony polityką governance, nie limitacją platformy.

---

## Co ten pakiet NIE jest

- Nie zastępuje `docs.twenty.com/llms.txt` (terminy natywne Twenty).
- Nie jest pełnym Event Contract SSOT orkiestracji Sortowni (ten żyje w dokumentacji orkiestracji).
- Nie jest automatycznym eksportem z Twenty UI — aktualizacja ręczna przy każdej zmianie systemu (Prawo 1).

## Legacy (do rekonsyliacji, nie SSOT)

| Plik | Status |
|------|--------|
| `../twenty/EVENT_CONTRACT_OWOCNI.md` | Legacy — zastępowany przez `EVENT_CONTRACT.md` |
| `../twenty/analiza-migracja-twenty.html` | Analiza operacyjna — zaktualizowana pod SSOT |
| `../twenty/snapshots/` | Dowód POC Fazy 1 — nie SSOT |
