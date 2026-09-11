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
| 2026-09-10 | **Zwrotki: test `wymyslonyadresss.pl`** | DSN wszedł IMAP ~4 min później, worker dopiął (`isFollowUp=true`, ten sam wątek co OUT). UI **0.1.113**: default pane = bounce (OUT był 1 s nowszy), `Unrouteable` = niepoprawny adres, refresh po wysyłce do 6 min. | **TAK** | Composer | Karta: odśwież Mail — „Zwrotka · niepoprawny adres”, nie osobny wątek. |
| 2026-09-10 | `maciejwysocki@` pod login Maćka; From sprzedaży; `copywriting@` receive-only | Enum `ourMailboxes` +MACIEJ; widoki 📥/📤 Maciej = COPYWRITING\|MACIEJ; stopka rekord `dd96f94e` → `maciejwysocki@`; Owocni Mail **0.1.106**; worker `00071-sir` / build `2026-09-10-maciejwysocki` | **TAK** | Composer | T1=0. Auto-create na nowym kanale było SENT — **przestawić na Brak w UI**. Hard refresh przed T2. |
| 2026-09-04 | Widoki poczty: 1 skrzynka / osoba; `studio@` i `leads@` w folderze Poczta | 8 filtrów `ourMailboxes` (Marta/Gosia/Mariusz/Ewa IN+OUT) → tylko własna. Nowe widoki 📥/📤 studio@ + leads@ **w Poczcie**. Osobne foldery top-level usunięte (Twenty MAX_DEPTH 2). | **TAK** | Composer | Soft filter, nie ACL. |
| 2026-09-04 | C-Δ preflight sitko | Auto-create **None** na 6 skrzynkach. Webhooki bez `message.*` / `*.*`. Failover `false`. `CUTOVER_AT=2026-08-31`. | **TAK (konstrukcja)** | Dawid + Composer | S1–S8 PASS przed APPEND. |
| 2026-09-04 | C-Δ paka copywriting offset 852 | **2 APPEND** (koniec okna Sent). QA 2/2. | **TAK (konstrukcja)** | Composer | copywriting C-Δ same-mailbox **31 łącznie**. Dalej: gosia@. |
| 2026-09-03 | R-1: zdjęcie `LEADS` z filtrów `ourMailboxes` na widokach 📥/📤 Marta i Gosia | 4 widoki; duplikat filtra Gosi IN usunięty | **TAK** | Composer | Marta/Gosia = MARTA\|GOSIA ∪ STUDIO. Soft filter, nie ACL. |
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
| 2026-08-25 | **Clear Owner Ewa × Pipedrive** (bez kasowania rekordów) | Opportunity `ownerId=Ewa` (`b9e2b31e-…0b16`) AND `srcSystem=PIPEDRIVE_LEGACY`. Próbka 2× LOST → Owner=null OK. Bulk: 130 non-PROPOSAL + 88/108/118 PROPOSAL (limit 200/call). **Przed:** 446. **Po:** 0. PIPEDRIVE_LEGACY nadal 3251 (Robert 2509 / null 446 / owocni 296). | **TAK** | Composer | Gate OFF ×3: `Opp · SQL → Account Owner gdy pusty v13`, `Opp · guard odrzucony v1`, `deal · stage QUALIFIED → Stape v14b`. Inbound: 444× `SKIP_DUPLICATE_DELIVERY`, 0 enqueue/`task_queue`. WF z powrotem ACTIVE. Jednorazówka — bez wiszącego workflow. Widok „Moje” Ewy wyczyszczony; All nadal widzi (brak RLS). |
| 2026-08-28 | **Opportunity multi-contact + Person max 5 email/phone** | Metadata API live: `bizAdditionalEmails`, `bizAdditionalPhones`; Record Page order; Person `maxNumberOfValues=5` | **TAK** | Composer | Runbook `OPPORTUNITY_MULTI_CONTACT.md`. Lookup po additional = backlog. |
| 2026-08-28 | **Owocni Mail deploy 0.1.54** | `deploy_owocni_mail_patched.py` (yarn apply drift); scroll/reply preview PASS | **TAK** | Composer | Natywny Reply Twenty — scroll OPEN (SOP: używać Owocni Odpowiedz). |
| 2026-08-31 | **Owocni Mail deploy 0.1.57** | Większe pole odpowiedzi (edytor wypełnia panel, nie 260px); Do/Od w jednym rzędzie. `deploy_owocni_mail_patched.py` | **TAK** | Composer | Gosia: po odświeżeniu (hard refresh) Odpowiedz — treść zajmuje resztę paska. |
| 2026-09-01 | **H-WF: ON guardy/metryki po pętli kredytów 31.08** | ACTIVE: Track Stage Time v3, zapamiętaj etap v4e, guard odrzucony v1, Account Owner v13. Guard SQL był już ON. HTTP Stape/rejected **zostają OFF** (native webhook). | **TAK** | Composer | Hamulec 31.08 06:15–06:42; kolejka pusta 31.08 10:13; ON 01.09 bez lawiny NOT_STARTED. |
| 2026-09-03 | **Owocni Mail deploy 0.1.60** | Przycisk **Pełne okno** w Odpowiedz: lewa = wiadomość źródłowa, prawa = edytor. `deploy_owocni_mail_patched.py` | **TAK** | Composer | Hard refresh; Twenty FC nie portaluuje — overlay `position:fixed` + fallback stacked w panelu. |
| 2026-09-04 | **Ads rollback + sample-week Twenty** | Inbound `RUNTIME_ENVIRONMENT=sandbox`; worker `LEAD_SAMPLE_WEEK_ENABLED` (quota 2/dzień Marta/Gosia/Maciej → surplus `owocni@gmail.com`; Robert exempt). BB analytics → `prod` w kodzie — **wymaga deployu crm.owocni.pl**. | **TAK** (Twenty) | Composer | Runbook `SAMPLE_WEEK_BB_TWENTY.md` + `ADS_SQL_SIGNAL_ROLLBACK.md`. Stape Client sandbox w repo — publish sGTM. |
| 2026-09-04 | **Park open Opp Marta/Gosia/Maciej → holding** | 557 otwartych → owner `owocni@gmail.com`; stempel `PARKED-SAMPLE-WEEK:{slug}`. Manifest `exports/sample_week_park/20260904T042844Z/`. Restore: `park_sample_week_owners.py restore --run 20260904T042844Z`. | **TAK** | Composer | WON/LOST nietknięte. Sample-week quota od dziś na czysto. |
| 2026-09-04 | **Retire Biorę / dyspozytor** | WF Biorę DEACTIVATED; widok Do wzięcia usunięty; sweep no-op; hash COPY/Gosia/Marta jedynym przydziałem nowych kart. Ownerów istniejących nie ruszano. | **TAK** | Composer | Build `2026-09-04-retire-biore`. Pola bizAckAt archiwum. |
| 2026-09-03 | **Stape: 5× `crm:twenty_update_person` → failed** | Trucizny 400/404 (2× duplicate idOid Natalia/CSE, 3× skasowane karty). Pending update_person 5→0. Kart Twenty nietknięte. | **TAK** | Composer | Nie `create_lead`. Klucze: `twenty_person_aa83516b…`, `twenty_person_6414820e…`, `pending_mint_1785492977871`, `_1785826212154`, `_1787643292542`. |
| 2026-09-03 | **Owocni Mail deploy 0.1.62** | Pełne okno: nie zdejmować overlay po fałszywym pomiarze; inline `position:fixed` + popover. `deploy_owocni_mail_patched.py` | **TAK** | Composer | Hard refresh. Live `version=0.1.62` checksum `62e86904…`. |
| 2026-09-07 | **Owocni Mail deploy 0.1.86** | Zakładka **Stopki maili** (`mailSignature`); seed 8 rekordów (Marta/Gosia/Maciej/Ewa/Robert/Mariusz/pomoc/firma). `deploy_owocni_mail_patched.py` + `seed_mail_signatures_to_twenty.py` | **TAK** | Composer | Live `version=0.1.86` checksum `35e6dd9fd5dd188ad570dd32623b083d`. Hard refresh; edycja w menu, nie w Szablonach. |
| 2026-09-07 | **Owocni Mail deploy 0.1.87** | Rekord Stopki: własny edytor HTML (kolory + Kod HTML), nie BlockNote Twenty. | **TAK** | Composer | Live `version=0.1.87` checksum `cabde7d36bd96e0881694199e02d1556`. Hard refresh; klik w osobę → Zapisz stopkę. |
| 2026-09-07 | **Owocni Mail deploy 0.1.88** | Klik w imię otwiera stronę rekordu (nie ołówek/BlockNote). Markdown bez HTML nie nadpisuje stopki. Przywrócona treść firmowa. | **TAK** | Composer | Live `version=0.1.88` checksum `23fd35771b3b90e0891ab89ac7103b46`. Hard refresh; Stopki maili → imię → Zapisz stopkę. |
| 2026-09-11 | **Owocni Mail deploy 0.1.115** | Dwufazowe wątki: `GET /mail/thread-list` (lista) + równoległy `picker-data` (treść). Odwrót: `?owocniMailLoad=full`. | **TAK** | Composer | Live `version=0.1.115` checksum `87080ef4a534d1f09c1fb1a4b5361e0b`. Front padł: zgubiony import `emailBodyToDisplayText`. |
| 2026-09-11 | **Owocni Mail deploy 0.1.116** | Przywrócony import `emailBodyToDisplayText`. | **TAK** | Composer | Live `version=0.1.116` checksum `7228fadf6dde69eb9896ded04040680e`. Hard refresh; kanban → Mail. |
| 2026-09-08 | **createLead: token-spam skip** | Cała `biz_message` = jeden losowy token (≥12 alnum, ≥3 A-Z i ≥3 a-z) → brak Person/Opp. Mail `leads@` nietknięty. | **TAK** | Composer | Live `twenty-crm-worker-sandbox` rev `00069-gij`, build `2026-09-08-form-token-spam`. |
| 2026-09-10 | **Furtka Insta Form → Meta CAPI** | Twenty zostaje sandbox. Flaga `META_INSTA_FORM_CAPI_FROM_SANDBOX=true` na Robocie: SQL/WON/rejected Instant Form (`lead_id`) idą na prod Meta. Google Ads / GA4 / reszta Twenty / BB nietknięte. | **NIE** | Composer | Decyzja właściciela 10 IX. Payload bez PII (`metaCapi.js`). Smoke: Piotr w Ads Manager. |
| 2026-09-10 | **Replay 3 sygnałów Insta Form z okna sandbox** | 1× SQL hexy (4 IX) + 1× SQL i 1× WON neoneo (8 IX). Meta CAPI `events_received=3`. Google Ads nietknięte. | **NIE** | Composer | `replay_insta_form_capi_sandbox.js`. Robot `00071` 06:10 UTC. |

> Każda operacja masowa (import / backfill / replay / mass-update) → wiersz z jawnym `no_emit`. `no_emit=NIE` jest dozwolone tylko dla operacji świadomie emitujących (rzadkość) i wymaga uzasadnienia w kolumnie Wynik.

### 5.4 Log incydentów (incident)

| Data | Incydent | Wpływ | row_class | Rozwiązanie |
|---|---|---|---|---|
| 2026-08-31 | Pętla `opportunity.updated` (CODE+UPDATE stage) → kredyty → hamulec 5× MUST_ON | H-WF DOWN 01.09 08:00; metryki/guard odrzucony/AO OFF ~26 h | `incident` | Guard SQL ON 31.08 06:45. 01.09: ON Track Stage Time, zapamiętaj, guard odrzucony, AO. HTTP Stape/rejected zostają OFF. |
| 2026-09-02 | H-LEAD-FORM DOWN: maile Zapytanie bez karty OWOCNI_SORTOWNIA (sGTM nie enqueue, worker processed=0) | 5 formularzy tylko w BB+mail; 3 sales + 2 spam `/kontakt` | `incident` | Worker `formMailWitness` — parse maila Zapytanie → `crm:twenty_create_lead`. Sortownia: fail-closed na pusty `API_KEY`. |
| 2026-09-03 | Failover dyspozytora wstrzymany (G8) | Sweep nie zmienia ownera do ustaleń z zespołem. Przydział przy create zostaje. | `decision` | `LEAD_DISPATCH_FAILOVER_ENABLED=false`. Build `2026-09-03-failover-paused`. |
| 2026-09-04 | Biorę / dyspozytor wycofany | Brak przycisku, brak sweep, brak ponownego przydziału istniejących kart. | `decision` | Hash GCP only. `2026-09-04-retire-biore`. |
| 2026-09-04 | Tydzień BB: Ads z Twenty sandbox; sprzedaż w BB; sample routing w Twenty | SQL/WON z Twenty nie na Ads; surplus leadów → holding owocni@ | `decision` | `SAMPLE_WEEK_BB_TWENTY.md`. Build worker `2026-09-04-sample-week`. |
| 2026-09-10 | Insta Form SQL/WON/rejected z Twenty sandbox znowu na Meta CAPI | Robertowe leady Insta Form nie mają kart w BB; od 4 IX Meta nie dostawała SQL | `decision` | Flaga `META_INSTA_FORM_CAPI_FROM_SANDBOX` na `robot-task-monitor`. Google/BB nietknięte. |
| 2026-09-07 | H-LEAD-FORM DOWN: `Zapytanie ze strony kontakt.` (JuicyLogos) bez karty Sortowni | Fałszywy pager; formularze Owocni z kartami | `incident` | Allowlist świadka w `formWitness.js` (build `2026-09-07-health-form-witness-owocni`). Quota 2/dzień nie blokuje kart. |

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
