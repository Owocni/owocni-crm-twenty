# CALL_INGEST_N8N — kontrakt (Play PBX → n8n → GCP → Twenty)

Status: **MVP aktywny (2026-07-21)** · Play wysyła surowy transkrypt · n8n filtruje i forwarduje · worker zapisuje do Twenty.

**Powiązane:** schema/UX [`BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md`](./BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md) · mapa [`../TWENTY_PATHS.md`](../TWENTY_PATHS.md) §4.4 · kod Play: sibling `telefony/` (poza tym repo).

## 1. Wejście z Play (webhook n8n)

Play (`run.js`, cron co 1h) POST na webhook n8n:

```json
{
  "source": "play_pbx",
  "externalCallId": "2026-07-20-12-42-39_48792888728_48660970980",
  "timestamp": "2026-07-20 12:42:39",
  "direction": "MT",
  "callingNumber": "48792888728",
  "calledNumber": "48660970980",
  "transcript": "...",
  "recordingApiUrl": "...",
  "recordingWebUrl": "...",
  "environment": "prod"
}
```

Nagłówek opcjonalny: `X-Webhook-Secret: <N8N_PLAY_WEBHOOK_SECRET>`

## 2. n8n — wymagane kroki

### Krok A — Webhook trigger
- Method: POST
- Authentication: Header `X-Webhook-Secret` (opcjonalnie)

### Krok B — Bramka kontaktu (D-15)
DROP jeśli:
- regex poczty głosowej: `niedostępny|nie odpowiada|po sygnale|nagraj wiadomość`
- `transcript.length < 100`
- (opcjonalnie) LLM: „czy dwustronna rozmowa biznesowa?” → NO

DROP: zapisz log + opcjonalnie archiwum (Google Drive / GCS).

### Krok C — Summary (LLM)
3–5 zdań po polsku → pole `summary`.

### Krok D — Normalizacja numerów
- klient = numer spoza `{48660970980, 48570704470}`
- zapisz E.164 (`+48...`)

### Krok E — POST do GCP worker (enqueue)

URL: `POST https://<twenty-crm-worker-url>`

```json
{
  "action": "enqueue_call_transcript",
  "environment": "prod",
  "data": {
    "externalCallId": "...",
    "timestamp": "...",
    "direction": "INBOUND|OUTBOUND|MT|MO",
    "callingNumber": "...",
    "calledNumber": "...",
    "transcript": "...",
    "summary": "...",
    "recordingWebUrl": "...",
    "workspaceMemberId": null
  }
}
```

Worker zapisuje task `job_type: crm:call_transcript_ingest` w Stape `task_queue` i przetwarza przy kolejnym poll.

## 3. Co robi worker GCP

1. Upsert `CallTranscript` po `externalCallId`
2. 2× `CallTranscriptParticipant` (klient + my)
3. Match Person (historia uczestników → lookup telefonu, z/bez +48)
4. Match Opportunity (newest open)
5. PATCH `lastContactAt`, `bizLastContactLabel`
6. OUTBOUND + stage NEW → CONTACTED + `firstResponseAt` (gdy metryki puste)
7. Brak match → `matchStatus=UNMATCHED` + owner po numerze firmowym; kolejka **Rozmowy → Do przypięcia** (Taski parking **wyłączone** domyślnie: `CALL_TRANSCRIPT_PARKING_TASKS=false`)

### HTTP actions (po ingest)

| Action | Rola |
|--------|------|
| `enqueue_call_transcript` | n8n → kolejka |
| `link_call_transcript` / webhook `callTranscript.updated` | ręczne przypięcie Szansy → Person + MATCHED + phone |
| `create_lead_from_call` | workflow „Utwórz lead z rozmowy” |

## 4. Zmienne środowiskowe

### Play (`/home2/stronyow/test/.env`)
```
N8N_PLAY_WEBHOOK_URL=https://owocni.app.n8n.cloud/webhook/play-pbx-ingest
N8N_PLAY_WEBHOOK_SECRET=...
OWOCNI_ENV=prod
```

### GCP worker
```
CALL_TRANSCRIPT_INGEST_ENABLED=true
CALL_TRANSCRIPT_PARKING_TASKS=false
OUR_PHONE_NUMBERS=48660970980,48570704470
PHONE_OWNER_MAP=48660970980:<martaId>,48570704470:<gosiaId>
CALL_TRANSCRIPT_OBJECT=callTranscripts
CALL_TRANSCRIPT_PARTICIPANT_OBJECT=callTranscriptParticipants
```

## 5. Kill-switch

- Play: `N8N_PLAY_WEBHOOK_URL=` (pusty) → skip wysyłki
- Worker: `CALL_TRANSCRIPT_INGEST_ENABLED=false`
- n8n: wyłącz workflow **Play PBX → GCP CallTranscript**

## 6. Test smoke

1. Uruchom `node run.js` na serwerze z jednym znanym nagraniem
2. n8n: sprawdź execution (PASS/DROP)
3. GCP: POST enqueue → task w `task_queue`
4. Worker poll → `CallTranscript` w Twenty
5. Parking: numer nieznany → widok **Do przypięcia** (nie Task)
