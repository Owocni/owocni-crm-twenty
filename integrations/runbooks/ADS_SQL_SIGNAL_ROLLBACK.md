---
doc_id: ADS_SQL_SIGNAL_ROLLBACK
title: "Rollback sygnałów SQL / WON / rejected — Twenty sandbox, BB prod"
layer: runbook
status: active
owner: "Dawid"
audience: "Dawid (wykonanie) + Piotr (Ads/Meta) + Mariusz (go/no-go)"
last_verified: 2026-09-01
related:
  - CUTOVER_BB_SYNC_EXECUTION.md
  - ../TWENTY_PATHS.md
  - ../shared/envGuard.js
source: "decyzja cutover 2026-08-28 + brief marketing (Etap 2 rollback 1 h)"
---

# Rollback sygnałów SQL / WON / rejected

**To nie jest rollback CRM.** Karty, maile i kanban zostają w Twenty. Cofacie **tylko routing analityki** do Google Ads / Meta / GA4 MP.

**Stan po cutoverze (piątek 28.08.2026, dzień zero):**

| Źródło | `environment` na evencie | Ads / Meta |
|---|---|---|
| Formularz → Sortownia → `generate_lead` | **prod** (bez zmian) | **idzie** |
| Twenty → inbound → `qualify_lead` / `purchase` / `rejected_lead` | **prod** | **idzie** |
| BB `/api/analytics/lead` → SQL / WON / rejected | **sandbox** | **nie idzie** (tylko arkusz debug) |

**Stan po tym rollbacku:**

| Źródło | `environment` | Ads / Meta |
|---|---|---|
| Formularz → `generate_lead` | **prod** | **idzie** (nie ruszamy) |
| Twenty → SQL / WON / rejected | **sandbox** | **nie idzie** |
| BB `/lead` → SQL / WON / rejected | **prod** | **idzie** |

`helpdesk` BB bez zmian. Robot (`envGuard.js`): `environment=sandbox` → SKIP prod API, zapis do arkusza sandbox.

---

## 1. Co rollback robi, a czego nie

**Robi:** przepina emisję `qualify_lead`, `purchase` (`lead_won`), `rejected_lead` z Twenty z powrotem na sandbox i z BB z powrotem na produkcję.

**Nie robi:**

- nie cofa syncu BB→Twenty (`sync_bb_to_twenty.py rollback` to **inny** playbook),
- nie usuwa kart z Twenty,
- nie wyłącza `generate_lead` z formularza / Sortowni,
- nie zmienia kont konwersji w Ads/Meta,
- nie przywraca automatycznie pracy sprzedaży w BB — to decyzja operacyjna (patrz §6).

**Warunek, żeby Ads znowu dostały SQL/WON/rejected:** ktoś musi wykonać te akcje **w BB `/lead`**. Jeśli zespół zostaje w Twenty, sygnały CRM idą tylko do arkusza sandbox i konta reklamowe **milczą** na SQL/WON/rejected.

---

## 2. Kto i kiedy

| Rola | Robi |
|---|---|
| Mariusz / Piotr | go/no-go (np. rozjazd vs baseline, duplikaty, SQL poza oknem 7/10 dni) |
| **Dawid** | przełącza env (GCP + Stape + BB) |
| **Piotr** | w UI Ads/Meta potwierdza, że SQL/WON z Twenty **przestały** wchodzić, a z BB **wróciły** (jeśli sprzedaż znów klika w BB) |

Cel czasowy z briefu: **ok. 1 h**. Szybka ścieżka = update env Cloud Run, bez przebudowy kodu inboundu.

**Kolejność bezwzględna** (inaczej double-count na Ads/Meta):

1. Twenty → sandbox (**najpierw**).
2. Smoke: SQL w Twenty **nie** idzie na prod.
3. BB → prod.
4. Smoke: SQL w BB idzie na prod (jeśli jest karta testowa w BB).
5. Komunikat zespołowi.

Nigdy oba źródła na `prod` w tym samym czasie.

---

## 3. Krok A — Twenty na sandbox

Inbound stempluje `environment` na tasku w `task_queue`. Źródło prawdy: **`RUNTIME_ENVIRONMENT` na Cloud Function / Cloud Run**. Dopóki ta zmienna jest `prod` albo `sandbox`, nagłówek Stape `X-Owocni-Runtime` jest **ignorowany** (`getRuntimeEnvironment` w `cloud-functions/twenty-inbound-webhook/shared/config.js`).

### A1. Szybko (bez pełnego deployu)

```bash
gcloud run services update twenty-inbound-webhook-sandbox \
  --project=owocni-robot \
  --region=europe-central2 \
  --update-env-vars RUNTIME_ENVIRONMENT=sandbox
```

Sprawdź rewizję i env:

```bash
gcloud run services describe twenty-inbound-webhook-sandbox \
  --project=owocni-robot \
  --region=europe-central2 \
  --format='yaml(spec.template.spec.containers[0].env)'
```

Szukaj `RUNTIME_ENVIRONMENT: sandbox`.

### A2. Pełny redeploy (gdy A1 nie przejdzie albo chcesz zsynchronizować kod)

W `integrations/cloud-functions/twenty-inbound-webhook/.env.deploy` ustaw `RUNTIME_ENVIRONMENT=sandbox` (plik lokalny, **nie commituj**). Potem:

```bash
cd integrations/cloud-functions/twenty-inbound-webhook
RUNTIME_ENVIRONMENT=sandbox bash deploy.sh
```

Uwaga: `deploy.sh` czyta `.env.deploy`. Jeśli tam zostaje `prod`, sam `bash deploy.sh` **przywróci prod**. Zawsze nadpisuj `RUNTIME_ENVIRONMENT=sandbox` w komendzie **albo** zmień plik przed deployem.

### A3. Stape (spójność, nie mechanizm)

W `integrations/INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js` jest dziś `runtime_environment: "prod"`. Po rollbacku ustaw `"sandbox"` i **publish** kontenera.

To nie wyłączy prod, dopóki CF ma `RUNTIME_ENVIRONMENT=prod`. Po A1/A2 jest tylko po to, żeby logi stubu i przyszły deploy bez env na CF nie wróciły przypadkiem na prod.

### A4. Smoke Twenty

1. Na karcie testowej w Twenty: „Przyjmij jako SQL” (albo WON / Odrzuć).
2. Log inbound: `env=sandbox`, emit `qualify_lead` / `purchase` / `rejected_lead`.
3. `task_queue`: `environment: sandbox`.
4. Log Robota: skip prod API (`env-guard` / `SKIP` sandbox).
5. Arkusz **sandbox** ma wiersz; arkusz prod i Ads/Meta **nie** dostają tego SQL.

PASS: SQL z Twenty nie wchodzi na konto reklamowe.

---

## 4. Krok B — BB na produkcję

Endpoint: `better-bitrix-main/app/api/analytics/lead/route.ts`.

Po cutoverze payload ma na sztywno:

```ts
environment: "sandbox",
runtime_environment: "sandbox",
```

Rollback: zmień **oba** na `"prod"` (albo usuń pola — Robot bez `environment` traktuje task jako prod).

```ts
environment: "prod",
runtime_environment: "prod",
```

Deploy aplikacji BB (Vercel / dotychczasowy pipeline `crm.owocni.pl`). **Helpdesk nie używa tego endpointu** — zostaje.

Komentarz w pliku o cutoverze 2026-08-31 zaktualizuj przy commicie, żeby kolejny agent nie myślał, że sandbox jest nadal celem.

### B1. Smoke BB

1. Na karcie testowej w BB `/lead`: SQL / WON / odrzucenie kampanii (ten sam flow co przed cutoverem).
2. Request `/api/analytics/lead` z `environment: prod`.
3. Robot **nie** loguje skip sandbox.
4. Piotr: konwersja w Ads/Meta (istniejące akcje, nie nowe).

PASS: SQL/WON/rejected z BB wracają na platformy.

---

## 5. Czego nie ruszać

| Zostaw | Dlaczego |
|---|---|
| Sortownia / Web GTM / `generate_lead` | Lead z formularza ma iść jak dziś |
| `robot-task-monitor` kod | Guard zostaje. Jedyny wyjątek: flaga `META_INSTA_FORM_CAPI_FROM_SANDBOX` puszcza SQL/WON/rejected Instant Form na Meta CAPI (`lead_id`), bez Google Ads / GA4. Domyślnie OFF. |
| Webhook Twenty (URL, HMAC, Stape path) | Inbound ma dalej działać, tylko sandbox |
| BB `/helpdesk` | Osobny SoR obsługi |
| Conversion actions w Ads/Meta | Brief: bez nowych zdarzeń |

---

## 6. Praca zespołu po rollbacku

| Obszar | Po rollbacku |
|---|---|
| Nowe leady z formularza | Twenty (Sortownia), jak po cutoverze |
| SQL / WON / rejected **dla Ads/Meta** | **BB `/lead`** |
| SQL / WON w Twenty | wolno robić operacyjnie, ale **nie** karmią Ads |
| Helpdesk | BB, bez zmian |

Jeśli sprzedaż ma zostać w Twenty, ten rollback **nie naprawia** sygnału reklamowego — tylko go wyłącza z Twenty. Wtedy jedyna opcja to zostać na Twenty=prod (stan po 28.08) albo naprawić jakość SQL, nie cofać env.

**Wyjątek Insta Form (10 IX 2026):** kart Roberta z Instant Form nie ma w BB, więc ścieżka BB ich nie pokrywa. Robot może odesłać SQL/WON/rejected tych kart na Meta CAPI przy `META_INSTA_FORM_CAPI_FROM_SANDBOX=true`. Reszta Twenty zostaje sandbox. Google Ads nietknięte. Payload = `lead_id`. Roll-forward całego inboundu na prod **nie** jest tą furtką.

---

## 7. Double-count i okna atrybucji

W oknie między A i B Twenty już nie emituje prod, BB jeszcze nie. Krótka luka SQL na Ads jest akceptowalna.

Jeśli odwrócisz kolejność (BB prod **przed** Twenty sandbox) i ktoś kliknie SQL w obu CRM-ach → **dwa** `qualify_lead` na to samo konto.

Okna z briefu (Meta 7 dni od zdarzenia, Google 10 dni od kliknięcia) obowiązują też po rollbacku. Stary lead w BB z SQL po 2 tygodniach nadal może nie przypisać się do kliknięcia — to nie jest błąd routingu.

---

## 8. Roll-forward (powrót do stanu po 28.08)

Odwróć **kolejność**:

1. BB z powrotem `environment: "sandbox"` + deploy.
2. Smoke: SQL w BB nie idzie na Ads.
3. Twenty: `RUNTIME_ENVIRONMENT=prod` (Cloud Run update albo `RUNTIME_ENVIRONMENT=prod bash deploy.sh`).
4. Stape Client z powrotem `runtime_environment: "prod"` + publish.
5. Smoke: SQL w Twenty idzie na Ads (Piotr).
6. `.env.deploy`: `RUNTIME_ENVIRONMENT=prod`, żeby następny inbound deploy nie zepsuł stanu.

---

## 9. Log operacji

Po wykonaniu wpisz wiersz w `owocni-crm/ops/OPS_NOTES.md` (log operacji): data, Twenty sandbox / BB prod, kto odpalił, smoke PASS/FAIL, `no_emit` jeśli dotyczy.

Nie commituj `.env.deploy`.
