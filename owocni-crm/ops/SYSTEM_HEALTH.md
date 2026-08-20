---
doc_id: SYSTEM_HEALTH
title: "SYSTEM_HEALTH — stan funkcjonowania dodatków Owocni w Twenty (spec zakładki + instrukcja LLM)"
layer: ops
status: active
edit_scope: content_and_structure
owner: "Dawid (techniczny) / Właściciel (priorytety SLO)"
last_verified: 2026-08-17
recheck_trigger: "nowy dodatek Owocni w Twenty / nowy scheduler / nowy workflow krytyczny / incydent ciszy kanału / wdrożenie zakładki"
default_trust: D:CORE
related:
  - OPS_NOTES
  - ARCHITECTURE
  - EVENT_CONTRACT
  - IDENTITY_AND_INBOUND
  - ../integrations/TWENTY_PATHS.md
  - ../integrations/runbooks/CALL_INGEST_N8N.contract.md
  - ../integrations/runbooks/META_LEAD_WEBHOOK_PHASE_B.md
  - ../integrations/runbooks/E12_3_EMAIL_TEMPLATE_STRATEGY.md
  - ../integrations/cloud-functions/system-health-check/
---

# SYSTEM_HEALTH — stan funkcjonowania dodatków Owocni

**Stan zakładki w Twenty:** `[D:OPEN]` — **nie zbudowana**.  
**Stan maili / probe GCP:** `[D:OPEN]` kod w repo (`system-health-check`); **deploy wymaga GO** (SMTP + Scheduler). Ten plik jest specyfikacją produktu **oraz** obowiązkową instrukcją dla LLM. UI zakładki = osobne zadanie (NR-7).

---

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** które elementy **dodane przez Owocni** (nie rdzeń Twenty) wchodzą na zakładkę „Stan systemu” **i do maila**; jakie sygnały oznaczają OK / DEGRADED / DOWN; jak LLM **diagnozuje ciszę kanału**; budżet probe'a (bez palenia kredytów); jak LLM **później** zbuduje zakładkę (fazy, zakazy).

**Ten plik NIE decyduje o:** faktach platformy Twenty (HMAC, credits, rate limit → `OPS_NOTES.md`); semantyce eventów (→ `EVENT_CONTRACT.md`); tożsamości (→ `IDENTITY_AND_INBOUND.md`); granicach systemów (→ `ARCHITECTURE.md`); polach (→ `DATA_MODEL.md`). Zakładka **czyta** te pliki, nie je zastępuje.

**Zawsze czytaj razem z:** `OPS_NOTES.md` (incydenty, bulk-op które wyłączają workflowy), `TWENTY_PATHS.md` (gdzie żyje runtime), kontrakt kanału z objawu (§5.4).

**Najgroźniejszy błąd:** uznać „brak nowych rekordów” za awarię (weekendu / ciszy reklam / DROP D-15) **albo** uznać „scheduler 200” za zdrowie, gdy n8n / Meta push / Email Sync stoją ciszej. Health = **heartbeat infrastruktury** + **świeżość biznesowa jako sygnał miękki**.

**Przy konflikcie:** łańcuch runtime → `TWENTY_PATHS.md` + kontrakt kanału. Semantyka eventu → `EVENT_CONTRACT.md`. Fakt Twenty → `OPS_NOTES.md`. Ten plik rozstrzyga tylko **co pokazać na zakładce i jak diagnozować**.

**Zmiana wymaga:** nowy dodatek Owocni (obiekt / worker / n8n / app / scheduler) → nowy wiersz w §5.2 **i** matcher w `system-health-check` w **tej samej** zmianie co kod. Wdrożenie UI zakładki → osobne zadanie, nie „przy okazji”. Deploy maili → GO Dawida (SMTP).

**Kiedy LLM MA otworzyć ten plik (obowiązkowo):**

| Prompt / objaw | Co zrobić |
|---|---|
| „nie przychodzą rozmowy / telefony / n8n” | §5.2 H-CALL + H-MISSED, playbook §5.4 A |
| „nie ma leadów” / „formularz nie wpada” | **nie zgaduj kanału** — dopytaj form / mail / Meta / rozmowa; §5.4 B–D |
| „szablony maili nie działają” | §5.2 H-MAIL-TPL, playbook §5.4 E |
| „zbuduj / zaimplementuj zakładkę stanu” | §5.5–§5.7; **STOP** jeśli zadanie nie jest wąskie i nie ma GO na Faza 1 |
| „maile o awarii / codzienny status” | §5.8; kod `integrations/cloud-functions/system-health-check/`; **NIE** n8n, **NIE** workflow HTTP |
| bulk import / gate workflowów OFF | `OPS_NOTES` §5.3 + §5.2 H-WF — po imporcie MUST_ON |
| nowy worker / obiekt / app Owocni | dodaj wiersz §5.2 + matcher w health-check |

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie |
|---|---|---|---|---|---|
| NR-1 | **NIE traktuj braku nowych rekordów jako DOWN.** Cisza biznesowa ≠ awaria. DOWN tylko gdy padł heartbeat (scheduler / poll / workflow ACTIVE / app). | Weekend, DROP D-15, brak reklam Meta, brak submitów. | Fałszywe alarmy, ignorowanie prawdziwych. | Właściciel + SLO §5.3 | §5.3 |
| NR-2 | **NIE buduj zakładki na workflow HTTP Twenty ani na credits.** Probe = logika poza Twenty (GCP / logic function App) albo odczyt rekordów. | Limit credits Pro (`OPS_NOTES`). | Wyczerpanie puli, cisza eventów. | ADR | CONSTITUTION Prawo 7 / ARCHITECTURE NR-3 |
| NR-3 | **NIE twórz custom object Deal / równoległego pipeline** „żeby mieć health”. Opportunity zostaje natywna. | Prawo 3a. | Dwa pipeline'y. | ADR | CONSTITUTION |
| NR-4 | **NIE mieszaj pickera szablonów z panelem ops w jednym front component.** Health = osobna strona nawigacji (osobna app lub osobny page layout). | Inny user (handlowiec vs admin), inny cykl awarii. | Sales psuje ops, ops psuje mail. | Dawid przy Faza 1 | §5.5 |
| NR-5 | **NIE emituj eventów Sortowni z probe'ów** (`generate_lead`, `qualify_lead`, …). Health jest `no_emit`. | INV-6 / fałszywy sygnał reklamowy. | Zepsuta atrybucja. | ADR | EVENT_CONTRACT |
| NR-6 | **NIE zgaduj, który kanał leadów padł.** Formularz, `leads@`, Meta, rozmowa, ręczny — to **osobne** pozycje H-\*. | Jeden objaw „brak leadów”, pięć łańcuchów. | Naprawa złego odcinka. | — | §5.4 |
| NR-7 | **NIE wdrażaj UI zakładki w tej samej sesji co „tylko dokumentacja”.** Ten plik = Faza 0. | Scope creep. | Półprodukt w Twenty. | Osobne zadanie + GO | §5.5 |
| NR-8 | **NIE kasuj / nie deaktywuj workflowów MUST_ON** przy imporcie bez wiersza `OPS_NOTES` §5.3 i bez planu `--apply-on`. | Historyczny wzorzec: 8× OFF na Pipedrive, cisza powiadomień. | „Leady nie działają” = notify OFF. | Właściciel | H-WF, PIPEDRIVE_IMPORT_GATE |
| NR-9 | **NIE przenoś STT do n8n** „żeby health był prostszy”. | `CALL_CHANNEL_ARCHITECTURE.md`. | Timeout n8n, kredyty. | ADR | H-CALL |
| NR-10 | **NIE używaj auto-merge** jako naprawy health. | IDENTITY NR-5. | Sklejone tożsamości. | ADR | IDENTITY §5.9 |
| NR-11 | **NIE wkładaj health ani alertów do n8n.** | Gdy n8n padnie (H-CALL), nie będzie maila że padł. n8n ma własne kredyty. | Ślepa cisza. | ADR | §5.8 |
| NR-12 | **NIE odpalaj workera CRM / Robota / pollera Play jako probe.** Czytaj status **istniejącego** Cloud Scheduler (GCP API). | Każde HTTP do workera = pełny poll Stape + Twenty. | Palenie Stape/GCP/kredytów. | — | §5.8 |
| NR-13 | **NIE zapisuj heartbeat do Twenty** (zakaz obiektu `systemHealthPing` dopóki GCS wystarcza). Snapshot = GCS. Probe = tylko GET. | Write API + ewentualne workflow credits; OQ-H4. | Koszt i szum. | ADR | §5.5 Faza 3, §5.8 |
| NR-14 | **NIE wysyłaj maila natychmiastowego na DEGRADED ani na ciszę biznesową.** Pager = DOWN + recovery. Daily = watchdog „monitoring żyje”. | NR-1. | Ignorowanie prawdziwych alarmów. | Właściciel | §5.8 |

---

## 2. PURPOSE

Trzy cele, jeden plik:

1. **Produkt (UI):** zakładka w Twenty **„Stan systemu”** — admin widzi, czy **nasze** dodatki żyją. `[D:OPEN]`.
2. **Produkt (maile):** codzienny digest „wszystko OK” + natychmiastowy mail przy DOWN / recovery na `dawidnowak@owocni.pl`. Mózg = GCP, nie Twenty.
3. **LLM:** stały protokół diagnostyki i implementacji — bez zgadywania łańcucha, bez dublowania SSOT.

Rdzeń Twenty (Person, Opportunity, Email Sync natywny) **nie jest** tematem zakładki, chyba że nasz dodatek od niego zależy (np. szablony wymagają SMTP). Wtedy pozycja jest **zależnością**, nie „feature Twenty”.

---

## 3. SCOPE

### Pokrywa

- Inwentarz dodatków Owocni (obiekty, appy, workery GCP, n8n, schedulery, workflowy krytyczne).
- Sygnały OK / DEGRADED / DOWN i progi (do kalibracji).
- Playbook objaw → łańcuch → dowód.
- Spec UI zakładki (Faza 0–3) i protokół implementacji dla LLM.
- Alerting mailowy + budżet kredytów (Twenty / n8n / GCP) — §5.8.
- **Sandbox i prod w jednym raporcie** (jedna funkcjonalność Twenty, jeden mail).

### Nie pokrywa

- Faktów platformy Twenty (→ `OPS_NOTES.md`).
- Mechaniki eventów / tożsamości / pól (→ pliki domenowe).
- Deploy GCP / n8n / Meta Developers (→ runbooki w `integrations/runbooks/`).
- Dashboardów sprzedażowych M1–M7 (→ `METRICS.md`, `statystyki/`).

---

## 4. CANONICAL DEFINITIONS

| Termin | Znaczenie |
|---|---|
| **Dodatek Owocni** | Obiekt / app / worker / n8n / scheduler / workflow, którego Twenty Cloud **nie** dostarcza out-of-the-box albo który my spięliśmy (CallTranscript, mailTemplate, meta poll, Play, Faktura, …). |
| **Zakładka „Stan systemu”** | Pozycja **nawigacji workspace** (sidebar), nie tab na karcie Opportunity. Audience: właściciel + Dawid; handlowcom wystarczy semafor. |
| **Heartbeat** | Dowód, że **infrastruktura** wykonała cykl (job 200, poll, workflow ACTIVE, app zainstalowana). Nie wymaga nowego leada/rozmowy. |
| **Świeżość (freshness)** | Czas od ostatniego **rekordu biznesowego** (CallTranscript, Opportunity kanału X). Sygnał **miękki** — DEGRADED po godzinach pracy, nie DOWN w niedzielę. |
| **OK** | Heartbeat świeży; freshness w normie albo cisza uzasadniona. |
| **DEGRADED** | Heartbeat żyje, ale freshness poza SLO w godzinach pracy **lub** kanał na fallbacku (np. Meta: 0 push, poll działa). |
| **DOWN** | Heartbeat padł **lub** kill-switch / workflow DEACTIVATED / app odinstalowana — kanał nie może działać. |
| **UNKNOWN** | Brak taniego probe'a przy **żywym** komponencie (H-SYNC Core API, H-STAPE bez ping Store). Brak podpięcia / brak joba / brak klucza = **DOWN**, nie UNKNOWN. |
| **`no_emit`** | Probe i heartbeat **nie** wolno wysyłać do Sortowni jako business event. |
| **Instancje razem** | Sandbox + prod + `shared` (GCP/n8n) w **jednym** digescie / pagerze. Wiersz = `H-* @ sandbox` / `H-* @ prod` / `H-* @ shared`. Brak skonfigurowanego klucza ≠ DOWN (to SKIP). |
| **Watchdog** | Codzienny mail o 08:00 Europe/Warsaw. Brak maila do ~08:15 = padł sam monitoring (albo SMTP). |

---

## 5. BODY

### 5.1 Czym jest zakładka (spec produktu)

**Nazwa UI:** `Stan systemu`  
**Lokalizacja:** lewy sidebar Twenty (Navigation Menu Item → Page Layout STANDALONE).  
**Nie:** tab na Opportunity, nie widget na dashboardzie sprzedaży, nie Notes.

**Układ (docelowy):**

1. **Semafor całości** — najgorszy status z pozycji P0.
2. **Lista pozycji** — id H-\*, nazwa, status, ostatni heartbeat, ostatni rekord biznesowy, „co sprawdzić”.
3. **Kanały leadów osobno** — nigdy jedna kreska „Leady”.
4. **Workflowy MUST_ON** — lista ACTIVE/DEACTIVATED (historycznie najczęstsza cisza po imporcie).
5. **Linki** — ten plik + kontrakt kanału; bez kopiowania runbooka w UI.

**Role:** odczyt dla workspace; zapis probe'ów tylko worker/app (nie handlowiec).

**Język UI:** polski. Identyfikatory H-\* zostają w docs/API.

---

### 5.2 Inwentarz komponentów (źródło prawdy zakładki)

Każda nowa integracja Owocni = nowy wiersz. Kolumna **Prio:** P0 = „CRM wydaje się martwy”, P1 = ból procesu, P2 = wsparcie.

#### P0 — cisza, którą zgłasza sprzedaż

##### H-CALL — Rozmowy telefoniczne (nagrane)

| | |
|---|---|
| **Objaw** | Nie pojawiają się nowe `CallTranscript` / „Rozmowy”. |
| **Łańcuch** | Cloud Scheduler `*/5` → Cloud Run Job `telefony-play-poller` (GCS cursor, `hoursBack=2`) → STT OpenAI → **n8n** webhook `play-pbx-ingest` (tylko gdy jest nowy tekst) → filtr D-15 + summary → `POST` worker `enqueue_call_transcript` → Stape `task_queue` → poll worker `*/5` → upsert `CallTranscript` |
| **Kod / kontrakt** | sibling `telefony/` · `CALL_CHANNEL_ARCHITECTURE.md` · `CALL_INGEST_N8N.contract.md` · `workers/callTranscriptIngest.js` |
| **Heartbeat** | Job poller zakończony (nawet `n8nTriggered=0`); n8n workflow **Play PBX → GCP CallTranscript** ACTIVE; worker `CALL_TRANSCRIPT_INGEST_ENABLED=true`; ostatni poll worker 200. |
| **Freshness** | `CallTranscript.startedAt` max — **miękki**. DROP D-15 (poczta głosowa, transkrypt &lt; 100 znaków) = cisza **zamierzona**. |
| **Kill-switch** | pusty `N8N_PLAY_WEBHOOK_URL`; n8n OFF; `CALL_TRANSCRIPT_INGEST_ENABLED=false` |
| **Typowe awarie** | n8n Cloud pause / credentials; secret webhook; STT fail → nagranie nie oznaczone processed (retry OK); Stape paused → kolejka stoi; worker circuit breaker. |
| **NIE** | STT w n8n; scheduled n8n „profilaktycznie”; mylić z H-MISSED. |

##### H-MISSED — Nieodebrane (Play CDR)

| | |
|---|---|
| **Objaw** | Nie rośnie `bizMissedCallsCount` / brak MISSED przy realnych nieodebranych. |
| **Łańcuch** | Ten sam poller → **omija n8n** → `enqueue_missed_call` → worker `missedCallIngest` |
| **Kontrakt** | `MISSED_CALLS_PLAY.contract.md` |
| **Heartbeat** | Job poller 200 + worker poll. **n8n nie jest w ścieżce.** |
| **Typowe awarie** | Założenie „n8n padł ⇒ nieodebrane też” — **fałsz**. Osobna pozycja celowo. |

##### H-LEAD-FORM — Leady z formularza (Sortownia)

| | |
|---|---|
| **Objaw** | Submit na stronie, brak Opportunity w Twenty. |
| **Łańcuch** | Formularz → GTM/sGTM Sortownia (`oid_init` → `generate_lead`) → `crm:twenty_create_lead` → worker `createLead` → Person + Opportunity NEW. Równolegle backup Sheets/Make (**nie** ten sam tor). |
| **Kod / SSOT** | `ARCHITECTURE.md` §5.3 · `BUILD_CRM_TWENTY_CREATE_LEAD.md` · `workers/createLead.js` |
| **Heartbeat** | sGTM/Stape żywy; worker poll `*/5`; ostatni task `crm:twenty_create_lead` nie w nieskończonym retry. |
| **Freshness** | ostatnia Opportunity z kanału paid/form (nie `PIPEDRIVE_LEGACY`). |
| **Zależność** | H-WF `lead · formularz · powiadom owner v3` — brak **powiadomienia** ≠ brak rekordu. Rozróżniaj. |
| **Backup** | `sendToGoogleSheets` + Make — jeśli Twenty puste a arkusz pełny → pada **nasz** tor, nie formularz. |

##### H-LEAD-MAIL — Leady z `leads@` (Email Sync + workflow)

| | |
|---|---|
| **Objaw** | Mail na `leads@`, brak nowego leada / brak powiadomienia ownera. |
| **Łańcuch** | IMAP Email Sync (~5 min) → Message + MCMA → workflow `lead · mail · powiadom owner v1` (FILTER: NEW + TWENTY_EMAIL) oraz/lub adapter inbound. |
| **SSOT** | `IDENTITY_AND_INBOUND.md` §5.4–5.6 · `LEAD_OWNER_ROUTING_PLAN.md` · `LEADS_AT_INBOUND_TEST.md` |
| **Heartbeat** | Connected account `leads@` sync nie pauzowany; workflow mail v1 **ACTIVE**; H-MAIL-DIR żywy (kierunek). |
| **Typowe awarie** | Skrzynka disconnected; visibility Metadata Only; workflow OFF po gate imporcie; FILTER nie łapie `srcSystem`. |
| **NIE** | `kontakt@` — świadomie poza CRM (IDENTITY). Brak leadów z `kontakt@` to **nie** incydent. |

##### H-LEAD-META — Leady Meta Instant Form

| | |
|---|---|
| **Objaw** | Lead w Ads Manager / Graph, brak Opportunity `bizSource=FACEBOOK`. |
| **Łańcuch** | (bonus) webhook Page `leadgen` → CF `meta-lead-webhook-sandbox` → `ingest_meta_lead` → `create_lead`. **SoR = poll:** Scheduler `meta-lead-poll-every-5min` → Graph po `META_FORM_IDS` → ten sam ingest. Idempotencja `metaLeadgenId`. Owner = Robert Mańk. |
| **Kontrakt** | `META_LEAD_WEBHOOK_PHASE_B.md` · `META-PODLACZENIE.md` (CAPI ≠ ten tor) |
| **Heartbeat** | Scheduler poll 200; CF GET verify 200; worker ingest. **0 POST-ów z Meta przy żywym pollu = DEGRADED (push martwy), nie DOWN.** |
| **Typowe awarie (udokumentowane)** | subskrypcja Page bez `fields=leadgen` (2026-07-28); app Development / 0 push mimo Live (2026-08-04…07) — poll jest po to. |
| **NIE** | leczyć CAPI/EMQ; to inna warstwa. |

##### H-MAIL-TPL — Szablony maili (Owocni Mail App)

| | |
|---|---|
| **Objaw** | Brak pozycji Szablony / pusta lista / „wyślij” pada / composer nie dostaje treści. |
| **Łańcuch** | Twenty App `apps/owocni-mail-twenty/` → obiekt `mailTemplate` + `mailEditorDraft` → nav / command menu / tab Opportunity → front `template-picker` → logic functions (`list-mail-picker-data`, `get-mail-template`, `send-template-email`, `mail-send-readiness`). |
| **SSOT** | ADR #17 · `E12_3_EMAIL_TEMPLATE_STRATEGY.md` · `E12_4_OWOCNI_MAIL_RESET_PLAN.md` |
| **Heartbeat** | App **zainstalowana i opublikowana** na instancji; `find_many_mailTemplates` zwraca seed (~19); `mail-send-readiness` `canSend=true` dla usera. |
| **Typowe awarie** | App zniknęła po release Twenty; brak SMTP / sync na `studio@`/`leads@` (konto wspólne `owocni@gmail.com`); logic function 401; puste subject w części szablonów (T9 — to treść, nie DOWN). |
| **NIE** | wracać do better-bitrix / Notes jako picker (ADR #17). |

#### P1 — proces CRM, który „nagle nie działa”

##### H-WF — Workflowy krytyczne MUST_ON

Po imporcie / repairu **8 workflowów** bywa DEACTIVATED (`PIPEDRIVE_IMPORT_GATE.md`). To najczęstsza „cisza leadów” przy żywym workerze.

**MUST_ON (DATABASE_EVENT) — po zakończeniu bulk-op:**

1. `lead · formularz · powiadom owner v3`
2. `lead · mail · powiadom owner v1`
3. `Track Stage Time v3`
4. `deal · stage QUALIFIED → Stape v14b`
5. `deal · campaign rejected · event do orkiestracji`
6. `Opp · guard SQL v6`
7. `Opp · guard odrzucony v1`
8. `Opp · zapamiętaj etap przed SQL v4e`

**MUST_ON (MANUAL — nie wyłączać przy imporcie):** Przyjmij jako SQL · Odrzuć leada · Scal z leadem · Rozmowa · Przypnij do leada · Rozmowa · Utwórz lead.

**Heartbeat:** MCP `list` / `get_workflow_current_version` = **któraś** wersja nazwy ACTIVE (stary v1 DEACTIVATED + v2 ACTIVE = OK).  
**DOWN:** DEACTIVATED poza jawnym oknem gate (`OPS_NOTES` §5.3).  
**Po bulk-op:** `--apply-on` albo MCP activate + wiersz OPS.

##### H-CALL-LINK — Przypnij / Utwórz lead z rozmowy

| | |
|---|---|
| **Objaw** | Parking „Do przypięcia” rośnie; przyciski MANUAL nic nie robią. |
| **Łańcuch** | Workflow MANUAL → `link_call_transcript` / `create_lead_from_call` (`callTranscriptLink.js`) |
| **Heartbeat** | MUST_ON MANUAL „Przypnij do leada” + „Utwórz lead” ACTIVE. Worker nie musi być odpalany jako probe (NR-12). |
| **Prio** | P1 — ingest (H-CALL) może żyć, UX przypięcia pada. |

##### H-UPDATE-PERSON — Backfill `idOid` po ręcznym leadzie

| | |
|---|---|
| **Objaw** | Ręczny Opportunity bez `idOid`; Sortownia nie widzi tożsamości. |
| **Łańcuch** | inbound mint → `crm:twenty_update_person` → worker `updatePerson` |
| **Heartbeat** | Scheduler workera ENABLED (ten sam `*/5` co create_lead). Osobny DOWN tylko gdy worker scheduler padł (wspólny z H-LEAD-FORM). |

##### H-INBOUND — Webhook Twenty → Sortownia

| | |
|---|---|
| **Objaw** | Zmiana stage w Twenty nie idzie na platformy / arkusze; SQL bez `qualify_lead`. |
| **Łańcuch** | Native webhook OUT (HMAC) → Stape stub → GCP `twenty-inbound-webhook` (`gcp-v5`) → `task_queue` → Robot `robot-task-monitor` `*/5` |
| **SSOT** | `EVENT_CONTRACT.md` §5 · `TWENTY_PATHS.md` |
| **Heartbeat** | Webhook w Settings istnieje (GET `/webhooks`); inbound CF **nie** odpalamy. |
| **Typowe awarie** | HMAC signed-string bez timestamp; filtr obiektu; gate `SKIP_LEGACY_IMPORT` zostawiony po imporcie; env-guard sandbox→prod. |

##### H-ROBOT — `robot-task-monitor`

| | |
|---|---|
| **Objaw** | Event w kolejce, platformy / arkusze milczą; inbound CF żywy. |
| **Łańcuch** | `task_queue` → Cloud Run `robot-task-monitor` · Scheduler `robot-monitor-every-minute` (`*/5`) |
| **Heartbeat** | Cloud Scheduler job Robota ENABLED, last attempt OK. **Nie** HTTP do Run. |
| **NIE** | Sklejać z H-INBOUND — inbound 200 + Robot OFF = cisza orkiestracji. |

##### H-STAPE — `task_queue` / circuit breaker

| | |
|---|---|
| **Objaw** | Enqueue OK, Twenty/Robot „nic nie robi”. |
| **Łańcuch** | Worker i Robot pollują Store `*/5`; circuit breaker przy paused kontenerze. |
| **Heartbeat** | Poll 200; kolejka nie rośnie bez bound; Stape nie paused. |
| **Uwaga** | sGTM strony **współdzieli** kontener — limit usage może uciszyć CRM. |

##### H-SYNC — Email Sync (zależność, nie dodatek)

Pozycja jako **dependency** H-LEAD-MAIL i H-MAIL-TPL: skrzynki z IDENTITY §5.5 (`leads@`, `studio@`, handlowcy). `kontakt@` = NIE.  
**Probe:** Core API **nie** widzi `connectedAccount` (`OPS_NOTES`). Status w mailu = UNKNOWN (nie malować na zielono, nie pagingować). Heartbeat ręczny: konto połączone, sync nie error, visibility nie Metadata-only gdy treść jest potrzebna.

##### H-MAIL-DIR — Kierunek maili + widoki 📥/📤

| | |
|---|---|
| **Objaw** | Widoki Poczta puste / 🔧 rośnie / NEW nie przechodzi w Rozeznanie po OUTGOING. |
| **Łańcuch** | Webhook `messageChannelMessageAssociation.*` + poll `messageDirectionEnrich` + `advanceNewToContacted`. Workflowy direction **DEACTIVATED** (Message nieedytowalny przez automation — `OPS_NOTES` 2026-07-28). |
| **Runbook** | `E12_5_MAIL_DIRECTION_VIEWS.md` |
| **NIE** | włączanie z powrotem workflowów direction „żeby naprawić”. Live path = GCP. |

#### P2 — dodatki, cisza nie = „CRM martwy”

##### H-INVOICE — Faktury (`faktura` / Fakturownia)

Worker `issue_invoice`; SoR = Fakturownia. `DATA_MODEL.md` §5.3b. Heartbeat: udany issue albo webhook statusu. Freshness niska priorytetem vs P0.

##### H-ENRICH — Enrichment firm PL (GUS/KRS/MF)

Worker `enrich_company_pl`; pola Company `enrichedAt`. Awaria = przycisk/form, nie cisza leadów.

##### H-MERGE — Scalanie leadów

MANUAL „Scal z leadem” → `merge_leads`. Health = workflow ACTIVE + worker action 200 na teście. **Nigdy auto.**

---

### 5.3 Sygnały i progi `[D:OPEN]` — kalibracja z właścicielem

Zasada: **heartbeat twardy, freshness miękka, okno = godziny pracy PL (pn–pt ~8–18, Europe/Warsaw).**

| Pozycja | OK | DEGRADED | DOWN |
|---|---|---|---|
| H-CALL | Job + n8n ACTIVE + worker poll &lt; 15 min | Godziny pracy i brak nowego CallTranscript **oraz** w Play są nowe nagrania | Job nie startuje / n8n OFF / **n8n nie podpięte (brak API)** / ingest disabled / kolejka stoi &gt; 30 min przy pending |
| H-MISSED | Poller + worker | — | Poller/worker DOWN (n8n ignoruj) |
| H-LEAD-FORM | Worker poll + Stape | Arkusz backup ma wiersz, Twenty nie (rozjazd) | sGTM/worker DOWN albo create_lead fail loop |
| H-LEAD-MAIL | Sync + workflow ACTIVE | Mail w Twenty, brak Opportunity/notify | Sync error albo workflow DEACTIVATED poza gate |
| H-LEAD-META | Poll 200 | 0 push Meta, poll łapie leady | Poll fail **i** brak ingest |
| H-MAIL-TPL | App zainstalowana, count szablonów &gt; 0, readiness canSend | canSend=false (SMTP) / część szablonów pusta | App brak / obiekt brak / 401 logic functions |
| H-WF | 8× DATABASE + MANUAL = ACTIVE (poza jawnym gate) | 1–2 OFF | ≥3 MUST_ON OFF bez wiersza OPS |
| H-INBOUND / H-STAPE | inbound webhook istnieje; worker scheduler OK | latency / retry | brak webhooka OUT; scheduler worker/inbound PAUSED; Stape paused (ręcznie) |
| H-ROBOT | Scheduler Robota ENABLED + last OK | — | job PAUSED / last attempt fail |
| H-CALL-LINK | MANUAL Przypnij + Utwórz lead ACTIVE | 1 z 2 OFF | oba OFF |
| H-MAIL-DIR | enrich worker 200, 🔧 ≈ 0 | 🔧 rośnie | worker DOWN; **nie** „workflow direction OFF” (to stan zamierzony) |
| H-SYNC | — | — | **zawsze UNKNOWN w automacie** (brak w Core API) |

**Faza 0 UI:** statusy w zakładce byłyby UNKNOWN — UI jeszcze nie istnieje.  
**Probe maili:** czyta heartbeat (scheduler / workflow ACTIVE / szablony / webhook / n8n API). **Nie** używa freshness do DOWN (NR-1, NR-14).

---

### 5.4 Playbook diagnostyczny (objaw → dowód)

LLM **nie naprawia w ciemno**. Kolejność: objaw → pozycja H-\* → łańcuch od **źródła** do Twenty → jeden odcinek na raz → evidence (log / count / screenshot) → dopiero zmiana.

Wspólne narzędzia: Twenty MCP `find_many_*` / `group_by_*` (limit 10 + filtr daty); GCP logi CF/Job/Scheduler; n8n executions; `OPS_NOTES` §5.3 (czy ktoś wyłączył WF).

#### A. „Nie przychodzą rozmowy”

1. Czy to nagrane rozmowy (H-CALL) czy nieodebrane (H-MISSED)? **Rozdziel.**
2. GCP: ostatni run `telefony-play-poller` — exit 0? `n8nTriggered` vs `processedRecordings`.
3. Jeśli poller widzi nagrania, a n8n=0 przy niepustym transkrypcie → webhook n8n / secret / workflow OFF.
4. n8n execution: PASS czy DROP D-15? DROP ≠ awaria.
5. Worker: `enqueue_call_transcript` w logu? `task_queue` pending?
6. Twenty: `find_many_callTranscripts` sort `startedAt` DESC. Rekord jest, UI nie — to widok/filtr, nie ingest.
7. **Nie** ruszaj STT do n8n (NR-9).

#### B. „Nie ma leadów z formularza”

1. Czy submit w ogóle doszedł? Arkusz backup / Make (ARCHITECTURE §5.3.1).
2. Jest w arkuszu, nie ma w Twenty → Sortownia / `create_lead` / Stape (H-LEAD-FORM, H-STAPE).
3. Jest w Twenty, nikt nie dostał maila → H-WF pozycja 1, nie worker.
4. `srcSystem=PIPEDRIVE_LEGACY` nie liczy się jako live form.

#### C. „Nie ma leadów z maila”

1. Message w Twenty dla `leads@`? Nie → H-SYNC.
2. Message jest, Opportunity nie → workflow mail v1 / FILTER / adapter (H-LEAD-MAIL, H-WF).
3. Nie szukaj w `kontakt@`.

#### D. „Nie ma leadów z Meta / Insta FORM”

1. Graph ma `leadgen_id`? Nie → problem Ads, nie CRM.
2. Poll scheduler ostatni 200? Nie → H-LEAD-META DOWN.
3. Poll 200, Twenty puste → `ingest_meta_lead` / `metaLeadgenId` / mapowanie pól. Backfill ręczny z Graph jest **legalnym** dogonieniem (runbook Faza B).
4. 0 POST webhook przy żywym pollu = znany stan DEGRADED, nie „naprawiaj CAPI”.

#### E. „Szablony nie działają”

1. App zainstalowana? Obiekt `mailTemplate` w metadata? Count &gt; 0?
2. Picker się otwiera, send nie → `mail-send-readiness` (SMTP / `studio@` / `leads@`).
3. Picker pusty, rekordy są → front component / logic function auth.
4. **Nie** importuj z powrotem do Notes.

#### F. „SQL / odrzucenie / powiadomienia padły po imporcie”

1. `OPS_NOTES` §5.3 — czy gate OFF bez `--apply-on`?
2. H-WF: 8× ACTIVE. MANUAL nie ruszaj.
3. Potem dopiero H-INBOUND (guardy SQL/reject).

---

### 5.5 Spec implementacji zakładki (fazy)

| Faza | Co | Status | GO |
|---|---|---|---|
| **0** | Ten dokument + wpisy navigatora | **teraz** | — |
| **A** | Probe GCP + maile (§5.8). Kod: `system-health-check`. UI **nie**. | **wdrożone 2026-08-17** (SMTP PASS, pierwszy digest) | n8n API później |
| **1** | Sidebar „Stan systemu”: lista H-\* **statyczna** albo odczyt snapshotu GCS (zero probe'ów przy page-load). Osobny page layout — **nie** w `template-picker`. App: nowa `owocni-ops` **albo** drugi layout w Mail App (NR-4). | `[D:OPEN]` | osobne zadanie |
| **2** | Semafory w UI z ostatniego snapshotu GCS (Faza A), nie z live logic function przy każdym otwarciu. | `[D:OPEN]` | po Faza 1 + działającym probe |
| **3** | Obiekt `systemHealthPing` w Twenty — **nie robimy** (NR-13 / OQ-H4 = GCS). | **odrzucone** | ADR tylko jeśli GCS nie wystarczy |

**Preferencja Faza 1–2:** Twenty Apps (`yarn twenty dev:add` navigationMenuItem + pageLayout + frontComponent + logicFunction). Wzorzec: `apps/owocni-mail-twenty/src/page-layouts/main-page.page-layout.ts`.

**Zakaz Faza 1–A:** workflow HTTP co 5 min; custom Deal; sekrety w Code Action; eventy Sortowni; dashboard sprzedaży jako substytut; n8n cron na health; HTTP do workera jako probe.

**UI sandbox najpierw** (`zany-maroon-panther.twenty.com`). Maile §5.8: **jeden** raport sandbox+prod.

---

### 5.6 Protokół LLM przy incydencie

```
1. READ ten plik §0 + pozycja H-* z objawu (§5.2) + playbook (§5.4)
2. CLASSIFY: cisza biznesowa vs heartbeat vs workflow OFF vs zły kanał
3. PLAN: który odcinek łańcucha sprawdzasz; czego NIE ruszasz
4. EVIDENCE: count/log/status BEFORE zmiany
5. DIFF: jeden odcinek
6. VERIFY: rekord testowy albo naturalny ruch
7. UPDATE: OPS_NOTES §5.4 (incydent) + ten plik jeśli nowy failure mode
```

**STOP i pytaj człowieka:** cutover, deploy prod, włączanie/wyłączanie 8 workflowów poza udokumentowanym gate, zmiana n8n D-15, Live/Development Meta, kasowanie kolejki Stape, merge tożsamości.

**MCP Twenty:** `learn_tools` przed non-CRUD; `find_many_*` z filtrem i małym limitem; nie `delete_*` bez potwierdzenia.

---

### 5.7 Protokół LLM przy implementacji zakładki

Gdy zadanie brzmi „zrób zakładkę / zaimplementuj Stan systemu”:

1. Potwierdź Fazę (1 lub 2). Domyślnie **tylko Faza 1**, jeśli nie powiedziano inaczej. Maile = Faza A (§5.8), nie UI.
2. PLAN: pliki w `apps/` (nowa app vs drugi layout), universal UUID v4, role odczytu, **zero** zmian EVENT_CONTRACT / DATA_MODEL (Faza 1).
3. Semafory w UI czytają snapshot GCS z Fazy A — **nie** live probe przy page-load.
4. Nie wrzucaj health do `template-picker.tsx`.
5. Po UI: ten plik — status fazy, `last_verified`; `INTEGRATIONS_PARITY` jeśli nowy runtime.
6. Nie zamykaj `[D:OPEN]` faz bez dowodu na sandbox (screenshot + 1 semafor zgodny z ręcznym checkiem).
7. Nie twórz obiektu `systemHealthPing` (NR-13). Deploy CF wymaga GO (SMTP).

---

### 5.8 Alerting mailowy + budżet kredytów `[D:CORE]`

**Adres:** `dawidnowak@owocni.pl` (override: `HEALTH_ALERT_TO`).  
**Kod:** `integrations/cloud-functions/system-health-check/`.  
**Kanał SMTP:** niezależny od Twenty i n8n (żeby mail o padzie Twenty w ogóle wyszedł). Daily watchdog: brak maila rano = padł probe albo SMTP.

#### Budżet (twardy)

| Źródło | Zakaz | Co zamiast | Szacunek |
|---|---|---|---|
| Twenty workflow credits | HTTP/Code w workflow, zapis rekordów health | tylko GET REST (`/workflows`, `/workflowVersions`, `/mailTemplates?limit=1`, `/webhooks`) | ~4 GET × instancja × ~49 runów/dzień |
| n8n | nowy workflow / cron / execution | 1× GET API `active`. **Brak klucza / nieaktywne = H-CALL DOWN** (fail-closed). | 49 wywołań/dzień gdy klucz jest; 0 executions |
| GCP / Stape | nowy job `*/5`; HTTP do worker/Robot/Play | 1 CF min-instances=0, **co 30 min** + **08:00**; odczyt listy **istniejących** Scheduler jobs | ~49 cold-startów/dzień, 256 MiB, timeout 60 s |
| Twenty write | obiekt ping, Notes, Opportunity | snapshot GCS `system-health/last.json` | 2 ops GCS / run |

Nie dokładamy `*/5` — istniejące schedulery już palą budżet; health je **czyta**, nie dubluje.

#### Harmonogram

| Job | Cron (Europe/Warsaw) | Body | Mail |
|---|---|---|---|
| `system-health-probe-every-30min` | `*/30 7-20 * * 1-5` | `{mode:"probe"}` | tylko przy **zmianie** na DOWN albo recovery (debounce: ten sam DOWN nie sypie co 30 min) |
| `system-health-digest-daily-0800` | `0 8 * * *` | `{mode:"digest"}` | **zawsze** (OK albo lista problemów). To watchdog. |

Poza 7–20 pn–pt probe nie chodzi (cisza noc/weekend ≠ DOWN). Digest w niedzielę nadal wychodzi — potwierdza, że monitoring żyje.

#### Treść maila

- Temat OK: `[Owocni CRM] Stan systemu — OK — DD.MM.YYYY HH:mm`
- Temat awarii: `[Owocni CRM] AWARIA — {H-*} @ {sandbox\|prod} — {krótki powód}`
- Temat recovery: `[Owocni CRM] Wróciło — {H-*} @ {sandbox\|prod}`
- Body: semafor całości (najgorszy P0), tabela pozycji (`@ sandbox` / `@ prod` / `@ shared`), UNKNOWN osobno (H-SYNC), zero payloadów sekretów.

DEGRADED (np. 0 push Meta, poll żywy) **tylko w digescie**, nie w pagerze.

#### Deploy

`deploy.sh` w katalogu funkcji. **Nie odpalać bez GO.** Wymaga: `HEALTH_SMTP_*`, klucze Twenty per instancja (brak prod = SKIP, nie DOWN). `N8N_API_KEY` — dopóki pusty, H-CALL = DOWN. Scheduler OIDC, funkcja **bez** `allow-unauthenticated`.

---

## 6. CROSS-REFERENCES

| Temat | Plik |
|---|---|
| Fakty platformy, bulk-op, incydenty | `ops/OPS_NOTES.md` |
| Mapa adapterów / schedulerów | `integrations/TWENTY_PATHS.md` |
| Telefon | `CALL_CHANNEL_ARCHITECTURE.md`, `CALL_INGEST_N8N.contract.md`, `MISSED_CALLS_PLAY.contract.md` |
| Meta | `META_LEAD_WEBHOOK_PHASE_B.md` |
| Szablony | `E12_3_EMAIL_TEMPLATE_STRATEGY.md`, `apps/owocni-mail-twenty/` |
| Workflow gate | `PIPEDRIVE_IMPORT_GATE.md` |
| Kanały wejścia | `IDENTITY_AND_INBOUND.md` §5.4 |
| Eventy | `EVENT_CONTRACT.md` |
| Anti-wpadki deploy | `LLM_ANTI_WPADKI_GO_NO_GO.md` |
| Probe + maile (Faza A) | `integrations/cloud-functions/system-health-check/` |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie |
|---|---|---|---|---|
| OQ-H1 | Faza 1: nowa app `owocni-ops` vs drugi page layout w Mail App? | Dawid | Faza 1 UI | implementacja |
| OQ-H2 | Czy handlowcy widzą pełną listę H-\*, czy tylko semafor P0? | Właściciel | Faza 1 UX | ten plik §5.1 |
| OQ-H3 | Kalibracja SLO freshness (godziny/cisza weekend) | Właściciel | Faza 2 UI | §5.3 |
| OQ-H4 | Obiekt `systemHealthPing`? | Dawid | — | **nie** — GCS (NR-13), 2026-08-17 |
| OQ-H5 | Źródło n8n/Play bez sekretów w UI | Dawid | — | **GCP:** Scheduler API + n8n GET; UI czyta snapshot |
| OQ-H6 | SMTP do pagera (konto / app password) | Dawid | — | **wklejone 2026-08-17**; n8n API później |

---

## 8. VERIFICATION / RECHECK

| Co | Kiedy | Kto | Dowód |
|---|---|---|---|
| §5.2 pokrywa każdy dodatek Owocni na instancji | przy nowym workerze/app/obiekcie | LLM + Dawid | wiersz H-\* w tym samym PR |
| Playbook A–F zgadza się z ostatnim incydentem | po incydencie | Dawid | `OPS_NOTES` §5.4 + ewentualny dopisek „Typowe awarie” |
| Faza 1 nie istnieje na instancji, dopóki ten plik mówi OPEN | teraz | — | brak nav item „Stan systemu” = zgodne |
| MUST_ON = ACTIVE poza oknem gate | po każdym bulk-op | wykonawca | `OPS_NOTES` §5.3 `--apply-on` |
| Daily digest 08:00 na dawidnowak@ | po deploy Fazy A | Dawid | mail w skrzynce; brak maila = DOWN monitoringu |
| `evaluate.test.js` PASS | przy zmianie matcherów H-\* | LLM | `npm test` w `system-health-check` |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-08-17 | Fail-closed: n8n nie podpięte / brak schedulera = DOWN (nie UNKNOWN/OK) | Composer | n8n nieopłacone; nie malować H-CALL na zielono |
| 2026-08-17 | Utworzenie pliku (Faza 0): inwentarz, semafory, playbook LLM, spec zakładki | Composer | cisze kanałów (n8n/leady/szablony); docs przed UI |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — inwentarz łańcuchów i zakazy (ten plik, o ile nie oznaczono wiersza).
- `[D:OPEN]` — UI zakładki, SLO freshness, wybór app vs layout (OQ-H1–H3). Deploy maili: GO 2026-08-17 (SMTP w `.env.deploy`).
- `[D:VERIFIED]` — fakty platformy **nie** żyją tutaj; idź do `OPS_NOTES.md`.
