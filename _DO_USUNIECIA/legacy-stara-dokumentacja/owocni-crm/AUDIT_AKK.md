# AUDIT_AKK — Audyt Konsystencji SSOT (kroki 1–10)

**Status:** Procedura operacyjna (fault-only)  
**Skrót:** AKK = Audyt Konsystencji SSOT  
**Owner:** Właściciel + LLM (tury) + developer (weryfikacja faultów)  
**Last updated:** 2026-05-28  
**Powiązane:** `DECISION_REGISTER.md` (#9, #14, #16), `CHECKLIST_REVIEW.html` blok 7, `AUDIT_MIGRACJA.md`

---

## Cel

Wykryć **tylko niespójności** (fault) między dokumentami SSOT i — w turach preflight — zgodność z Twenty 2.8.0 i Stape sGTM.

**Zasada pracy:** automat/LLM produkuje tabelę trafień; człowiek patrzy **wyłącznie na fault**, nie na „OK”.

---

## Kiedy który krok (macierz faz)

| Zakres | Kroki | Faza | Blokuje cutover? |
|--------|-------|------|------------------|
| Spójność wewnętrzna docs | **1–7** | **TERAZ** (tura A) | Pośrednio — karmi #12, #13, #14 |
| Konformność Twenty | **8** | **PREFLIGHT** (tura B, po P1) | Tak — ADR #16 |
| Konformność Stape + styk | **9** | **PREFLIGHT** (tura B) | Tak — ADR #10, #11 |
| Wykonalność operacyjna | **10** | **Szkic → domknięcie przed cutoverem** | Tak — uzupełnia AKK |
| Migracja masowa | `AUDIT_MIGRACJA.md` 1–7 | **PÓŹNIEJ** (przed dry-run importu) | Tak — osobny audyt |

**Nie mylić z:** `STRESS_TEST_PLAN.md` (runtime PASS/FAIL), `CHECKLIST_REVIEW.html` (decyzje biznesowe P1).

---

## Wejście (korpus)

### Obowiązkowe (tura A: kroki 1–7)

| # | Plik / źródło |
|---|----------------|
| 1 | `CRM_CONSTITUTION.md` |
| 2 | `CRM_ARCHITECTURE_CURRENT.md` |
| 3 | `DATA_MODEL.md` |
| 4 | `EVENT_CONTRACT.md` |
| 5 | `DECISION_REGISTER.md` |
| 6 | `CUTOVER_RUNBOOK.md` |
| 7 | `POC_MAPPING.md` |
| 8 | `IDENTITY_AND_INBOUND.md` |
| 9 | `STAGE_MAPPING.md` |
| 10 | `STRESS_TEST_PLAN.md` |
| 11 | `SALES_OPS_REQUIREMENTS.md` (tylko gdy dotyczy własności/reguł MVP) |
| 12 | **[Dokumentacja orkiestracji Sortowni](https://docs.google.com/document/d/1RJOx2FpknlnP5vUBmuX42UFbkcH3H4cdGTvlueMVtAw/edit?tab=t.jwr3op45t6an)** (Google Docs) |

### Opcjonalne ground truth (tura B: krok 9, weryfikacja styku)

| Źródło | Po co |
|--------|--------|
| [SORTOWNIA_V2_POPRAWIONY.js](https://github.com/AdrianKrauza/owocni/blob/main/SORTOWNIA_V2_POPRAWIONY.js) | Faktyczny resolve, multi-key write, normalizacja PII |
| [GoogleCloudRobot.js](https://github.com/AdrianKrauza/owocni/blob/main/GoogleCloudRobot.js) | task_queue, adaptery, retry |
| `docs.twenty.com` / llms.txt | Krok 8 |
| Dokumentacja Stape Store / sGTM | Krok 9 |

---

## Wyjście (format fault-only)

Jedna tabela — **tylko wiersze z trafieniem**. Pusty plik wyników = brak wykrytych kolizji **w zakresie danego kroku** (nie „system gotowy”).

### Szablon tabeli (CSV / arkusz)

```text
run_id | krok | wymiar | byt_lub_regula | lokalizacja_a | lokalizacja_b | opis_fault | severity | status | owner | uwagi
```

| Kolumna | Wartości |
|---------|----------|
| `run_id` | np. `AKK-2026-05-28-A` |
| `krok` | `1`…`10` |
| `wymiar` | `wewnetrzny` \| `twenty` \| `stape` \| `operacyjny` |
| `severity` | `P1` \| `P2` \| `info` |
| `status` | `open` \| `fixed` \| `wontfix` \| `deferred` |

**Severity — propozycja:**

- **P1** — sprzeczność normatywna, brak właściciela id_oid, kanał bez triggera, event_name legacy (`WON`, `closed_won`)
- **P2** — synonimy, definicje rozjeżdżone bez wpływu na cutover w 7 dni
- **info** — do ADR / Etap 2

---

## Wykonawca

| Tura | Kroki | Kto |
|------|-------|-----|
| A | 1–7 | LLM bez wiedzy dziedzinowej (zero-shot) + 1 pass człowieka na P1 |
| B | 8–9 | Developer + LLM z dostępem do docs.twenty.com i kodu Sortowni |
| C | 10 | Właściciel + owner Sortowni (checklist operacyjna) |

LLM **nie zamyka** faultów — tylko je wystawia. Zamknięcie = zmiana w SSOT + wpis `status=fixed` + commit/docs.

---

## Kroki 1–7 — spójność wewnętrzna (TERAZ)

### Krok 1 — Inwentaryzacja bytów

Przejdź korpus, wyekstrahuj każdy nazwany byt do rejestru:

- eventy (`event_name`)
- pola CRM (Twenty custom)
- role, adaptery, komponenty (Sortownia, Robot, Ratownik…)
- stany (stage)
- klucze (`id_oid`, `id_event`, `Job_ID`, `order_id`)
- kanały wejścia

**Fault:** byt wymieniony w tekście bez definicji lub bez lokalizacji w żadnym pliku SSOT.

### Krok 2 — Test unikalności nazwa↔byt (bijekcja)

Dla każdej nazwy: czy wskazuje dokładnie jeden byt (brak homonimów) i czy byt ma jedną nazwę kanoniczną (brak synonimów).

**Fault:** `purchase` / `lead_won` / `WON` / `closed_won` jako to samo lub różne byty bez mapowania.

### Krok 3 — Test unikalności definicji

Dla bytu w ≥2 plikach: porównaj definicje operacyjne.

**Fault:** ten sam byt zdefiniowany różnie (np. sandbox, `campaignRejected`, źródło `id_oid`).

### Krok 4 — Test niesprzeczności reguł

Wyekstrahuj zdania normatywne (MUSI / NIE WOLNO / zawsze / nigdy / mutually exclusive). Szukaj par, których nie da się spełnić jednocześnie.

**Fault:** np. „Twenty mintuje id_oid” vs „tylko Sortownia mintuje id_oid”.

### Krok 5 — Test jednoznaczności własności

Dla klas: stan sprzedaży, `id_oid`, wartości konwersji, outbox, retry, alerty — dokładnie jeden właściciel (system + rola).

**Fault:** ta sama klasa u dwóch właścicieli lub klasa bez właściciela.

### Krok 6 — Test integralności referencyjnej

Każde odwołanie (plik, sekcja, event, pole, adapter) → czy cel istnieje.

**Fault:** link do usuniętego bytu, pole w `EVENT_CONTRACT` bez wpisu w `DATA_MODEL`.

### Krok 7 — Test pokrycia kanałów wejścia

Dla każdego fizycznego kanału: trigger `id_oid` (przez Sortownię) **LUB** adnotacja „sierota + konsekwencja”.

**Fault:** kanał bez obu (np. `kontakt@`, telefon, skrzynka handlowca, polecenie).

**Powiązanie checklisty:** pytania **I1**, **I2** w `CHECKLIST_REVIEW.html`.

---

## Krok 8 — Konformność Twenty 2.8.0 (PREFLIGHT)

Dla założeń opartych o Twenty:

- czy natywne byty (Opportunity, Person, stage, webhook OUT) istnieją i znaczą to, co zakładamy;
- czy mechanizm jest realny w 2.8.0 (webhook OUT, payload, custom fields, limity);
- czy warstwa nazewnicza (`idOid`, `campaignRejected`) jest dozwolona (API name, unique, nullable).

**Fault:** założenie sprzeczne z docs **lub** oparte na niezweryfikowanej pamięci / POC.

**Powiązanie:** ADR #16, `ops/OPS_NOTES.md`.

---

## Krok 9 — Konformność Stape sGTM + styk (PREFLIGHT)

Na granicy Twenty ↔ Stape ↔ Sortownia:

- format pól webhooka = oczekiwania adaptera;
- byty Stape (`Job_ID`, `id_event`, Store, Lista Zadań) zgodne z faktyczną nomenklaturą;
- kontrakt spójny po obu stronach (wysyłane = odbierane).

**Fault:** rozjazd nazwa/format/kontrakt; nazwa Stape użyta niezgodnie z semantyką.

**Ground truth:** kod Sortowni/Robot przy sporze docs vs kod — **kod wygrywa do czasu rekonsyliacji docs**.

**Powiązanie:** ADR #10, #11.

---

## Meta-pytanie (odpowiedź SSOT)

> Czy pusty wynik AKK (kroki 1–9) jest **wystarczającym** dowodem, że SSOT jest spójny i konformny z Twenty + Stape?

### Odpowiedź: **NIE**

Pusty AKK oznacza tylko: brak wykrytych kolizji **w zakresie dokumentów i konformności platform w opisie**.

Nie pokrywa m.in.:

| Klasa poza 1–9 | Gdzie domykamy |
|----------------|----------------|
| Wyścigi runtime / kolejność eventów | `STRESS_TEST_PLAN.md` (S1, S1b), kod Sortowni |
| Legacy równoległe (`julia362`) | `CUTOVER_RUNBOOK.md`, ADR #12 |
| Konflikt 2× `id_oid` (email vs phone → 2 profile) | ADR #13, reguła merge + manual queue |
| Import masowy bez fałszywych triggerów | `AUDIT_MIGRACJA.md` krok 4 |
| Funkcje handlowca dnia po cutoverze | `SALES_OPS_REQUIREMENTS.md`, ADR #15 |
| Ludzki SOP (`kontakt@`, ręczny lead) | `IDENTITY_AND_INBOUND.md` |

**Wniosek operacyjny:** zielone światło na cutover wymaga: **AKK fault=0 (P1)** + **stres-testy PASS** + **P1 ADR zamknięte** + (opcjonalnie) **Audyt Migracji** przed importem.

---

## Krok 10 — Audyt wykonalności operacyjnej (szkic, do rozpisania)

Dla każdej reguły normatywnej z kroku 4:

| Pytanie | Oczekiwana odpowiedź |
|---------|----------------------|
| Czy ma test w sandbox? | Tak / N/A (Etap 2) |
| Czy ma owner? | Rola + imię |
| Czy ma SOP lub automat? | Link do runbooka / adaptera |
| Czy fault z AKK ma ticket? | `run_id` + wiersz tabeli |

**Fault kroku 10:** reguła MUSI bez testu, ownera ani SOP przed cutoverem.

---

## Procedura uruchomienia (automat / LLM)

### Tura A — teraz

1. Ustal `run_id` (np. `AKK-2026-05-28-A`).
2. Wklej korpus (lista plików powyżej) do LLM z promptem: *„Wykonaj kroki 1–7. Zwróć wyłącznie tabelę fault. Brak fault = jedna linia: BRAK_TRAFIEN_K1_K7.”*
3. Importuj CSV do arkusza `AKK_faults`.
4. Filtruj `severity=P1` → przypisz owner → wpisz do `DECISION_REGISTER` lub zamknij poprawką w SSOT.
5. Powtórz po każdej większej edycji SSOT (delta: tylko zmienione pliki + krok 6 odwołań).

### Tura B — preflight

Kroki 8–9 z dostępem do docs.twenty.com + fragmentów kodu Sortowni. Fault P1 blokuje Fazę 4 (eventy) z `PLAN_DZIALAN.md`.

### Raport dla szefa (1 strona)

- Liczba fault P1 / P2 / open
- Top 5 faultów (krótki opis)
- Czy meta-pytanie: NIE (świadomie)
- Następny krok (np. domknięcie #14, I1–I4, S1b)

---

## Prompt startowy (kopia do LLM — tura A)

```text
Jesteś audytorem SSOT bez wiedzy dziedzinowej OWOCNI.
Wejście: [wklej pliki korpusu].
Wykonaj AUDIT_AKK kroki 1–7 zgodnie z AUDIT_AKK.md.
Zasady:
- Zwróć WYŁĄCZNIE wiersze fault (tabela: run_id, krok, wymiar, byt_lub_regula, lokalizacja_a, lokalizacja_b, opis_fault, severity).
- wymiar = wewnetrzny dla kroków 1–7.
- Nie pisz podsumowań „wszystko OK” — jeśli brak fault, jedna linia: BRAK_TRAFIEN_K1_K7.
- Priorytet: homonimy eventów (purchase/WON/closed_won), id_oid ownership, kanały bez triggera.
run_id = [USTAW]
```

---

## Powiązanie z checklistą review

| Checklist | AKK |
|-----------|-----|
| **A1** | Tura A (1–7) uruchomiona fault-only |
| **A2** | Meta-pytanie: pusty AKK ≠ cutover OK |
| **A3** | Tura B (8–9) zaplanowana po P1 |
| **I1–I4** | Krok 7 + krok 5 + STRESS_TEST (nie zastępują AKK) |

Zobacz `CHECKLIST_REVIEW.html` blok 7.

---

## Historia uruchomień

| run_id | Data | Kroki | P1 open | Uwagi |
|--------|------|-------|---------|-------|
| *(puste — pierwszy run po utworzeniu procedury)* | | | | |
