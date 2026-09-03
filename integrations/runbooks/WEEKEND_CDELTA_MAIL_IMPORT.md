---
doc_id: WEEKEND_CDELTA_MAIL_IMPORT
title: "Weekend 5–6 IX 2026 — C-Δ same-mailbox (BB Sent → IMAP → Twenty)"
layer: runbook
status: ready
owner: "Dawid"
audience: "Dawid"
last_verified: 2026-09-03
related:
  - BB_MAIL_IMPORT_RISKS_DECISION.md
  - BB_MAIL_IMAP_APPEND_RUNBOOK.md
  - PLAN_NAPRAWCZY_GATES.md
source: "Decyzja Dawid 3.09 · test na żywo pt 4.09 rano · większy C-Δ w weekend po PASS"
---

# Brakujące wysłane z BB: test w piątek rano, fala w weekend

**Lejek:** zero nowych kart. FAIL = nowa Opportunity albo nowa osoba → stop.  
**Okno:** **piątek 4.09 rano** = test na żywo (10 szt., `copywriting@`). **Sobota–niedziela** = większy C-Δ same-mailbox, **tylko jeśli test PASS**. Poniedziałek 7.09 QA na 2–3 istniejących sprawach.  
**Zakres:** tylko **C-Δ same-mailbox**. Nie C2, nie R-6, nie `leads@` / formularz, nie `studio@`.

R-6 zostaje celem. Ten weekend **udowadnia falę na żywych skrzynkach**, nie zamyka historii.

Narzędzie: `python3 integrations/tools/bb_mail_cdelta_append.py`  
Folder IMAP: **`BB Archive`** (nowa nazwa na marta/gosia/copywriting — nie odtwarzać skasowanego `Phase0` / `ThreadTest`).  
Manifest: `integrations/runbooks/exports/bb_sync/cdelta_weekend_20260905/`

---

## Sitko (bez tego nie APPEND)

| # | Warunek | Jak |
|---|---|---|
| S1 | Auto-create kontaktów **off** na ruszanych skrzynkach | Twenty → Settings → Accounts → każda skrzynka weekendowa |
| S2 | Webhook OUT **bez** `message.*` i bez `*.*` | Settings → Developers → Webhooks — spisać do `OPS_NOTES` datą 5.09 |
| S3 | Nigdy `leads@`, nigdy `studio@` | skrypt odrzuca |
| S4 | Parent w Twenty ma chip **tej** skrzynki (nie sam `LEADS`) | skrypt: `skip_other_channel` |
| S5 | Szczyt formularzy | **Piątek rano = tylko test 10 szt. na jednej skrzynce.** Discover nie na trzech naraz. Weekend: pełne paki. 429 → S6 |
| S6 | Stop przy **429** / pager formularza | 15 min przerwy, potem `--limit 5` albo koniec dnia |
| S7 | Nie równolegle z backfillem kierunku / innym hurtem API | jeden proces |
| S8 | Brak body, wewnętrzne `@owocni.pl`, Message-ID już na IMAP albo w Twenty | skip, wpis w manifeście |

**O-5:** zero zapisu Opportunity. Sam Message z Email Sync. Auto-create off.

---

## Limit

| | Piątek rano (test) | Weekend po PASS |
|---|---|---|
| Jedna paka APPEND | **10** (jedna paka, koniec) | **25** |
| Przerwa po pace | **10 min** + 5 checków | **10 min** + co 2. paka 2 wątki na sklejenie |
| Skrzynki naraz | **tylko `copywriting@`** | jedna skrzynka w danym momencie |
| Na skrzynkę / dzień | 10 | **do wyczerpania eligible**, albo stop dnia przy 429 |
| Cel weekendu | — | zejść C-Δ same-mailbox (szacunek luki Sent ~1,5–2,5 tys. **przed** sitkiem; `eligible` z discover) |
| Nadal nie | C2 ~7,4 tys., C3 ~330 tys., R-6 hurtem | to samo |

Twenty Email Sync łyka ~400/min — wąskim gardłem jest **nasze** API (100/min) przy discover/apply, nie IMAP. Dlatego paka 25 + pauza, nie 2 tys. w jednej komendzie.

---

## Kolejność skrzynek

1. **`copywriting@`** — sklejanie już PASS (3.09, 1 mail zostawiony).  
2. **`gosia@`** albo **`marta@`** — jedna w sobotę, druga w niedzielę, nie obie naraz.  
3. **`mariusz@`** — tylko jeśli 1–2 przeszły; dużo parentów jest na `LEADS` → i tak skip.

---

## Piątek 4.09 rano — test na żywo (bramka weekendu)

**Cel:** na skrzynce sprzedaży, sitkiem produkcyjnym, 10 prawdziwych BB-Sent. Nie nowy lab na `mariusz@`.

**Zanim cokolwiek:**

- [ ] S1 auto-create **off** na copywriting (i od razu gosia/marta — weekend ich użyje)  
- [ ] S2 spis webhooków OUT  
- [ ] Żadnego innego hurta API (backfill kierunku **off**)

**1. Discover** (jedna skrzynka — rano nie trzy):

```bash
cd owocni-crm-github
python3 integrations/tools/bb_mail_cdelta_append.py discover \
  --mailbox copywriting@owocni.pl \
  --out integrations/runbooks/exports/bb_sync/cdelta_weekend_20260905/discover_copywriting.json
```

Jeśli `eligible = 0` albo 429 nie wraca po 15 min → **nie ma weekendu**.  
Jeśli prawie wszystko to `skip_other_channel` → sitko działa; na copywriting i tak musi zostać `eligible > 0`.

**2. Apply 10:**

```bash
python3 integrations/tools/bb_mail_cdelta_append.py apply \
  --mailbox copywriting@owocni.pl \
  --limit 10 \
  --folder "BB Archive" \
  --yes
```

Czekaj **10 min**. Checki — **wszystkie PASS**, inaczej weekend odwołany:

- [ ] 2 Message-ID z logu: **ten sam** `messageThreadId` co parent (nie nowy wątek)  
- [ ] `receivedAt` = data z BB, nie 4.09  
- [ ] `direction` = OUTGOING  
- [ ] **zero** nowej Opportunity, **zero** nowej Person  
- [ ] brak 429 / pagera formularza  

FAIL → zostawiamy to, co weszło; **nie** kasujemy folderu; **nie** ruszamy Marty/Gosi w weekend.  
PASS → odblokowany większy import sobota–niedziela. W piątek **żadnej drugiej paki** (rano jest test, nie fala).

---

## Sobota 5.09 — większy C-Δ (tylko po PASS piątku)

Discover na skrzynce dnia **przed** pierwszą paką (gosia/marta: osobny JSON). Potem paki **25**:

```bash
python3 integrations/tools/bb_mail_cdelta_append.py apply \
  --mailbox copywriting@owocni.pl \
  --limit 25 \
  --folder "BB Archive" \
  --yes
```

Kolejność: dokończyć `copywriting@` (eligible), potem **jedna** ze sprzedaży (`gosia@` albo `marta@`). Nie dwie paki na dwóch skrzynkach jednocześnie.

Po każdej pace: 10 min. Co drugą pakę: 2 wątki (sklejenie + data + zero kart). 429 → 15 min, potem `--limit 10` albo koniec dnia.

Cel soboty: zjeść eligible copywriting + zacząć drugą skrzynkę, nie C2.

---

## Niedziela 6.09

- Druga skrzynka sprzedaży + reszta eligible z soboty. Paki 25, to samo sitko.  
- Jak eligible C-Δ same-mailbox zejdzie do zera na tych trzech skrzynkach — **koniec**, nawet przed wieczorem. To sukces fali, nie pretekst do C2.  
- Po ostatniej pace: manifest + liczby. Żadnego APPEND w nocy.

---

## Poniedziałek 7.09 — QA, potem stop

- [ ] Marta: 2–3 **swoje** stare sprawy, czy widać brakującą odpowiedź w **tym samym** wątku (folder `BB Archive` / poczta).  
- [ ] Gosia: to samo.  
- [ ] Maciek: to samo na `copywriting@`.  
- [ ] Wpis `OPS_NOTES` §5.3: data, skrzynki, liczby, `no_emit=TAK (konstrukcja)`, 429 tak/nie.  
- [ ] Auto-create: **nie włączaj** w poniedziałek rano „bo weekend skończony” — decyzja osobno (karta studio).  
- [ ] **Stop.** Pytanie 5 karty importu: reszta (R-6 / C2) **nie** w tym oknie.

Krótki komunikat po QA, nie przed: „brakujące odpowiedzi z BB, które szły obok skrzynki, są w Twenty w folderze BB Archive — tylko tam, gdzie pytanie już było na Twojej poczcie. Zapytania z `leads@` bez zmiany wątku; te nadal w BB.”

---

## Stop natychmiast

- 429 albo pager formularza  
- nowa karta / nowa osoba, której nie było przed paką  
- `receivedAt` = dziś  
- sklejenie FAIL (nowy wątek przy parencie na tej samej skrzynce)  
- ktoś włączył auto-create albo webhook `message.*`

**Rollback IMAP:** nie kasować `BB Archive` w panice (Twenty i tak zostawi rekordy; odtworzenie folderu **nie** zsyncuje ponownie). Cofanie pojedynczych pomyłek = GraphQL `deleteMessages` jak 3.09, nie EXPUNGE całego folderu.

---

## Czego ten weekend świadomie nie robi

- APPEND na `leads@` (żeby „skleić formularz”)  
- drugi wątek obok zapytania z lejka  
- 7,4 tys. / od 1.01.2023  
- most Owocni Mail ↔ Supabase  
- włączanie failovera, Odroczenia, backfillu „Do odpisania”
