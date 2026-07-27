# CALL_CHANNEL — architektura kanału telefon (Play → Twenty)

Status: **SSOT 2026-07-27** · near-realtime GCP **2026-07-24**

**Powiązane:** kontrakt n8n [`CALL_INGEST_N8N.contract.md`](./CALL_INGEST_N8N.contract.md) · schema [`BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md`](./BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md) · MISSED [`MISSED_CALLS_PLAY.contract.md`](./MISSED_CALLS_PLAY.contract.md) · mapa [`../TWENTY_PATHS.md`](../TWENTY_PATHS.md) §4.4 · kod pollera: sibling `telefony/docs/GCP_NEAR_REALTIME.md`.

---

## 1. Słownik

| Skrót | Znaczenie |
|---|---|
| **STT** | Speech-to-Text — zamiana nagrania audio na tekst (u nas: OpenAI `gpt-4o-transcribe` w Cloud Run Job) |
| **D-15** | Bramka „kontakt zaszedł” — wyłącznie w n8n przed zapisem do Twenty; poczta głosowa / monolog → DROP |
| **Poller** | Cloud Run Job `telefony-play-poller`, Scheduler `*/5`, okno Play `hoursBack=2`, kursor dedup w GCS |
| **Parking** | Widok Twenty **Rozmowy → Do przypięcia** (`matchStatus=UNMATCHED`) |

**Inwariant (D-15):** rekord `CallTranscript` w Twenty ⇔ odbyty kontakt dwustronny. Worker **nie** decyduje, czy to kontakt.

---

## 2. Jak to działa teraz (2026-07-24)

```
Cloud Scheduler */5 (Europe/Warsaw)
  → Cloud Run Job telefony-play-poller
       Play getCallHistory + getRecordingsList
       kursor GCS (recordings/*, missed/*)
       │
       ├─ nowe MISSED ──► POST GCP enqueue_missed_call (bez n8n)
       │                      → worker → licznik + notatka na leadzie
       │
       └─ nowe nagranie ──► download/decrypt (Play CMS)
                              → ffmpeg → STT (OpenAI)
                              → POST n8n webhook (tylko gdy jest tekst)
                                   → D-15 filtr
                                   → (opcjonalnie) summary LLM
                                   → POST GCP enqueue_call_transcript
                                        → Stape task_queue
                                        → worker poll */5
                                        → CallTranscript + match + timeline note
```

**Równolegle:** CRM worker + Robot poll Stape `task_queue` co **`*/5`** (było co 1 min); jeden list-pending na cykl + circuit breaker przy paused Stape.

**SLA:** ~10 min (poll telefony 5 min + poll worker 5 min + czas STT).

---

## 3. Dlaczego podział odpowiedzialności jest dobry

| Warstwa | Rola | Dlaczego tu |
|---|---|---|
| **Cloud Run Job (`telefony/`)** | Play API, audio, STT, delta-only, MISSED → GCP | Ciężkie I/O, ffmpeg, openssl, timeout 15 min; **0 n8n** przy pustym pollu |
| **n8n** | D-15, summary LLM, normalizacja payloadu → enqueue | Kontrakt D-15; LLM/summary bez przepisywania workera; **1 execution = 1 nowa rozmowa** |
| **GCP worker** | Idempotentny zapis Twenty, match Person/Opp, timeline, merge | Testowalny kod; env-guard; wspólny tor z mailem/leadami |
| **Twenty** | CRM, relacje, UX (parking, przypięcie, merge) | Źródło prawdy kontekstu klienta |

### Dlaczego STT **nie** przenosić do n8n

| | STT w Jobie (obecnie) | STT w n8n |
|---|---|---|
| Kredyty n8n | 1 krótka execution / rozmowa (tekst) | długa execution + binary audio |
| Timeout | Job 15 min | Cloud n8n pada na dużych WAV |
| Retry | prosty w Jobie | droższy (cały flow od nowa) |
| Koszt | OpenAI STT i tak płatny | + kredyty n8n za to samo |

**Wniosek:** Job robi **audio → tekst**; n8n robi **tekst → decyzja + LLM → enqueue**.

---

## 4. Koszty i kredyty (skrót)

| Co | Kiedy płacicie |
|---|---|
| Cloud Scheduler + Run Job | co 5 min (pusty poll = sekundy CPU) |
| Play API | co poll (2 numery) |
| OpenAI STT | tylko **nowe** nagrania |
| n8n | tylko webhook z **nowym** transkryptem |
| Stape Store | enqueue + poll CRM/Robot (zoptymalizowane `*/5`) |
| sGTM strony | **ten sam kontener Stape** — rozważyć osobny plan/kontener |

---

## 5. Co można poprawić (ewolucja)

| Priorytet | Zmiana | Po co |
|---|---|---|
| P1 | STT zostaje w Jobie; n8n = tekst + LLM | stabilność (patrz §3) |
| P2 | Archiwum DROPów D-15 w GCS | re-import po zmianie reguł |
| P3 | Osobny kontener/plan Stape na CRM vs tracking | nie spalać limitu sGTM |
| P4 | Push zamiast poll Stape (Pub/Sub) | mniej Store API |
| P5 | Nagranie → GCS bucket; Job wysyła link | audyt, re-STT |

**Nie rekomendujemy:** przeniesienia STT do n8n „żeby uprościć telefony/”.

---

## 6. Rozbudowa LLM (summary, drafty, kontekst wątków)

Docelowy tor — **kontekst z Twenty**, inteligencja w n8n / osobnym agencie:

```
CallTranscript (tekst + opportunityId)
  → n8n / agent LLM
      ← kontekst z Twenty API:
         • wcześniejsze CallTranscript na tym leadzie
         • Message / MessageParticipant (maile)
         • Notatki, stage, Person
      → summary → pole CallTranscript.summary
      → draft odpowiedzi → Task / draft mail (NIE auto-send v1)
      → opcjonalnie: tagi intencji, next step
```

**Zasady przy rozbudowie**

1. **Źródło prawdy kontekstu = Twenty**, nie pamięć n8n między runami.
2. **D-15 przed LLM** — nie marnować tokenów na pocztę głosową.
3. **Human-in-the-loop** — auto-odpowiedź dopiero po regułach + okresie draft-only.
4. **Idempotencja** — `call_timeline_*`, `processed_*`; retry nie duplikuje summary.
5. **Kontrakt** — nowe pola LLM w [`CALL_INGEST_N8N.contract.md`](./CALL_INGEST_N8N.contract.md) §C+.

Backlog operacyjny: [`NEXT_STEPS.md`](./NEXT_STEPS.md) (wiersz „Call: summary LLM”).

---

## 7. UX na leadzie (Opportunity) — stan i kierunek

### Stan MVP (2026-07-24)

- Po dopasowaniu rozmowy worker tworzy **Note** + wpis timeline (`linked-callTranscript.created`).
- Relacja `CallTranscript.opportunity` istnieje w schema.
- Ręczne: workflow **Przypnij do leada** / pole **Lead (szansa)**.

### Kierunek (backlog — następny krok produktowy)

**Cel:** na karcie leada **zakładka „Rozmowy”** — lista `CallTranscript` powiązanych z tym Opportunity, **bez** mieszania z ogólnymi Notatkami.

| Opcja | Opis |
|---|---|
| A | Twenty **Record Page** — widget relacji `callTranscripts` (jeśli dostępny w UI) |
| B | Custom view / filtered relation panel na Opportunity |
| C | Timeline tylko jako skrót; pełna treść w zakładce Rozmowy |

**Nie zmieniać:** D-15, tor ingest, obiekt `CallTranscript` — tylko layout + ewentualnie mniej redundantnych Notes po MATCH (osobna decyzja).

---

## 8. Operacyjnie

| Akcja | Gdzie |
|---|---|
| Deploy pollera | `telefony/deploy_gcp.sh` |
| Deploy workera | `cloud-functions/twenty-crm-worker/deploy.sh` |
| Wyłącz Hostline cron | po green light GCP |
| Stape musi być aktywny | enqueue/poll pada przy Paused kontenerze |
| Klucz Store API | 48 znaków z sufiksem kontenera (`…uinpcbwf`) — nie obcinać do 40 |

---

## 9. Anti-wzorce

- ❌ STT w n8n jako critical path  
- ❌ Poll Stape co 1 min (CRM + Robot + sGTM na jednym limicie)  
- ❌ n8n scheduled co X min „profilaktycznie” (tylko webhook na delta)  
- ❌ Auto-merge / auto-link bez ręki handlowca (NR-5)  
- ❌ Bramka D-15 w workerze Twenty (NR-C11)
