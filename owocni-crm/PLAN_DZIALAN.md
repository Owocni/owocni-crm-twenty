# Plan działań — OWOCNI CRM na Twenty (SSOT-first)

**Status:** aktywny od 2026-05-28  
**Owner techniczny wdrożenia:** Dawid (Twenty, GTM, sGTM, Stape/Sortownia)  
**Uzgodnienia:** Mariusz, Krzysztof (przełożeni — nie wykonawcy wdrożenia)  
**Harmonogram:** ten dokument + praca w Cursor (Dawid)

---

## Role i odpowiedzialność

| Kto | Rola |
|-----|------|
| **Dawid** | Wdrożenie: Twenty, GTM, sGTM, Stape, Sortownia, adaptery, Email Sync, webhook OUT, aktualizacja docs orkiestracji (#14), routing w Sortowni (#10) |
| **Mariusz, Krzysztof** | Przełożeni — akceptacja kierunku, decyzje biznesowe; **nie** przypisani jako wykonawcy techniczni |
| **Handlowcy** | Znają już stage’e i różnicę LOST vs „Odrzuć leada”; przed cutoverem = **nowe szkolenie Twenty** (patrz niżej) |
| **Właściciel produktu** | Cutover date, scope Etap 2, Twenty Pro vs Org (#6) |

---

## Etap 1 — podział na fazy (plan od początku)

Cutover **dopiero** gdy mamy **parzystość funkcjonalną** z better-bitrix (obecny CRM) + testy PASS.

| Faza | Co wchodzi | Uwagi |
|------|------------|--------|
| **Etap 1.1** | Schema Twenty, paid inbound (Sortownia→Twenty), native webhook OUT + adapter, szablony maili z better-bitrix, szkolenie zaplanowane | julia362 **włączone** dla maili do czasu 1.2 |
| **Etap 1.2** | Email Sync: `leads@`, `studio@`, skrzynki handlowców; Identity Resolver (ADD-1…3); odpowiedzi mailowe w Twenty | **Nie** obejmuje `kontakt@` |
| **Testy** | S0–S5, S1b, parzystość z better-bitrix | Bramka przed datą cutover |
| **Cutover** | Data **po** testach — gdy wiemy, że wszystko gotowe (#8) | `CUTOVER_RUNBOOK.md` |

**`kontakt@owocni.pl`:** skrzynka istnieje (spam w backlogu), **nie podłączamy** — jawnie poza obsługą CRM.

---

## Must-have przed cutover (operacyjne)

| # | Element | Status planu |
|---|---------|----------------|
| 1 | **Szablony email** przeniesione z better-bitrix → Twenty | **Must-have na start** (przed odejściem od better-bitrix) |
| 2 | **Szkolenie handlowców** — Twenty UI, stage’e, „Odrzuć leada”, mail w Twenty | Zaplanować przed przełączeniem (handlowcy znają już logikę z Bitrix) |
| 3 | Parzystość funkcji CRM vs better-bitrix | Lista w `SALES_OPS_REQUIREMENTS.md` + testy akceptacyjne |
| 4 | Stres-testy S0–S5 PASS | `STRESS_TEST_PLAN.md` |

---

## Faza A — Fundament dokumentacji

| # | Zadanie | Status |
|---|---------|--------|
| A1–A8 | Pakiet SSOT `owocni-crm/` | **done** (utrzymywać przy zmianach) |
| A9 | Rekonsyliacja `analiza-migracja-twenty.html` | kolejny |

---

## Faza B — przed pełnym wdrożeniem prod

| # | Zadanie | Owner | Wyjaśnienie |
|---|---------|-------|-------------|
| B3 | Kryteria stage’ów | **Zamknięte** — handlowcy znają; tylko **szkolenie Twenty** przed cutoverem | ADR #5 |
| B4 | Preflight webhook payload | **Dawid** | ADR #11 — patrz § poniżej |
| B5 | AUDIT_AKK tura A | Dawid / LLM | fault-only |
| B14 | Rekonsyliacja nazw eventów w docs orkiestracji + Robot (`purchase` zamiast `lead_won`) | **Dawid** | ADR #14 — wpisane w plan prac Sortowni |
| B10 | Routing w Sortowni (qualify_lead, purchase, rejected_lead) | **Dawid** | ADR #10 |

---

## Wyjaśnienia decyzji otwartych

### ADR #11 — native webhook payload (preflight, Dawid)

Twenty przy zmianie rekordu wysyła webhook. Trzeba **jednym testem w sandbox** sprawdzić, czy payload zawiera:

- `data.before` / `data.after` (stan przed i po), **czy**
- tylko aktualny stan rekordu.

**Dlaczego to ważne:** adapter `inbound:twenty_webhook` musi wykryć *przejście* (np. stage NEW→QUALIFIED), a nie każdy update.  
- Jeśli jest `data.before` → adapter porównuje before/after, **bez** pamięci w Stape Store.  
- Jeśli nie ma → adapter trzyma w Stape Store `last_stage` i `last_campaignRejected` per `opportunity_id` (2 pola).

**Krok:** zmiana stage w sandbox → zapis payloadu → decyzja w `EVENT_CONTRACT.md` / adapterze.

### ADR #6 — Twenty Pro vs Organization

| | **Pro** (~$9/user/mc) | **Organization** |
|---|----------------------|------------------|
| CRM pipeline, pola, Email Sync | Tak | Tak |
| Workflow credits | ~50/rok (mało) | Więcej |
| Audit log enterprise | Ograniczony | Pełniejszy |
| Nasz kompensat | Snapshoty git + `ops/OPS_NOTES.md` | — |

**Decyzja do uzgodnienia z właścicielem:** czy Pro + git wystarczy na start, czy wymagamy Organization ze względu na audyt/compliance.

### ADR #8 — data cutover

**Nie ustalamy daty z góry.** Cutover wyznaczamy **po**:

1. Etap 1.1 + 1.2 ukończone,
2. Szablony maili w Twenty,
3. Szkolenie handlowców przeprowadzone,
4. Testy S0–S5 PASS,
5. Potwierdzenie parzystości z better-bitrix.

Wtedy wybieramy **T-0** w `CUTOVER_RUNBOOK.md`.

### FIX-1 — pole `assist` w Sortowni (paid)

W profilu klienta jest pole **`assist`** (asystent właściciela). W kodzie bywa niespójne (czasem null, czasem logika niepełna).

| Opcja | Co robimy |
|-------|-----------|
| **A** | Dokończyć logikę assist w Sortowni paid |
| **B** | Jawny deferral: `assist` zawsze `null` w SSOT do czasu osobnego ADR |

**Decyzja:** wybrać A lub B przed commitem FIX-1 (osobny commit, nie mieszać z ADD).

### FIX-2 — `AktTimestamp` (format czasu)

Pole **`AktTimestamp`** (aktywność własności) bywa zapisywane jako ISO string lub epoch — różne formaty utrudniają porównania w Stape/Robot.

**FIX-2:** ujednolicić na **epoch milliseconds** + parser tolerancyjny dla starych wartości.

---

## Faza C — egzekucja (mapowanie na fundamenty)

| Faza fundamentów | Owocni plan | Owner |
|------------------|-------------|--------|
| 1 Sandbox | POC workspace | done |
| 2 Schema prod | Etap 1.1 | Dawid |
| 3 Import | Po `AUDIT_MIGRACJA` | Dawid |
| 4 Eventy | Webhook OUT + adapter Sortowni | Dawid |
| 5 Cutover | Po testach + parzystość BB | Dawid + właściciel (data) |

**Poza MVP:** Helpdesk, MCP write, workflow HTTP outbound w Twenty.

---

## Kluczowe decyzje już przyjęte

Patrz `DECISION_REGISTER.md` (sekcja zamknięte) oraz `EVENT_CONTRACT.md`.

---

## Następny krok (Dawid)

1. Etap 1.1: schema + paid path + webhook preflight (#11) + **migracja szablonów maili**.
2. Równolegle: ADR #14 cleanup nazw w docs orkiestracji.
3. Etap 1.2: Email Sync (bez `kontakt@`) + Identity Resolver.
4. Szkolenie handlowców + testy → **dopiero wtedy** data cutover.

Szczegóły kanałów: `IDENTITY_AND_INBOUND.md` §5–6.
