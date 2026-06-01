# CRM_CONSTITUTION — role i 9 praw

**Status:** Etap 1 MVP  
**Last updated:** 2026-05-28  
**Rozszerzona wersja:** `../twenty/OWOCNI_CRM_fundamenty (1).md` (pełny tekst, bramy fazowe, preflight)

---

## Jak czytać

- **Część I** — kto czym rządzi  
- **Część II** — 9 praw (kompas przed każdą zmianą)  
- Szczegóły techniczne → `CRM_ARCHITECTURE_CURRENT.md`, `DATA_MODEL.md`, `EVENT_CONTRACT.md`

---

## CZĘŚĆ I — ROLE (skrót)

| Rola | Odpowiedzialność |
|------|------------------|
| **1. Właściciel** | Semantyka: co znaczy qualified, rejected, won; kryteria stage'ów; cutover |
| **2. Developer / wdrożenie** | **Dawid** — Twenty, GTM, sGTM, Stape, Sortownia; uzgodnienia z Mariuszem i Krzysztofem (przełożeni) |
| **3. Twenty** | Stan CRM, UI, **native webhook OUT** (nie business events) |
| **4. Sortownia** | id_oid, atrybucja, routing, adaptery, Lista Zadań |
| **5. n8n** | Ad-hoc LLM — **poza** critical path SSOT |
| **6. MCP/AI** | Operator po kontrakcie; **default read-only** |

---

## CZĘŚĆ II — 9 PRAW (skrót)

### Grupa I — Prawda

**Prawo 1 — Jeden SSOT, zsynchronizowany ze stanem faktycznym**  
Dokument aktualizuje się w tej samej zmianie co system. Fakty Twenty → `ops/OPS_NOTES.md`. Terminy Twenty → `docs.twenty.com/llms.txt`.

**Prawo 2 — Klasyfikuj decyzje**  
Strukturalna / Semantyczna / Proceduralna / Chroniczna / Kosmetyczna. Dyscyplina tylko na nieodwracalne.

### Grupa II — Fundament

**Prawo 3 — Model danych to kontrakt**  
Natywne Opportunity/Person/Company/Note. Typ pola niezmienny. camelCase + prefiks id/biz. Każde pole ma `description` w UI.

**Prawo 4 — Znaczenie przed polem**  
Stage'e i pola klasyfikujące: definicja operacyjna **przed** cutoverem. 6 pytań przed nowym polem.

**Prawo 5 — Jedna ścieżka wejścia**  
Kanonicznie: `crm:twenty_create_lead` w Sortowni. Manual create = jawny wyjątek. julia362 = data wyłączenia.

**Prawo 6 — Jeden właściciel prawdy per klasa**  
Twenty = stan sprzedaży. Sortownia = id_oid, atrybucja. Granica widoczna w prefiksach pól.

### Grupa III — Czytelność

**Prawo 7 — Workflow ma kontrakt**  
Prosty → wpis w OPS_NOTES. Outbound zewnętrzny → **native webhook**, nie Workflow HTTP (credits). Walidacja przy emisji eventu, nie przy autosave.

**Prawo 8 — Czytelność przed automatyzacją**  
MCP default read-only. 6 powierzchni uprawnień Twenty — mapować świadomie.

**Prawo 9 — Wąski start**  
MVP: leady, pipeline, eventy SSOT, migracja aktywnych, jasny fallback. **Poza MVP:** Helpdesk, MCP write, dashboardy jako fundament.

---

## Glossary (skrót)

| Termin | Znaczenie |
|--------|-----------|
| Opportunity | Lead pipeline w Twenty |
| Deal (Bitrix24) | Księgowy — osobny system |
| id_oid | Mint Sortownia; klucz cross-system |
| qualify_lead | stage → QUALIFIED |
| purchase | stage → WON (nie lead_won) |
| rejected_lead | campaignRejected true (nie LOST) |
| generate_lead | Formularz lub manual create |
| julia362 | Legacy IMAP watcher — wyłączyć |

Pełna tabela: `../twenty/OWOCNI_CRM_pakiet_plikow (1).md` Plik 1 § Glossary.

---

## AI / MCP rules

- Tryb: read → plan → diff → **człowiek** approve → wykonanie  
- Brak zmian schemy/workflow/stage przez agenta bez zgody  
- Write po retro Etapu 1

---

## Test przed zmianą

*„Czy ta zmiana jest w wąskim rdzeniu MVP, czy to osobny mini-projekt po retro?"* → Prawo 9.
