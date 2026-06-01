---
doc_id: AUDIT_MIGRACJA
title: "AUDIT_MIGRACJA — protokół audytu migracji danych (7 kroków + preflight)"
layer: audit
status: active
edit_scope: content_and_structure
owner: "Dawid (wykonawca techniczny)"
last_verified: 2026-05-31
recheck_trigger: "nowa migracja / zmiana modelu danych / nowa relacja obiektów"
default_trust: D:CORE
related:
  - EVENT_CONTRACT
  - DATA_MODEL
  - IDENTITY_AND_INBOUND
  - runbooks/IMPLEMENTATION_PLAN
---

# AUDIT_MIGRACJA — protokół audytu migracji

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** protokole audytu migracji danych (7 kroków: surjekcja → semantyka → relacje → false-triggers → ciągłość → tożsamość → odwracalność); preflight importu (czy pola/opcje/użytkownicy/relacje istnieją); side-effect guard (import nie emituje, nie mintuje); interpretacji wyniku audytu.

**Ten plik NIE decyduje o:** semantyce eventów (→ `EVENT_CONTRACT.md`); regułach tożsamości (→ `IDENTITY_AND_INBOUND.md`); harmonogramie cutoveru (→ `runbooks/IMPLEMENTATION_PLAN.md`).

**Zawsze czytaj razem z:** `EVENT_CONTRACT.md` §5.4 (cold-start / no_emit), `DATA_MODEL.md` (pola docelowe), `runbooks/IMPLEMENTATION_PLAN.md` (G6 import-safety).

**Najgroźniejszy błąd:** uznać „pusty wynik audytu" za „migracja bezpieczna". Pusty wynik = brak wykrytych faultów w 7 krokach, NIE dowód bezpieczeństwa.

**Przy konflikcie:** procedura audytu importu — ten plik. Semantyka emisji → `EVENT_CONTRACT.md`.

**Zmiana wymaga:** ADR (kroki audytu = `[D:CORE]`; numeracja 1–7 nietykalna).

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | **NIE renumerować ani nie zwijać 7 kroków audytu.** Numeracja 1–7 jest kotwicą (ludzie i ADR odwołują się do „kroku 4"). | Renumeracja zrywa odwołania zewnętrzne. | Niespójne odniesienia w ADR/runbookach. | Właściciel + ADR | §5 |
| NR-2 | **NIE pisać „pusty wynik = migracja bezpieczna".** Pusty wynik = brak faultów w 7 krokach, nie dowód bezpieczeństwa. | Fałszywe poczucie bezpieczeństwa = cutover na niezaudytowanym ryzyku. | Nieodwracalna szkoda mimo „zielonego" audytu. | — | §5.8 |
| NR-3 | **Import / backfill / replay NIGDY nie emituje do platform i NIGDY nie mintuje `id_oid`.** | Sygnał reklamowy nieodwracalny; mint przy imporcie = rozdwojenie tożsamości. | Wydane budżety / zduplikowana tożsamość. | Właściciel + ADR | §5.4 + `EVENT_CONTRACT.md` |

---

## 2. PURPOSE

Protokół audytu poprawności migracji danych do Twenty: czy mapowanie legacy → Twenty jest pełne, semantycznie spójne, bez fałszywych triggerów i odwracalne. Plus preflight importu i guard side-effectów. Status: przed cutoverem.

---

## 3. SCOPE

### Pokrywa
- 7 kroków audytu migracji; preflight importu; side-effect guard; interpretację wyniku.

### Nie pokrywa
- Semantyki eventów (→ `EVENT_CONTRACT.md`), tożsamości (→ `IDENTITY_AND_INBOUND.md`), harmonogramu (→ `runbooks/IMPLEMENTATION_PLAN.md`).

---

## 4. CANONICAL DEFINITIONS

- **Surjekcja mapowania** = każdy stan/pole legacy ma cel w Twenty (brak osieroconych danych).
- **False-trigger** = import/zmiana stanu przy migracji wyzwala workflow/webhook → fałszywy event.
- **Bramy 0–2** = wcześniejsze bramy wstępne audytu (dawniej „AKK"); tu numeracja własna kroków 1–7 jest niezależna i nietykalna.
- **Pusty wynik** = brak wykrytych faultów w 7 krokach. NIE równa się „migracja bezpieczna" (NR-2).

---

## 5. BODY — protokół audytu

> **Numeracja 1–7 nietykalna (NR-1).** Każdy krok: co sprawdzamy → jak → fault jeśli FAIL.

### Krok 1 — Surjekcja mapowania (kompletność)
Czy każdy stan/pole/etap legacy (better-bitrix, Supabase) ma jednoznaczny cel w Twenty? Sprawdź: stage'e, pola PII, atrybucję, statusy won/lost/rejected. **Fault:** stan legacy bez celu = osierocone dane po migracji.

### Krok 2 — Semantyka (spójność znaczeń)
Czy znaczenie pola/stage'a jest identyczne po obu stronach? Np. „qualified" legacy ≡ QUALIFIED Twenty? `campaignRejected` ≡ semantyka odrzucenia BB? **Fault:** to samo pole, inne znaczenie = zatruta historia.

### Krok 3 — Relacje (integralność)
Czy relacje Person ↔ Company ↔ Opportunity są zmapowane i niezerwane? Czy `id_oid` łączy rekordy cross-system? **Fault:** zerwana relacja = lead bez firmy / osierocony Opportunity.

### Krok 4 — False-triggers (cisza importu)
Czy import NIE wyzwala workflowów create/update ani native webhooka OUT? Wszystkie workflowy create/update **OFF** podczas importu (CRM_CONSTITUTION Prawo 7c). Adapter w trybie `no_emit` (EVENT_CONTRACT §5.4 cold-start). **Fault:** import emituje fałszywe `qualify_lead`/`purchase` do platform = nieodwracalny sygnał reklamowy.

### Krok 5 — Ciągłość (brak luk czasowych)
Czy w oknie cutoveru żaden lead nie ginie (backup inbound Sheets działa; ledger importu kompletny)? **Fault:** lead utworzony w oknie przełączenia przepada.

### Krok 6 — Tożsamość (brak rozdwojenia)
Czy import NIE mintuje nowych `id_oid` dla rekordów już mających tożsamość? Czy fail-closed działa, gdy Stape niedostępny w trakcie? **Fault:** drugi mint = rozdwojenie tożsamości klienta (nieodwracalne).

### Krok 7 — Odwracalność (rollback)
Czy migrację da się wycofać (legacy reaktywowalne, leady z okna do ręcznego przeglądu)? **Fault:** brak ścieżki rollbacku = cutover bez wyjścia awaryjnego.

### 5.8 Interpretacja wyniku

**Pusty wynik audytu = brak wykrytych faultów w 7 krokach powyżej. To NIE znaczy „migracja bezpieczna".** Bezpieczeństwo wymaga dodatkowo: PASS bram systemowych (`runbooks/IMPLEMENTATION_PLAN.md` §5.4), przeszkolonych użytkowników i sprawnego rollbacku. Audyt wyklucza znane klasy błędów — nie nieznane (NR-2).

### 5.9 Import preflight (przed uruchomieniem importu)

| Sprawdzenie | Warunek PASS | Źródło |
|---|---|---|
| Pola docelowe istnieją | Wszystkie pola krytyczne utworzone z właściwym typem/API name | `DATA_MODEL.md` |
| Opcje SELECT istnieją | Wartości stage / bizSource / bizProduct zdefiniowane przed importem | `DATA_MODEL.md` §5.5 |
| Użytkownicy / owners istnieją | Konta handlowców w Twenty + mapowanie Opportunity owner | `IDENTITY_AND_INBOUND.md` §5.5 |
| Relacje zmapowane | Person ↔ Company ↔ Opportunity klucze gotowe | krok 3 |
| Format znacznika czasu | Spójny (epoch ms — FIX-2) | `runbooks/IMPLEMENTATION_PLAN.md` §5.7 |

### 5.10 Side-effect guard (w trakcie importu)

1. Workflowy create/update **OFF** (Prawo 7c).
2. Adapter `inbound:twenty_webhook` → tryb `no_emit` (zero sygnałów do platform — INV-6).
3. **Brak workflow HTTP** odpalającego się przy imporcie (NR-3 + `ARCHITECTURE.md` NR-3).
4. **Import NIE mintuje `id_oid`** — rekordy z istniejącą tożsamością zachowują `id_oid`; rekordy bez → kolejka resolvera po imporcie, nie w trakcie.
5. Native webhook OUT — wyłączony lub odbiornik w `no_emit` na czas importu.

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| Cold-start / no_emit / mapowanie eventów | `EVENT_CONTRACT.md` §5.4 |
| Pola docelowe, opcje SELECT, frozen | `DATA_MODEL.md` |
| Fail-closed, owners, resolver | `IDENTITY_AND_INBOUND.md` |
| Brama G6 import-safety, harmonogram, FIX-2 | `runbooks/IMPLEMENTATION_PLAN.md` |
| Zakaz workflow HTTP, backup inbound | `ARCHITECTURE.md` |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-AU1 | Zakres importu: tylko aktywne leady czy pełna historia BB? | Właściciel | cutover | przed importem |

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| 7 kroków audytu wykonanych na próbce | Preflight | Dawid | raport audytu |
| Import preflight §5.9 — wszystkie PASS | Przed importem | Dawid | checklist |
| Side-effect guard §5.10 aktywny w teście importu | Przed importem | Dawid | runtime (zero EMITTED) |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:CORE`. Inline = odchylenie.
