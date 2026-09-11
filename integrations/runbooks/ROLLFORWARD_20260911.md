---
doc_id: ROLLFORWARD_20260911
title: "Wieczór 11 IX 2026 — Twenty z powrotem prod, BB sandbox"
layer: runbook
status: executed_20260911
owner: "Dawid"
audience: "wykonawca (Composer) + Dawid + Piotr (Ads)"
last_verified: 2026-09-11
related:
  - ADS_SQL_SIGNAL_ROLLBACK.md
  - SAMPLE_WEEK_BB_TWENTY.md
  - WEEKEND_CDELTA_MAIL_IMPORT.md
  - CUTOVER_BB_SYNC_EXECUTION.md
  - PIPEDRIVE_IMPORT_GATE.md
source: "decyzja Dawid 11.09 — sprzedaż wraca do Twenty; Google znów z Twenty"
---

# Wieczór 11 IX — roll-forward Twenty = produkcja

**Start tylko po jawnym GO od Dawida.** Do tego momentu: zero deployów, zero apply, zero zmiany env.

**Cel:** Twenty znowu SoR sprzedaży i sygnałów Ads (zwłaszcza **Google**). Better-Bitrix `/lead` wraca na sandbox. Meta Instant Form już idzie na prod furtką — po tym playbooku furtka schodzi, bo cały inbound Twenty jest prod.

**Nie robimy:** replay SQL/WON z tego tygodnia na Google (BB już je wysyłał → double-count). Helpdesk BB bez zmian. Roberta nie ruszamy.

**Kolejność bezwzględna:** dane (maile + etapy/ownerzy) przy Twenty **sandbox** → dopiero potem Ads. Odwrotna kolejność = `qualify_lead`/`purchase` z PATCH-y na Google.

```
A  Preflight (odczyt)
B  Maile C-Δ ten tydzień
C  Restore parku 4 IX
D  Sync etap + owner z BB (patch only, no_emit)
E  Sample-week OFF
F  BB analytics → sandbox + deploy
G  Twenty inbound → prod + Stape + furtka Meta OFF
H  Smoke + OPS + komunikat
```

Jeśli czas się kończy: **D + F + G ważniejsze niż pełny B**. Resztę maili można dokończyć w sobotę (maile nie emitują Ads).

---

## Stałe wieczoru

| | |
|---|---|
| Katalog | `owocni-crm-github` |
| Run sync | `20260911T180000Z` |
| Maile od | `2026-09-06T07:21:00Z` (koniec fali weekendowej) |
| Manifest maili | `integrations/runbooks/exports/bb_sync/cdelta_week_20260911/` |
| Park | `restore --run 20260904T042844Z` |
| Ownerzy BB | 257 Gosia · 259 Marta · 79 Maciej |
| Holding | `owocni@gmail.com` / `2d65d0e6-…` |

Mapa etapów (`BB_TO_TWENTY_STAGE` w `sync_bb_to_twenty.py`):

| BB | Twenty |
|---|---|
| `unsorted` `to_call` `error` | `NEW` |
| `inquiry` `reminder` `indifferent` `excited` `blackday` | `CONTACTED` |
| `negotiations` `analysis` `call_after_offer` `cold` `hot` | `PROPOSAL` |
| `pays` | `PAYING` |
| `lead_won` | `WON` |
| `lead_lost` | `LOST` |

W BB nie ma `QUALIFIED` / `CONTRACT_SENT`. BB wygrywa: SQL w Twenty + `inquiry` w BB → `CONTACTED`.

---

## STOP natychmiast

- BB i Twenty **oba** na `prod` (nawet minutę)
- nowa Opportunity albo nowa Person przy imporcie maili
- 429 / pager formularza
- apply etapów przy `RUNTIME_ENVIRONMENT=prod`
- replay SQL z tego tygodnia na Google
- restore parku **po** apply BB (nadpisze ownerów z BB stanem z 4 IX)

---

## A — Preflight (nic nie zapisujemy)

- [ ] A1. Inbound Cloud Run = `sandbox`

```bash
gcloud run services describe twenty-inbound-webhook-sandbox \
  --project=owocni-robot --region=europe-central2 \
  --format='yaml(spec.template.spec.containers[0].env)'
```

Szukaj `RUNTIME_ENVIRONMENT: sandbox`. Jeśli już `prod` → **STOP**, nie ruszaj etapów.

- [ ] A2. Worker: `LEAD_SAMPLE_WEEK_ENABLED` nadal true (do kroku E).
- [ ] A3. Robot: `META_INSTA_FORM_CAPI_FROM_SANDBOX=true` (do kroku G).
- [ ] A4. Sitko maili: auto-create **off** na marta/gosia/copywriting; webhook OUT **bez** `message.*`.
- [ ] A5. Nikogo nie informować „już Twenty”, dopóki H nie PASS.

---

## B — Maile: odpowiedzi z BB z tego tygodnia

Sitko jak weekend (`WEEKEND_CDELTA_MAIL_IMPORT.md`). Tylko C-Δ same-mailbox. Folder IMAP: `BB Archive`.

Kolejność skrzynek: `copywriting@` → `gosia@` → `marta@`. `mariusz@` tylko jeśli discover ma `eligible > 0`.

**Discover** (jedna skrzynka):

```bash
cd "/Volumes/Samsung_T5/owocni/owocni strona i bitrix/owocni-crm-github"
SINCE=2026-09-06T07:21:00Z
OUT=integrations/runbooks/exports/bb_sync/cdelta_week_20260911

python3 integrations/tools/bb_mail_cdelta_append.py discover \
  --mailbox copywriting@owocni.pl \
  --since "$SINCE" \
  --bb-limit 400 \
  --out "$OUT/discover_copywriting.json"
```

To samo: `gosia@owocni.pl`, `marta@owocni.pl`.

- [ ] B1. Discover 3 skrzynek. Zapisać `eligible` w notatce wieczoru.
- [ ] B2. Jeśli `eligible = 0` na wszystkich → B SKIP (nie FAIL), iść do C.
- [ ] B3. Apply paki **25**, jedna skrzynka, `--yes`:

```bash
python3 integrations/tools/bb_mail_cdelta_append.py apply \
  --mailbox copywriting@owocni.pl \
  --since "$SINCE" \
  --limit 25 \
  --bb-limit 400 \
  --folder "BB Archive" \
  --manifest-dir "$OUT" \
  --yes
```

Po pace: **10 min**. Check 2 Message-ID: ten sam wątek, `receivedAt` z BB, `OUTGOING`, zero nowych kart.

- [ ] B4. 429 → 15 min, potem `--limit 10` albo koniec B, dalej C.
- [ ] B5. Nowa karta/osoba → **STOP B**, nie kasować `BB Archive`.

---

## C — Park 4 IX z powrotem na Marty/Gosię/Maćka

**Przed** apply BB. Przywraca ownerów z 4 IX; krok D nadpisze je aktualnymi z BB.

```bash
python3 integrations/tools/park_sample_week_owners.py restore --run 20260904T042844Z
```

- [ ] C1. Restore PASS (557 plan, błędy = 0 albo notatka).
- [ ] C2. Karty sample-week na holdingu **spoza** tego manifesta (nowe z limitu 2/dzień) zostają na `owocni@gmail.com` — nie ruszamy hurtem.

---

## D — Etap + owner z BB (Twenty nadal sandbox)

Nie używać `delta` z runu `20260828T120000Z` (park = `skipped_twenty_user_edit`). Nowy run. **Tylko patch** — bez create.

Opcjonalnie na czas apply: workflow OFF (`pipedrive_workflow_gate.py --apply-off`) — Track Stage Time / SQL→Stape. Po D: `--apply-on`. Inbound i tak sandbox = Ads bezpieczne.

```bash
RUN=20260911T180000Z

python3 integrations/tools/sync_bb_to_twenty.py export \
  --run "$RUN" --days 30 --include-closed

python3 integrations/tools/sync_bb_to_twenty.py plan --run "$RUN"
```

- [ ] D1. Przegląd `plan_summary.json` + `review_list.json`. Review bez decyzji → nie apply tych wierszy.
- [ ] D2. Create w planie **zostawiamy** (ryzyko duplikatu z formularza). Wieczór = patch.
- [ ] D3. Apply:

```bash
python3 integrations/tools/sync_bb_to_twenty.py apply \
  --run "$RUN" --actions patch
```

- [ ] D4. Spot-check 2 karty / osobę: owner = BB, etap = mapa.
- [ ] D5. WON/LOST z BB z tego tygodnia są na `WON`/`LOST` w Twenty.
- [ ] D6. Workflowy z powrotem ON, jeśli były OFF.

Rollback danych (nie Ads): `python3 integrations/tools/sync_bb_to_twenty.py rollback --run "$RUN"`.

---

## E — Koniec sample-week

W `integrations/cloud-functions/twenty-crm-worker/.env.deploy`:

`LEAD_SAMPLE_WEEK_ENABLED=false`

Potem **albo** pełny deploy workera, **albo** samo env:

```bash
gcloud run services update twenty-crm-worker-sandbox \
  --project=owocni-robot --region=europe-central2 \
  --update-env-vars LEAD_SAMPLE_WEEK_ENABLED=false
```

- [ ] E1. Env live = false (describe).
- [ ] E2. Lokalny `.env.deploy` też false, żeby następny deploy nie włączył limitu.

---

## F — BB na sandbox (Ads)

**Zanim** Twenty na prod.

1. `better-bitrix-main/app/api/analytics/lead/route.ts`: `environment` i `runtime_environment` → `"sandbox"`. Komentarz: roll-forward 2026-09-11.
2. Deploy `crm.owocni.pl` (dotychczasowy pipeline).
3. Smoke: SQL na karcie testowej w BB `/lead` → Robot SKIP sandbox / arkusz sandbox. **Piotr: Google nie dostaje tego SQL.**

- [ ] F1. Kod zmieniony.
- [ ] F2. Deploy BB live.
- [ ] F3. Smoke BB PASS.

Bez F3 **nie** idziemy do G.

---

## G — Twenty na prod (Google znowu z kart)

1. Inbound — szybki update (bez pełnego deployu, o ile rewizja jest aktualna):

```bash
gcloud run services update twenty-inbound-webhook-sandbox \
  --project=owocni-robot --region=europe-central2 \
  --update-env-vars RUNTIME_ENVIRONMENT=prod
```

`.env.deploy` inbound: `RUNTIME_ENVIRONMENT=prod` (nie commitować).

2. Stape: `integrations/INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js` → `runtime_environment: "prod"` + **publish** kontenera.

3. Furtka Meta OFF:

```bash
gcloud run services update robot-task-monitor \
  --project=owocni-robot --region=europe-central2 \
  --update-env-vars META_INSTA_FORM_CAPI_FROM_SANDBOX=false
```

- [ ] G1. Describe inbound = `prod`.
- [ ] G2. Stape opublikowany.
- [ ] G3. Furtka `false`.
- [ ] G4. Smoke Twenty: testowe SQL → `task_queue environment=prod` → Piotr: konwersja w **Google Ads**. Meta: Insta Form nadal wpada (już zwykłą ścieżką prod, nie furtką).

PASS G4 = Google z Twenty żyje. FAIL → natychmiast rollback Ads (§ Odwrót), dane C/D zostawiamy.

---

## H — Domknięcie

- [ ] H1. Wiersz `owocni-crm/ops/OPS_NOTES.md` §5.3: Twenty prod / BB sandbox / sample-week OFF / furtka OFF / liczby maili i patch / `no_emit=TAK` na C–D.
- [ ] H2. Komunikat zespołu: sprzedaż od teraz w Twenty; BB `/lead` podgląd; helpdesk bez zmian.
- [ ] H3. Holding: ile kart nadal na `owocni@gmail.com` — notatka, rozdanie w poniedziałek jeśli trzeba, nie dziś hurtem.

---

## Odwrót (tylko Ads)

Jak `ADS_SQL_SIGNAL_ROLLBACK.md`: **najpierw** Twenty `RUNTIME_ENVIRONMENT=sandbox`, smoke że SQL Twenty nie idzie, **potem** BB z powrotem `"prod"` + deploy. Furtkę Meta można z powrotem `true`, jeśli Insta Form ma znowu iść przy sandbox Twenty.

Rollback **danych** (etapy/ownerzy): `sync_bb_to_twenty.py rollback --run 20260911T180000Z`. To nie cofa maili IMAP.

---

## Log startu (wypełnić przy GO)

| | |
|---|---|
| GO od | Dawid, 11.09 ~16:48 PL |
| Start (czas PL) | ~16:48 |
| Discover eligible (copy / gosia / marta) | 1 / 13 / 16 |
| Appended łącznie | 30 (1+13+16); Gosia 2 stitch_warn; 0 nowych kart |
| Patch apply ok / total | 78 patched + 117 unchanged / 195; create 33 pominięte |
| BB deploy | Vercel success `5eabd99` (sandbox) |
| Twenty inbound rev | `00017-n88` `RUNTIME_ENVIRONMENT=prod` |
| Smoke Google | czeka na Piotra |
| Uwagi | Furtka Meta `false` (`00072-2ds`). Sample-week OFF (`00075-bvj`). Stape Client w repo prod — publish ręcznie. Holding open ~101. |
