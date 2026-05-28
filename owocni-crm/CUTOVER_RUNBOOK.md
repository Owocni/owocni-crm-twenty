# CUTOVER_RUNBOOK — przełączenie na Twenty

**Wersja:** 0.1 (szkic — data cutover TBD)  
**Owner:** Właściciel + Developer  
**Pełna wersja:** `../twenty/OWOCNI_CRM_pakiet_plikow (1).md` Plik 6

---

## Pre-cutover (T-7 … T-1)

- [ ] Dry-run w sandbox + smoke testy (`EVENT_CONTRACT.md` §7) — 5/5 PASS
- [ ] Komunikat do zespołu (handlowcy)
- [ ] Zamrożenie nowych pól/workflowów (okno zmian)
- [ ] Backup Supabase legacy
- [ ] **Workflow OFF** na Opportunity/Person (bulk gate) — lista w `ops/OPS_NOTES.md`
- [ ] Checklist webhook:
  - [ ] Twenty native webhook OUT → URL Sortowni, HMAC
  - [ ] Adapter `inbound:twenty_webhook` gotowy
  - [ ] Inteligentny Routing: qualify_lead, purchase, rejected_lead, generate_lead
  - [ ] Guard `environment`: sandbox → safe sink (np. Google Sheets), prod → adaptery reklamowe
  - [ ] Loop prevention przetestowany
- [ ] ADR #5, #6, #8 zamknięte w `DECISION_REGISTER.md`

---

## Cutover (T-0) — kolejność

1. Zaproszenia handlowców (jeśli nie wcześniej)
2. Aktywacja adaptera `crm:twenty_create_lead` w Sortowni
3. Smoke inbound: 1 lead testowy → Twenty
4. Legacy pipeline **read-only** (better-bitrix zapis nowych leadów OFF)
5. **Wyłączenie julia362** (`pm2 stop` / data w komunikacie)
6. Aktywacja native webhook OUT + adapter Sortowni
7. Reaktywacja prostych workflowów wewnętrznych Twenty (jeśli były OFF)
8. E2E: 5 scenariuszy z `EVENT_CONTRACT.md`
9. Komunikat: system aktywny
10. Monitoring 4h (Ratownik + logs)

---

## Rollback — kiedy

- ≥3 alerty auth/schema w 1h
- Webhook failure rate >20% przez 30 min
- >50% zadań `failed_final` w 1h
- Decyzja właściciela

**Procedura (skrót):** OFF adapter Sortowni + webhook; ON legacy + julia362; **nie usuwać** workspace Twenty.

---

## Po cutover (T+1 … T+7)

- Ledger migracji zweryfikowany
- failed_final <2%
- Retrospektywa Etapu 1 (T+7)
- ADR-y z DECISION_REGISTER → Sekcja B

---

## Handoff WON → Bitrix24 (MVP)

Manual SOP: po `stage=WON` handlowiec tworzy Deal w Bitrix24, wpisuje `bitrixDealId` w Twenty.  
Phase 2: adapter `crm:bitrix_create_deal`.
