# BUILD — CallTranscript w Twenty (Settings UI)

Wykonaj **przed** pierwszym deployem workera `crm:call_transcript_ingest`.

## 1. Obiekt `CallTranscript` (etykieta: Rozmowa)

| Pole API | Typ | Unique | Uwagi |
|---|---|---|---|
| `clientPhone` | Text | numer klienta (E.164) — widoczny na liście |
| `ourPhone` | Text | numer firmowy / handlowca |
| `matchStatus` | Select | `UNMATCHED`, `MATCHED`, `CONFLICT` |
| `owner` | Relation → Workspace Member | handlowiec po numerze firmowym |
| `title` | Text | — | tytuł rozmowy |
| `externalCallId` | Text | **TAK** | idempotencja |
| `startedAt` | Date & Time | — | |
| `endedAt` | Date & Time | — | opcjonalnie = startedAt |
| `direction` | Select | — | `INBOUND`, `OUTBOUND` |
| `transcript` | Rich text | — | |
| `summary` | Rich text | — | |
| `recording` | Links | — | link do nagrania Play |
| `opportunity` | Relation → Opportunity | — | nullable |

## 2. Obiekt `CallTranscriptParticipant`

| Pole API | Typ | Uwagi |
|---|---|---|
| `handle` | Text | numer E.164 |
| `displayName` | Text | |
| `participantRole` | Select | `CALLER`, `CALLEE` |
| `callTranscript` | Relation → CallTranscript | |
| `person` | Relation → Person | nullable = parking |
| `workspaceMember` | Relation → Workspace Member | nullable |

## 3. Widoki

### Rozmowy do przypięcia
- Obiekt: `CallTranscript`
- Widok: **„Do przypięcia”** (filtr `matchStatus = UNMATCHED`)
- Kolumny: numer klienta, numer handlowca, handlowiec (owner), kierunek, data
- **Nie** Taski — kolejka kontroli jest na obiekcie Rozmowy

### Na karcie Opportunity
- Sekcja powiązanych `CallTranscript`, sort DESC po `startedAt` (PF-B2)
- Po MATCH: **Notatka + wpis Timeline** (`linked-callTranscript.created`) z linkiem do Rozmowy / nagrania — tworzy worker (`shared/callTimeline.js`)

## 4. Ręczne przypięcie (handlowiec) — prosty UX

**Jedno pole na karcie rozmowy: `Opportunity` (Szansa / Lead).** Reszta synchronizuje się automatycznie (worker).

### Istniejący lead
1. **Rozmowy → Do przypięcia** → zaznacz rozmowę
2. Akcja **„Przypnij do leada”** (workflow MANUAL pinned) → wybierz lead z pickera
3. Worker (`link_call_transcript`):
   - przypina osobę do uczestnika rozmowy,
   - ustawia `matchStatus = MATCHED`,
   - uzupełnia telefon na Person (jeśli brak),
   - aktualizuje `lastContactAt` (+ NEW→CONTACTED przy OUTBOUND),
   - dodaje notatkę / wpis na timeline

Alternatywa: na karcie rozmowy pole **Lead (szansa)** → zapis → webhook `callTranscript.updated`.

### Nowy lead
1. Otwórz rozmowę z widoku **Do przypięcia**
2. Przycisk **„Utwórz lead z rozmowy”** (workflow MANUAL pinned)
   - opcjonalnie podaj imię/nazwę; numer bierze z `clientPhone`
3. Worker zakłada Person + Opportunity, przypina rozmowę i mintuje `idOid`

### Live (sandbox 2026-07-21)
| Element | ID / URL |
|---|---|
| Webhook | `80bbd89d-853d-42b2-a673-001ac54bb3fa` → `callTranscript.updated` → GCP worker |
| Workflow | **Rozmowa · Utwórz lead v2** (`92e72492-10c3-48aa-babc-68d662271093`) |
| Workflow | **Rozmowa · Przypnij do leada v1** (`cb93c9be-1e8b-47cd-b977-602d7373d100`) — picker Opportunity → `link_call_transcript` |
| Worker actions | `link_call_transcript`, `create_lead_from_call` |

### Layout karty (Settings → Objects → Rozmowa)
- Na górze: **clientPhone**, **Szansa (Opportunity)**, **owner**, **direction**, **startedAt**
- Niżej: transkrypt, nagranie, uczestnicy (tylko podgląd)

### Auto-match numeru
Przy kolejnej rozmowie worker dopasuje numer po:
- historii uczestników (wcześniejsze przypięcie),
- telefonie Person (z/bez kierunkowego +48, ostatnie 9 cyfr).

## 5. Smoke po utworzeniu obiektów

```bash
curl -X POST "<worker-url>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "enqueue_call_transcript",
    "environment": "sandbox",
    "data": {
      "externalCallId": "test-smoke-001",
      "timestamp": "2026-07-21 10:00:00",
      "direction": "INBOUND",
      "callingNumber": "48123456789",
      "calledNumber": "48660970980",
      "transcript": "Dzień dobry, dzwonię w sprawie strony internetowej dla mojej firmy. Chciałbym porozmawiać o wycenie i terminie realizacji projektu.",
      "summary": "Klient pyta o stronę i wycenę."
    }
  }'
```

Następnie trigger worker (GET/POST) i sprawdź rekord w Twenty.
