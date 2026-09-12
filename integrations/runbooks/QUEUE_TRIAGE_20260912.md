---
doc_id: QUEUE_TRIAGE_20260912
title: "Weekend 12–13 IX — triage kolejki, nie start poniedziałkowy"
layer: runbook
status: t1_chat_done
owner: "Dawid"
audience: "Dawid + wykonawca"
last_verified: 2026-09-12
related:
  - ROLLFORWARD_20260911.md
  - ODROCZENIE_DECISION.md
  - ADS_SQL_SIGNAL_ROLLBACK.md
  - MAIL_EDITOR_REBUILD_20260912.md
source: "Mail Mariusz 12.09 + sonda A/B/C na żywych kartach"
---

# Weekend — triage kolejki (start zespołu przesunięty)

Mariusz **przekłada start** („po raz drugi”). To nie jest cutover poniedziałek. Cel weekendu: dziewczyny **nie** dostają sterty śmieci w „Do odpisania”, Owocni@ nie jest workiem bez opiekuna, **nikt nie wysyła pustego maila z Owocni Mail**.

Dokumenty Mariusza (przebudowa edytora + 500-stronicowy cleanup) **nie są planem sobota–niedziela**. Ten plik jest. Pełny pakiet W0–W7 zostaje backlogiem po weekendu.

**Start tylko po jawnym GO od Dawida.**

---

## Konflikt z tym, co Mariusz zmienił w Twenty

Repo `owocni-crm-github` jest czyste i zsynchronizowane z `origin/main`. To, co Mariusz ruszył, siedzi **w workspace Twenty**, nie w git:

| Warstwa | Gdzie żyje | Konflikt z GitHub? |
|---|---|---|
| Widoki / filtry / „PODGLĄDY KANBAN” / Gosia do odpisania | Twenty UI (często ulubione usera) | **Nie.** Kod ich nie nadpisze. |
| Karty, owner, etap, flaga | rekordy Opportunity | **Nie git.** Nasz PATCH idzie w te same rekordy — to zamierzone. |
| Owocni Mail (app 0.1.128) | Twenty Application + repo `apps/owocni-mail-twenty` | **Tak, jeśli zrobimy deploy appki.** Live i git są na 0.1.128. Nie deployujemy maila w tym przebiegu. |

**Wolno:** czytać jego widoki, PATCH-ować rekordy z manifestu.

**Nie wolno w tym weekendzie:** `deploy_owocni_mail_patched.py` / `yarn twenty apply`, `upsert_complete_view` na jego kanbanach, kasowanie widoków, pełny sync BB (inbound jest **prod** → SQL/WON poszłyby na Ads).

---

## Dwa tory (nie mieszać)

| Tor | Co | Ten weekend |
|---|---|---|
| **T1 dane** | Kolejka, owner, produkt, holding | Tak, po GO, `no_emit` |
| **T2 wysyłka** | Rebuild edytora z załącznika | **Nie.** Thunderbird / zakaz Owocni Mail do oferty. Epik osobno. |

---

## T1 — triage danych

Inbound Twenty = **prod**. PATCH `stage` na QUALIFIED/WON = sygnał Ads. Ten weekend **nie ruszamy etapu na SQL/WON**.

### Fala 0 — odczyt (nic nie zapisujemy)

- [ ] Snapshot: otwarte Opportunity Gosi/Marty/Maćka + holding `2d65d0e6-…` + `ownerId` null.
- [ ] Odświeżyć A/B/C (ID poniżej).
- [ ] Policzyć: `isFollowUp=true` AND `stage=NEW` per osoba; holding open (NEW vs PAYING).
- [ ] Nie używać `tmp/premonday_20260913/apply_premonday.py`.

### Fala 1 — obowiązkowe ID (Mariusz)

| ID | Karta | Decyzja (potwierdzić odczytem, potem PATCH) |
|---|---|---|
| A `53081308-5f1c-4f2f-9113-0e575160dc4f` | Gosia NEW, IN-only; druga karta Roberta `35e5dbd6-…` PROPOSAL | Zdjąć z kolejki Gosi: `isFollowUp=false`. **Nie merge** w weekend. Owner zostaje albo eskalacja do Mariusza jeśli ma iść do Roberta. |
| B `2cb65973-3284-425b-b73d-5a77d4f79486` | Pusta karta, zero maili | Nie LOST z automatu. `isFollowUp=false` + notatka na karcie **albo** lista „do decyzji Mariusza”. |
| C `67e969b4-1033-424e-8899-10e3f3e5b92e` | `copywriting.pl/kontakt`, produkt INNE, Gosia | `bizProduct=COPYWRITING`, `ownerId=Maciej`. Szukać OUT w BB; jeśli jest — import C-Δ albo flaga wg faktu. Bez zmiany etapu na QUALIFIED. |

### Fala 2 — kolejka Gosi (i analog Marta)

Klasa jak A/B: `owner=Gosia`, `stage=NEW`, `isFollowUp=true`, źródło Sortownia, lipiec/sierpień, mało lub zero OUT.

Dozwolone operacje: `isFollowUp`, `ownerId`, `bizProduct`.  
Zakazane: `stage` → QUALIFIED/WON; create Opportunity; auto-LOST.

Manifest `exports/queue_cleanup/20260912T…/wave2.json`. Dry-run → Dawid patrzy 10 wierszy → apply.

### Fala 3 — 2A holding

Konto Owocni (`owocni@gmail.com`) **nie** jest właścicielem sprzedaży.

- NEW / CONTACTED na holdingu z sample-week → imienny owner (hash / COPY→Maciej / ciągłość). Lista do akceptacji **zanim** PATCH.
- PAYING na holdingu (~60) **nie** rozdawać hurtem w weekend — osobna decyzja Mariusza (kto prowadzi wpłaty).
- `owner=null` na otwartych: jedna osoba przyjmująca (Mariusz wskazuje). Nie Owocni.

### Fala 4 — nie teraz

- Pełny BB→Twenty apply (ryzyko Ads + QUALIFIED).
- 33 create z planu 11 IX.
- Historyczne 355 null-owner na WON/LOST.
- Rebuild Owocni Mail.
- Skrypt premonday.

---

## T2 — puste maile (do komunikatu, nie do kodu)

Live = **0.1.128**: iframe nadal się przebudowuje przy tokenie. Plan przebudowy edytora jest **słuszny i duży**. Weekend go nie wdraża.

Komunikat do zespołu (nawet przy przesuniętym starcie):

> Oferty i odpowiedzi: Thunderbird. Owocni Mail — tylko odczyt wątku. Nie klikać Wyślij z karty, dopóki nie damy znać.

---

## Kolejność

```
0  GO Dawida
1  Fala 0 odczyt
2  Fala 1 A/B/C (3 karty)
3  Fala 2 dry-run NEW+followUp Gosi/Marty → akceptacja → apply
4  Fala 3 lista holdingu NEW → akceptacja ownerów → apply
5  Smoke: Gosia „Do odpisania” bez A/B/C; C u Macieja
6  OPS_NOTES + komunikat Thunderbird
```

Jeśli czas się kończy: **1 + 2 + komunikat T2** ważniejsze niż fala 3 PAYING.

---

## STOP

- Deploy Owocni Mail
- Kasowanie / nadpisywanie widoków Mariusza
- PATCH stage QUALIFIED/WON
- Oba CRM na prod Ads (BB ma zostać sandbox)
- `apply_premonday.py`

Rollback danych: zapis `before` w manifeście; przywracać tylko pola z operacji. Nie wracać ownera na Owocni.

---

## Log GO

| | |
|---|---|
| GO od | Dawid, 12.09.2026 07:19 — oba tory |
| Fala 1 | A/B `isFollowUp=false` + notatki; C `COPYWRITING` + owner Maciej. HTTP 200. |
| Fala 2 n PATCH | 7 (puste lastContact) + 73 (NEW+FU Sortownia lipiec–sierpień; lastContactAt to stempel formularza, nie OUT) = **80**. `no_emit`. Manifest `exports/queue_cleanup/20260912T052202Z/` |
| Holding NEW rozdane | **14 Sortownia** → Marta 11 / Gosia 3 (stempel parku). PD 18 + PAYING 62 zostają archiwum na Owocni. |
| T1 czat 12.09 | DELETE 8 testów (KEEP `a88aa583-…`); Batko miss BB+PD; Inkflow merge_leads → WON Roberta `3fcd51f3-…`; dump 28 / BB 20 hit 8 miss; open 572 vs piątek 78 patched 0 creates. `no_emit`. Manifest `t1_tests_batko_inkflow.json`. |
| T1 GO-2 | Batko hash → Gosia. Dump BB-hit **17** przydzielone z BB (bez SQL/WON). IMAP: 2 skitomasz + 3 Marta C-Δ. Nadmiar Twenty = restore 557 + lejek Sortowni vs okno BB 30d=228. |
| T1 BB sync 12.09 | 22 PATCH etap/ID (holding+email); 0 create; C-Δ LEADS-parent 24 APPEND. Run `20260912T072500Z`. |
| T1 BB sync fala 2 | leftover 13 create + 3 patch; 90d **99 PATCH**; C-Δ VIII Gosia 72 / Marta 49 / copy 39. |
| Komunikat Thunderbird | Live **0.1.129** (`f8e039854bf5e6ae2fa3bc2cc6ff328a`). Hard refresh. Do potwierdzenia wysyłki kontrolnej — Thunderbird na oferty. |
