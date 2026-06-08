---
doc_id: TWENTY_SANDBOX_STEP01
title: "Krok T1 — pola i pipeline w Twenty sandbox"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-08
---

# Krok T1 — Twenty sandbox: pola FROZEN + pipeline

**Czas:** ~30 min (API, agent) lub ~2–3 h (tylko UI — fallback)  
**Instancja:** [https://zany-maroon-panther.twenty.com](https://zany-maroon-panther.twenty.com)  
**Źródło prawdy pól:** `owocni-crm/DATA_MODEL.md` §5.1–5.2  

> **Preferowana ścieżka (POC 2026-05-25):** Metadata GraphQL na `https://api.twenty.com/metadata` + API key. Agent wykonuje T1; Ty tylko dostarczasz klucz w `.env.local`.

---

## Ścieżka A — API (agent) — **DOMYŚLNA**

### A.0 Sekrety (Ty, jednorazowo)

```bash
cp .env.example .env.local
# Wklej TWENTY_API_KEY z Twenty → Settings → Developers → API Keys
```

### A.1 Audit

```bash
python3 integrations/tools/twenty_schema.py audit
```

### A.2 Co robi agent po audicie

- `createOneField` / `updateOneField` (Metadata API) — pola z tabeli §2 poniżej
- `stage` → wartości NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST
- Eksport JSON → `owocni-crm/generated/twenty-schema.snapshot.json`

**PASS:** `twenty_schema.py audit` bez brakujących pól.

---

## Ścieżka B — UI (fallback)

Użyj tylko gdy API key niedostępny lub endpoint zwraca 403.

---

## 0. Przed startem

- [ ] Masz dostęp do **Twenty Cloud** (plan Pro — ADR #6).
- [ ] Ustal **sandbox workspace** (osobna subdomena / workspace testowy — nie mieszaj z przyszłym prod).
- [ ] Otwórz w drugiej karcie: `DATA_MODEL.md` (tabela pól).

---

## 1. Pipeline / stage (natywne pole Opportunity)

Twenty ma natywne pole **Stage** na Opportunity. Ustaw wartości **dokładnie** (API = uppercase):

| Wartość (API) | Label (UI) — sugerowany |
|---------------|-------------------------|
| `NEW` | Nowy |
| `CONTACTED` | Kontakt |
| `QUALIFIED` | Zakwalifikowany (SQL) |
| `PROPOSAL` | Oferta |
| `WON` | Wygrany |
| `LOST` | Przegrany |

**Gdzie w Twenty:** Settings → Objects → **Opportunities** → Fields → **Stage** → Edit options.

**Uwaga:** `QUALIFIED` = SQL w języku zespołu (`EVENT_CONTRACT` ADR #5). `LOST` **nie** wysyła eventu do reklam.

---

## 2. Opportunity — custom fields

**Gdzie:** Settings → Objects → **Opportunities** → Fields → **+ Add field**

Dla każdego pola: **API name** (camelCase) musi być **identyczny** jak poniżej. Wypełnij **Description** (kopiuj z tabeli).

| Kolejność | API name | Typ Twenty | Unique? | Description (wklej do Twenty) |
|-----------|----------|------------|---------|-------------------------------|
| 1 | `idOid` | Text | **Yes** | Cross-system id_oid; mint Sortownia przy generate_lead. Puste przy ręcznym leadzie do czasu backfill. |
| 2 | `campaignRejected` | Boolean | No | UI label: **Odrzuć leada**. Informuje kanały reklamowe, że takich leadów nie szukamy. ≠ stage LOST. |
| 3 | `rejectionReason` | Select | No | Powód odrzucenia kampanii (raport). Wymaga `campaignRejected=true`. |
| 4 | `bizProduct` | Select * | No | Produkt (web, logo, …). Start: dodaj opcje które znacie z BB. |
| 5 | `bizSource` | Select * | No | Źródło leada (formularz, polecenie, mail, …). |
| 6 | `bizValueWon` | Currency | No | Wartość wygranej — przy stage WON. |
| 7 | `srcSystem` | Select | No | Proweniencja: OWOCNI_SORTOWNIA / TWENTY_UI / BETTER_BITRIX_LEGACY. Pole raportowe — nie do SKIP. |
| 8 | `lastOrchestrationEventAt` | Date time | No | Ostatni event wysłany do Sortowni (audit). |
| 9 | `lastOrchestrationEventId` | Text | No | id_event ostatniego eventu do Sortowni. |
| 10 | `bitrixDealId` | Text | No | Deal księgowy Bitrix24 po WON — ręcznie (MVP). |

\* `bizProduct` / `bizSource`: jeśli Twenty wymusza TEXT zamiast SELECT na start — OK na sandbox; zanotuj w `OPS_NOTES` (OQ-D1). Docelowo SELECT.

### Opcje `srcSystem` (SELECT)

- `OWOCNI_SORTOWNIA`
- `TWENTY_UI`
- `BETTER_BITRIX_LEGACY`

### Opcje `rejectionReason` (start — uzupełnij z BB)

Minimum na testy (doprecyzuj z zespołem):

- `BUDGET`
- `NOT_TARGET`
- `SPAM`
- `DUPLICATE`
- `OTHER`

### Opcje `bizProduct` (przykłady startowe)

- `WEB`
- `LOGO`
- `COPY`
- `OTHER`

---

## 3. Person — custom field

**Gdzie:** Settings → Objects → **People** → Fields → **+ Add field**

| API name | Typ | Unique? | Description |
|----------|-----|---------|-------------|
| `idOid` | Text | **Yes** | Cross-system id_oid (Stape master). Backfill z Sortowni po manual create. |

---

## 4. Widok Kanban

- [ ] Utwórz widok **Kanban** na Opportunities z kolumnami = stage (NEW → LOST).
- [ ] Ustaw domyślny stage nowego leada = **NEW**.

---

## 5. Test ręczny (5 min)

1. Utwórz **Person**: email `test-sandbox@example.com`, `idOid` puste.
2. Utwórz **Opportunity** powiązaną z tą osobą:
   - `stage` = NEW
   - `campaignRejected` = false
   - `bizProduct` = WEB (jeśli jest)
   - `srcSystem` = TWENTY_UI
3. Zmień stage → QUALIFIED → WON, ustaw `bizValueWon`.
4. Ustaw `campaignRejected` = true + `rejectionReason` na **osobnym** rekordzie testowym.

Jeśli wszystko działa w UI → **T1 PASS**.

---

## 6. Po T1 — oddaj agentowi

Opcjonalnie (przyspiesza T2):

- Screenshot: Settings → Opportunities → Fields (lista).
- Lub: Settings → Developers → API — potwierdź że workspace działa.

Agent zaktualizuje `generated/twenty-schema.snapshot.json` i przejdzie do [TWENTY_SANDBOX_STEP02_WEBHOOK.md](./TWENTY_SANDBOX_STEP02_WEBHOOK.md).

---

## Checklist PASS T1

| # | Kryterium | ☐ |
|---|-----------|---|
| 1 | Wszystkie pola z tabeli §2 istnieją z poprawnym API name | |
| 2 | Person.`idOid` unique | |
| 3 | Stage ma 6 wartości NEW…LOST | |
| 4 | `campaignRejected` label = „Odrzuć leada" | |
| 5 | Kanban działa | |
| 6 | Rekord testowy utworzony bez błędów | |
