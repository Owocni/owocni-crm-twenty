---
doc_id: CUTOVER_TWENTY_TEAM_PLAN
title: "Plan przesiadki na Twenty — zespół (do końca miesiąca)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-08-21
related:
  - ../../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md
  - TWENTY_ROLLOUT_MASTER.md
  - LEAD_OWNER_ROUTING_PLAN.md
  - LEAD_DISPATCHER_PLAN.md
  - PIPEDRIVE_MIGRATION_CHECKLIST.md
  - RULE_CONTINUITY_IMPL_CHECKLIST.md
  - CUTOVER_1ON1_CHECKPOINT_SHEET.md
source_request: "Mariusz 2026-08 — działać tylko w Twenty do końca miesiąca"
---

# Plan przesiadki na Twenty (zespół)

**Cel:** do **2026-08-31** handlowcy realizują codzienny przepływ wyłącznie w Twenty.  
**Nie-cele w tym oknie (nie blokują cutoveru):** Fakturownia/PayU (osobny tor), backfill Account Owner.

**Continuity (Account Owner)** = **DONE 2026-08-20** (worker ON + AO v13) — [RULE_CONTINUITY_IMPL_CHECKLIST.md](./RULE_CONTINUITY_IMPL_CHECKLIST.md).  
**Arkusz operacyjny (status na dziś, 1:1, smoke’y):** [CUTOVER_1ON1_CHECKPOINT_SHEET.md](./CUTOVER_1ON1_CHECKPOINT_SHEET.md) ← tu odhaczasz postęp.  
**Scenariusze filmików (referencja):** [CUTOVER_VIDEO_SCRIPTS.md](./CUTOVER_VIDEO_SCRIPTS.md) — filmiki zespołu **już wysłane** (20.08).

> **Dwa pliki cutoveru:** ten dokument = **plan** (cel, D1, harmonogram, role). Arkusz 1:1 = **dziennik postępu** (pytania, scorecard, co gotowe). Nie duplikuj statusów w planie — żywy stan trzymaj w arkuszu.

### Stan vs harmonogram (21.08)

| Kiedy (plan) | Założenie | Stan |
|--------------|-----------|------|
| **Cz 20** | dokument + start 1:1 + continuity | ✅ plan + arkusz; continuity DONE; ankiety wystartowały; smoke’y D1 tech ✅; filmiki wysłane |
| **Pt 21 (dziś)** | **checkpoint** zielone/czerwone z Mariuszem | ⏳ **to jest zadanie na dziś** — nie kolejny dokument |
| Pt 21 | dopięcie czerwonych do śr 26 | po checkpointcie: lista napraw (widoki, Ewa scope, Kanban vs taski) |
| Pn–Śr 26 | naprawa blockerów | jeszcze nie — po pt 21 |
| Cz 27 | dry-run ½ dnia tylko Twenty | później |
| Pt 28 | go/no-go | później |
| do 31 | cutover | później |

**Na dziś z tego pliku zostaje tylko:** checkpoint §3 (status osób + D1 + czy dry-run 27 realny + decyzja Kanban-first). Reszta postępu = [CUTOVER_1ON1_CHECKPOINT_SHEET.md](./CUTOVER_1ON1_CHECKPOINT_SHEET.md).  
Czekasz jeszcze na ankięty: **Marta** (+ ewentualnie **Maciej**).

### Rozdzielanie leadów vs cutover

**Na start wystarczy to, co jest (D1-7):** hard-assign — Meta/Marketing→Robert, COPY→Maciej, reszta hash Marta/Gosia, Ewa ręcznie.  
**Większe reguły (model dyspozytora)** — zegar HOT/STANDARD/LOW, „Biorę”, limit 3, godziny 8–18, święta, urlop, kaskada, alerty managera — **domyślnie po cutoverze**.  
Jeśli będzie czas: można wdrażać **wcześniej, nawet przed cutoverem**; nie są must-have D1.  
**SSOT procesu:** [LEAD_DISPATCHER_PLAN.md](./LEAD_DISPATCHER_PLAN.md) (instrukcja zespołu + LLM).  
**Świadomie rezygnujemy** (stary claim/puli v1.3): „możliwość przejęcia”, rezerwacja 3 min, mini-shark/broadcast, sloty 1/2/3, status „rozmowa trwa”, overflow „wsparcie sprzedażowe”, conv rate — szczegóły w §11 dyspozytora.

---

## 1. Role

| Rola | Osoba | Odpowiedzialność |
|------|--------|------------------|
| Priorytety / go-live | Mariusz | Decyzja cutover, akceptacja „zielone/czerwone” |
| Wykonanie techniczne | Dawid | Integracje, importy, deploy, checklisty, video |
| Użytkownicy D1 | Marta, Gosia, Maciej, Robert, Ewa | Potwierdzenie flow 1:1 + smoke w swoim torze |
| CRM / faktury (później) | Maja | Tor Fakturownia — **nie blokuje** cutoveru handlowców |

---

## 2. Co musi działać pierwszego dnia (D1 must-have)

Bez tych punktów cutover **nie startuje**.

| ID | Must-have | Dowód PASS | Owner potwierdzenia |
|----|-----------|------------|---------------------|
| D1-1 | **Maile jako backstop** — skrzynki handlowców + `leads@` sync; da się odpisać z Twenty / owocni-mail | Mail testowy IN + OUT per osoba | Każdy 1:1 |
| D1-2 | **Nowe leady z formularza** → Person + Opp + owner + powiadomienie | 1 lead testowy Sortownia | Dawid + Marta/Gosia |
| D1-3 | **Leady FB / Meta** → Robert (owner + widoczność) | 1 lead Instant Form lub poll | Robert |
| D1-4 | **Import Pipedrive Ewy** — otwarte sprawy widoczne, owner=Ewa gdzie mapowane | Spotkanie Ewa: „mogę śmigać” | Ewa |
| D1-5 | **Import Pipedrive Roberta** — j.w. | Spotkanie Robert | Robert |
| D1-6 | **SQL / WON / LOST / odrzucenie** — bez pseudo-SQL dragiem | Smoke workflow „Przyjmij jako SQL” + WON z kwotą | Marta lub Gosia + Dawid |
| D1-7 | **Przydzielanie nowych leadów** — Marta/Gosia hash, COPY→Maciej, FB/Marketing→Robert | 3 scenariusze smoke | Dawid |
| D1-8 | **Widoki robocze** — co najmniej 1 praktyczny widok per osoba (bez ściany pustych pól) | Screenshot / „używam tego” na 1:1 | Każdy |

**Nice-to-have D1 (nie blokują):** continuity Account Owner, Fakturownia, PayU, video na YouTube, SQL dashboardy; fragmenty dyspozytora (zegar / „Biorę” / limit 3) — **tylko jeśli jest czas**.

**Świadomie poza must-have D1:** pełny dyspozytor (można wcześniej przy wolnych rękach), auto-łączenie Person↔Company po domenie, odrzucony model claim/puli/slotów per klasa.

---

## 3. Harmonogram (realistyczny, 20–31 VIII)

```text
Cz 20 VIII  — ten dokument + start 1:1 + plan continuity (równolegle, nieblocker)
Pt 21 VIII  — checkpoint „zielone / czerwone” (status per osoba + per D1-*)
          — dopięcie czerwonych do środy 26
Pn–Śr 26    — naprawa blockerów; video #1–3 (maile, widoki, SQL/WON)
Cz 27       — dry-run: ½ dnia tylko Twenty (BB read-only / bez nowych leadów w BB)
Pt 28       — go/no-go Mariusz + Dawid
Pn–Wt 31    — cutover window (wyłączenie julia362/BB jako SoR leadów) ALBO przesunięcie z listą blockerów
```

**Piątek 21 VIII — agenda checkpointu (30–45 min):**

Dla każdej osoby: 🟢 siedzi w systemie / 🟡 częściowo / 🔴 nie może pracować.  
Dla każdego D1-\*: 🟢 / 🔴 + kto naprawia.

Przykłady (jak w mailu Mariusza):

- Robert 🟢 — import PD OK, FB leady wpadają.
- Marta 🔴 — nie wie jak wysyłać maile → video + 15 min live.
- Gosia 🟡 — leady się przydzielają, ale widok bezużyteczny → sesja widoków.

---

## 4. 1:1 — skrypt rozmowy (każdy użytkownik = inny projekt)

**Czas:** 20–30 min. **Cel:** czy już „siedzą w systemie” + lista braków D1.

| # | Pytanie | Notatka |
|---|---------|---------|
| 1 | Gdzie dziś robisz leady / maile / follow-upy? (BB / PD / Twenty / mix) | |
| 2 | Co **musisz** zrobić jutro rano, żeby sprzedać? | |
| 3 | Czy w Twenty widzisz swoje otwarte sprawy? | |
| 4 | Czy umiesz: znaleźć lead, zmienić stage, potwierdzić SQL, wpisać kwotę przy WON? | |
| 5 | Czy maile IN/OUT działają na Twojej skrzynce? | |
| 6 | Co Cię najbardziej niepokoi przy wyłączeniu starego systemu? | |
| 7 | Jeden widok: co chcesz widzieć na karcie / w liście (ukryć puste)? | |

### Macierz użytkowników (wypełnić na 1:1)

| Osoba | Tor / dane | D1 krytyczne dla niej | Status 21.08 | Blokery |
|-------|------------|------------------------|--------------|---------|
| **Marta** | pulą formularz + mail | maile, widoki, SQL, przydział | | |
| **Gosia** | j.w. | j.w. | | |
| **Maciej** | COPYWRITING | leady copy, maile, WON | | |
| **Robert** | FB + PD import + marketing | FB ingest, import PD, maile | | |
| **Ewa** | SQL / PD (Krzysztof→Ewa) | import PD, SQL pipeline, maile | | |
| **Maja** | faktury (później) | świadomość procesu; nie D1 | n/a cutover | Fakturownia |

---

## 5. Video (prywatny YouTube `owocni@gmail.com`)

Seria krótka (3–6 min / odcinek). Nagrywa Dawid; **wysłać przed 1:1 / dry-runem 27.08**.  
**Scenariusze „co pokazać na ekranie”:** [CUTOVER_VIDEO_SCRIPTS.md](./CUTOVER_VIDEO_SCRIPTS.md).

| # | Temat | Priorytet |
|---|--------|-----------|
| V1 | Widok „moje sprawy” — filtr moje, ukryj puste, pin 4–6 pól | P0 |
| V2 | Maile — przeczytaj i odpisz z Twenty | P0 |
| V3 | SQL (świadomie) → oferta → WON+kwota / LOST vs odrzucenie | P0 |
| V4 | Szukaj: osoba / sprawa / firma | P1 |
| V5 | Duble — co wolno / kiedy pisać do Dawida | P1 |
| V6 | Fakturowanie — po cutoverze z Mają | P2 |

---

## 6. Cutover day — kolejność

1. Checkpoint D1-1…D1-8 = wszystkie 🟢 (albo świadomy waiver Mariusza na piśmie).
2. Backup / snapshot: schema + lista otwartych Opp.
3. Wyłączenie SoR legacy (julia362 create lead / BB jako master) — **dopiero** gdy Email Sync + create_lead live.
4. Monitor 2–4 h: nowe leady, powiadomienia ownerów, maile, reason codes inbound.
5. Kanał awaryjny: Sheets / Make backup inbound **zostaje** (nie wyłączamy).
6. Continuity: jeśli PASS tego dnia — flaga ON; jeśli nie — zostaje OFF (nie blokuje).

**Rollback (minimum):** włączyć legacy inbound; wyłączyć native webhook OUT jeśli psuje eventy; leady z okna cutoveru — ręczny przegląd.

---

## 7. Tor osobny: Fakturownia + PayU (nie blokuje)

### Stan 21.08 (smoke Dawida)

| Element | Stan | Uwaga |
|---------|------|--------|
| **PayU (REST API)** | ✅ klucze wygenerowane i wpisane w Fakturowni | konto zaktualizowane ~10:18 |
| **Autopłatności** (checkbox konta) | ✅ zaznaczone | potwierdzone UI |
| **„Nie wyświetlaj przycisku Zapłać online”** | ✅ wyłączone (nie blokuje) | Wydruki |
| **Przycisk „Kliknij i zapłać online” / `payment_url`** | ❌ brak na proformie i VAT | smoke API + publiczny podgląd |
| **KSeF** | ❌ niepodpięty (decyzja wstrzymana) | **powód braku działających autopłatności** |

**Dlaczego PayU „jest”, a zapłata nie działa:** konto Fakturowni Owocni założone **2026-08-04**. Od **15.04.2026** Fakturownia wymaga **działającej, zautoryzowanej integracji KSeF**, żeby Autopłatności (w tym PayU) działały na dokumentach przychodowych. Bez KSeF klucze PayU można zapisać, ale przycisk zapłaty / `payment_url` się nie pojawia.  
Źródło: [Autopłatności — Fakturownia](https://pomoc.fakturownia.pl/107832-autoplatnosci-czym-sa-i-jak-je-skonfigurowac).  
*(Pewność: bardzo wysoka wg oficjalnej reguły + smoke; 100% dopiero po potwierdzeniu helpdesku Fakturowni albo po włączeniu KSeF i ponownym teście.)*

**Zostaje do domknięcia (po cutoverze handlowców / gdy odblokują KSeF):**

| Krok | Owner | Uwaga |
|------|--------|-------|
| **KSeF** — podpięcie + autoryzacja w Fakturowni | Mariusz / Maja | **odblokowuje PayU/Autopłatności** na tym koncie |
| Ponowny smoke PayU (przycisk + `payment_url`) | Dawid | po KSeF — ten sam test co 21.08 |
| **Konta użytkowników w Fakturowni** (Marta, Gosia, Maciej + Maja) | Maja / admin | osobny krok rolloutu UI |
| Smoke wystawiania z Twenty (`issue_invoice`) per osoba | Maja + Dawid | worker jest; userzy + SOP |
| SOP ręczny (proforma / VAT bez automatu) | Dawid | Minimum „jak coś padnie” — 1 strona |

**Świadomie poza tor Day-1:** automatyczna wysyłka KSeF z Twenty (osobna decyzja produktowa).

---

## 7b. Monitoring — codzienny poranny check (DONE)

**Co:** Cloud Function `system-health-check` + Scheduler (spec: [SYSTEM_HEALTH.md](../../owocni-crm/ops/SYSTEM_HEALTH.md)).  
**Po co:** wiedzieć rano, czy **Owocni-dodatki** w Twenty żyją (formularz/Stape, Meta, maile/szablony, workflowy MUST_ON, n8n/rozmowy, inbound…) — zanim handlowiec zgłosi „nic nie wpada”. Cisza biznesowa ≠ awaria; DOWN = padł heartbeat (scheduler / API / workflow OFF).  
**Jak:** co ~30 min w godzinach pracy probe czyta status (GET REST + lista istniejących Scheduler jobs + snapshot GCS); **codziennie ~08:00** mail-digest na `HEALTH_ALERT_TO` (watchdog: brak maila = padł monitoring albo SMTP). Przy zmianie na DOWN / recovery — osobny pager (nie spam co 30 min). **Nie** idzie przez n8n ani workflow Twenty (żeby awaria kanału nie uciszyła alarmu). UI zakładki w Twenty = później; maile już działają.

---

## 8. Definition of Done (miesiąc)

- [ ] Handlowcy pracują tylko w Twenty (brak SoR w BB/PD dla nowych leadów).
- [ ] D1-1…D1-8 potwierdzone przez właścicieli.
- [ ] Checkpoint 21.08 przeprowadzony; czerwone domknięte lub waiver.
- [x] Min. V1–V3 / filmiki zespołu wysłane (20.08).
- [ ] Fakturownia/PayU: albo live, albo jasny SOP ręczny + data kolejnego kroku.
- [x] Continuity: PASS (DONE 2026-08-20 — flaga ON + AO v13).
