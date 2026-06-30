---
doc_id: BUILD_CRM_TWENTY_CREATE_LEAD
title: "Formularz → Twenty — adapter crm:twenty_create_lead"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-30
related:
  - ../CRM_TWENTY_CREATE_LEAD.sGTM.js
  - ../SORTOWNIA_V2_POPRAWIONY.js
  - ../../owocni-crm/ARCHITECTURE.md
  - TWENTY_ROLLOUT_MASTER.md
---

# BUILD — `crm:twenty_create_lead`

**Cel:** po `generate_lead` w Sortowni (nowy Akt) utworzyć **Person + Opportunity** w Twenty sandbox, **równolegle** do BB/julia362 — bez wyłązania legacy.

**Stan (2026-06-30):** **PASS sandbox** — deploy sGTM, Faza B write, Person+Opp, workflow powiadomień z FILTER Sortownia. Evidence: §9 + `INTEGRATIONS_PARITY.md`.

**Kontener:** `GTM-5ZM8KQ5S` · host `https://uinpcbwf.eug.stape.io`

---

## 0. Co już masz w sGTM (nie ruszaj, tylko uzupełnij)

| Element sGTM | Nazwa (z evidence) | Plik repo |
|--------------|-------------------|-----------|
| Tag Sortownia | tag z kodem `SORTOWNIA V2` | `SORTOWNIA_V2_POPRAWIONY.js` |
| Tag worker backfill | `crm_twenty_update_person` | `CRM_TWENTY_UPDATE_PERSON.sGTM.js` |
| Client HTTP worker | `POST /crm/twenty_worker` | `TWENTY_CRM_WORKER_CLIENT.sGTM.js` |
| Tag inbound | `inbound_twenty_webhook` | `INBOUND_TWENTY_WEBHOOK.sGTM.js` |

**Dziś dodajesz / aktualizujesz:** 3 pliki → 1 nowy tag + 1 client + 1 tag Sortownia.

**Ścieżki plików w repo** (root: `owocni-crm-github/`):

```
integrations/CRM_TWENTY_CREATE_LEAD.sGTM.js      ← NOWY tag
integrations/TWENTY_CRM_WORKER_CLIENT.sGTM.js    ← podmiana kodu clienta
integrations/SORTOWNIA_V2_POPRAWIONY.js         ← podmiana kodu Sortowni
```

---

## 3. Deploy sGTM — krok po kroku

Otwórz kontener **server-side** `GTM-5ZM8KQ5S` w edytorze Google Tag Manager (Stape → *Open GTM* / bezpośrednio tagmanager.google.com → kontener **Server**).

**Nie publikuj** na końcu każdego kroku osobno — zrób wszystkie 3 kroki, potem **Submit → Publish** raz.

---

### Krok 1 — NOWY tag `crm_twenty_create_lead`

#### 1A. Szablon tagu (jeśli nie masz jeszcze dedykowanego template)

1. sGTM → **Templates** → **Tag Templates** → **New**.
2. Nazwa szablonu: np. `Owocni — CRM Twenty Create Lead`.
3. W edytorze kodu szablonu **wklej całą zawartość** pliku:
   `integrations/CRM_TWENTY_CREATE_LEAD.sGTM.js`
4. W zakładce **Permissions** włącz:
   - Logs to console
   - Reads event data
   - Sends HTTP requests
5. **Save** szablonu.

> Jeśli wolisz ten sam wzorzec co `crm_twenty_update_person`: otwórz istniejący szablon tego tagu, **Save as new**, wklej nowy kod, zapisz pod nową nazwą.

#### 1B. Instancja tagu

1. sGTM → **Tags** → **New**.
2. **Tag Configuration** → wybierz szablon z 1A.
3. **Tag name:** `crm_twenty_create_lead` (dokładnie — tak woła worker client).
4. **Triggering** → **+** → **Custom Event**.
   - Event name: `crm_twenty_create_lead`
   - Ten trigger **nie istnieje jeszcze** — utwórz go w tym kroku.
5. **Save** tagu.

#### 1C. Bezpieczny start (log-only)

W kodzie szablonu (krok 1A) upewnij się, że jest:

```javascript
var CREATE_LEAD_WRITE_ENABLED = false;
```

Przy `false` **nic nie trafia do Twenty** — tylko log + task `done` z `create_lead_result: log_only`.

#### 1D. Sekrety Twenty (w kodzie szablonu — jak u `crm_twenty_update_person`)

Sprawdź na górze pliku (po wklejeniu):

```javascript
var TWENTY_REST_URL = "https://api.twenty.com/rest";
var TWENTY_API_KEY = "eyJ...";  // ten sam klucz co w crm_twenty_update_person
```

Jeśli klucz w `crm_twenty_update_person` jest aktualny — **skopiuj te same wartości**. Nie commituj zmian klucza do git.

---

### Krok 2 — AKTUALIZACJA Clienta `POST /crm/twenty_worker`

1. sGTM → **Templates** → **Client Templates**.
2. Znajdź client obsługujący ścieżkę **`/crm/twenty_worker`**
   (w logach: `=== TWENTY CRM WORKER CLIENT START ===`).
3. Otwórz szablon clienta → **zastąp cały kod** zawartością:
   `integrations/TWENTY_CRM_WORKER_CLIENT.sGTM.js`
4. **Permissions:** claim request, read request, run container, write response (jak było).
5. **Save**.

**Co się zmienia:** po `POST /crm/twenty_worker` client odpala **dwa** eventy w kontenerze:

| Kolejność | Custom Event | Tag który reaguje |
|-----------|--------------|-------------------|
| 1 | `crm_twenty_update_person` | istniejący tag backfill |
| 2 | `crm_twenty_create_lead` | **nowy** tag z kroku 1 |

**Nie twórz** drugiego clienta — podmień kod w istniejącym.

**Scheduler GCP** (`twenty-crm-worker-sandbox`, co ~2 min) — **bez zmian**; dalej woła ten sam URL.

---

### Krok 3 — AKTUALIZACJA tagu Sortownia

1. sGTM → **Tags** → znajdź tag Sortownia (szukaj w kodzie szablonu frazy `SORTOWNIA V2 START` albo `=== SORTOWNIA V2 START ===`).
2. Otwórz **Tag Template** powiązany z tym tagiem (Templates → Tag Templates → edytuj szablon).
3. **Zastąp cały kod** zawartością:
   `integrations/SORTOWNIA_V2_POPRAWIONY.js`
4. **Save** szablonu + tagu.

**Opcjonalne pola szablonu** (Tag Configuration → pola tagu Sortownia):

| Pole szablonu | Zmienna sGTM | Po co |
|---------------|--------------|--------|
| `runtimeEnvironment` | `{{runtime_environment}}` | Wymuszenie sandbox na wszystkich eventach (tylko na czas testów) |
| `clientIp` | `{{IP Address}}` | IP klienta gdy GA4 Client nie ustawi `ip_override` |

**Routing sandbox bez zmian w Web GTM:** email testowy z domeny `@fastman.eu` lub `@example.com` → taski dostają `environment: sandbox` (Robot → arkusz sandbox). Produkcja bez zmian.

**Co się zmienia w Sortowni:** po udanym `generate_lead` z **nowym Aktem** (nie przy blokadzie 90 dni) dopisuje drugi dokument w Store:

```
task_queue / {id_oid}_{timestamp}_crm_twenty_create_lead
job_type: crm:twenty_create_lead
status: pending
```

Reszta Sortowni (analytics, identity_map, paid) — bez zmian.

---

### Krok 4 — Publish sGTM

1. **Submit** (prawy górny róg) → opis np. `crm:twenty_create_lead — log-only prep`.
2. **Publish**.

---

### Krok 5 — Weryfikacja Faza A (log-only)

#### 5A. Submit formularza testowego

Wyślij formularz na stronie (unikalny email testowy, najlepiej `*@fastman.eu` → routing sandbox). Web GTM musi wysłać event `generate_lead` do sGTM — to już działało wcześniej.

#### 5B. Logi sGTM (Stape → Logs / Preview)

Szukaj kolejno:

| Log | Znaczenie |
|-----|-----------|
| `SORTOWNIA: Enqueue crm:twenty_create_lead` | Sortownia zapisała task CRM |
| `SORTOWNIA: ✅ crm:twenty_create_lead task saved` | PUT do Store OK |
| `=== CRM_TWENTY_CREATE_LEAD worker ===` | Worker scheduler odpalił tag |
| `log_only payload` | WRITE wyłączony — **OK na start** |
| `done processed=1` | Task przetworzony |

#### 5C. Stape Store

Storage → kolekcja `task_queue` → dokument `…_crm_twenty_create_lead`:

- `job_type`: `crm:twenty_create_lead`
- po workerze: `status`: `done`, `create_lead_result`: `log_only`

#### 5D. Ręczny test workera (opcjonalnie)

```bash
curl -X POST "https://uinpcbwf.eug.stape.io/crm/twenty_worker"
```

Oczekiwane: HTTP 200 + w logach oba eventy (`crm_twenty_update_person` + `crm_twenty_create_lead`).

---

### Krok 6 — Faza B (zapis do Twenty sandbox) — dopiero po PASS Fazy A

1. Edytuj szablon tagu `crm_twenty_create_lead` → ustaw:
   ```javascript
   var CREATE_LEAD_WRITE_ENABLED = true;
   ```
2. **Save** szablonu → **Publish**.
3. Ponowny submit formularza (nowy email).
4. Twenty sandbox (`zany-maroon-panther.twenty.com`): Person + Opportunity, `idOid` zgodny z Sortownią, `srcSystem` = OWOCNI_SORTOWNIA.
5. Log: `pending-write SET pending_write_twenty_{oppId}`.

---

## 3bis. Stary checklist (skrót)

### 3.1 Tag `crm_twenty_create_lead`

Patrz **Krok 1** powyżej.

### 3.2 Worker client

Patrz **Krok 2** powyżej.

### 3.3 Sortownia

Patrz **Krok 3** powyżej.

### 3.4 Bezpieczny start (log-only)

Patrz **Krok 1C** — domyślnie `CREATE_LEAD_WRITE_ENABLED = false`.

### 3.5 Włączenie zapisu sandbox

Patrz **Krok 6** — `CREATE_LEAD_WRITE_ENABLED = true` + Publish.

---

```
Formularz → GTM → Sortownia (generate_lead, mint id_oid)
                    ├── task_queue analytics:ga4_mp  (bez zmian)
                    └── task_queue crm:twenty_create_lead  (NOWE — tylko nowy Akt)
                              │
Scheduler POST /crm/twenty_worker (~2 min)
                              │
                    CRM_TWENTY_CREATE_LEAD.sGTM.js
                              │
                    Twenty REST: POST /people → POST /opportunities
                              │
                    pending_write_twenty_{oppId}  (loop-prevention echo)
```

**Nie tworzy taska CRM gdy:** blokada 90 dni (ten sam Akt) — unikamy duplikatu Opportunity w Twenty.

**BB / julia362 / Make / Sheets:** bez zmian.

---

## 2. Pliki w repo

| Plik | Rola |
|------|------|
| `SORTOWNIA_V2_POPRAWIONY.js` | Enqueue `crm:twenty_create_lead` po zapisie analytics task |
| `CRM_TWENTY_CREATE_LEAD.sGTM.js` | Worker — poll task_queue, Twenty API |
| `TWENTY_CRM_WORKER_CLIENT.sGTM.js` | Odpala **oba** workery: update_person + create_lead |
| `integrations/tools/verify_create_lead_e2e.py` | Test lokalny API + mapowanie pól |

---

## 1. Architektura

## 4. Test end-to-end

### Faza A — log-only (prod-safe)

1. Submit testowy formularz (np. sandbox / test email).
2. Stape logs Sortownia: `Enqueue crm:twenty_create_lead`.
3. Stape Store `task_queue`: dokument `{id_oid}_…_crm_twenty_create_lead`, `job_type: crm:twenty_create_lead`.
4. Po schedulerze (~2 min): log `crm:twenty_create_lead log_only payload`.
5. Task `status: done`, `create_lead_result: log_only`.

### Faza B — zapis Twenty

1. `CREATE_LEAD_WRITE_ENABLED = true`.
2. Submit formularz z **unikalnym** emailem testowym.
3. Twenty UI: Person + Opportunity, stage **NEW**, `idOid` = z Sortowni, `srcSystem` = OWOCNI_SORTOWNIA.
4. Stape: `pending-write SET pending_write_twenty_{oppId}`.
5. Inbound webhook: **brak** drugiego `generate_lead` (idOid już ustawione przy create).

Lokalnie:

```bash
cd integrations/tools
python3 verify_create_lead_e2e.py --write
```

(wymaga `.env.local` z `TWENTY_API_KEY`)

---

## 5. Mapowanie pól

| Sortownia / task | Twenty Opportunity / Person |
|------------------|----------------------------|
| `id_oid` | `idOid` (Person + Opp) |
| `biz_email` | Person.emails.primaryEmail |
| `biz_phone` | Person.phones.primaryPhoneNumber |
| `biz_name` | Person.name (first/last) |
| `biz_product` slug | `bizProduct` enum (WEB, LOGO, …) |
| `attr_gclid` | `bizSource` = GOOGLE_ADS |
| default form | `bizSource` = FORM |
| — | `srcSystem` = OWOCNI_SORTOWNIA |
| — | `stage` = NEW |

Slug → enum: `strony`→WEB, `logo`→LOGO, `nazwa`→NAME, `copywriting`→COPYWRITING, `opakowanie`→OPAKOWANIE, `marketing/strategia/konsultacje`→MARKETING, inne→INNE.

---

## 6. Idempotencja i konflikty

| Sytuacja | Zachowanie |
|----------|------------|
| Opportunity z tym `idOid` już istnieje | `create_lead_result: already_exists`, task done |
| Person z emailem istnieje, ten sam `idOid` | Reuse Person, nowa Opp |
| Person z emailem, **inny** `idOid` | FAIL (log), task failed — ręczna interwencja |
| Duplikat submit < 90 dni | Brak taska CRM (Sortownia nie enqueue) |

---

## 7. Cutover (później — NIE teraz)

1. G-PAR + szkolenie handlowców.
2. Twenty prod (jeśli ≠ sandbox).
3. `environment=production`.
4. Wyłączenie julia362 dla kanału formularz→leads@ (E12.4).
5. BB jako CRM operacyjny OFF.

---

## 8. Powiadomienia Twenty (owner leada)

**Cel:** po `create_lead` handlowiec dostaje powiadomienie. **Nie** jest to część `CRM_TWENTY_CREATE_LEAD.sGTM.js` — konfigurujesz **Workflow** w Twenty UI.

**Faza testowa (teraz):** wszystkie maile na `dawidnowak@owocni.pl`.

**Docelowo:** powiadomienie do **Owner** Opportunity (rozdzielanie Gosia / Marta).

Szablon / ID: `integrations/tools/twenty_workflow_lead_notify_owner.json`  
**Sandbox (MCP):** workflow `lead · formularz · powiadom owner v3` — **ACTIVE**, id `e570b3de-4565-40c7-a776-dfd273b908e8`, wersja `aa0f64e2-9c24-45fa-80a3-7d644b9303e7`.  
Kroki: **FILTER** (`srcSystem=OWOCNI_SORTOWNIA`, `stage=NEW`) → **Task** → **taskTarget** → **Email** (link do Opp).

Plan rozdzielania Gosia/Marta: [LEAD_OWNER_ROUTING_PLAN.md](./LEAD_OWNER_ROUTING_PLAN.md).  
Test kanału mail `leads@`: [LEADS_AT_INBOUND_TEST.md](./LEADS_AT_INBOUND_TEST.md).

### 8.1 Workflow w Twenty UI (jeśli tworzysz ręcznie)

1. **Settings → Workflows → Create workflow**
2. **Trigger:** `Record is created` → **Opportunities**
3. **Trigger filter** (AND):
   - `srcSystem` **is** `OWOCNI_SORTOWNIA`
   - `stage` **is** `NEW`
4. **Krok 1 — Send Email** (wymaga podłączonej skrzynki w Settings → Accounts):
   - **To:** `dawidnowak@owocni.pl` *(test)*
   - **Subject:** `Nowy lead: {{trigger.object.name}}`
   - **Body:** nazwa, `bizProduct`, `idOid`, `bizSource`
   - **Continue on failure:** ON *(żeby Task i tak powstał, gdy skrzynka nie gotowa)*
5. **Krok 2 — Create Record → Task**
   - **Title:** `Nowy lead: {{trigger.object.name}}`
   - **Assignee:** osoba na dyżurze *(sandbox: Mariusz — jedyny member)*
6. **Activate** workflow.

### 8.2 Skrzynka nadawcza vs odbiorca (ważne)

| Rola | Adres | Czy podłączać w Twenty? |
|------|-------|-------------------------|
| **FROM (nadawca)** | np. `leads@owocni.pl` | **TAK** — Settings → Accounts → Email Sync + message channel |
| **TO (odbiorca test)** | `dawidnowak@owocni.pl` | **NIE** — zwykły adres w polu „To” workflow |
| **TO (produkcja)** | email ownera Opp | **NIE** — `{{trigger.properties.after.owner…}}` lub stały adres |

Workflow wysyła **z** podłączonej skrzynki (`connectedAccountId` = `leads@`) **na** Dawida. Dawid nie musi mieć konta w workspace ani podłączonej skrzynki.

### 8.3 Bloker email (sandbox)

Test `send_email` MCP zwrócił: `No message channel found for connected account`.  
**Naprawa:** dokończ **Email Sync** skrzynki nadawczej (np. `leads@` lub `marta@`) w Twenty → Settings → Accounts. Bez tego działa **Task in-app**, mail z workflow nie.

### 8.3 Docelowo: Gosia / Marta

| Etap | Co zrobić |
|------|-----------|
| **1** | Dodać Gosia i Marta jako **Workspace Members** |
| **2** | Przed emailem: krok **Update Record** → ustaw `ownerId` (np. **Pick Record** ROUND_ROBIN między ich member ID) |
| **3** | W Send Email zmienić **To** z `dawidnowak@…` na `{{trigger.object.owner.userEmail}}` |
| **4** | Task **Assignee** → `{{trigger.object.owner.id}}` |

Alternatywa: rozdzielanie w **Sortowni** (`owner_hint` w task) + `ownerId` w `create_lead` przy POST — osobny PR po ustaleniu reguł produktowych.

**Nie używaj** Workflow HTTP Request → Sortownia (workflow credits — `EVENT_CONTRACT.md`).

Make.com ze strony www **zostaje** jako backup mailowy równolegle.

---

## 9. PASS criteria (sandbox)

- [x] Faza A log-only na prawdziwym submit formularza (2026-06-29)
- [x] Faza B Person+Opp w Twenty z poprawnym `idOid` (testy v4, strony.owocni.pl, `test120gagafg@fastman.eu`)
- [x] Brak duplikatu Opp przy powtórnym submit < 90 dni (Sortownia SKIP)
- [x] Brak duplikatu `generate_lead` z inbound (pending-write — smoke #4)
- [x] Workflow powiadomień: Task + taskTarget + mail `dawidnowak@owocni.pl` (leads@ nadawca)
- [x] Workflow FILTER: tylko `srcSystem=OWOCNI_SORTOWNIA` + `stage=NEW` (2026-06-30, wersja `aa0f64e2…`)
- [x] BB/julia362 nadal tworzy lead równolegle (do cutover E12.4)
- [x] Evidence w `INTEGRATIONS_PARITY.md` (2026-06-30)
