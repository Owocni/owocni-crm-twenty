---
doc_id: OPS_NOTES
title: "OPS_NOTES — fakty platformowe Twenty, znane bugi, log operacji"
layer: ops
status: active
edit_scope: content_and_structure
owner: "Dawid (wykonawca techniczny)"
last_verified: 2026-05-31
recheck_trigger: "Twenty release / nowy known-issue / nowa operacja masowa / nowy incident"
default_trust: D:VERIFIED
related:
  - EVENT_CONTRACT
  - CRM_CONSTITUTION
  - DATA_MODEL
---

# OPS_NOTES — fakty platformowe i log operacji

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** zweryfikowanych faktach platformowych Twenty (HMAC, workflow credits, R-18, audit log gating, API key) — z datą i źródłem; logu operacji masowych (z kolumną `no_emit`); logu incydentów. Jest **domem faktów platformowych** — inne pliki cross-ref tutaj, nie powielają nazw.

**Ten plik NIE decyduje o:** zasadach projektowych (→ `CRM_CONSTITUTION.md`); mechanice eventów (→ `EVENT_CONTRACT.md`); polach (→ `DATA_MODEL.md`). Tu są **fakty wersjonowane**, nie decyzje.

**Zawsze czytaj razem z:** `EVENT_CONTRACT.md` (które fakty są konsumowane przez transport), `CRM_CONSTITUTION.md` (Prawo 1d — fakty platformowe żyją tutaj).

**Najgroźniejszy błąd:** potraktować fakt platformowy jak trwałą decyzję projektową (fakt się starzeje — ma `recheck_trigger`); albo skasować zweryfikowany `[F:docs]`/`[F:POC]` przy porządkach.

**Przy konflikcie:** fakt o Twenty (pricing/HMAC/limit) — ten plik rozstrzyga CO sprawdzono i kiedy; ostatecznym arbitrem jest instancja/docs, nie Markdown.

**Zmiana wymaga:** aktualizacji `row_class` + `last_checked` przy każdej weryfikacji. Klasa wiersza NADPISUJE `default_trust` pliku.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie |
|---|---|---|---|---|---|
| NR-1 | **NIE tworzyć nowego inline systemu stempli** — używać KOLUMNY `row_class`. | Drugi system znaczników = chaos epistemiczny. | Niespójne oznaczanie pewności. | — | §5 |
| NR-2 | **NIE kasować zweryfikowanych `[F:docs]`/`[F:POC]`** przy porządkach. | To zarobiona wiedza (recheck kosztuje). | Utrata zweryfikowanych faktów. | — | §5 |
| NR-3 | **NIE przenosić faktów platformowych do plików-decyzji** (CONSTITUTION/EVENT_CONTRACT). Fakt wersjonowany żyje tu. | Fakt starzeje się niezauważony w pliku zasad. | Nieaktualny fakt udający zasadę. | — | `CRM_CONSTITUTION.md` Prawo 1d |
| NR-4 | **Operacja masowa w logu §5.3 MUSI mieć wartość w kolumnie `no_emit`.** | Brak = nie wiadomo, czy operacja emitowała do platform. | Niewidoczny sygnał reklamowy z bulk-op. | — | §5.3 |

---

## 2. PURPOSE

Dom faktów platformowych Twenty (wersjonowanych, z datą/źródłem/recheck), log operacji masowych i incydentów. To, czego nie wolno trzymać w plikach zasad (Prawo 1d). Status: żywy log operacyjny.

---

## 3. SCOPE

### Pokrywa
- Twenty Verified Facts (HMAC, credits, R-18, audit log gating, API key, permissions).
- Log operacji masowych (z `no_emit`), log incydentów.

### Nie pokrywa
- Zasad projektowych / mechaniki eventów / pól (→ pliki domenowe).

---

## 4. CANONICAL DEFINITIONS

**`row_class`** (KOLUMNA — nie inline stempel; NADPISUJE `default_trust` pliku):

| row_class | Znaczenie | Trust efektywny |
|---|---|---|
| `verified_fact` | Zweryfikowane na instancji lub w oficjalnych docs | D:VERIFIED |
| `platform_recheck_needed` | Wymaga sprawdzenia na instancji (niejednoznaczne / wersyjne) | D:OPEN do rechecku |
| `inference_from_docs` | Wniosek z docs, nie cytat dosłowny | D:RESEARCH/inference |
| `poc_result` | Wynik własnego POC | D:VERIFIED (w zakresie POC) |
| `incident` | Zdarzenie produkcyjne | log |
| `bulk_operation_log` | Operacja masowa | log |

---

## 5. BODY

### 5.1 Twenty Verified Facts

| Fakt | Wartość | row_class | source | last_checked | recheck_trigger |
|---|---|---|---|---|---|
| **HMAC — nazwy nagłówków** (#16) | `X-Twenty-Webhook-Signature` (HMAC SHA256) + `X-Twenty-Webhook-Timestamp` | `verified_fact` | docs.twenty.com | 2026-05-31 | Twenty release |
| **HMAC — signed string** (#16) | `{timestamp}:{payload}` — podpisywany jest timestamp **z** payloadem, NIE sam payload (bez prefiksu timestamp implementacja odrzuci legalne webhooki) | `verified_fact` | docs.twenty.com | 2026-05-31 | Twenty release |
| **Native webhook OUT — workflow credits** | Native webhook (Settings → Developers → Webhooks) **nie zużywa workflow credits**; workflow credits dotyczą Workflow actions (Code/HTTP) | `inference_from_docs` | docs.twenty.com (model pricing) | 2026-05-31 | Twenty pricing change |
| **Workflow credits — limit Pro** | Plan Pro ma limit workflow credits → przy ~5400 emisji/rok workflow HTTP niewykonalny; native webhook obowiązkowy | `inference_from_docs` | docs + credit budget | 2026-05-31 | Twenty pricing change |
| **R-18 — manual create trigger** | Manual UI create wyzwala trigger jako **Created or Updated** (autosave), nie czysty „Created" — stąd detekcja przez `idOid IS NULL`, nie typ operacji | `verified_fact` | instancja (POC) | 2026-05-29 | Twenty release |
| **Audit log** | Brak natywnego audit logu na planie Pro (Organization-tier) — stąd governance ręczne (snapshoty, OPS log, reason codes) | `verified_fact` | docs (plany) | 2026-05-31 | Twenty plan change |
| **Row-level permissions** | Brak na Pro (Organization/Premium); **field-level permissions SĄ na Pro** | `verified_fact` | docs (permissions) | 2026-05-31 | Twenty plan change |
| **Custom fields required** | Twenty 2.8.0 nie wspiera required na custom fields → walidacja przy emisji eventu, nie przy save | `verified_fact` | instancja/docs | 2026-05-31 | Twenty release |
| **createWorkflowVersion / workflow-as-code** | Workflowów nie da się pewnie definiować jako kod; snapshot JSON eksportowany ręcznie do git | `platform_recheck_needed` | docs (niejednoznaczne) | 2026-05-31 | Twenty release |
| **Nazwa eventu webhooka** (`*.created`/`*.updated` vs `record.*`) | Niejednoznaczna w źródłach — sprawdzić dokładną nazwę pola `event` w payloadzie na instancji | `platform_recheck_needed` | sprzeczność źródeł | 2026-05-31 | preflight (sandbox) |
| **API key — Workflow Code secrets** | Code Action wymaga kluczy w function body — nie secure runtime; secrets poza Twenty (Sortownia/n8n); wyjątek: Apps Framework `secret:true` | `verified_fact` | docs (Apps Framework) | 2026-05-31 | Twenty release |
| **Merge rekordów** | Dostępny od v1.3 (UI); zachowanie webhooka przy merge (oba ID?) → recheck | `platform_recheck_needed` | docs + IDENTITY §5.9 | 2026-05-31 | preflight |
| **Dashboards** | Beta / Early Access — nie fundament MVP | `verified_fact` | docs | 2026-05-31 | Twenty release |
| **Kierunek maila** | Żyje na `MCMA.direction`, nie na Message. Dedup Message po `headerMessageId` → 1 mail = N asocjacji. Materializacja firmowa = `Message.direction` (ADR #19) | `verified_fact` | kod + E12.5 @ sandbox 2026-07-28 | 2026-07-28 | Twenty messaging release |
| **Filtr po relacji** | Tylko MANY_TO_ONE; ONE_TO_MANY niewidoczne na liście filtrów; sort po relacji nie istnieje | `verified_fact` | `getFilterFilterableFieldMetadataItems.ts` | 2026-07-28 | Twenty release |
| **Wyszukiwarka Message** | `searchVector` = wyłącznie `subject`; treść tylko przez filtr `Text → Contains` (podciąg, case-insensitive) | `verified_fact` | kod + instancja E12.5 | 2026-07-28 | Twenty search-vector rework |
| **Message Visibility** | Per skrzynka: Metadata Only / Subject and Metadata / All Email Content — determinuje czy `text` istnieje | `verified_fact` | docs calendar-emails | 2026-07-28 | zmiana visibility skrzynki |
| **Message bez strony rekordu** | Z listy Messages nie da się otworzyć maila; pełna treść = chip Message Thread | `verified_fact` | instancja | 2026-07-28 | Twenty release |
| **updateMany cap** | `MUTATION_MAXIMUM_AFFECTED_RECORDS = 100`; skraca czas, nie liczbę zdarzeń webhooka | `verified_fact` | kod + backfill E12.5 | 2026-07-28 | Twenty release |
| **API key rate limit (Cloud)** | Long window **100 req/min** wiążący (OQ-3 zmierzony 2026-07-28 — LIMIT_REACHED przy szybszym tempie) | `verified_fact` | backfill E12.5 | 2026-07-28 | Twenty rate-limit change |
| **connectedAccount / messageChannel** | Poza Core API — perspektywa użytkownika dla kierunku niewykonalna | `verified_fact` | Core object list + E12.5 | 2026-07-28 | Twenty API surface |
| **Webhook OUT (sandbox)** | REST webhooks tylko `opportunity.*` / `person.*` / `company.*` — **nie** `message.*` → backfill Message = `no_emit` względem Sortowni | `verified_fact` | preflight E12.5 2026-07-28 | 2026-07-28 | zmiana webhooków OUT |

> **Dom faktu HMAC = ten wiersz (#16).** `CRM_CONSTITUTION.md` Prawo 7g i `EVENT_CONTRACT.md` §5.1 robią cross-ref TUTAJ, nie powielają nazwy nagłówka. Zamknięte z docs — bez wiersza „recheck na instancji" dla samej nazwy/signed-string (recheck_trigger = Twenty release, standardowo).

### 5.2 Znane bugi / PR (śledzenie)

| Element | Status | row_class | source | last_checked |
|---|---|---|---|---|
| (pusto — uzupełniać przy napotkaniu) | — | — | — | — |

### 5.3 Log operacji masowych (bulk_operation_log — kolumna `no_emit` obowiązkowa, NR-4)

| Data | Operacja | Zakres | `no_emit` | Wykonał | Wynik |
|---|---|---|---|---|---|
| 2026-07-28 | E12.5b soft filter `Message.ourMailboxes` (MULTI_SELECT z uczestników) + widoki 📥/📤 Marta·Gosia·Mariusz | living Message; źródło participant handles | **TAK** | Composer | Soft filter, nie ACL. Widoki w folderze Poczta. |
| 2026-07-28 | E12.5 live path: workflow → GCP (Message nieedytowalny przez automation) | 2 maile w 🔧 naprawione ręcznie; workflowy direction+ourMailboxes DEACTIVATED; enrich w twenty-crm-worker | **TAK** | Composer | Błąd: `Object cannot be updated by automation`. REST PATCH Message OK. 🔧 MA BYĆ 0. |
| 2026-07-28 | E12.5 backfill `Message.direction` (`updateMessages` ×100) | 26 970 update-ops na ID z MCMA; żywe Message po: OUT 3 554 + IN 20 044; empty 91 (bez MCMA); total 23 689 | **TAK** | Composer | Preflight: webhook OUT bez `message.*`. OQ-2 PASS. Konflikty both-dir = 0. `errors=0`. 🔧 ≈ 91. |
| 2026-08-04 | Pipedrive import gate: deploy `SKIP_LEGACY_IMPORT` + OFF 8 workflowów opp create/update | CF `twenty-inbound-webhook-sandbox` rev ~00008; MUST_OFF ×8 (snapshot w `gate/deactivated_snapshot.json`) | **TAK** | Composer | Brama przed sample. MANUAL workflowy zostają ACTIVE. Po load: `--apply-on` / MCP activate. |
| 2026-08-04 | Pipedrive **sample load** 23 Opportunity | `PIPEDRIVE_LEGACY` / `PIPEDRIVE_IMPORT`; notes×23; mix NEW/PROPOSAL/WON; identity link+email_dedup | **TAK** | Composer | Artefakty `…/sample/sample_results.json`. Rollback: `pipedrive_rollback_twenty.py` przed IMAP. |
| 2026-08-04 | Pipedrive **full load** (start) ~3251 Opportunity w oknie 3 lat | Company→Person→Opp→Note; `SKIP_LEGACY_IMPORT` + 8 WF OFF; zero `idOid` | **TAK** | Composer | Progress: `…/full/progress.jsonl`. Activities→Task = osobna faza po Opp. |
| 2026-08-04 | Pipedrive **full load** DONE + retry 14 | **3251** Opp `PIPEDRIVE_LEGACY`; notes; identity link/dedup; junk phone/email skipped | **TAK** | Composer | Artefakty `…/full/`. WF nadal OFF — włączyć `--apply-on` po akceptacji. |
| 2026-08-06 | Pipedrive gate: **ON** 8 workflowów | MCP `activate_workflow_version` ×8 z `gate/deactivated_snapshot.json` | **TAK** | Composer | Import zakończony; live leady znowu z powiadomieniami/guardami. |
| 2026-08-06 | Pipedrive **active tasks** Robert+Krzysztof→Ewa | 93 Task (follow/email/meeting); bez call; `…/tasks/` | **TAK** | Composer | assignee Robert/Ewa; target Opp/Person po `pipedriveId`. |
| 2026-08-13 | **Repair Faza 0+1 start** | 0.3 etykiety Company OK; 0.1 SENT + 0.2 blocklist = MANUAL (API 403 / User id); Faza 1 `ORG_REPORT.md` GATE=`DOMAIN_SPARSE` | **TAK** | Composer | Staging `…/repair/`. Org PD: WWW/NIP=0; osoby email 87.6%. Bez wipe. |
| 2026-08-13 | **Repair Faza 0 DONE + Faza 2 OFF** | SENT+blocklist właściciel; WF×8 OFF (`gate_off_snapshot.json`); backup `…/repair/backup/20260813T121323Z/` | **TAK** | Composer | Lead notify OFF do końca faz 3–6. |
| 2026-08-13 | **Repair Faza 3.0/3.1** | +40 Company create; +15 stamp `pipedriveId` na auto-mint po domenie; domainName patch 96 OK / 105 kolizja→Faza 4 | **TAK** | Composer | `import_missing_*`, `backfill_company_*`, `recon.json`. |
| 2026-08-13 | **Repair Faza 4 merge domen** | 95 merge PD←automint (relink people + domain + DELETE); 10 PD↔PD odłożone | **TAK** | Composer | domain% 22.5→39.6; `merge_domain_dupes_*`, `domain_dupes.json` |
| 2026-08-13 | **Repair Faza 5.0 osoby** | 1725 missing: 401 create + 1324 email_dedup; errors=0 | **TAK** | Composer | `import_missing_persons_apply.json` |
| 2026-08-13 | **Repair Faza 5.0 fix bilans** | +1213 (głównie create bez maila przy kolizji); missing=0; extra=36 | **TAK** | Composer | `import_missing_persons_fix_apply.json` |
| 2026-08-13 | **Repair Faza 5.1 link people** | opp→person 7/7; domain-match 13 propozycji (0 konfliktów) | **TAK** | Composer | `link_people_apply.json`, `link_people_domain_*.csv` |
| 2026-08-13 | **Repair Faza 3.3 + 6 nazwy** | Company URL→label 142; Opp rename 275/275 | **TAK** | Composer | `fix_company_names_*`, `fix_opportunity_names_*` |
| 2026-08-13 | **Repair Faza 2.4 WF ON** | MCP activate ×8 z `gate_off_snapshot.json` | **TAK** | Composer | Live notify/guardy z powrotem |
| 2026-08-13 | **Repair Faza 8 dry-run** | 17334 firm; 16777 kandydatów DELETE (2 safe / 16775 z osobami); bez apply | **TAK** | Composer | `cleanup_automint_candidates.csv` — czeka na GO |
| 2026-08-14 | **Repair D3 + Faza 8C** | D3=MAX 3 lata; dry-run outbound-gate → CSV `cleanup_automint_candidates_outbound.csv` | **TAK** | Composer | Apply dopiero po GO właściciela |
| 2026-08-14 | **Repair Faza 8C APPLY start** | DELETE ~15816 firm z CSV outbound (GO właściciela); osoby nietknięte | **TAK** | Composer | Progress: `cleanup_automint_apply_outbound.json` |
| 2026-08-14 | **Repair Faza 8C APPLY DONE** | **15816/15816** DELETE OK, err=0 (~4.6 h) | **TAK** | Composer | `cleanup_automint_apply_outbound.json` |
| 2026-08-14 | **Repair B-5 / widoki 8.1+8.3** | Firmy 17334→1518; recon missing=0; widoki „Firmy z leadami” / „Z firmą…” / „Z leadem (POC)” | **TAK** | Composer | `SIGNOFF_B5.json` |
| 2026-08-14 | **Repair Faza 7.2 ACCEPT** | Historia maili: bez reconnect (brak „sync od daty” w UI); D3 best effort | **TAK** | właściciel + Composer | `PHASE7_RESYNC_MANUAL.md` |
| (pusto — uzupełniać przy każdej operacji masowej; każdy wiersz MUSI mieć wartość `no_emit`: TAK/NIE) | — | — | — | — | — |

> Każda operacja masowa (import / backfill / replay / mass-update) → wiersz z jawnym `no_emit`. `no_emit=NIE` jest dozwolone tylko dla operacji świadomie emitujących (rzadkość) i wymaga uzasadnienia w kolumnie Wynik.

### 5.4 Log incydentów (incident)

| Data | Incydent | Wpływ | row_class | Rozwiązanie |
|---|---|---|---|---|
| (pusto) | — | — | `incident` | — |

---

## 6. CROSS-REFERENCES

| Temat | Gdzie konsumowane |
|---|---|
| HMAC (#16) — transport webhooka | `EVENT_CONTRACT.md` §5.1 (cross-ref tutaj) |
| Workflow credits — czemu native webhook | `ARCHITECTURE.md` §5.8 / `EVENT_CONTRACT.md` §5.1 |
| R-18 — manual create przez `idOid IS NULL` | `EVENT_CONTRACT.md` §5.4 |
| Custom fields required / permissions | `CRM_CONSTITUTION.md` Prawo 8 / `DATA_MODEL.md` §5.4 |
| Reguła „fakty platformowe żyją w OPS" | `CRM_CONSTITUTION.md` Prawo 1d |
| Stan dodatków Owocni / diagnostyka ciszy / zakładka „Stan systemu” | `ops/SYSTEM_HEALTH.md` (nie dublować łańcuchów tutaj) |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-O1 | Dokładna nazwa pola `event` w payloadzie webhooka (`*.created` vs `record.*`) | Dawid | nie | sandbox |
| OQ-O2 | Czy native webhook payload Opportunity niesie `Person.idOid` | Dawid | nie | sandbox |

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Wiersze `platform_recheck_needed` rozstrzygnięte na instancji | Preflight | Dawid | sandbox |
| HMAC signed-string działa end-to-end (Sortownia weryfikuje) | Preflight | Dawid | runtime |
| Każda bulk-op ma `no_emit` w logu §5.3 | Po każdej operacji | Dawid | §5.3 |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-07-28 | Fakty E12.5 (kierunek/MCMA, filtr relacji, searchVector, visibility, updateMany, rate 100/min, webhook OUT) + bulk log backfill | Composer | wdrożenie E12.5 sandbox |
| 2026-05-31 | HMAC (#16) wpisany jako `verified_fact` (nazwy + signed-string) | Dawid | rozstrzygnięcie docs.twenty.com |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` / `[D:VERIFIED]` / `[D:RESEARCH]` / `[D:OPEN]` — jak w pozostałych plikach.
- **Dodatkowo w tym pliku:** `row_class` (kolumna) NADPISUJE `default_trust`. `verified_fact`/`poc_result` → D:VERIFIED; `platform_recheck_needed` → D:OPEN do rechecku; `inference_from_docs` → D:RESEARCH/inference.
- Default tego pliku: `D:VERIFIED` (fakty zweryfikowane). Wiersz `platform_recheck_needed` = świadome odchylenie.
