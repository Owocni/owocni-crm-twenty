---
doc_id: SANDBOX_PHASE1
title: "Faza 1 — sandbox: kanoniczne event_name + Robot"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-02
related:
  - ../fixtures/README.md
  - ../INTEGRATIONS_PARITY.md
---

# Faza 1 — sandbox P1 (Robot + task_queue)

**Cel:** potwierdzić, że `GoogleCloudRobot.js` po normalizacji poprawnie obsługuje **`purchase`** i **`rejected_lead`**, oraz że legacy **`lead_won`** / **`lead_rejected`** w tasku są mapowane bez regresji.

**Bramy:** P1 → PASS; wkład w **G1** (event-semantics).

---

## Wymagania wstępne

- [ ] Deploy Robot z aktualnego `integrations/GoogleCloudRobot.js` (GCP).
- [ ] Środowisko **sandbox** — `environment=sandbox` w tasku lub env-guard wyłącza prod API (patrz `ARCHITECTURE` §5.4).
- [ ] Dostęp do logów Cloud Function + (opcjonalnie) arkuszy debug GA4/Meta/Google Ads.

---

## Kroki

### 1.1 Task kanoniczny — `purchase`

1. W Stape Store kolekcja `task_queue` dodaj dokument z payloadem z pliku:
   - `../fixtures/task-queue-purchase-canonical.json`
2. Ustaw `status: pending`.
3. Wywołaj Robot (cron lub HTTP trigger).
4. **Oczekiwane w logach:**
   - `event_name` po normalize: `purchase`
   - GA4 map: `purchase` (nie `lead_won`)
   - Google Ads: gałąź `purchase`, `GOOGLE_ADS_PURCHASE_ACTION`
   - `biz_value` użyty jako wartość konwersji
5. **Oczekiwane NIE w logach:** ostrzeżenie `SSOT normalize` (bo już kanon).

### 1.2 Task legacy — `lead_won` → `purchase`

1. Dodaj task z `../fixtures/task-queue-purchase-legacy-lead_won.json`
2. Uruchom Robot.
3. **Oczekiwane:**
   - Log: `SSOT normalize: legacy event_name "lead_won" → "purchase"`
   - Zachowanie jak w 1.1 (ta sama gałąź `purchase`)

### 1.3 Task kanoniczny — `rejected_lead`

1. Task: `../fixtures/task-queue-rejected_lead-canonical.json`
2. **Oczekiwane:** wartość Google Ads = 0; prefix cennika `rejected_*`

### 1.4 Task legacy — `lead_rejected` → `rejected_lead`

1. Task: `../fixtures/task-queue-rejected-legacy-lead_rejected.json`
2. **Oczekiwane:** normalize + gałąź `rejected_lead`

### 1.5 Sortownia paid (opcjonalnie w tej fazie)

1. W GTM Preview wyślij event testowy z `event_name: lead_won`.
2. W logach Sortownii: `event_name = purchase` po `normalizeSsoEventName`.
3. Task zapisany w `task_queue` powinien mieć **`event_name: purchase`** (nie `lead_won`).

---

## Kryteria PASS (Faza 1)

| # | Kryterium | PASS |
|---|-----------|------|
| 1 | Kanoniczny `purchase` przetwarza się bez normalize warning | ☐ |
| 2 | Legacy `lead_won` → `purchase` + ten sam routing co (1) | ☐ |
| 3 | Kanoniczny `rejected_lead` → wartość 0 / rejected prefix | ☐ |
| 4 | Legacy `lead_rejected` → `rejected_lead` | ☐ |
| 5 | W nowych taskach **nie** zapisujesz już `lead_won` jako docelowej nazwy | ☐ |

Po PASS: w `INTEGRATIONS_PARITY.md` ustaw P1 na **PASS** (data + link do logów/screenshot).

---

## FAIL — typowe przyczyny

| Objaw | Działanie |
|-------|-----------|
| Robot nadal gałąź `lead_won` | Stary deploy — przeładuj funkcję z repo |
| Brak konwersji Google Ads | `order_id` puste w fixture |
| Sandbox trafia w prod Ads | Włącz env-guard (P10) przed kolejnymi testami |

---

## Następna faza

→ [PREFLIGHT_TWENTY_WEBHOOK.md](./PREFLIGHT_TWENTY_WEBHOOK.md)
