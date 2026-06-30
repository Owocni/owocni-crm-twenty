---
doc_id: LEADS_AT_INBOUND_TEST
title: "Test i reguły — mail na leads@owocni.pl"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-30
related:
  - E12_EMAIL_SYNC_EXECUTION.md
  - LEAD_OWNER_ROUTING_PLAN.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../../../better-bitrix-main/app/api/lead/route.ts
---

# Mail na `leads@owocni.pl` — jak to działa i jak testować

**Tak — możesz przetestować** wysyłając mail z zewnętrznego konta na `leads@owocni.pl`. W okresie równoległym (przed E12.4) **oba** systemy reagują — to oczekiwane (ADR #13).

---

## 1. julia362 + better-bitrix (prod, legacy)

Skrypt `julia362` (`julia362.mikrus.xyz`, `app2.js`) **nie jest w repo owocni-crm** — to osobny serwer IMAP. Logika tworzenia leada jest w **better-bitrix**:

### Warunki utworzenia NOWEGO leada (BB)

Z `better-bitrix-main/app/api/lead/route.ts`:

```typescript
// isValidEmailMessage — JEDYNA brama auto-leada
emailMessage.inbox === "leads@owocni.pl" && emailMessage.folder_path === "INBOX"
```

| Warunek | Skutek |
|---------|--------|
| Skrzynka = `leads@owocni.pl` | ✓ wymagane |
| Folder = `INBOX` | ✓ wymagane (Sent/Spam → **brak** auto-leada) |
| Nadawca już ma lead w BB (po email) | **SKIP** — zwraca istniejący `leadId` |
| Inna skrzynka (marta@, gosia@, …) | **brak** auto-leada przez `createLead` |

### Co robi BB po utworzeniu

1. **GPT-4o** wyciąga z treści: tytuł, produkt, telefon, firmę, utm, gclid…
2. Tworzy **Company** + **Lead** (`stage_name=unsorted`)
3. Woła **`leadAssignment()`** — leady z telefonem: `unsorted` → `inquiry` + **Gosia (257) lub Marta (259)** ~50/50
4. **Make.com** webhook + opcjonalnie **SMS** (fraza „Chce eksperta”, godz. 8–16, dni robocze)

### Inne skrzynki w julia362

| Skrzynka | BB |
|----------|-----|
| `pomoc@` | Helpdesk (ticket), nie sales lead |
| `leads@` | Auto-lead |
| pozostałe 5 | Tylko sync maili / stage change — **bez** nowego leada |

---

## 2. Twenty + Stape (sandbox / docelowo prod)

### Ścieżka — **Opcja B** (2026-06-30)

```
Mail zewnętrzny → leads@ (INBOX)
  → Twenty Email Sync: Message + Person (nadawca)
  → Webhook person.created / person.updated
  → Stape INBOUND_TWENTY_WEBHOOK:
       Identity Resolver (T3 mint idOid)
       → jeśli wątek INCOMING na skrzynce leads@ → enqueue crm:twenty_create_lead
  → Worker CRM_TWENTY_CREATE_LEAD:
       reuse Person (Email Sync) + POST Opportunity (srcSystem=TWENTY_EMAIL)
  → Webhook opportunity.created
  → Workflow „lead · mail · powiadom owner v1” (FILTER: NEW + TWENTY_EMAIL)
```

**Twenty Email Sync NIE tworzy Opportunity** — robi to adapter `crm:twenty_create_lead` (jak formularz, ale `srcSystem=TWENTY_EMAIL`).

### Ustawienie „Exclude non-professional emails” (Gmail/Outlook)

| Co robi Twenty | Skutek |
|----------------|--------|
| **Włączone** | Email Sync **nie tworzy Person** z @gmail.com / @outlook.com — wątek może być w CRM, ale bez kontaktu |
| **Wyłączone** | Person powstaje też z Gmail; Twenty **może** auto-utworzyć Company z domeny |

**Nasza reguła biznesowa:** Person + Lead (Opportunity) **tak**, auto-Company z freemail **nie**.

| Kanał | Person | Company | Opportunity |
|-------|--------|---------|-------------|
| Domena firmowa (np. `mail@fastman.eu`) | Email Sync ✓ | Twenty może utworzyć z domeny | Adapter ✓ |
| Gmail/Outlook z **Exclude ON** | ✗ (Twenty blokuje) | ✗ | Adapter **nie odpali** (brak webhook Person) — **faza 2:** trigger na `message.created` |
| Gmail z **Exclude OFF** | ✓ | Ryzyko auto-Company — ręcznie usuń / nie linkuj | Adapter ✓ |

**Rekomendacja na teraz:** zostaw **Exclude OFF** dla obsługi leadów z Gmail; Company z freemail usuń ręcznie lub zostaw puste. Adapter **nie tworzy Company**.

### Reguły Resolvera (skrót)

| Tier | Kiedy |
|------|-------|
| **T1** | Email znany w Stape `identity_map` → link istniejący `idOid` |
| **T3** | Nowy nadawca → mint nowy `idOid` |
| **T4** | Konflikt email vs phone → flaga „do rozstrzygnięcia”, brak auto-PATCH |

**Twenty Email Sync** tworzy Person + wątek — **Opportunity** tworzy adapter `crm:twenty_create_lead` (`srcSystem=TWENTY_EMAIL`).

### Workflow powiadomień formularza

Workflow **`lead · formularz · powiadom owner v3`** ma FILTER:

- `srcSystem` = `OWOCNI_SORTOWNIA`
- `stage` = `NEW`

→ **Mail na leads@ nie wywoła** tego workflow (poprawne — osobna reguła w E12.3b).

---

## 3. Jak przetestować (checklist)

### Przygotowanie

- [ ] **`leads@owocni.pl` podłączone w Twenty** — Settings → Accounts → IMAP (E12 FAZA 2, krok 7). **Bez tego mail nie pojawi się w Twenty.**
- [ ] Webhook Stape aktywny (`/inbound/twenty_webhook`)
- [ ] Workflow **`lead · mail · powiadom owner v1`** ACTIVE (1b, 2026-06-30)
- [ ] julia362 **włączony** (równoległość — nie wyłączać)

### Test

1. Wyślij mail **z nowego zewnętrznego adresu** (np. `test-leads-inbound+DATA@twojadomena.pl`) na **`leads@owocni.pl`**
2. Temat/treść: realistyczne zapytanie (np. „Potrzebuję strony www”, podaj telefon)
3. Poczekaj **~5–15 min**

### Oczekiwany wynik (równoległość)

| System | Oczekuj |
|--------|---------|
| **better-bitrix** | Nowy lead w kanban, stage inquiry/unsorted, owner Gosia lub Marta |
| **Twenty** | Person + wątek maila; **Opportunity** z adaptera; Resolver T3 → `idOid`; workflow mail v1 |
| **Workflow formularzowy** | **Brak** run (FILTER Sortownia) |
| **Duplikat** | Drugi mail **tym samym** adresem w BB → reuse leada (bez duplikatu) |

### Weryfikacja

- BB: nowy lead po `message_id` / email nadawcy
- Twenty: People → email testowy; Timeline wątku
- Stape logs: `inbound_twenty_webhook`, tier T3 w logu Resolvera
- **Nie** oczekuj maila od workflow formularzowego na Dawida

---

## 4. Różnice formularz vs mail

| | Formularz www | Mail na leads@ |
|---|---------------|----------------|
| Wejście | Sortownia `generate_lead` | Email Sync |
| `idOid` | Sortownia (profil) | Resolver T3 mint |
| `srcSystem` | `OWOCNI_SORTOWNIA` | `TWENTY_EMAIL` (adapter) |
| Auto-lead BB | Często też mail na leads@ z formularza | GPT z treści maila |
| Powiadomienie test | Workflow v3 (Dawid) | Workflow mail v1 (Dawid) |
| Przydział Gosia/Marta | Plan R1–R7 | BB `leadAssignment` **już teraz** |

---

## 5. Czego nie testować na leads@

- **`kontakt@owocni.pl`** — świadomie poza CRM (IDENTITY §5.4)
- **Duplikat tego samego emaila** — oczekuj SKIP w BB; w Twenty może dołożyć wątek do istniejącego Person
- **Oczekiwanie workflow formularzowego** — wymaga `srcSystem=OWOCNI_SORTOWNIA` (tylko Sortownia)

---

## 6. Następne kroki po teście mailowym

1. Evidence w `E12_EMAIL_SYNC_EVIDENCE.md` (wiersz leads@)
2. SOP rozdziału wątków `leads@` → owner (E12.3b)
3. Osobny workflow powiadomień dla kanału mail (opcjonalnie ROUND_ROBIN)
4. G-PAR → E12.4 wyłączenie julia362
