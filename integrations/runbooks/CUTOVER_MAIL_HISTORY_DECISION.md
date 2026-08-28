---
doc_id: CUTOVER_MAIL_HISTORY_DECISION
title: "Decyzja Mariusz — historia maili BB vs Twenty (po czystce leadów)"
layer: runbook
status: draft
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-08-28
related:
  - CUTOVER_BB_SYNC_DECISION.md
  - CUTOVER_BB_SYNC_EXECUTION.md
  - CUTOVER_TWENTY_TEAM_PLAN.md
  - E12_4_P4_CUTOVER_INSTRUCTIONS.md
---

# Historia korespondencji — decyzja przed cutoverem (pn 31.08)

**Do:** Mariusz  
**Od:** Dawid  
**Data:** 28.08.2026 (piątek)  
**Pytanie:** czy handlowcy mają mieć pełną historię maili w Twenty, czy BB zostaje archiwum — i ile to kosztuje po czystce lejka.

---

## W skrócie (1 minuta)

1. **Sync leadów BB → Twenty jest zrobiony** (232/232 otwarte z 30 dni). Po czystce ghostów z `leads@` w Twenty zostaje **~166 otwartych kart `BETTER_BITRIX_LEGACY`**.
2. **Historia maili z BB nie weszła do Twenty.** Sync przeniósł karty (etap, owner, `bb:{id}`), nie wątki IMAP z Better Bitrix.
3. Dlatego Gosia widzi np. `proaura.tychy@gmail.com` poprawnie u Marty, ale **bez wątku** — albo kłódkę „nie udostępnione” na mailach z cudzej skrzynki w Twenty (to osobny temat: visibility Message Channel).
4. **Pełny import historii jest możliwy, ale to osobny projekt** — nie „włączymy w poniedziałek”. Liczby poniżej.
5. **Rekomendacja:** cutover w pn z **opcją A** (BB = archiwum ≥1 miesiąc). Opcja C (import) dopiero po decyzji koszt/korzyść.

---

## Stan po czystce (28.08)

| Co | Liczba |
|---|---:|
| Sync apply (30 dni, Marta/Gosia/Maciej) | **232** leadów |
| Otwarte `BETTER_BITRIX_LEGACY` w Twenty teraz | **~166** |
| Unikalne emaile klientów z tego syncu | **~236** |
| Wątki maili w BB powiązane z tymi adresami | **~5 900** |
| Wiadomości w tych wątkach (cała historia BB) | **~7 400** |
| Cała tabela `email_message` w BB (kontekst) | **~330 000** |

Czystka ghostów `TWENTY_EMAIL` / `leads@` (żeby nie mylić lejka):

| Fala | Efekt |
|---|---|
| A — usuń NEW-ghost przy otwartym BB-legacy | **38** + 12 testów |
| B — wyrównaj TWENTY_EMAIL do BB (owner/etap/`bb:`) | **78** |
| C — archiwum NEW-sierot (>7 dni, brak BB) | **41** LOST (7 świeżych zostawione) |

Zabezpieczenie: worker `create_lead` nie tworzy już drugiej karty, gdy osoba ma otwartą opportunity.

---

## Co handlowiec realnie widzi w Twenty dziś

| Sytuacja | Co jest | Czego brak |
|---|---|---|
| Lead zsynchronizowany z BB | Karta, etap, owner, `bb:{id}` | Historia maili z BB |
| Mail z podpiętej skrzynki w Twenty (IMAP) | Wątki **od momentu podpięcia** | Starsze maile sprzed syncu skrzynki |
| Mail kolegi (inna skrzynka) | Często **kłódka / „nie udostępnione”** | Treść — to ustawienie visibility w Twenty, nie brak syncu BB |
| Przykład Gosi: ProAura | Poprawnie **Marta / PROPOSAL / bb:9268** | Wątek w Twenty = 0 (historia tylko w BB) |

---

## Opcje (wybierz jedną)

### Opcja A — rekomendowana na cutover pn — BB jako archiwum

| | |
|---|---|
| **Co** | Twenty = SoR (lejki, nowe maile, oferty). BB `/lead` + inbox BB = **read-only ≥ 1 miesiąc** do podglądu starej korespondencji |
| **Import historii** | **0** wiadomości |
| **Czas** | **0 dni** inżynierii; komunikat do zespołu 15 min |
| **Koszt** | niski |
| **Ryzyko** | handlowiec czasem klika w BB przy starej sprawie |
| **Cutover pn** | **tak** |

**Komunikat do zespołu:** „Lejek i nowe maile tylko w Twenty. Stary wątek z BB — otwierasz BB i szukasz po emailu / numerze `bb:` z karty.”

---

### Opcja B — bez importu, tylko „widać maile kolegów” w Twenty

| | |
|---|---|
| **Co** | Ustawienia Message Channel / sharing w Twenty tak, żeby Marta/Gosia/Maciej widzieli treść wątków ze skrzynek zespołu (nie tylko własnych) |
| **Import historii BB** | **0** |
| **Czas** | **~0,5–1 dzień** konfiguracji + smoke z zespołem |
| **Ryzyko** | prywatność / RODO — trzeba świadomie wybrać zakres skrzynek |
| **Cutover pn** | **tak** (można domknąć w tym samym tygodniu) |

**Nie rozwiązuje:** historii sprzed podpięcia skrzynek do Twenty ani maili, które nigdy nie weszły przez IMAP Twenty.

---

### Opcja C — import historii z BB do Twenty (tylko leady po syncu / czystce)

| | |
|---|---|
| **Co** | Jednorazowy importer: BB `email_thread` / `email_message` → Twenty Messages, podpięte do Person / Opportunity z `bb:{id}` |
| **Ile (po czystce, zakres sync 30 dni)** | **~7 400** wiadomości / **~5 900** wątków (~236 adresów / ~166 otwartych kart) |
| **Czas** | **realnie 3–7 dni roboczych** (mapowanie, body/załączniki, dedupe vs IMAP, visibility, dry-run, apply, QA z 3 osobami) |
| **Ryzyko** | średnie–wysokie: duplikaty z bieżącym IMAP, brak body w BB (część = „archived” i fetch z IMAP), limity API Twenty, kto „właścicielem” wątku |
| **Cutover pn** | **tak, ale bez czekania na C** — import jako **faza 2** po go-live |

**Dlaczego nie „szybko przed poniedziałkiem”:** to nie jest przełączenie przełącznika. BB trzyma maile w osobnym modelu (`email_message` + czasem body dopiero po dociągnięciu z IMAP). Twenty ma własny model Message Channel. Trzeba zbudować most, nie skopiować plik.

Warianty zawężenia C (jeśli jednak idziemy w import):

| Wariant | Zakres | Orientacyjnie |
|---|---|---|
| C1 | tylko otwarte ~166 + maile **od 2026-01-01** (cała BB ~17k/rok; dla naszych adresów mniej niż 7,4k) | krócej, nadal projekt |
| C2 | pełna historia tych ~236 adresów | **~7,4k** msg |
| C3 | cała poczta BB | **~330k** — **odrzucone** (koszt/ryzyko nieadekwatne) |

---

### Opcja D — odłożyć cutover do czasu importu historii

| | |
|---|---|
| **Co** | Czekamy z SoR Twenty aż opcja C będzie gotowa |
| **Koszt** | opóźnienie cutoveru o **≥1 tydzień** + utrzymanie dwóch SoR |
| **Rekomendacja** | **nie** — lejek już jest w Twenty; brak historii to ból, nie blocker go-live |

---

## Propozycja decyzji (do potwierdzenia)

1. **Cutover pn 31.08 — Opcja A** (BB archiwum ≥1 miesiąc).  
2. **Równolegle / w tym tygodniu — Opcja B** jeśli zespół zgłasza kłódki na mailach kolegów.  
3. **Opcja C — osobna decyzja kosztowa** (tak/nie + C1 vs C2). Start dopiero po cutoverze, nie blokuje D1.

---

## Checklist poniedziałek (niezależnie od C)

- [ ] Delta sync BB → Twenty (`sync_bb_to_twenty.py delta`) — domknięcie zmian weekendowych  
- [ ] Analytics BB → `environment: sandbox` (żeby Meta/Google nie dublowały z Twenty)  
- [ ] Komunikat: SoR = Twenty; BB tylko archiwum korespondencji / starych spraw  
- [ ] Smoke: 1 lead nowy z formularza + 1 mail na `leads@` + 1 karta BB-legacy (etap/owner)

---

## Status dokumentacji / GitHub (stan na 28.08)

| | |
|---|---|
| **Czy cała dokumentacja ostatnich zmian jest na GitHubie?** | **Nie.** |
| Remote | `https://github.com/Owocni/owocni-crm-twenty.git` — branch `main` = `origin/main` (0 commitów do wypchnięcia, bo lokalnie **nie ma commita**) |
| Ostatni commit na remote | `eebe708` — cutover docs z **21.08.2026** |
| Lokalnie (niecommitowane) m.in. | `CUTOVER_BB_SYNC_DECISION.md`, `CUTOVER_BB_SYNC_EXECUTION.md`, ten plik, tooly sync/czystki, poprawki inbound/worker/sGTM, evidence w `exports/bb_sync/` |

**Wniosek:** praca z 27–28.08 (sync BB, czystka ghostów, dedupe, runbooki) jest **na dysku / w tym repo lokalnie**, ale **nie jest zacommitowana ani wypchnięta**. Po Twojej decyzji mogę zrobić jeden commit + push (bez sekretów / bez `.env`).
