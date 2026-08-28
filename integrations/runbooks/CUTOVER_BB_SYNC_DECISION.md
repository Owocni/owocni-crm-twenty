---
doc_id: CUTOVER_BB_SYNC_DECISION
title: "Decyzja Mariusz — cutover Twenty vs sync leadów z BB (Marta / Gosia / Maciej)"
layer: runbook
status: approved
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-08-27
related:
  - CUTOVER_TWENTY_TEAM_PLAN.md
  - CUTOVER_1ON1_CHECKPOINT_SHEET.md
  - G_PAR_BETTER_BITRIX_PARITY.md
source: "https://crm.owocni.pl/lead (Supabase `leads` — nowy kanban)"
---

# Cutover Twenty — decyzja: sync z Better Bitrix

**Do:** Mariusz  
**Od:** Dawid  
**Data:** 27.08.2026 (czwartek)  
**Pytanie:** czy cutover jutro (pt 28), w poniedziałek (31), czy później — i czy robimy sync otwartych leadów z BB.

---

## W skrócie

1. **Źródło:** wyłącznie [crm.owocni.pl/lead](https://crm.owocni.pl/lead) (nowa baza). Starej `/lead2` **nie ruszamy**.
2. **Plan cutoveru do tej pory nie zakładał syncu BB → Twenty** — tylko import Pipedrive (Ewa/Robert) + wyłączenie BB. To luka: Marta/Gosia nadal mają żywy kanban w BB, a w Twenty etapy tych spraw **nie są aktualne**.
3. **Bez syncu (lub ręcznego TOP) cutover = start z niepełnym lejkiem** dla Marty, Gosi (i częściowo Macieja).
4. **Pełny sync skryptem (~229 spraw / 30 dni) = realnie ~1 dzień pracy**, nie „kilka godzin”. **Jutro rano cutover + pełny sync B naraz — nie da się bezpiecznie.**  
   Realne ścieżki: **jutro tylko wariant A (ręcznie)** albo **sync B dziś–pt → cutover poniedziałek**.

---

## Ile leadów (bieżące, bez wygranych/przegranych)

Filtr: nie `lead_won` / `lead_lost`, nie zarchiwizowane, ruszane w ostatnich N dniach, bez etapu `service` (obsługa).

| | Gosia | Marta | Maciej | **Razem** |
|---|---:|---:|---:|---:|
| **30 dni** (rekomendowane) | 94 | 90 | 45 | **~229** |
| **90 dni** (szersze) | 289 | 240 | 72 | **~601** |
| Wszystkie „otwarte” w BB | ~5,7k | ~3,7k | ~330 | **nie bierzemy** |

W Twenty już są osobne leady z formularza/maili (Marta ~248, Gosia ~225, Maciej ~39) — sync **dokleja / ustawia etap**, nie dubluje po emailu.

---

## Opcje (wybierz jedną)

### Opcja A — cutover jutro (pt 28), bez skryptu

| | |
|---|---|
| **Co** | Każdy (Marta/Gosia/Maciej) ręcznie ustawia w Twenty **~10–15 najważniejszych** spraw z BB; reszta BB = archiwum do podglądu |
| **Ile** | ~45 spraw |
| **Czas** | **~45 min × osoba** (sesja z Dawidem) |
| **Sync skryptem** | nie |
| **Ryzyko** | niskie technicznie; część spraw „w toku” zostaje tylko w BB |
| **Cutover** | **jutro możliwe** |

### Opcja B — sync skryptem 30 dni → cutover w poniedziałek (31)

| | |
|---|---|
| **Co** | Jednorazowy import/sync z BB `/lead`: match po emailu → ustaw etap; brak w Twenty → utwórz lead (`BETTER_BITRIX_LEGACY`) |
| **Ile** | **~229** |
| **Czas** | **~1 dzień kalendarzowy** (realnie, nie optymistycznie) |
| **Harmonogram** | **dziś (cz)** decyzja + start skryptu + dry-run CSV · **pt** poprawki + apply · **pn 31** cutover (wyłączenie BB jako SoR) |
| **Ryzyko** | średnie (duplikaty, mapowanie etapów) — mitigacja: dry-run przed apply |
| **Cutover** | **poniedziałek** |

**Dlaczego nie krócej niż 1 dzień?**  
Trzeba: export z BB → match z Twenty → mapa etapów → dry-run do akceptacji → apply z limitem API + wyłączenie eventów analytics. Przy ~229 rekordach sam apply to godziny z throttlingiem; większe ryzyko to błędy matchowania, nie „czas CPU”. Skracanie = pominięcie dry-run = ryzyko duplikatów w lejku Day-1.

### Opcja C — sync 90 dni (~601)

Jak B, ale **1–2 dni** pracy i cutover raczej **wtorek / później**. Pełniejszy lejek, większy koszt przeglądu. **Nie rekomendowane**, jeśli celem jest szybki cutover.

### Opcja D — cutover jutro bez żadnego syncu / TOP

Zgodne ze **starym planem** (wyłączyć BB, pracować w Twenty na nowych).  
**Koszt:** Marta/Gosia startują z lejkiem, który **nie pokazuje aktualnej pracy z BB**. **Nie rekomendowane.**

---

## Czy jutro da się mieć sync i cutover?

| Pytanie | Odpowiedź |
|---|---|
| Cutover jutro + pełny sync B (~229)? | **Nie bezpiecznie.** Nawet start dziś rano → apply najwcześniej pt po południu, bez buforu na błędy. |
| Cutover jutro + tylko A (ręczny TOP)? | **Tak.** |
| Sync B w ~1 dzień? | **Tak, realne** — nie „za długo”, ale nie „kilka godzin”. |
| Cutover w poniedziałek po syncu B? | **Tak — najlepszy kompromis** tempo vs jakość. |

---

## Co świadomie pomijamy (we wszystkich opcjach)

- wygrane / przegrane,
- stara baza `/lead2`,
- ciągły dwukierunkowy sync (tylko **jednorazowy** most przed cutoverem),
- etap `service` (zostaje w BB jako archiwum obsługi — chyba że zdecydujesz inaczej),
- Ewa / Robert (Pipedrive już w Twenty).

---

## Decyzja (28.08.2026 — Mariusz)

```
Opcja: B (sync 30d ~229)
Apply: PIĄTEK po południu (problemy w piątek, nie pn pod mailami)
Cutover pracy: PONIEDZIAŁEK rano (delta przed 8:00)
service: NIE importować
BB po cutoverze: read-only min. 1 miesiąc (wyłączenie osobno)
```

**Wykonanie:** [CUTOVER_BB_SYNC_EXECUTION.md](./CUTOVER_BB_SYNC_EXECUTION.md)
