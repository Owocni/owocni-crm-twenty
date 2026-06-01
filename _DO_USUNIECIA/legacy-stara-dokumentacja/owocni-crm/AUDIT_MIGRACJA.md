# AUDIT_MIGRACJA — Audyt Migracji (kroki 1–7)

**Status:** Procedura — **PÓŹNIEJ** (przed dry-run importu / Faza 3)  
**Skrót:** nie uruchamiać równolegle z pierwszą turą `AUDIT_AKK.md`  
**Owner:** Developer + LLM (tury) + właściciel (semantyka stage)  
**Last updated:** 2026-05-28

---

## Cel

Wykryć faulty w przejściu **źródło (Bitrix / Supabase legacy)** → **Twenty 2.8.0** + **Sortownia (Profil Klienta / `id_oid`)**, bez fałszywych triggerów outbound i bez utraty ciągłości pracy handlowca.

**Zasada:** fault-only — patrzymy tylko na trafienia.

---

## Kiedy uruchomić

| Moment | Dlaczego |
|--------|----------|
| **NIE teraz** (pre-P1) | Brak zamrożonego mapowania, otwarte ADR #12/#13, brak daty cutover |
| **TAK przed dry-run importu** | Gdy `STAGE_MAPPING.md` + plan w `migration/README.md` są zamrożone |
| **TAK po AKK tura A** | Wewnętrzna spójność nazw eventów (#14) musi być domknięta wcześniej |

---

## Co przygotować już teraz (bez pełnego audytu)

| Zadanie | Plik | Cel |
|---------|------|-----|
| Szkic mapowania stage Bitrix → Twenty | `STAGE_MAPPING.md` | Skraca krok 1–2 później |
| Zasada: import ≠ event outbound | `migration/README.md` | Skraca krok 4 |
| Lista funkcji MVP vs Etap 2 | `SALES_OPS_REQUIREMENTS.md` | Skraca krok 5 |

---

## Wejście

- Stan źródłowy: Bitrix / Supabase (eksport, opis pól, stage Kanban)
- Model docelowy: `DATA_MODEL.md`, Twenty 2.8.0 schema
- Sortownia: reguły `id_oid` w Profilu Klienta (`IDENTITY_AND_INBOUND.md`, ADR #13)
- `CUTOVER_RUNBOOK.md`, `migration/README.md`

---

## Wyjście (szablon tabeli)

```text
run_id | krok | byt | zrodlo | cel | opis_ryzyka | severity | status | owner | uwagi
```

Pusty wynik = brak wykrytych zagrożeń **w zakresie 7 kroków** (nie „migracja bezpieczna” bez stres-testów).

---

## Kroki 1–7

### Krok 1 — Kompletność mapowania (surjekcja źródła)

Każdy byt źródłowy (stage, pole, relacja, funkcja operacyjna) ma cel w Twenty **lub** adnotację „porzucamy + konsekwencja”.

**Fault:** byt źródłowy bez celu i bez świadomej decyzji.  
**Pochłania:** część ADR #15 (stage + pola).

### Krok 2 — Zachowanie semantyki przy mapowaniu

Para źródło→cel: to samo znaczenie operacyjne (np. Bitrix „Kwalifikowany” = Twenty QUALIFIED = trigger `qualify_lead`).

**Fault:** mapowanie nazwa→nazwa przy rozjeździe znaczeń.

### Krok 3 — Zachowanie relacji

Person↔Company, lead↔historia przetrwają import.

**Fault:** relacja się rozpada lub spłaszcza bez decyzji.

### Krok 4 — Brak fałszywych wyzwoleń (import ≠ ruch operacyjny)

Operacja masowa **nie** generuje: eventu do platform, mint `id_oid`, workflow, alertu outbound.

**Fault:** import wyzwala cokolwiek outbound.  
**Przykłady:** rekord w stage=QUALIFIED wyzwala `qualify_lead`; pusty rekord wyzwala `generate_lead`.

### Krok 5 — Ciągłość operacyjna

Funkcje wymagane „dnia po cutoverze” (szablony, wysyłka o godzinie, wyszukiwarka…) — dostępne w Twenty lub mają workaround.

**Fault:** blocker bez ścieżki.  
**Uwaga:** większość z `SALES_OPS_REQUIREMENTS.md` = Etap 2+ — oznacz `deferred`, nie P1, jeśli zaakceptowane w ADR #15.

### Krok 6 — Integralność tożsamości po imporcie

Legacy `id_oid`: zgodność z Profilem w Sortowni. Brak `id_oid`: zdefiniowana ścieżka uzupełnienia.

**Fault:** osierocony `id_oid` lub luka tożsamości.

### Krok 7 — Odwracalność i dowód

Ledger (każdy rekord = wiersz, suma się zgadza) + procedura cofnięcia.

**Fault:** operacja bez audytowalnego śladu lub bez rollbacku.

---

## Powiązanie z AKK i checklistą

| Dokument | Relacja |
|----------|---------|
| `AUDIT_AKK.md` | Najpierw spójność docs (1–7), potem migracja |
| `STRESS_TEST_PLAN.md` | Runtime po imporcie próbnym |
| Checklist **A4** | „Audyt migracji dopiero przed dry-run” |

---

## Historia uruchomień

| run_id | Data | P1 open | Uwagi |
|--------|------|---------|-------|
| *(nie uruchamiano)* | | | |
