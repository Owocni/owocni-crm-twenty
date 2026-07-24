# MERGE_LEADS — Scalanie leadów (Opportunity + tożsamość)

Status: **MVP** · ręcznie · nigdy auto (NR-5 / IDENTITY §5.9)

## 1. Dwie operacje

| Operacja | Kiedy | id_oid |
|---|---|---|
| **Dopisz kanał** | Rozmowa/mail → istniejący lead | bez zmian |
| **Scal leady** | X1 i X2 = ta sama firma/osoba | X2 → alias X1 (`canonical_oid`) |

Parking rozmów = dopisz kanał. Ten runbook = **scal leady**.

## 2. Model survivor / loser

Handlowiec na **Opportunity B (loser)** klika **„Scal z leadem”** → wybiera **Opportunity A (survivor)**.

Po merge:

- Otwarta zostaje tylko **A** (`idOid` = X1)
- **B** → `stage=LOST`, `rejectionReason=DUPLICATE`, opis audytu
- CallTranscript z B → `opportunityId=A`
- **Maile:** `MessageParticipant.personId` Person B → Person A (timeline na survivorze)
- Email/telefon Person B → additional na Person A (gdy brak)
- Stape: wskaźniki email/phone/id_oid X2 → `canonical_oid=X1` (profil X2 **nie** kasujemy)
- **2026-07-24:** operacje Stape (pending write / alias / audit) są **soft-fail** — awaria Store nie blokuje merge w Twenty (ostrzeżenie w odpowiedzi `stapeWarnings`)

## 3. Worker GCP

```http
POST https://twenty-crm-worker-sandbox-…/
Content-Type: application/json

{
  "action": "merge_leads",
  "environment": "sandbox",
  "data": {
    "survivorOpportunityId": "<uuid A>",
    "loserOpportunityId": "<uuid B>",
    "reason": "ta sama firma",
    "adminConfirmed": false
  }
}
```

Idempotencja: klucz `merge_{loserId}_{survivorId}` w `twenty_state` — ponowny POST = `already_merged`.

### T5 (dwa paid id_oid)

Gdy **oba** Opportunity mają niepusty `idOid` **oraz** `srcSystem=OWOCNI_SORTOWNIA` → wymagane `adminConfirmed: true`. Inaczej HTTP 400 / skipped `needs_admin_t5`.

## 4. Stape alias (SOP OQ-I2)

Po udanym merge worker zapisuje:

1. `twenty_state/merge_{ts}_{X2}_{X1}` — audyt
2. `identity_map/{X2}` — dopisuje `canonical_oid=X1`, `merged_into=X1`, `merged_at`
3. Wskaźniki (jeśli istnieją dokumenty pod email/phone losera) — ten sam `canonical_oid` + `id_oid=X1` w lookupu kolejnych eventów

**Uwaga:** Sortownia paid dziś resolve’uje po email/phone → stary `id_oid`. Pełne „kolejne eventy idą zawsze na X1” wymaga, by Identity Resolver / Sortownia czytały `canonical_oid` (backlog). MVP merge i tak scala CRM + zostawia alias w Store.

## 5. Workflow Twenty

- Nazwa: **Opp · Scal z leadem v2** (`f99d9b49-ba9c-47f2-929d-50f87adcf105`) — ACTIVE
- Trigger: MANUAL pinned na `opportunity`
- Form: **picker RECORD** (Opportunity) + powód opcjonalnie — bez wklejania UUID
- HTTP → `action: merge_leads` (`loserOpportunityId` = `{{trigger.payload.id}}`, survivor = `{{….survivorOpportunity.id}}`)

v1 (UUID tekstowy) wyłączone. Spec: `integrations/tools/deploy_workflow_merge_leads.py`.

Worker URL: `https://twenty-crm-worker-sandbox-hsxlhvflrq-lm.a.run.app/` · action `merge_leads`.

Smoke PASS 2026-07-21: transcriptsMoved=1, additional email/phone, LOST/DUPLICATE, idempotent `already_merged`.

## 6. Czego NIE robimy w v1

- Auto-merge / propozycje free-mail
- Kasowanie Person B / Opportunity B
- Przepięcie Google/Meta attribution X2 (T5 admin)
- Merge Company native

## 7. Smoke

1. Utwórz Opp A + Person (email a@…, tel 111) i Opp B + Person (email b@…, tel 222) + CallTranscript na B
2. POST `merge_leads`
3. Sprawdź: B=LOST/DUPLICATE, rozmowa na A, Person A ma additional kontakt, `twenty_state` merge doc
