---
doc_id: KANBAN_CARD_SPEC
title: "Kafelek kanban Opportunity — specyfikacja PAR-1"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-07-10
related:
  - G_PAR_BETTER_BITRIX_PARITY.md
  - TWENTY_WORKFLOWS_REJECT_AND_GUARD.md
  - ../../owocni-crm/DATA_MODEL.md
---

# Kafelek kanban — specyfikacja

Widok **By Stage** (Opportunities, KANBAN) w Twenty sandbox.

## Kolejność pól na kafelku

| # | Pole (API) | Etykieta UI | Źródło |
|---|------------|-------------|--------|
| 0 | `name` | Name | Adapter — nagłówek karty (wymóg Twenty) |
| 1 | `bizLastContactLabel` | Czas od kontaktu | `Godzin: N` / `Dni: N` — **nie** pokazywać `lastContactAt` na kafelku (daje datę) |
| 2 | `bizValueDisplay` | Wartość | `0 PLN`, widełki, `Do ustalenia`, później kwota oferty |
| 3 | `pointOfContact` | Kontakt | Relacja Person (imię) |
| 4 | `bizCardEmail` | Email | Denormalizacja z formularza / leads@ |
| 5 | `bizCardPhone` | Telefon | Denormalizacja z formularza / leads@ |

**Uwaga Twenty:** pole `name` musi być na pozycji 0 (label identifier). Na kafelku wyświetlamy **wyłącznie** tekst `Godzin:` / `Dni:` — pole `lastContactAt` zostaje w rekordzie (dane), ale **nie** na widoku kanban (inaczej widać datę + etykietę).

## Składanie `name` (formularz)

Segmenty łączone separatorem ` · ` (pomijane, gdy brak danych):

1. **Produkt** — Strona / Logo / Naming / Marketing…
2. **Typ projektu** — `Nowe` / `Redesign` (z odpowiedzi `strona_ma`, `logo_ma`…)
3. **Jakość** — `Cennik` / `Ekspert` (z `strona_jaka`, `logo_jakie`… → `basic` / `premium`)
4. **Kontakt** — imię (obowiązkowy segment; fallback: prefix email, telefon, `Lead`)

Przykład: `Strona · Redesign · Ekspert · Anna`

Maile `leads@`: bez zmian — temat / nadawca + `— mail leads@`.

## Wartość

| Stan | `bizValueDisplay` | `amount` | `bizValueMin` / `bizValueMax` |
|------|-------------------|----------|-------------------------------|
| Nowy lead | `0 PLN` | 0 PLN | puste lub z formularza |
| Widełki (strona wizytówka) | `4 000 PLN – 10 000 PLN` | 0 | min/max z `strona_cena` |
| Nie znam stawek | `Do ustalenia` | 0 | puste |
| Oferta handlowca | kwota z `amount` lub tekst | wpisane w UI | widełki zostają w tle |
| Wygrana (`WON`) | `1222 PLN` (tekst kafelka) | **`bizValueWon`** preferowane | adapter: fallback `bizValueDisplay` → `biz_value` |

**Ważne:** `bizValueDisplay` = **tylko UI kafelka**. Event `purchase` bierze `biz_value` z `bizValueWon` → `amount` → widełki → parser `bizValueDisplay` (patrz `EVENT_CONTRACT.md` §5.7). Wartość `0 PLN` w `amount` **nie blokuje** fallbacku z display.

Mapowanie `strona_cena`:

- `4-10k` → 4 000 – 10 000 PLN
- `10-25k` → 10 000 – 25 000 PLN
- `25k+` → od 25 000 PLN
- `unknown` → Do ustalenia

Pełna tabela kombinacji → `owocni-staging-standalone/docs/kombinacje-formularzy/kombinacje-formularzy-cennik.csv` (kolumny `widełki_min` / `widełki_max` — do uzupełnienia w GTM).

## Ostatni kontakt

- **`lastContactAt`** — przy utworzeniu = czas leada; aktualizacja przy **mailu w obie strony** (GCP worker `email_contact_sync`, CRON co ~5 min).
- **`bizLastContactLabel`** — przeliczane przy zapisie (`crm:twenty_create_lead`, docelowo workflow na `message.created` INCOMING).

**TODO (faza 2):** workflow Twenty — patrz sekcja **Workflow odpowiedzi mailowej** poniżej.

## Workflow odpowiedzi mailowej (faza 2 — do zrobienia)

**Cel:** po **mailu klienta lub naszej odpowiedzi** zaktualizować powiązane Opportunity: `lastContactAt` + `bizLastContactLabel` (`Godzin: 0` przy zdarzeniu).  
**Reguła (2026-07-23):** `lastContactAt` **tylko do przodu** (`max` z istniejącym) — opóźniony mail nie może cofnąć czasu po nowszej rozmowie (i odwrotnie).

### Dlaczego nie w Stape?

Email Sync zapisuje wiadomość w Twenty **zanim** webhook trafi do Stape. Adapter `crm:twenty_create_lead` obsługuje tylko **nowe** leady, nie każdą odpowiedź w wątku.

### Proponowany workflow (Twenty UI lub MCP)

| Krok | Typ | Opis |
|------|-----|------|
| Trigger | `DATABASE_EVENT` | `message.created` (lub odpowiednik Email Sync) |
| FILTER | | Kierunek = **INCOMING** / od klienta (nie wysłane z Twenty) |
| FILTER | | Opcjonalnie: wyklucz skrzynki wewnętrzne |
| FIND / LOGIC | | Z `message` → `messageThread` → `Person` → ostatnie **OPEN** Opportunity (`pointOfContact`) |
| UPDATE | | `lastContactAt` = czas wiadomości |
| CODE? | | `bizLastContactLabel` — Twenty nie ma formuły; wymaga kroku CODE liczącego różnicę lub CRON co godzinę przeliczający wszystkie karty |

**Alternatywa prostsza (MVP):** CRON co 1h — workflow iteruje Opportunity w stage ≠ LOST/WON i PATCH `bizLastContactLabel` z `lastContactAt` (bez triggera na message).

### Blokery do sprawdzenia przed implementacją

1. Czy trigger `message.created` jest dostępny na planie sandbox (Email Sync)?
2. Jak w schemacie `message` oznaczony jest kierunek INCOMING vs OUTGOING?
3. Czy wiadomość ma relację do Opportunity, czy tylko do Person (wtedy trzeba szukać Opp po `pointOfContactId`)?

### Co już działa bez workflow

- Przy **utworzeniu** leada: `bizLastContactLabel: Godzin: 0` + `lastContactAt` z czasu Sortowni (`created_at`).
- Etykieta **nie odświeża się sama** w kanbanie — staje się nieaktualna po kilku dniach, dopóki nie wdrożymy CRON lub triggera message.

## Etapy kanban (By Stage) — od 2026-07-06

| # | Etykieta UI | Wartość API | Event SSOT | Automatyzacja |
|---|-------------|-------------|------------|---------------|
| 1 | Nowy | `NEW` | `generate_lead` (przy utworzeniu) | Sortownia → create_lead |
| 2 | Rozeznanie | `CONTACTED` | — | **GCP worker** `advanceNewToContacted` po OUTGOING mailu do klienta (scheduler); opcjonalnie workflow Twenty UI |
| 3 | Przyjęty SQL | `QUALIFIED` | `qualify_lead` | Workflow MANUAL **„Przyjmij jako SQL"** (`bizSqlConfirmed=true`). Drag bez workflow → guard cofa etap |
| 4 | Wysłano ofertę | `PROPOSAL` | — | Ręcznie |
| 5 | Wysłano umowę | `CONTRACT_SENT` | — | Ręcznie |
| 6 | Wpłaca | `PAYING` | — | Ręcznie |
| 7 | Wygrany | `WON` | `purchase` | Ręcznie; **`bizValueWon`** (waluta) lub fallback z `bizValueDisplay` |
| 8 | Przegrany | `LOST` | — (brak eventu) | Ręcznie |
| — | *(akcja, nie stage)* | — | `rejected_lead` | Workflow MANUAL **„Odrzuć leada"** — `campaignRejected=true`, etap bez zmiany |

**SQL — modal:** Zamiast polegać na drag&drop używaj workflow **„Przyjmij jako SQL"** (pinned). Bez `bizSqlConfirmed` inbound zwraca `SKIP_QUALIFIED_WITHOUT_SQL_CONFIRM`.

**Odrzucenie:** workflow **„Odrzuć leada"** — patrz `TWENTY_WORKFLOWS_REJECT_AND_GUARD.md`. Na odrzuconym leadzie guard blokuje SQL/WON.

**Rozeznanie — auto:** workflow `message.created` + filtr OUTGOING → jeśli powiązane Opp `stage=NEW` → `stage=CONTACTED`. Wymaga potwierdzenia pola kierunku w Email Sync (faza 2).


```
Formularz V2 (answers JSON)
  → Web GTM generate_lead
  → Sortownia (biz_form_answers, biz_form_product)
  → crm:twenty_create_lead
  → Twenty Opportunity + pola kanban
```

## Pola metadata (sandbox 2026-07-06)

| API name | Typ |
|----------|-----|
| `lastContactAt` | DATE_TIME |
| `bizLastContactLabel` | TEXT |
| `bizProjectType` | SELECT: NEW, REDESIGN |
| `bizIntent` | SELECT: CENNIK, EKSPERT |
| `bizValueMin` / `bizValueMax` | CURRENCY |
| `bizValueDisplay` | TEXT |
| `bizSqlConfirmed` | BOOLEAN |
| `bizLastNonSqlStage` | TEXT |
| `bizCardEmail` / `bizCardPhone` | TEXT |

## Deploy checklist

- [x] Pola Opportunity w Twenty (MCP)
- [x] Widok kanban **By Stage** — pola i kolejność
- [x] `CRM_TWENTY_CREATE_LEAD.sGTM.js` — BUILD `2026-07-06-kanban-card-v1`
- [x] `SORTOWNIA_V2_POPRAWIONY.js` — `biz_form_answers` w task CRM
- [ ] Publish tagów Stape (create_lead + Sortownia)
- [ ] Test E2E: formularz strony → kanban
- [x] GCP worker `email_contact_sync` — `lastContactAt` + `bizLastContactLabel` po INCOMING/OUTGOING (build `gcp-v6`)
- [ ] Uzupełnić widełki w CSV + mapowanie OW-xxx w Sortownii/GTM
