---
doc_id: E12_3_EMAIL_TEMPLATES_AND_TRAINING
title: "E12.3 — szablony maili, leads@, szkolenie handlowców"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-16
related:
  - E12_EMAIL_SYNC_EXECUTION.md
  - E12_EMAIL_SYNC_EVIDENCE.md
  - G_PAR_BETTER_BITRIX_PARITY.md
  - ../../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
---

# E12.3 — szablony, rozdział `leads@`, szkolenie

**Cel:** handlowcy mogą pracować w Twenty **bez regresu** względem better-bitrix (NR-3 `IMPLEMENTATION_PLAN`).

**Zależności:** E12.1 Email Sync PASS · E12.2 Identity Resolver PASS.

**Następny gate:** G-PAR PASS → dopiero wtedy E12.4 (julia362 OFF).

---

## 0. LLM QUICK ENTRY

| Nie | Tak |
|-----|-----|
| Wyłączać julia362 | Migruje szablony + SOP `leads@` + szkolenie |
| Auto-merge tożsamości | T4 = ręczna decyzja |
| `kontakt@` do CRM | Świadomie poza zakresem |

---

## FAZA A — Inwentaryzacja szablonów BB

### A1. Eksport listy z Supabase (better-bitrix)

Źródło: tabela `email_template` (`title`, `subject`, `message`, `category[]`).

| # | Zadanie | Owner | Done |
|---|---------|-------|------|
| A1.1 | Zaloguj się do BB → **Ustawienia → Szablony email** (`/settings/emailTemplates`) | Dawid | ☑ |
| A1.2 | Eksport CSV / screenshot listy (tytuł + kategorie) | Dawid | ☑ **2026-06-16** — `exports/bb_email_templates/` |
| A1.3 | Oznacz szablony **MUST** (używane ≥1×/tydzień) vs **NICE** vs **ARCHIWUM** | Dawid + sprzedaż | ☑ heurystyka 2026-06-16 (9 MUST / 10 NICE) |
| A1.4 | Mapowanie kategorii BB → Twenty (tabela poniżej) | Dawid | ☑ `bb_email_templates_migration_2026-06-16.md` |

**Kategorie BB** (`lib/constants.ts` → `EMAIL_TEMPLATE_TYPES`):

| BB `category` | Priorytet migracji | Uwagi |
|---------------|-------------------|--------|
| `sales` | P0 | Odpowiedzi na zapytania |
| `contact` | P0 | Pierwszy kontakt |
| `reminder` | P0 | Follow-up |
| `customer_service` | P1 | Obsługa |
| `helpdesk` | P1 | Migrujemy razem z resztą (19 szt. łącznie — decyzja 2026-06-16) |
| `logo`, `name`, `website`, `packaging`, `packages` | P1 | Per produkt |
| `texts`, `project_start`, `invoice` | P2 | Rzadziej |

### A2. Szablony w Twenty

> **Strategia (ADR #17):** [E12_3_EMAIL_TEMPLATE_STRATEGY.md](./E12_3_EMAIL_TEMPLATE_STRATEGY.md) — Notes **odrzucone**; Faza 0 dual BB+Twenty; docelowo **Template Sidecar**.

| # | Zadanie | Owner | Done |
|---|---------|-------|------|
| A2.0 | Plan zastępczy + cleanup Notes spike | Agent | ☑ 2026-06-16 |
| A2.1 | Faza 0: SOP dual compose + test BB→Twenty timeline | Dawid | ☐ |
| A2.2 | Spike Sidecar (picker + kopiuj do Twenty) | Dawid | ☐ plan w strategii §Faza 1 |
| A2.3 | Sidecar MVP → G-PAR PAR-5 PASS | Dawid | ☐ |
| A2.4 | Podpisy BB → Sidecar / Accounts | Dawid | ☐ eksport gotowy |

**PASS E12.3 (szablony):** Sidecar MVP **lub** Twenty native + PAR-5 PASS. Do tego czasu Faza 0 dual.

---

## FAZA B — E12.3b Rozdział wątków `leads@` → owner

**SSOT:** `IDENTITY_AND_INBOUND.md` §5.5 (C13) — wątek z `leads@` musi trafić do właściwego Opportunity / handlowca.

### Model docelowy (MVP)

```
Mail na leads@ → Email Sync → Person (+ Opp jeśli nowy)
        │
        ├─ Nowy klient → Opp owner = reguła przydziału (lub round-robin)
        └─ Istniejący wątek → link do istniejącego Opp (ten sam email / firma)
```

**Równoległość do cutoveru:** julia362 nadal tworzy lead w Supabase; Twenty **równolegle** — duplikat do czasu E12.4 jest **oczekiwany**.

### B1. Reguła przydziału (wybierz jedną — uzgodnij ze sprzedażą)

| Opcja | Opis | Plusy | Minusy |
|-------|------|-------|--------|
| **B1a** | Proces manualny: pierwszy kontakt z `leads@` → handlowiec **ręcznie** ustawia owner + link Opp | Zero dev, szybki start | Ryzyko pomyłek |
| **B1b** | Twenty workflow: nowy Opp z `leads@` → domyślny owner (np. dyżur) | Półautomat | Wymaga workflow credits |
| **B1c** | Mapowanie produktu (z treści maila / GPT) → owner jak w BB | Parzystość z BB | Więcej pracy, Etap 2 |

**Rekomendacja MVP:** **B1a + checklist** (poniżej) do G-PAR PASS; B1b jako ulepszenie po retro.

### B2. Checklist operacyjny `leads@` (dla handlowca)

Wydruk / Notion — **obowiązkowy** przed go-live:

- [ ] Mail na `leads@` widoczny w Twenty (timeline `leads@`) w ~5 min
- [ ] Sprawdź czy **Person** już istnieje (email nadawcy)
- [ ] Jeśli nowy → utwórz **Opportunity** lub przypisz do istniejącej (ta sama firma)
- [ ] Ustaw **Owner** (nie zostawiaj pustego)
- [ ] Odpowiedz z Twenty (nie z osobistego klienta mail, jeśli wątek jest wspólny)
- [ ] **Nie** usuwaj duplikatu w BB do cutoveru — tam nadal żyje julia362

### B3. Testy E12.3b (sandbox)

| # | Scenariusz | Kroki | PASS |
|---|------------|-------|------|
| B3.1 | Nowy nadawca | Mail zewnętrzny → `leads@` | Person + Opp w Twenty; owner ustawiony; Resolver T3 (`idOid`) |
| B3.2 | Znany nadawca | Drugi mail tego samego emaila | Ten sam Opp / T1 link; brak drugiego `id_oid` |
| B3.3 | Odpowiedź handlowca | Odpowiedź z marta@ w Twenty | Wątek w timeline; BB nadal ma kopię (OK) |
| B3.4 | Równoległość julia362 | Mail na `leads@` INBOX | Lead w BB **oraz** rekord Twenty (ADR #13) |

**PASS FAZA B:** B3.1–B3.4 w sandbox + podpisany SOP przez sprzedaż.

---

## FAZA C — Szkolenie handlowców (must-have, NR-3)

**Materiał:** slajdy 30–45 min + ćwiczenie na sandbox Twenty.

### C1. Agenda szkolenia

| Blok | Temat | Czas |
|------|-------|------|
| 1 | Dlaczego Twenty + co z BB do cutoveru | 5 min |
| 2 | **Stage** vs **Odrzuć leada** (`campaignRejected`) — LOST ≠ rejected | 10 min |
| 3 | Kanban: NEW → CONTACTED → QUALIFIED → PROPOSAL → WON / LOST | 10 min |
| 4 | Maile: **dual compose** (BB szablony + Twenty lejek), `leads@` SOP | 10 min |
| 5 | Tożsamość: T4 „do rozstrzygnięcia”, merge firmowy (ręcznie), free-mail NIE | 5 min |
| 6 | Q&A + ćwiczenie | 10 min |

### C2. Kluczowe komunikaty (muszą paść wprost)

1. **„Odrzuć leada”** (`campaignRejected`) ≠ **„Przegrany”** (LOST). Tylko pierwsze wysyła sygnał do reklam.
2. **WON** = stage; event `purchase` idzie automatycznie — nie trzeba nic robić w Stape.
3. **Merge** — system **proponuje**, handlowiec **decyduje**; na Gmail/wp.pl **nigdy** auto-merge.
4. **`kontakt@`** — nie obsługujemy w CRM (spam).
5. Do cutoveru: **dwa systemy** na `leads@` — to normalne.

### C3. Ćwiczenie praktyczne (sandbox)

| # | Zadanie uczestnika | Kryterium PASS |
|---|-------------------|----------------|
| C3.1 | Zmień stage na QUALIFIED | Wie co to znaczy operacyjnie |
| C3.2 | Odrzuć leada (`campaignRejected`) | Rozumie różnicę vs LOST |
| C3.3 | Wyślij mail z szablonu **BB** (do czasu Sidecar) | Timeline w Twenty po sync |
| C3.4 | Symulacja `leads@` | Ustawia owner wg SOP |

### C4. Checklist zamknięcia szkolenia

| # | Element | Done |
|---|---------|------|
| C4.1 | Szkolenie przeprowadzone (data, uczestnicy) | ☐ |
| C4.2 | Nagranie lub notatka udostępniona | ☐ |
| C4.3 | Każdy handlowiec ma dostęp do Twenty sandbox | ☐ |
| C4.4 | Podpis / potwierdzenie od sprzedaży (mail/Slack) | ☐ |

---

## FAZA D — Zamknięcie E12.3

| ID | Kryterium PASS E12.3 |
|----|----------------------|
| E12.3 | Szablony P0 w Twenty + test wysyłki |
| E12.3b | SOP `leads@` + testy B3.1–B3.4 PASS |
| E12.3c | Szkolenie C4 PASS |

Po PASS: zaktualizuj `E12_EMAIL_SYNC_EVIDENCE.md` i `G_PAR_BETTER_BITRIX_PARITY.md` (sekcje PAR-MAIL, PAR-LEADS).

---

## CROSS-REFERENCES

| Temat | Plik |
|-------|------|
| G-PAR testy | `G_PAR_BETTER_BITRIX_PARITY.md` |
| Bramy cutover | `IMPLEMENTATION_PLAN.md` §5.4 |
| Kanały mailowe | `IDENTITY_AND_INBOUND.md` §5.5–5.7 |
| BB szablony (kod) | `better-bitrix-main/app/(dashboard)/settings/emailTemplates/` |
