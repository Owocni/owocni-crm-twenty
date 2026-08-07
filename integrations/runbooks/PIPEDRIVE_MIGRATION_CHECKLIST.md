# Pipedrive → Twenty — decyzje

Metoda: `AUDIT_PIPEDRIVE_EXPORT_REDTEAM_v0.4.md` · `STRATEGY_PIPEDRIVE_IMPORT_TWENTY_v0_6_FINAL.md`

**Jeszcze otwarte:** brak.

---

## Podpisane (2026-07-31)

### Owner-map (skrót)

| Pipedrive | Twenty | WorkspaceMember ID | Okno wieku |
|-----------|--------|-------------------|------------|
| **Robert** | Robert Mańk (`robertmank@owocni.pl`) | `23ac9976-0232-4097-b056-5dc391bf7c34` | ≤ **3 lata** |
| **Krzysztof Gilowski** | **Ewa Malanowska** (`ewamalanowska@owocni.pl`) | `b9e2b31e-0b4a-4936-9d2a-2e5b4a3e0b16` | ≤ **3 lata** |
| **Kamil** (Matuszewski) | **Mariusz / konto ogólne** (`owocni@gmail.com`, UI: „Owocni Owocni”) | `2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d` | ≤ **3 lata** |
| **Patryk Sławicki** | j.w. | `2d65d0e6-…` | ≤ **3 lata** |
| niepowiązane (E5) | j.w. | `2d65d0e6-…` | ≤ **3 lata** |

Kryterium wieku (wszyscy ownerzy): `add_time` **nie starsza niż 3 lata** od cutoveru. Starsze — **poza importem**. To samo okno: maile (B2), archiwalne (E2).

> **2026-08-04:** Ewa potwierdzona w Twenty (mail podpięty, sync w toku — nie blokuje owner-map).  
> Konto docelowe Kamil/Patryk/E5 = **`owocni@gmail.com`** (`2d65d0e6-…`, UI „Owocni Owocni”) — **potwierdzone właściciel 2026-08-04** (tożsamość „ogólne konto Mariusz”).

### A1a / A3 — Krzysztof → Ewa Malanowska

**Wszystko z ownerem Krzysztof Gilowski w PD** (deale, aktywności/taski, powiązane ownershipy) → **Ewa Malanowska**.  
**Nie tworzymy** seata dla Krzyśka. Ewa = WorkspaceMember w Twenty przed loadem.

### A1b / D2a — Kamil → Mariusz Słowik

**Tak, migrujemy** dane Kamila (deale + Activities → Taski) na **Mariusz Słowik**.  
**Bez** osobnego konta dla Kamila.  
Tylko rekordy **nie starsze niż 3 lata**.

### A2 — Patryk → Mariusz Słowik

**Tak, przenosimy** dane Patryka na **Mariusz Słowik**.  
**Bez** osobnego konta.  
Tylko rekordy **nie starsze niż 3 lata**.

### B1 — mapa mail ↔ deal _(P-MAIL / audyt D1)_

**TAK — zapisujemy metadane powiązań z Mailbox API** (staging = dowód; bez tego strata przy IMAP).

**Użycie w Twenty: opcja B** — przy imporcie Opportunity krótka **Note** z podsumowaniem powiązań z PD (liczba wątków + wybrane subject/daty; bez pełnych treści maili).  
Opcja C (własne Message↔Opportunity) — poza zakresem, ewentualnie później.

### B2 — okno historii maili _(audyt D3)_

**Max 3 lata.**

### C1 — pipeline _(P-PIPE)_

Otwarte deale z PD **liczą się** do bieżącego pipeline. Wykluczać tylko metryki czasowe (M1/M2/M3).

### C2 — `bizProduct` _(P-PROD)_

**Mapuj z Pipedrive**, jeśli się da.

### C3 — `bizSource` _(P-SRC)_

Stała **`PIPEDRIVE_IMPORT`**.

### C4 — attribution-dark _(P-DARK)_

**Akceptujemy.**

### D1 — taski Roberta _(P-TASK)_

**Wariant A (Activities)** przy dealach/leadach. Nie Projects.

### D2b — taski Krzyśka

**Taski Ewy Malanowskiej**, `taskTarget` na jej Opportunity/Person. Nie zamieniamy w nowe leady.

### E1 — usunięte rekordy _(P-DEL)_

**Nie importujemy.**

### E2 — archiwalne _(P-ARCH)_

**Max 3 lata.**

### E3 — call logi _(P-CALL)_

**Odpuszczamy** (kolizja PBX). Activities typu call → Task.

### E4 — delete-webhooki _(audyt D2)_

**TAK — teraz.** Starych delete’ów nie importujemy (E1).

### E5 — zakres pull _(audyt D4)_

**Pull całego konta → staging.** Niepowiązane → **Mariusz Słowik**.

### Cross-dedup PD ↔ Twenty _(tożsamość)_

**Ręczny review kolizji** (email/telefon PD vs istniejący Twenty). Zero auto-merge, zero mintu `id_oid` przy imporcie. Kandydaci → lista do człowieka (powiąż / zostaw osobno / pomiń).

### T3 — `createdAt = add_time` (REST Twenty)

**PASS (2026-07-31).** POST `/people` i `/opportunities` z `createdAt=2024-03-15…` → wartość przyjęta i potwierdzona GET; rekordy smoke usunięte. Można ustawiać datę z PD przy imporcie REST.

---

## Notatka: Activities → Task (nie nowe Opportunity)

Dla Krzyśka / Kamila / Patryka: Activity → **Task** u docelowego ownera + powiązanie z dealem/osobą.  
Świadoma strata: oryginalny wykonawca (opcjonalnie w body: `[ex-owner: …]`).  
**Nie** tworzyć nowych Opportunity z tasków.

---

## Rozstrzygnięte wcześniej w dokumentach (nie wracamy)

- uczestnicy poza primary → note · line-itemy → suma + note · raty → note · historia stage → `closeDate`
- consent → note · `bitrixDealId` / `pipedriveId` różne cele · `@owocni.pl` → IMAP
- technika: v2 + v1-only, staging, SHA-256, nie deaktywować seatów/IMAP, ADR `PIPEDRIVE_LEGACY`, `pipedriveId` ×3, patch metryk, workflowy OFF, zero auto-merge / zero mintu `id_oid`
