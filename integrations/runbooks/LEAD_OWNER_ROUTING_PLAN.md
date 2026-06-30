---
doc_id: LEAD_OWNER_ROUTING_PLAN
title: "Plan rozdzielania leadów — Gosia / Marta"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-30
related:
  - BUILD_CRM_TWENTY_CREATE_LEAD.md
  - E12_3_EMAIL_TEMPLATES_AND_TRAINING.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../tools/twenty_workflow_lead_notify_owner.json
---

# Plan rozdzielania leadów (Gosia / Marta)

**Cel:** po utworzeniu Opportunity handlowiec dostaje Task + email, a rekord ma ustawionego **Opportunity owner** (Gosia lub Marta).

**Stan (2026-06-30):** powiadomienia form + mail PASS na sandbox (filtry UI). Rozdzielanie ROUND_ROBIN **nie wdrożone**. R1 — zaproszenia członków zespołu (patrz §4.0).

---

## 1. Dwa różne „owner” (nie mylić)

| Pojęcie | Gdzie | Znaczenie |
|---------|-------|-----------|
| **owner (Sortownia paid)** | pole `owner` w profilu / task_queue | Kanał reklamowy first-touch: Google/Meta/organic — **nie** handlowiec |
| **Opportunity owner** | Twenty `opportunity.ownerId` | Gosia / Marta — kto obsługuje lead |

Sortownia **nie ustawia** dziś `ownerId` w Twenty (`CRM_TWENTY_CREATE_LEAD.sGTM.js` celowo pomija owner).

---

## 2. Legacy (julia362 / better-bitrix) — jak działa dziś

Źródło kodu: `better-bitrix-main/app/api/newEmail/route.ts`, `app/api/lead/route.ts`, `app/api/lead/assigned/route.ts`.

```
IMAP (julia362.mikrus.xyz, app2.js)
  → POST /api/newEmail  (better-bitrix prod)
  → createLead() tylko gdy inbox=leads@owocni.pl AND folder=INBOX
  → jeśli email nadawcy już w leads → SKIP (reuse leadId)
  → GPT-4o: tytuł + pola (produkt, telefon, firma, utm, gclid…)
  → insert leads (stage=unsorted, assigned_user_id=0)
  → leadAssignment(): unsorted + telefon → inquiry + assigned 257|259 (~50/50)
  → Make.com webhook (powiadomienie)
  → opcjonalnie SMS (Chce eksperta, godziny pracy)
```

| ID użytkownika BB | Handlowiec |
|-------------------|------------|
| 257 | Gosia |
| 259 | Marta |

**Ważne:** julia362 **nie** auto-tworzy leadów ze skrzynek handlowców — tylko **`leads@` + INBOX**.

---

## 3. Docelowy model Twenty (formularz + mail)

### 3.1 Formularz (już działa — Faza B)

```
Formularz → Sortownia → crm:twenty_create_lead → Person + Opp (srcSystem=OWOCNI_SORTOWNIA)
  → workflow „lead · formularz · powiadom owner v3” (FILTER: Sortownia + NEW)
  → Task + taskTarget + email (test: Dawid)
```

### 3.2 Mail na `leads@` (Opcja B + workflow 1b — 2026-06-30)

```
Mail → Email Sync leads@ → Person (+ wątek)
  → INBOUND: Resolver + enqueue crm:twenty_create_lead (leads_at)
  → Worker: Opportunity srcSystem=TWENTY_EMAIL
  → workflow „lead · mail · powiadom owner v1” (FILTER: NEW + TWENTY_EMAIL)
  → Task + taskTarget + email (test: Dawid)
```

**Wymaga:** skrzynka `leads@` podłączona w Twenty Settings → Accounts (E12.1 krok 7).  
Szczegóły testu: [LEADS_AT_INBOUND_TEST.md](./LEADS_AT_INBOUND_TEST.md).

**Równolegle (do cutoveru):** julia362 → BB → Make.com (Gosia/Marta losowo).

---

## 4. Rekomendacja: rozdzielanie w Twenty Workflow (Opcja A)

**Dlaczego:** parzystość z BB (`Math.random() > 0.5 ? 257 : 259`), bez zmian w Sortowni na start, jeden punkt konfiguracji dla powiadomień.

### 4.0 Zespół — Workspace Members (R1)

| Osoba | Email | Rola w CRM | ROUND_ROBIN leadów | Stan zaproszenia (sandbox) |
|-------|-------|------------|--------------------|---------------------------|
| Mariusz Słowik | `owocni@gmail.com` | dev / test | — | **ACTIVE** `2d65d0e6-…` |
| Marta Słowik | `marta@owocni.pl` | handlowiec | **tak** | **PENDING** (zaproszenie wysłane) |
| Gosia Zielińska | `gosia@owocni.pl` | handlowiec | **tak** | do zaproszenia |
| Maciej Wysocki | `maciej@owocni.pl` | zespół | na razie nie | do zaproszenia |
| Maja Srugała | `maja@owocni.pl` | zespół | na razie nie | do zaproszenia |

**Zaproszenia:** Settings → Members → **+ Invite** → email → rola **Member** (nie Admin).

API key (`TWENTY_API_KEY`) **nie może** wywołać `sendInvitations` (403 Forbidden) — tylko UI lub sesja admina w przeglądarce.

Opcjonalnie: Settings → Members → Invite → **Approved domain** `owocni.pl` — wtedy każdy z `@owocni.pl` może dołączyć bez osobnego maila (wymaga weryfikacji domeny).

Po **Accept** każdej osoby: uzupełnij kolumnę `workspaceMemberId` w tabeli (find w Twenty lub MCP `find_many_workspace_members`).

### Etapy

| # | Zadanie | Bloker |
|---|---------|--------|
| **R1** | Zaprosić zespół (tabela §4.0); poczekać na Accept | UI Twenty |
| **R2** | Zapisać `workspaceMemberId` Gosia + Marta (ROUND_ROBIN) | R1 |
| **R3** | W workflow formularzowym: nowy krok **0** `PICK_RECORD` ROUND_ROBIN między ID z R2 | R2 |
| **R4** | Krok **UPDATE_RECORD** Opportunity → `ownerId` = wynik PICK | R3 |
| **R5** | Email **To:** `{{trigger.properties.after.owner.userEmail}}` (po UPDATE użyć step output) | R4 |
| **R6** | Task **assignee** = ten sam owner | R4 |
| **R7** | Test: 4+ formularze → ~50/50 Gosia/Marta, brak maila na Dawida | R6 |
| **R8** | Cutover: osobny workflow lub FILTER dla kanału mail (`srcSystem` / brak idOid) — E12.3b | Email Sync PASS |

### Kolejność kroków workflow (docelowo)

```
Trigger opportunity.created
  → FILTER (Sortownia NEW)          ← już wdrożone 2026-06-30
  → PICK_RECORD (Gosia|Marta RR)
  → UPDATE_RECORD (ownerId)
  → CREATE task
  → CREATE taskTarget
  → SEND_EMAIL (to owner)
```

---

## 5. Alternatywa: Sortownia + create_lead (Opcja B)

| Krok | Opis |
|------|------|
| B1 | Reguła biznesowa w Sortowni: `owner_hint` = `gosia` \| `marta` (round-robin w Store lub stała kolejka) |
| B2 | Payload `crm:twenty_create_lead` niesie `owner_hint` |
| B3 | `CRM_TWENTY_CREATE_LEAD.sGTM.js` mapuje hint → `ownerId` przy POST Opportunity |
| B4 | Workflow tylko czyta owner z rekordu (bez PICK) |

**Kiedy:** mapowanie produkt→handlowiec (jak BB Opcja B1c w E12.3) lub gdy Sortownia ma być SSOT przydziału.

---

## 6. Kanał `leads@` — rozdzielanie wątków (E12.3b)

Osobny temat od formularza. Opcje z `E12_3_EMAIL_TEMPLATES_AND_TRAINING.md`:

| Opcja | Opis | Dev |
|-------|------|-----|
| **B1a** | Ręcznie: pierwszy kontakt → ustaw owner Opp | 0 |
| **B1b** | Workflow: nowy Opp z maila → domyślny owner / ROUND_ROBIN | niski |
| **B1c** | Mapowanie produktu z treści maila (GPT) → owner jak BB | średni |

Do cutoveru: **B1a + szkolenie**, potem **B1b** gdy Email Sync stabilny.

---

## 7. Checklist przed prod

- [ ] R1–R7 PASS na sandbox z prawdziwymi member ID Gosia/Marta
- [ ] Workflow formularzowy: FILTER Sortownia (PASS 2026-06-30)
- [ ] Osobny workflow / FILTER dla mail `leads@` (nie mieszać z formularzem)
- [ ] URL w mailu: prod Twenty zamiast `zany-maroon-panther`
- [ ] BB/julia362 OFF dopiero po G-PAR (E12.4)
- [ ] Make.com webhook — decyzja przy cutover (zastąpić email Twenty?)

---

## 8. ID referencyjne (sandbox)

| Zasób | ID |
|-------|-----|
| Workflow formularz | `e570b3de-4565-40c7-a776-dfd273b908e8` |
| Workflow formularz (aktywna wersja UI filter) | `b73869ce-d3e3-49d5-bb82-20ba95c9ac5f` |
| Workflow mail | `43406ab0-4259-45c5-b9fd-2268a7663152` |
| Workflow mail (aktywna wersja UI filter) | `6585690f-8320-40fd-bd8d-65625924a5ff` |
| leads@ connected account | `798c0b3b-c990-469a-b444-0e039d65b828` |
| Mariusz (test assignee) | `2d65d0e6-8a7f-4e6b-868f-07a6c4fd1f7d` |
| Rola Member (zaproszenia) | `c2d403d6-cb17-422b-9f15-79827a8d4834` |
| Zaproszenie pending Marta | `30608afa-53f9-4f89-88bf-f2f90d99cf93` |
