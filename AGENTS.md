---
doc_id: AGENTS
title: "AGENTS — obowiązkowy protokół pracy LLM w tym repo"
layer: governance
status: active
owner: "Właściciel + Dawid"
last_verified: 2026-06-02
recheck_trigger: "zmiana struktury SSOT / nowy adapter / incydent rozjazdu docs↔kod"
default_trust: D:CORE
---

# AGENTS — protokół pracy LLM (obowiązkowy)

Ten projekt jest **długotrwały i wielowarstwowy** (Twenty, Sortownia, Stape, Robot, SSOT, integracje).  
**Tryb „jedno zdanie → agent edytuje repo” jest zakazany** — prowadzi do lokalnie poprawnych, globalnie szkodliwych zmian.

LLM **pomaga**, ale **nie decyduje samodzielnie** o strukturze systemu, governance ani cutover.

---

## 1. Zasady nadrzędne (nie negocjuj)

1. **Nie wykonuj szerokich poleceń** typu: „popraw repo”, „uporządkuj dokumentację”, „zsynchronizuj wszystko”, „przejrzyj i napraw niespójności”.
2. **Każda zmiana wymaga wskazanego SSOT** — pliku‑właściciela typu treści (patrz §3). Bez tego: **STOP i zapytaj**.
3. **Nie twórz równoległych zasad** w nowych plikach bez struktury i bez ADR. Runbooki opisują *jak*, SSOT opisuje *co*.
4. **Nie zmieniaj struktury „przy okazji” implementacji** — najpierw problem, potem decyzja (człowiek), potem ADR jeśli trzeba.
5. **Implementacja nie może wyprzedzać dokumentacji** — ten sam PR/zmiana aktualizuje SSOT albo jawnie zostawia `[D:OPEN]` z planem domknięcia.
6. **Nie domykaj `[D:OPEN]`** ani nie zamieniaj `[D:RESEARCH]` na `[D:CORE]` bez testu + wpisu w `DECISION_REGISTER.md`.
7. **Nie czytaj jako SSOT:** `_DO_USUNIECIA/**`, `integrations/archive/**`, `owocni-crm/archive/**`.
8. **MCP/AI default: read-only** — zapis tylko po aprobacie człowieka (`CRM_CONSTITUTION.md` §5.1).

---

## 2. Wejście do repo (kolejność czytania)

| Krok | Plik | Po co |
|------|------|--------|
| 1 | **Ten plik** (`AGENTS.md`) | Protokół |
| 2 | [`REVIEW_PACKAGE.md`](REVIEW_PACKAGE.md) | Jeśli review / handoff |
| 3 | [`owocni-crm/README.md`](owocni-crm/README.md) | Navigator → plik‑właściciel |
| 4 | [`owocni-crm/CRM_CONSTITUTION.md`](owocni-crm/CRM_CONSTITUTION.md) §0, §0a | INVARIANTS + konflikty |
| 5 | Plik‑właściciel zadania (§3) | Konkretna domena |
| 6 | [`integrations/README.md`](integrations/README.md) | Tylko jeśli dotyczy kodu runtime |

**Semantyka:** `owocni-crm/`  
**Kod prep:** `integrations/` (bez `archive/`)  
**Przy sprzeczności semantyki eventów:** `EVENT_CONTRACT.md` wygrywa nad kodem.

---

## 3. Mapowanie: typ zmiany → plik SSOT (Primary)

| Typ zmiany | Primary (zacznij tutaj) | Secondary |
|------------|-------------------------|-----------|
| Zakazy, role, governance, ADR | `owocni-crm/CRM_CONSTITUTION.md` | `DECISION_REGISTER.md` |
| Pola, FROZEN, prefiksy | `owocni-crm/DATA_MODEL.md` | `CRM_CONSTITUTION.md` |
| Eventy, webhook, L-1, smoke | `owocni-crm/EVENT_CONTRACT.md` | `DATA_MODEL.md` |
| Tożsamość, kanały, Resolver | `owocni-crm/IDENTITY_AND_INBOUND.md` | `EVENT_CONTRACT.md` |
| Granice systemów, przepływy | `owocni-crm/ARCHITECTURE.md` | `EVENT_CONTRACT.md` |
| Decyzja / cutover / blocker | `owocni-crm/DECISION_REGISTER.md` | `IMPLEMENTATION_PLAN.md` |
| Plan, bramy G1–G8 | `owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` | `DECISION_REGISTER.md` |
| Fakt Twenty (HMAC, credits) | `owocni-crm/ops/OPS_NOTES.md` | — |
| Kod Sortownia/Robot/Twenty paths | `integrations/` + `TWENTY_PATHS.md` | `EVENT_CONTRACT.md` |
| Import / migracja danych | `owocni-crm/audits/AUDIT_MIGRACJA.md` | `EVENT_CONTRACT.md` |

Tabela w `owocni-crm/README.md` (Primary / Secondary) ma to samo znaczenie nawigacyjne.

---

## 4. Obowiązkowy workflow przed edycją (każde zadanie)

```
READ → CLASSIFY → LOCATE SSOT → PLAN (w odpowiedzi) → DIFF → VERIFY → UPDATE SSOT
```

| Etap | Co zrób |
|------|---------|
| **READ** | Przeczytaj INVARIANTS (CONSTITUTION §0) + plik‑właściciel + sekcję, którą dotykasz |
| **CLASSIFY** | Strukturalna / semantyczna / proceduralna / kosmetyczna (CONSTITUTION Prawo 2) |
| **LOCATE** | Jeden Primary z §3; nie edytuj „podobnych” plików bez uzasadnienia |
| **PLAN** | W odpowiedzi: które pliki, dlaczego, czego NIE ruszasz, czy potrzebny ADR |
| **DIFF** | Minimalny zakres — bez refaktoru „przy okazji” |
| **VERIFY** | Brak sprzeczności z INVARIANTS; `[D:OPEN]` zostaje otwarte |
| **UPDATE SSOT** | Ta sama sesja: docs + kod (jeśli oba dotknięte) |

Jeśli zadanie dotyka **Event Contract, Twenty, Stape, struktury repo lub governance** — w PLAN wskaż: *„wymaga potwierdzenia człowieka przed zapisem”*.

---

## 5. Zakazane prompty (odmów i zaproponuj wąski zakres)

- „Popraw / uporządkuj całe repo”
- „Zsynchronizuj dokumentację z kodem” (bez listy plików)
- „Zamknij wszystkie OPEN”
- „Zaimplementuj cutover”
- „Deploy na produkcję”
- „Usuń `_DO_USUNIECIA`” (bez osobnej decyzji właściciela)

**Zamiast tego poproś o:** jeden plik, jeden ADR, jeden adapter, jeden test — z nazwą SSOT.

---

## 6. Konstytucja — tabela §5.2 to INDEKS, nie pełne prawo

W `CRM_CONSTITUTION.md` sekcja **„Rdzeń (nazwa + Test)”** to skrót nawigacyjny.

**Przed implementacją lub cytowaniem prawa jako reguły:** przeczytaj **§5.3 Pełne brzmienie praw** dla danego numeru.

Traktowanie samej tabeli §5.2 jako kompletu reguł = **błąd proceduralny**.

---

## 7. Konflikt dokumentacja ↔ kod

| Sytuacja | Co wygrywa |
|----------|------------|
| Semantyka biznesowa (eventy, stage, idOid) | `owocni-crm/` SSOT |
| **Zweryfikowany** runtime + test na sandbox | może wymusić aktualizację SSOT w tej samej zmianie |
| Kod eksperymentalny / niezweryfikowany | **nie** nadpisuje SSOT po cichu |
| Fakt platformy Twenty | `ops/OPS_NOTES.md` + instancja |

**Zakaz:** zmienić kod i zostawić sprzeczny SSOT (lub odwrotnie) bez wpisu w `DECISION_REGISTER.md`.

---

## 8. Pliki pomocnicze (nie zastępują SSOT)

| Plik | Rola |
|------|------|
| `integrations/runbooks/LLM_ANTI_WPADKI_GO_NO_GO.md` | Checklist przed deployem |
| `integrations/INTEGRATIONS_PARITY.md` | Stan docs ↔ kod integracji |
| `integrations/TWENTY_PATHS.md` | Mapa ścieżek Twenty |
| `integrations/runbooks/NEXT_STEPS.md` | Kolejność faz operacyjnych |

---

## 9. Definition of Done (agent)

Zadanie uznaj za zakończone tylko gdy:

- [ ] Edytowany był właściwy plik‑właściciel (Primary)
- [ ] PLAN z §4 był widoczny przed diffem
- [ ] SSOT i kod (jeśli dotyczy) są spójne
- [ ] Nie powstał nowy plik „zasad” bez ADR
- [ ] `[D:OPEN]` nie zostało zamknięte bez dowodu
- [ ] Użytkownik wie, co wymaga **jego** akceptacji przed deployem

---

## 10. Eskalacja

Zatrzymaj się i zapytaj człowieka, gdy:

- sprzeczność między plikami SSOT,
- zmiana strukturalna / FROZEN / cutover,
- niejasny payload Twenty (brak preflight),
- potrzeba nowego pliku kanonicznego w `owocni-crm/`,
- merge policy / L-1 / smoke #4.

**Nie zgaduj.** Lepiej jedno pytanie niż cichy dług techniczny.
