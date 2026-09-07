---
doc_id: LEAD_DISPATCHER_PLAN
title: "Rozdzielanie leadów — v2.0 model dyspozytora (TIME TO LEAD) — ARCHIWUM"
layer: runbook
status: retired
owner: "Mariusz (biznes) / Dawid (wdrożenie)"
last_verified: 2026-09-04
related:
  - LEAD_OWNER_ROUTING_PLAN.md
  - CUTOVER_TWENTY_TEAM_PLAN.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../../owocni-crm/DATA_MODEL.md
  - ../../owocni-crm/CRM_CONSTITUTION.md
  - RULE_CONTINUITY_IMPL_CHECKLIST.md
supersedes:
  - "Rozdzielanie-leadow-wstep.md v1.3 (claim/puli — ODRZUCONE)"
  - "LEAD_DISPATCHER_PLAN draft 2026-08-20 (skrót zespołowy — scalony tu)"
audience: "zespół handlowy + LLM / agent wdrożeniowy"
source: "v2.0 Red Team 2026-08-12 + decyzje właściciela 2026-08-12…25; wycofane 2026-09-04"
---

> **RETIRED 2026-09-04.** Biorę, zegar failover, limit 3, least-loaded, alerty managera — wycofane.  
> **SSOT przydziału nowych kart:** `createLead.js` `resolveOpportunityOwnerId` (copywriting → Maciej; parzysty idOid → Gosia; nieparzysty → Marta).  
> Ten plik zostaje jako archiwum modelu. Nie uruchamiaj `start_lead_dispatcher.sh go`.


# Rozdzielanie leadów — v2.0 (model dyspozytora)

## 0. LLM QUICK ENTRY

**Ten plik = SSOT dyspozytora.** Decyduje o: przydziale ownera, klasyfikacji HOT/STANDARD/LOW, zegarze failover/eskalacji, przycisku „Biorę”, limicie 3, urlopie, weekendzie/świętach, alertach do managera, polach Twenty, wykonawcy (worker GCP).

**Ten plik NIE decyduje o:** cutoverze D1 (→ `CUTOVER_TWENTY_TEAM_PLAN.md`); szczegółach identity poza RULE-CONTINUITY (→ `IDENTITY_AND_INBOUND.md`).

**Model:** dyspozytor — system przydziela twardo. Brak puli claim / rezerwacji / mini-shark / slotów per klasa.

**Zasada:** reguły **kaskadowo od góry** — pierwsza pasująca wygrywa. Nie domykaj otwartych TODO wartościami „z głowy” (INV-2), **z wyjątkiem** jawnych interim poniżej (Meta = cały FB→Robert do listy Piotra).

**Cutover:** do wdrożenia dyspozytora obowiązuje dotychczasowy assign (hash Marta/Gosia, COPY→Maciej, FB→Robert). **15 min TIME TO LEAD = cel systemu**, nie automat — dopóki nie ma zegara + „Biorę” + limitu. Pełny dyspozytor = **zaraz po cutoverze** (lub wcześniej, jeśli czas).

**Blokada wdrożenia (stan 2026-08-25):**

| # | Temat | Status |
|---|---|---|
| 1 | Tabela klasyfikacji HOT/STANDARD/LOW | **DOMKNIĘTE** §4 |
| 2 | `MANAGER_EMAIL` | **DOMKNIĘTE** — `maciej@owocni.pl` |
| 3 | Lista Meta→Robert (Piotr) | **DOMKNIĘTE** §3.1 — 8 campaign_id |

---

## 0.1 Dla zespołu — 7 zdań

1. Lead pojawia się u Ciebie — system sam przydziela.  
2. Tyka **zegar**; bez reakcji lead idzie do drugiej osoby.  
3. Zanim piszesz/dzwonisz — kliknij **„Biorę”** (zegar failover staje).  
4. „Biorę” ≠ kontakt — to deklaracja; bez kontaktu i tak może pójść alert do Macieja.  
5. Po first contact (mail / stage poza NEW / odrzuć) lead jest Twój — nie wraca do pętli.  
6. Zegar tylko **pn–pt 8:00–18:00** (+ święta jak weekend).  
7. Max **3** leady bez kontaktu (także z „Biorę”); na urlopie nic nie dostajesz.

---

## 1. Decyzje zamknięte

| # | Temat | Decyzja | Zastępuje w v1.3 |
|---|---|---|---|
| 1 | Model | **Dyspozytor** — twardy przydział | primary + mini-shark |
| 2 | Claim / rezerwacja | **Wycięte** | § claim/TTL 3 min |
| 3 | „Biorę” | `bizAckAt` — wyłącza **failover**; eskalacja dalej liczy | rezerwacja |
| 4 | First contact | Mail OUT **lub** stage poza NEW → `bizFirstAttemptAt` | osobny log telefonu |
| 5 | Klasy | HOT / STANDARD / LOW — tylko zegary, **bez slotów** | limity 1/2/3 |
| 6 | Default class | Brak formularza → **STANDARD** | — |
| 7 | Failover | Neutralny — licznik na leadzie, nie kara człowieka | „niewykonanie” |
| 8 | „Rozmowa trwa” | Wycięte z v1 — chroni „Biorę” | §3A |
| 9 | Overflow wsparcie | Wycięte — mail do managera | §8 OPEN |
| 10 | Okno | pn–pt 8–18; **kontynuacja minut roboczych** (nie reset po weekendzie) | „od zera w poniedziałek” (odrzucone) |
| 11 | Alerty handlowca v1 | Brak SMS — widok Opp; architektura SMS-ready | „możliwość przejęcia” |
| 12 | Eskalacja manager | Mail do **Macieja** (`maciej@owocni.pl`) | — |
| 13 | Wykonawca | **Worker GCP** + sweep; Twenty = stan + UI + 1 przycisk | WF v7/v12 jako assign |
| 14 | TTL metryka | `bizFirstAttemptAt` (mail lub MANUAL/telefon); M2 mail-only = pomocnicza | — |
| 15 | Continuity | **Tylko wspólny email lub telefon**; reszta = nowy + ręczne scalanie | szerokie „strategiczne” |
| 16 | Limit 3 a „Biorę” | Lead z Ack **bez** first contact **liczy się** do MAX_OPEN | — |
| 17 | Meta | Lista Piotra §3.1 → `RULE-META-R01`; spoza listy → pula | — |
| 18 | Cold | = **LOW** (`LOW_INTENT`) | — |

---

## 2. Przebieg leada (kanoniczny)

```
Lead wchodzi (Opportunity NEW)
  ├─ 1. CONTINUITY: ten sam email LUB telefon → dotychczasowy owner. KONIEC.
  ├─ 2. KLASYFIKACJA: §4 → bizLeadIntentClass (+ zapis czasu na stronie jeśli jest)
  ├─ 3. ROUTING: §3 → hard-route albo pula DEFAULT
  ├─ 4. WYBÓR Z PULI: vacation=false, inClaimPool=true, poniżej MAX_OPEN
  │     → least-loaded (najmniej bez first contact); remis → dawniej dostała
  │     └─ nikt dostępny → bez ownera + mail managerowi
  └─ 5. PRZYDZIAŁ: ownerId + bizAssignedAt + bizRoutingRule. v1: bez SMS.

SWEEP (GCP, co 5 min, tylko w WORK_WINDOW, z wyłączeniem świąt):
  ├─ brak Ack i brak firstAttempt przez FAILOVER(klasa) min roboczych
  │     → druga osoba w puli (jeśli dostępna), failoverCount+1, assignedAt=now
  │     → jeśli druga niedostępna (limit/urlop) → zostaje + mail managerowi
  ├─ brak firstAttempt przez ESCALATE(klasa) (Ack obojętny)
  │     → mail managerowi, bizManagerAlertedAt (raz)
  └─ bez ownera > UNASSIGNED_ALERT → mail managerowi

WYJŚCIE Z PĘTLI (zegary OFF na zawsze):
  • bizFirstAttemptAt (mail OUT lub stage ≠ NEW)
  • campaignRejected = true („Odrzuć leada”)
```

### Tabela przejść

| Stan | Zdarzenie | Efekt |
|---|---|---|
| bez ownera | przydział | owner + `bizAssignedAt` |
| bez ownera > UNASSIGNED_ALERT | sweep | mail → Maciej |
| przydzielony, bez Ack, bez kontaktu | „Biorę” | `bizAckAt` — failover OFF; eskalacja ON |
| j.w., minęło FAILOVER | sweep | owner→druga / lub zostaje + mail jeśli druga pełna |
| przydzielony (Ack OK), bez kontaktu, ESCALATE | sweep | mail → Maciej |
| dowolny | mail OUT / stage poza NEW | `bizFirstAttemptAt` + kanał — pętla OFF |
| dowolny | Odrzuć leada | `campaignRejected` — pętla OFF |
| dowolny | ręczna zmiana ownera | respektuj; `bizAssignedAt` = teraz |
| przydzielony | urlop ownera | leady **bez** first contact → failover; z kontaktem zostają |

---

## 3. Reguły routingu (dane, nie kod)

Pierwszy pasujący wygrywa. `bizRoutingRule` = ID reguły (TEXT). Nazwiska tylko w kolumnie celu.

| ID | Priorytet | Warunek | Akcja | Cel |
|---|---|---|---|---|
| `RULE-CONTINUITY` | 0 | ten sam **email** lub **telefon** → znany owner | ASSIGN_OWNER | dotychczasowy owner |
| `RULE-META-INTERIM` | 10 | `bizSource=FACEBOOK` — **tylko gdy pusta lista kampanii** (kill-switch) | ASSIGN_MEMBER | Robert |
| `RULE-META-R01` | 10 | Meta z kampanii Roberta (lista Piotra, `campaign_id`) — §3.1 | ASSIGN_MEMBER | Robert |
| `RULE-MKTG-01` | 20 | produkt = marketing / strategia (**nie** Meta — Meta tylko R01) | ASSIGN_MEMBER | Robert |
| `RULE-COPY-01` | 30 | produkt = copywriting | ASSIGN_MEMBER | Maciej |
| `RULE-MAILBOX-*` | 40 | mail na skrzynkę imienną | ASSIGN_MEMBER | właściciel skrzynki |
| `RULE-POOL-DEFAULT` | 99 | reszta (formularz, `leads@`, `studio@`, **Meta spoza listy Piotra**) | ASSIGN_POOL | Marta, Gosia |

- Ewa: `bizInClaimPool=false` — tylko ręcznie.  
- Lista Piotra **aktywna** (2026-08-25): env `LEAD_DISPATCH_META_ROBERT_IDS` = §3.1 → **wyłączony** interim; Meta spoza listy → pula (strony/logo itd.).  
- Zmiana kampanii = edycja §3.1 / env — nie przebudowa kodu.

**Konflikt przykład:** stały klient Marty + copy → **RULE-CONTINUITY (Marta)** wygrywa z COPY.

### 3.1 Lista kampanii Meta → Robert (Piotr, 2026-08-25)

Marketing / strategia. Match: `campaign_id` z Graph (przez `ad_id`). Env: `LEAD_DISPATCH_META_ROBERT_IDS` (CSV).

| campaign_id |
|---|
| `120250072847080433` |
| `120250072846850433` |
| `120250072722520433` |
| `120250072471360433` |
| `120250072471350433` |
| `120250072471300433` |
| `120250068162040433` |
| `120245791885450433` |

**Cała reszta kampanii Meta** = inne produkty (strony, logo, …) → `RULE-POOL-DEFAULT` (Marta/Gosia), ewentualnie COPY jeśli produkt = copywriting.

---

## 4. Klasyfikacja HOT / STANDARD / LOW

Worker przy wejściu, raz, deterministycznie. **AND** w wierszu. Pierwszy pasujący wygrywa.  
**Cold (język biznesu) = LOW** (`LOW_INTENT`).

| # | Warunek | Klasa |
|---|---|---|
| 1 | Strony **oraz** redesign **oraz** premium **oraz** czas na stronie **> 6 min** | **HOT** |
| 2a | Strony, ale nie cały wiersz 1 | **STANDARD** |
| 2b | Inny produkt **oraz** właściciel firmy **oraz** premium **oraz** **> 6 min** | **STANDARD** |
| 3 | Pozostałe produkty / reszta z formularza | **LOW** |
| 99 | Brak danych formularza (goły mail) | **STANDARD** |

| Warunek | Dane |
|---|---|
| Strony | `bizProduct` = WEB / strony |
| Redesign | `bizProjectType` = `REDESIGN` |
| Premium | `bizIntent`=EKSPERT / `*_jaka=premium` |
| Właściciel firmy | `bizContactRole` = `OWNER` (form `recipient` — **nie** Opportunity owner) |
| > 6 min | `ctx_time_on_page_ms` > 360000 → zapisać też na Opp (`bizTimeOnPageMs`) |

**Brak czasu na stronie** (mail bezpośredni, Meta, brak sygnału): nie HOT, nie 2b; default **STANDARD** (lub LOW jeśli widać „pozostały produkt” bez sygnałów — przy braku danych: STANDARD).

---

## 5. Parametry (jedyne miejsce z liczbami)

| Parametr | Wartość | Uwagi |
|---|---|---|
| `FAILOVER_HOT` | **15 min** roboczych | |
| `FAILOVER_STANDARD` | **30 min** roboczych | |
| `FAILOVER_LOW` | **2 h** robocze | |
| `ESCALATE_HOT` | **1 h** robocza | także po „Biorę” |
| `ESCALATE_STANDARD` | **2 h** robocze | |
| `ESCALATE_LOW` | **4 h** robocze | |
| `MANAGER_EMAIL` | **maciej@owocni.pl** | Maciej Wysocki |
| `WORK_WINDOW` | pn–pt 8:00–18:00 | + święta z listy = poza oknem |
| `MAX_OPEN` | **3** bez first contact / osobę | **w tym** z `bizAckAt` bez kontaktu; obie na limicie → bez ownera + mail |
| `UNASSIGNED_ALERT` | 30 min roboczych | |
| `SWEEP_INTERVAL` | 5 min | Cloud Scheduler |
| `DEFAULT_CLASS` | STANDARD | |
| `NOTIFY_CHANNELS` | `[]` → później `[SMS]` | |
| `TIME_ON_PAGE_HOT_MS` | 360000 | 6 min |

Czas roboczy = wyłącznie w `WORK_WINDOW` minus święta. Przykład: pt 17:50 → +10 min; pn 8:00 kontynuacja (HOT: zostaje 5 min), **nie** reset do 15.

---

## 6. Gesty handlowca

| Gest | Mechanizm | Efekt |
|---|---|---|
| **„Biorę”** | manual WF → `bizAckAt` | failover OFF; eskalacja ON |
| Mail wychodzący | M2 / worker → `bizFirstAttemptAt` + EMAIL | pętla OFF |
| Stage poza NEW | webhook → `bizFirstAttemptAt` + MANUAL | pętla OFF (telefon bez nowego UI) |
| Odrzuć leada | `campaignRejected` | pętla OFF |
| Urlop | `bizVacationOn` | poza pulą; bezkontakowe odpływają |

---

## 7. Powiadomienia

- **v1 handlowiec:** brak SMS — widok „Moje nowe” po `bizAssignedAt`.  
- **v1 manager:** mail na `MANAGER_EMAIL` (eskalacje, unassigned, failover zablokowany limitem).  
- **Docelowo:** SMS 8–16 przy przydziale/failoverze (hook `notify` w workerze).  
- Świadomie: bez SMS HOT 15 min może padać na failover „bo nikt nie patrzył” — akceptowalne (failover neutralny).

---

## 8. Wykonanie i granice

| Element | Właściciel |
|---|---|
| Klasyfikacja + routing + przydział | Worker GCP |
| Sweep | Worker GCP + Scheduler |
| Stan | Pola Opp / capacity w Twenty |
| „Biorę” | 1 manual workflow |
| Mail manager / SMS | Worker GCP |

**Jedna ścieżka assignu:** przy go-live dyspozytora createLead **nie** może równolegle losować ownera „na boku”. Albo dyspozytor jest jedynym SSOT reguł, albo createLead woła tę samą funkcję routingu. Idempotencja: nie „skip jeśli ownerId jest” w sposób, który zostawia stary hash bez `bizAssignedAt` / klasy.

Przy wdrożeniu: wyłączyć assign z WF v7/v12 (zostaje co najwyżej powiadomienie do czasu SMS) albo zastąpić je workerem.

**Governance przy wdrożeniu:**
- boundary matrix `ARCHITECTURE.md`
- kontrakt `workflows/lead-dispatch.contract.md`
- pola §9 → `DATA_MODEL.md` (zastąpić „Lead claim — planowane”)
- ADR v1.3 → v2.0 w `DECISION_REGISTER.md`

---

## 9. Pola (CRM-only — NIGDY do payloadów reklamowych)

### Opportunity

| Pole | Typ | Kto | Po co |
|---|---|---|---|
| `bizLeadIntentClass` | SELECT HOT_FIT / STANDARD / LOW_INTENT | worker | zegary |
| `bizAssignedAt` | DATETIME | worker | start failover |
| `bizAckAt` | DATETIME | „Biorę” | stop failover |
| `bizFirstAttemptAt` | DATETIME | M2 / stage hook | wyjście z pętli; **metryka TTL** |
| `bizFirstAttemptChannel` | EMAIL / MANUAL | j.w. | audyt |
| `bizFailoverCount` | NUMBER | sweep | kalibracja |
| `bizManagerAlertedAt` | DATETIME | sweep | eskalacja raz |
| `bizRoutingRule` | TEXT | worker | audyt reguły |
| `bizTimeOnPageMs` | NUMBER | create_lead | próg >6 min (surowy ms) |

### Osoba / SalesCapacity

| Pole | Typ | Po co |
|---|---|---|
| `bizVacationOn` | BOOLEAN | urlop |
| `bizInClaimPool` | BOOLEAN | Marta/Gosia true; Ewa false |

**Nie tworzyć** (v1.3 claim): reservation_*, claim state, rep availability, sloty per klasa, lastQualifiedAssignAt (fairness z COUNT + `bizAssignedAt`).

---

## 10. Święta

- Jak weekend: zegar stój.  
- [ ] Wstępna lista PL ~12 mies. + podgląd w ustawieniach Twenty/CRM.  
- [ ] Owner aktualizacji listy na kolejny rok.

---

## 11. Cutover vs dyspozytor

| Warstwa | Co |
|---|---|
| **Dziś / D1** | Hash Marta/Gosia, COPY→Maciej, FB→Robert; **15 min = cel**, nie automat |
| **Po cutoverze** | Pełny ten dokument (pola → worker → sweep → „Biorę” → maile do Macieja) |
| **Później** | Lista Meta Piotra; SMS; lista świąt w UI |

---

## 12. Czego NIE budujemy w v1

| Wycięte | Cena |
|---|---|
| Claim / blind claim | System dyktuje ownera; ręczne przepisanie OK |
| „Rozmowa trwa” | Chroni „Biorę”; bez klika możliwy failover w trakcie rozmowy |
| Sloty per klasa | Priorytet robią zegary |
| Overflow „wsparcie” | Decyduje Maciej po mailu |
| SMS v1 | Failover „bo nie patrzył” do czasu bramki |

**Tripwire powrotu złożoności:** pula ≥4; stale >3 open; telefonia auto; custom appki Twenty; zmiana Meta musi być edycją §3.

---

## 13. Otwarte / TODO (nie blokują startu kodu klas+zegar+Biorę)

| Co | Kto | Blokuje? | Status |
|---|---|---|---|
| Lista form/kampanii Meta → Robert | Piotr / Mariusz | **Nie** | **DOMKNIĘTE** §3.1 (2026-08-25) |
| Lista świąt + UI | Operacje / Dawid | Nie | TODO |
| `bizTimeOnPageMs` na Opp | Dawid | Tech — tak dla HOT | część wdrożenia |
| WM vs SalesCapacity | Dawid | Nie | preflight |
| `metaFormId` jeśli lista po form_id | Dawid | Nie | **N/A** — lista = campaign_id |

---

## 14. Checklist wdrożenia (kolejność)

**One-shot (RETIRED):** `./integrations/tools/start_lead_dispatcher.sh retire` — nie `go`.

1. Pola §9 w Twenty + `DATA_MODEL`  
2. Klasyfikacja §4 w workerze (+ `bizTimeOnPageMs`)  
3. Routing §3 jako **jedyna** funkcja assignu (continuity email/telefon, interim Meta, least-loaded, MAX_OPEN)  
4. Urlop + pool flags  
5. Przycisk „Biorę” → `bizAckAt`  
6. Sweep: failover / escalate → `maciej@` / unassigned  
7. First attempt: mail + stage hook  
8. Wyłączyć sprzeczny assign w WF v7/v12  
9. Kontrakt + ADR + boundary  
10. Później: lista Meta Piotra, SMS, święta UI  

---

## 15. Słownik

| Termin | Znaczenie |
|---|---|
| Nieobsłużony | Bez `bizFirstAttemptAt` (także z „Biorę”) |
| „Biorę” | Ack — stop failover, nie kontakt |
| First contact | Mail OUT lub stage ≠ NEW lub odrzucenie |
| Minuty robocze | W WORK_WINDOW, bez weekendów/świąt |
| LOW | Cold |

---

## 16. Historia

| Data | Decyzja |
|---|---|
| 2026-08-12 | v2.0 dyspozytor (Red Team × właściciel) |
| 2026-08-20 | Cutover: D1 = stary assign; 15 min = cel do dyspozytora |
| 2026-08-25 | Klasy AND; manager Maciej; Meta lista później (interim cały FB→Robert); continuity email/telefon; Biorę w limicie 3; zegar = kontynuacja minut roboczych |
| 2026-08-25 | **Scalenie** draftu v2.0 + decyzji → ten plik = SSOT |
| 2026-08-25 | Lista Piotra: 8× campaign_id marketing/strategia → Robert; reszta Meta → pula |
