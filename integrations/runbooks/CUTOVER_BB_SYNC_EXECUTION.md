---
doc_id: CUTOVER_BB_SYNC_EXECUTION
title: "Cutover BB → Twenty — wykonanie (pt apply / pn delta)"
layer: runbook
status: active
owner: "Dawid"
audience: "Dawid + Mariusz + Marta / Gosia / Maciej"
last_verified: 2026-08-28
related:
  - CUTOVER_BB_SYNC_DECISION.md
  - G_PAR_BETTER_BITRIX_PARITY.md
  - PIPEDRIVE_IMPORT_GATE.md
  - CUTOVER_1ON1_CHECKPOINT_SHEET.md
source: "https://crm.owocni.pl/lead"
---

# Cutover BB → Twenty — plan wykonania

**Decyzja:** Opcja B (sync ~229 / 30d) · **apply w piątek** · **delta w poniedziałek przed 8:00** · BB read-only min. 1 miesiąc.

**Cel:** problemy w piątek (zespół może reagować), nie w poniedziałek pod stertą maili z weekendu.

**Narzędzie:** `integrations/tools/sync_bb_to_twenty.py`  
**Run ID (przykład):** `20260828T140000Z` → katalog `integrations/runbooks/exports/bb_sync/runs/{run_id}/`

---

## Harmonogram

| Kiedy | Co |
|---|---|
| **Pt rano (Dawid)** | `export` → `plan` → przegląd `review_list.json` + `plan.csv` |
| **Pt przed południem** | Domknięcie review (ręczne decyzje dla ambiguous) · gate workflow OFF + `no_emit` |
| **Pt po południu** | `apply` · sesje solo Marta/Gosia/Maciej · smoke maile · **bramki poniżej** |
| **Pt wieczór** | Rollback plan zapisany · komunikat zespołowi: BB tylko odczyt od pn |
| **Pn przed 8:00** | `delta` (BB zmiany pt–nd, **bez** nadpisywania edycji Twenty po apply) |
| **Pn 8:00+** | Praca tylko w Twenty · BB read-only |

---

## Komendy

```bash
cd owocni-crm-github
RUN=20260828T140000Z

# 1. Export z BB (30d, Marta/Gosia/Maciej, bez service/won/lost)
python3 integrations/tools/sync_bb_to_twenty.py export --run "$RUN"

# 2. Plan + review list + CSV
python3 integrations/tools/sync_bb_to_twenty.py plan --run "$RUN"

# 3. Apply (po akceptacji planu i review)
python3 integrations/tools/sync_bb_to_twenty.py apply --run "$RUN"

# 4. Poniedziałek rano — delta
python3 integrations/tools/sync_bb_to_twenty.py delta --run "$RUN"

# Rollback (gdyby pn coś nie grało)
python3 integrations/tools/sync_bb_to_twenty.py rollback --run "$RUN"
```

Wymaga: `.env.local` (Twenty) + `better-bitrix-main/.env` (Supabase).

Przed apply: jak Pipedrive — **workflow OFF** + inbound `SKIP_LEGACY_IMPORT` + wpis OPS `no_emit=TAK` ([PIPEDRIVE_IMPORT_GATE.md](./PIPEDRIVE_IMPORT_GATE.md)).

---

## Bramki — piątek po południu (must PASS przed „go” na poniedziałek)

### G1 — Widoczność i solo workflow (Marta, Gosia, Maciej)

Dawid **obserwuje** (nie pyta „czy dasz radę”):

| Osoba | Test solo | PASS gdy |
|---|---|---|
| Marta | Otwórz widok „moje” → znajdź 3 aktywne sprawy z BB → drag etap → odpowiedz mail Owocni Mail | Bez pomocy Dawida |
| Gosia | j.w. | j.w. |
| Maciej | j.w. + Sent jeśli dotyczy | j.w. |

Evidence: notatka w run folderze `friday_solo_evidence.md` (opp ID + co zrobili).

### G2 — Zgodność z BB (owner + etap)

| Kryterium | PASS |
|---|---|
| Każdy rekord z `apply` (poza `review_list`) ma ten sam **owner** co BB | ☐ |
| Każdy ma ten sam **etap** (mapa G-PAR) co BB w momencie apply | ☐ |
| `review_list.json` **pusta po ręcznym domknięciu** lub każdy wpis ma decyzję | ☐ |

### G3 — Maile i duplikaty (PAR-4 + merge-safety)

| Test | PASS |
|---|---|
| **Powracający klient** (email już w Twenty po sync): testowy mail → **link do istniejącej** Opp, **brak** drugiej karty | ☐ |
| **Nowy nadawca** na `leads@`: tworzy **jedną** Opp + owner sensowny | ☐ |
| **Formularz Sortownia**: jedna Opp, nazwa `email · produkt · …` | ☐ |
| Brak auto-merge (G8): tylko propozycja scalenia, nigdy silent merge | ☐ |

### G4 — PAR + G8

| | PASS |
|---|---|
| G-PAR macierz — brak regresu krytycznego (maile, SQL, WON, routing) | ☐ |
| G8 merge-safety — znane zachowanie webhooka przy ręcznym Scal | ☐ |

### G5 — Rollback

| | PASS |
|---|---|
| `apply_manifest.json` kompletny | ☐ |
| `rollback --run` przetestowany na **1 rekordzie testowym** (apply --limit 1 wcześniej) | ☐ |
| Wiadomo kto odpala rollback w pn (Dawid) | ☐ |

**Go / no-go na poniedziałek:** wszystkie G1–G5 ☐ → komunikat „pn tylko Twenty”.

---

## Poniedziałek przed 8:00 — delta

**Reguły:**

1. Tylko leady BB z `last_modified_at` **po** `applyStartedAt` z manifestu.
2. Jeśli handlowiec **zmienił etap lub owner w Twenty po apply** → **nie nadpisuj** (`skipped_twenty_user_edit`).
3. Jeśli ktoś ruszył kartę **tylko w BB** w pt–nd → delta PATCH stage/owner.
4. Nowe leady BB po apply → create/patch jak w planie.

```bash
python3 integrations/tools/sync_bb_to_twenty.py delta --run "$RUN"
```

Evidence: `delta_manifest.json`.

---

## Analytics: sandbox → prod (Twenty) / prod → sandbox (BB)

**Twenty CRM ≠ analytics env.** Workspace Twenty jest prod od dawna; **eventy z Twenty idą dziś w `environment=sandbox`** → Robot zapisuje tylko do arkusza debug, **bez Meta / Google Ads** (`envGuard.js`, `TWENTY_PATHS.md` §5).

### Piątek (przed spotkaniem z Piotrem) — Twenty na prod

| # | Gdzie | Co zmienić | Efekt |
|---|---|---|---|
| 1 | **Stape** `INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js` **oraz** `INBOUND_TWENTY_WEBHOOK.gcp-stub.sGTM.js` | Client: `runtime_environment: "prod"`; stub: forward z `X-Owocni-Runtime: env` (bez starego skip prod) + **publish** | SQL/WON z Twenty → Meta/Google |
| 2 | **GCP** `twenty-inbound-webhook-sandbox` | redeploy z **`RUNTIME_ENVIRONMENT=prod`** | task_queue z prod env |
| 3 | **GCP** `meta-lead-webhook` (FB→Twenty) | opcjonalnie **`RUNTIME_ENVIRONMENT=prod`** | leady Meta liczą się prod |
| 4 | **Smoke** | drag → QUALIFIED / WON testowy lead | task_queue `environment=prod`; Robot **nie** loguje SKIP sandbox |

```bash
cd integrations/cloud-functions/twenty-inbound-webhook
RUNTIME_ENVIRONMENT=prod bash deploy.sh
```

**Nie ruszamy dziś:** wyłączenie julia362, BB read-only (to pn).

**Ryzyko pt–nd:** BB nadal może emitować eventy **prod** (patrz pn) — jeśli ktoś ruszy kartę w BB i w Twenty, możliwy **double count**. Od pn praca tylko w Twenty minimalizuje to.

### Poniedziałek — stary CRM (BB) na sandbox

BB `/api/analytics/lead` **nie wysyła** pola `environment` → Robot domyślnie traktuje jako **prod**.

| # | Akcja |
|---|---|
| 1 | W payloadzie BB dodać **`environment: "sandbox"`** (lub `runtime_environment`) |
| 2 | Deploy BB → wtedy SQL/WON z BB = tylko arkusz debug, **bez Meta/Google** |
| 3 | julia362 / `leads@` → BB — osobna decyzja (wyłączenie zapisu); analytics BB = sandbox |

**Cel pn:** SoR sprzedaży = Twenty (prod analytics) · BB `/lead` = archiwum + sandbox analytics · **BB `/helpdesk` = nadal aktywny SoR obsługi**.

---

## BB po cutoverze

| Obszar BB | Od pn 8:00 | Uwagi |
|---|---|---|
| **`/helpdesk`** | **Aktywny** — normalna obsługa zgłoszeń, tickety, maile helpdesk | **Nie** traktować jako read-only |
| **`/lead` (sprzedaż)** | Archiwum + podgląd starych wątków ≥1 miesiąc | Nowa praca sprzedażowa w **Twenty** |
| **Analytics `/api/analytics/lead`** | `environment: sandbox` (cutover 2026-08-31) | SQL/WON z BB `/lead` nie idzie do Meta/Google |
| **julia362 / nowe leady do BB** | Osobna decyzja | Nie blokować helpdesku |

- Zespół wie: **sprzedaż = Twenty** od pn 8:00; **helpdesk = BB** bez zmian.

---

## Pliki w run folderze

| Plik | Zawartość |
|---|---|
| `bb_leads.json` | export z BB |
| `plan.csv` | pełny plan (patch/create/review) |
| `plan_summary.json` | liczniki |
| `review_list.json` | do ręcznego domknięcia przed apply |
| `apply_manifest.json` | apply + rollback |
| `delta_manifest.json` | poniedziałek rano |
| `friday_solo_evidence.md` | dowód solo workflow (ręcznie) |

---

## Eskalacja

| Sytuacja | Akcja |
|---|---|
| Duplikat Opp po teście maila | STOP apply · merge ręczny · fix match |
| >10% review_list bez decyzji | nie apply reszty · sesja z Dawidem |
| Pn: coś nie gra | `rollback` → BB master tymczasowo · post-mortem |
