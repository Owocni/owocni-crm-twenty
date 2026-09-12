---
doc_id: QUEUE_TRIAGE_T1_CHAT_20260912
title: "T1 weekend — osobny czat (testy, Batko, Fakturownia, Inkflow, Sortownia vs BB)"
layer: runbook
status: done_20260912
owner: "Dawid"
last_verified: 2026-09-12
related:
  - QUEUE_TRIAGE_20260912.md
  - MERGE_LEADS.md
  - ROLLFORWARD_20260911.md
---

# T1 — brief do nowego okna czatu

Ten plik jest **samowystarczalny**. Wklej prompt z §2 do nowego Agenta w tym samym workspace. **Nie ruszaj Owocni Mail** — to osobny tor w drugim czacie.

Workspace: `/Volumes/Samsung_T5/owocni/owocni strona i bitrix`  
Repo: `owocni-crm-github`  
Audit: `integrations/runbooks/exports/queue_cleanup/20260912T052202Z/wave3_null_sortownia_audit.json`  
BB sync piątek: `integrations/runbooks/exports/bb_sync/runs/20260911T180000Z/` (78 patched + 117 unchanged / 195; 33 create **pominięte**)

## 1. Decyzje Dawida (12.09, GO)

| # | Co | Akcja |
|---|---|---|
| 1 | 8 kart testowych | **Usuń Opportunity** (i Person jeśli osierocony). **Zostaw jedną** `test9959058@fastman.eu` `a88aa583-…` do testów poczty. |
| 2 | `lech.batko@poczta.fm` `34b12db0-…` (30 VIII, Sortownia, null owner) | **Najpierw odczyt:** czy był w BB i/lub Pipedrive. Nie kasować / nie przydzielać bez faktu. |
| 3 | `TEST Fakturownia DEMO` `c6d3fb6d-…` (11 IX, `TWENTY_UI`) | **Usuń.** |
| 4 | `info@inkflowcollective.com` `00fad7e0-…` (Sortownia CONTACTED, 1 VII) | **Scal** z wygranym leadem Roberta (2× sibling WON, `PIPEDRIVE_LEGACY`, owner Robert `23ac9976-…`). Loser = ta karta Sortownia. Survivor = nowszy/pełniejszy WON Roberta. Worker `merge_leads` (`integrations/runbooks/MERGE_LEADS.md`). Nie PATCH `stage` na QUALIFIED/WON ręcznie. |
| 5 | Reszta null-owner Sortownia (dump formularzy ~26 VI–3 VII, `bitrixDealId` puste) | **Odczyt:** czy mają odpowiedniki w BB (email → `leads_extended_materialized`). Policz hit/miss. **Nie rozdawaj** Gosi/Marcie jako poniedziałkową pracę. Wynik + rekomendacja (zostawić / archiwum LOST tylko jeśli Dawid potwierdzi — ten weekend **nie** auto-LOST). |
| 6 | Otwarte Twenty Marty / Gosi / Maćka | **Odczyt:** czy karty = sync z BB (piątek patch-only), nie „wysłane z BB” jako maile. Porównaj `bitrixDealId` / `srcSystem=BETTER_BITRIX_LEGACY` vs BB owner 259/257/79. IMAP historii **nie** było w syncu kart (`BB_MAIL_IMAP_APPEND_RUNBOOK.md`). Raport % pokrycia + dziury. |

### IDs do skasowania (7 testów + Fakturownia)

Zostaw: `a88aa583-…` `test9959058@fastman.eu`.

| id | nazwa |
|---|---|
| `10b309b9-f2ee-423b-822a-3c2b5cbfdbc8` | verify-create-lead-liimendf@example.com |
| `186fb2a4-1461-41f2-b155-0efc4f0ec94b` | test858ggaf@fastman.eu |
| `82739981-f35b-4e25-bc21-fbdfc97a9519` | verify-create-lead-llmkbjml@example.com |
| `97c956f1-c372-47c4-805b-bb27204fa0ad` | tjagurtn489@fastman.eu |
| `eb6b7d69-c80b-4d20-a0f2-a5cfccb6b129` | v4-test-test@fastman.eu |
| `f4b9c846-9970-46b4-8405-7ff50e08e4da` | test120gagafg@fastman.eu |
| `f6503cba-c0cb-4b5c-8199-26b57b702612` | 15ffjfj949@fastman.eu |
| `c6d3fb6d-7601-4e09-89b1-099a86e18f64` | TEST Fakturownia DEMO |

Zostaw: `a88aa583-646d-41f2-944f-20c988f63e3f` (`test9959058@fastman.eu`).

Nie kasuj bez pytania: `1e56276e-…` i `76cb0120-…` (`info@invitely.in` + dodatkowy `tesg8854@fastman.eu`) — to nie jest karta testowa.

### STOP

- Nie deploy Owocni Mail. Nie `yarn twenty apply`.
- Nie PATCH `stage` → QUALIFIED / WON (inbound Twenty = **prod** Ads).
- Nie `apply_premonday.py`. Nie nadpisuj widoków Mariusza.
- Nie pełny BB→Twenty apply (33 create z piątku zostają pominięte).
- Delete: najpierw lista + count, potem wykonaj (Dawid już potwierdził te 7+1).
- Merge Inkflow: survivor = WON Roberta, nie odwrotnie. `no_emit`.
- Log w `owocni-crm/ops/OPS_NOTES.md` §5.3 + krótki dopisek w `QUEUE_TRIAGE_20260912.md`.

### Narzędzia

- Twenty: `integrations/tools/twenty_rest.py` (`load_env` z `.env.local`).
- BB: `integrations/tools/bb_supabase.py` (`fetch_bb_leads` / `bb_get("leads_extended_materialized")`). Szukaj emaila w `company.emails`.
- Pipedrive: `PIPEDRIVE_API_TOKEN` w `.env.local` (skrypty `pipedrive_*.py`). Batko: search person + deals.
- Merge: POST worker sandbox `action: merge_leads` wg `MERGE_LEADS.md`. URL w runbooku. Survivor PD nie jest `OWOCNI_SORTOWNIA` → T5 `adminConfirmed` zwykle **nie** wymagane; jeśli worker zwróci `needs_admin_t5`, zatrzymaj się i raportuj.
- Manifest operacji: `integrations/runbooks/exports/queue_cleanup/20260912T052202Z/t1_tests_batko_inkflow.json`.

## 2. Prompt do wklejenia (nowy Agent, ten sam folder)

```
Pracujesz w workspace /Volumes/Samsung_T5/owocni/owocni strona i bitrix, repo owocni-crm-github. To TOR T1 (dane Twenty/BB/PD). NIE ruszaj Owocni Mail, nie deployuj aplikacji, nie zmieniaj kodu edytora.

Najpierw przeczytaj i wykonaj DOKŁADNIE:
integrations/runbooks/QUEUE_TRIAGE_T1_CHAT_20260912.md

Kontekst już zrobiony w innym czacie (nie powtarzaj fal 1–3a):
- Fala 1 A/B isFollowUp=false; C COPYWRITING + owner Maciej.
- Fala 2: 80× Gosia/Marta NEW+followUp lipiec–sierpień → isFollowUp=false.
- Fala 3a: 14 holding Sortownia → Marta 11 / Gosia 3. PD+PAYING na Owocni@ bez zmian.
- 39 null-owner open: audit wave3_null_sortownia_audit.json.

Zrób w tej kolejności i raportuj po każdym bloku:
1) Usuń 7 testów + TEST Fakturownia DEMO. Zostaw test9959058@fastman.eu (a88aa583). Lista UUID z audytu, nie skracaj. no_emit. Manifest before/id.
2) lech.batko@poczta.fm (34b12db0): szukaj w BB (Supabase leads_extended_materialized) i Pipedrive (osoba + deale). Raport: hit/miss, etap, owner, daty. Nie kasuj i nie przydzielaj.
3) Scal info@inkflowcollective.com (00fad7e0, Sortownia CONTACTED) jako LOSER z WON Roberta PIPEDRIVE_LEGACY (2 siblingi — wybierz pełniejszy/nowszy). merge_leads wg MERGE_LEADS.md. Nie ręczny PATCH na WON.
4) Pozostałe null-owner Sortownia z dumpa 26 VI–3 VII (bitrixDealId puste, ~26 kart): match emaili do BB. Tabela: email, twenty id, BB hit?, BB stage/owner. Rekomendacja — nie rozdawaj dziewczynom, nie auto-LOST.
5) Otwarte Opportunity Marta (4704e0c0) / Gosia (ccac533d) / Maciej (7fddba1d): vs BB (owner 259/257/79) i vs piątkowy apply 20260911T180000Z (78 patched, 0 creates). Ile ma bitrixDealId / BETTER_BITRIX_LEGACY, ile to Sortownia restored lejek, ile dziur (BB jest, Twenty nie — to te 33 create pominięte). Maile OUT z BB NIE były w tym syncu kart. Jasno napisz: karty tak/nie; historia wysłanych maili — nie.

STOP: stage QUALIFIED/WON, apply_premonday, widoki Mariusza, inbound/Ads, deploy maila.

Na koniec: OPS_NOTES wiersz + liczby. Nie commituj.
```
