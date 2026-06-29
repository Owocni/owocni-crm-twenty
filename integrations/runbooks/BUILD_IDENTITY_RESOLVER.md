---
doc_id: BUILD_IDENTITY_RESOLVER
title: "E12.2 — Identity Resolver T1–T5 w Stape"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-16
related:
  - ../IDENTITY_RESOLVER.sGTM.js
  - ../CRM_TWENTY_UPDATE_PERSON.sGTM.js
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
---

# E12.2 — Identity Resolver (Stape)

**Cel:** po Email Sync, gdy Twenty tworzy **Person** bez `idOid`, resolver przypisuje lub mintuje `id_oid` w Stape i backfilluje Twenty.

**SSOT:** `IDENTITY_AND_INBOUND.md` §5.2–5.3

---

## Architektura

```
Twenty Email Sync → Person (idOid null)
        │
        ▼
Webhook person.created / person.updated
        │
        ▼
Tag: inbound_twenty_webhook (opp + person w jednym szablonie)
        │  person.* → processPersonIdentityFromWebhook (inline)
        │  opportunity.* → dotychczasowa logika stage/lead
        ▼
lookup identity_map (email, phone) → T1/T2/T3 → task_queue
        ▼
Worker crm:twenty_update_person → PATCH Person.idOid

(Opcjonalny tag identity_twenty_resolver — PAUZA; duplikuje inbound)
```

---

## Kroki w Stape UI

| # | Zadanie | Done |
|---|---------|------|
| 1 | Skopiuj **`INBOUND_TWENTY_WEBHOOK.sGTM.js`** (zawiera inline resolver + mint-guard NR-3) | ☑ |
| 2 | Tag **`identity_twenty_resolver`** — jeśli już istnieje → **PAUZA** (nie republish) | ☑ |
| 3 | Permissions inbound: Logs, Reads event data, Sends HTTP requests | ☑ |
| 4 | Zaktualizuj `CRM_TWENTY_UPDATE_PERSON.sGTM.js` — **TWENTY_API_KEY** wpisany jawnie | ☑ |
| 5 | Publish kontenera sandbox | ☑ |

`IDENTITY_RESOLVER.sGTM.js` = backup w repo; nie jest wymagany w Stape, gdy inbound ma `processPersonIdentityFromWebhook`.

**Zmienne:** `twenty_api_key` w workerze (Constant) — ten sam co przy smoke #4.

---

## Test weryfikacyjny (G7 częściowy)

1. W Twenty znajdź **Person** z pustym `idOid` (Email Sync).
2. Ręcznie wywołaj webhook (zmiana pola) **lub** poczekaj na `person.updated`.
3. Log Stape resolvera:
   - `tier=T3 mint` (nowy nadawca) **lub** `T1` (znany email z formularza)
   - `RESOLVED` + `idOid`
4. Uruchom worker (`POST /crm/twenty_worker` lub Scheduler).
5. Person w Twenty ma wypełnione **idOid**.
6. Stape Storage → `identity_map` → klucz email → profil z `id_oid`.

**T4 test:** PASS sandbox 2026-06-16 — email→A, phone→B w `identity_map`; log `T4_NEEDS_REVIEW`; brak taska backfill i brak `Person.idOid` (patrz `E12_EMAIL_SYNC_EVIDENCE.md`).

**Automatyzacja:** `integrations/tools/verify_identity_e2e.py` — sekcje 1–6 (E2E, T3, T1, SKIP, NR-3, G7 T4).

---

## Ograniczenia v1 (świadome)

| Element | Status |
|---------|--------|
| `normalizeEmail` / `normalizePhone` | Uproszczone vs Sortownia — pełna parzystość w backlogu |
| Wskaźniki `by_email/` osobno | Używamy multi-key `identity_map` jak Sortownia (ADD-2) |
| T5 (dwa paid) | Nie implementowane — eskalacja manualna |
| Mint-guard concurrency (NR-3) | **Zaimplementowane** — klucz `twenty_person_{personId}` w `identity_map` + task `…_identity_backfill` |
| Flaga T4 w polu Twenty | Tylko log; UI flaga = Etap 2 |

---

## CROSS-REFERENCES

| Temat | Plik |
|-------|------|
| Macierz T1–T5 | `IDENTITY_AND_INBOUND.md` §5.2–5.3 |
| Worker backfill | `CRM_TWENTY_UPDATE_PERSON.sGTM.js` |
| Email Sync | `E12_EMAIL_SYNC_EXECUTION.md` |
