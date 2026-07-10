---
doc_id: E12_EMAIL_SYNC_EXECUTION
title: "E12 — Etap 1.2: czyszczenie Twenty + Email Sync (krok po kroku)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-07-10
recheck_trigger: "podłączenie skrzynki / PASS G7 / PASS G-PAR / zmiana zakresu maili"
default_trust: D:CORE
related:
  - TWENTY_ROLLOUT_MASTER
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../../owocni-crm/runbooks/IMPLEMENTATION_PLAN.md
---

# E12 — Email Sync: wykonanie krok po kroku

**Instancja Twenty:** [zany-maroon-panther.twenty.com](https://zany-maroon-panther.twenty.com)  
**Stape sandbox:** `https://uinpcbwf.eug.stape.io` · `environment=sandbox`  
**Legacy prod (bez zmian do cutoveru):** julia362 → better-bitrix → Supabase

**Źródła prawdy:** `IDENTITY_AND_INBOUND.md` §5.5–5.7 · `IMPLEMENTATION_PLAN.md` §5.2 · ADR #13

---

## Zasady na tę fazę (przeczytaj raz)

| ✅ Robimy | ❌ Nie robimy |
|----------|---------------|
| Czyszczenie **testowych** rekordów w Twenty | Usuwanie pól custom, webhooków, pipeline stage |
| Email Sync na 7 skrzynkach (bez `kontakt@`) | Email Sync na `kontakt@owocni.pl` |
| Równoległa praca: julia362 **włączony**, BB = prod | Wyłączanie julia362 (E12.4 — po G7 + G-PAR) |
| Webhook OUT → Stape sandbox | Przełączanie na prod Sortownię / prod adaptery |
| Po skrzynkach: budowa Resolvera (E12.2) — agent | Odpowiadanie klientom z Twenty (do cutoveru) |

**Równoległość `leads@`:** julia362 nadal tworzy leady w Supabase; Twenty równolegle widzi te same maile. To **świadomy** okres przed cutoverem (ADR #13). Prod BB **nie psujemy** — IMAP obsługuje wielu klientów.

**Hasła skrzynek:** `better-bitrix-main/.env` (zmienne `SMTP_USER_*` / `STMP_PASSWORD_*`). **Nie commituj** tego pliku. W runbooku tylko mapowanie — hasła bierz z pliku lokalnie.

---

## FAZA 0 — Czyszczenie Twenty (przed Email Sync)

**Cel:** puste kanban / People od śmieci ze smoke matrix i ręcznych testów. **Nie ruszać** konfiguracji integracji.

### 0.1 — Co zostawić (nie usuwać)

- [ ] Settings → Developers → **API Keys** (aktywny klucz)
- [ ] Settings → **Webhooks** — native webhook OUT na `/inbound/twenty_webhook` (Stape)
- [ ] Pola custom Opportunity / Person (`idOid`, `srcSystem`, `campaignRejected`, …)
- [ ] Pipeline **stage** (NEW … LOST) i widok Kanban
- [ ] Użytkownicy / workspace

### 0.2 — Co usunąć w Twenty UI

Wejdź na [Opportunities](https://zany-maroon-panther.twenty.com/objects/opportunities) → zaznacz rekordy testowe → Delete:

- [ ] Wszystkie Opportunity ze smoke matrix (m.in. opp z evidence `e812136a-a0a3-4c00-b348-6bba9ee9a258` jeśli nadal istnieje)
- [ ] Ręczne testy: „Test”, „Smoke”, fikcyjne firmy, opp bez realnego klienta
- [ ] Duplikaty utworzone wielokrotnie przy debugu webhooka

[People](https://zany-maroon-panther.twenty.com/objects/people):

- [ ] Osoby testowe powiązane tylko z usuniętymi opp
- [ ] Osoby bez powiązania — usuń jeśli to wyłącznie fixture testowy

[Companies](https://zany-maroon-panther.twenty.com/objects/companies) (jeśli są):

- [ ] Firmy testowe bez prod znaczenia

**Uwaga:** Twenty może blokować usunięcie rekordu z aktywnymi powiązaniami — usuń najpierw Opportunity, potem Person.

### 0.3 — Czyszczenie Stape Store (sandbox)

Stape UI → **Storage** (kontener sandbox `GTM-5ZM8KQ5S`):

| Kolekcja / wzorzec | Akcja |
|--------------------|--------|
| `twenty_opp_{uuid}` | Usuń dokumenty po usuniętych opp |
| `pending_write_twenty_{uuid}` | Usuń (TTL i tak wygasa ~45 s; porządek) |
| `task_queue` | Usuń wpisy `done` / testowe `crm:twenty_*` (Robot też czyści `done`) |

- [ ] Storage wyczyszczone od kluczy powiązanych z usuniętymi opp

### 0.4 — Opcjonalnie: arkusz sandbox Google Sheets

- [ ] Usuń wiersze testowe z arkusza `GOOGLE_SHEET_ID_SANDBOX` (jeśli zaśmiecony po smoke)

### 0.5 — Weryfikacja po czyszczeniu

- [ ] Kanban Opportunity: **0** lub tylko rekordy, które świadomie zostawiasz
- [ ] Zmień stage na jednym **nowym** ręcznym opp (opcjonalny mini-test) → webhook w logach Stape → usuń znowu
- [ ] **Nie** wyłączaj Schedulera `twenty-crm-worker-sandbox` ani inbound webhooka

**PASS FAZA 0:** Twenty gotowe na prawdziwe maile; Stape bez starych `twenty_opp_*` po testowych UUID.

---

## FAZA 1 — Parametry IMAP/SMTP (wspólne dla wszystkich skrzynek)

Z `better-bitrix-main/app/api/company/fetchEmailById.ts` (ten sam serwer co julia362):

| Parametr | Wartość |
|----------|---------|
| **IMAP host** | `mail.owocni.pl` |
| **IMAP port** | `993` |
| **IMAP SSL/TLS** | Tak |
| **SMTP host** | `smtp.owocni.pl` |
| **SMTP port** | `587` |
| **Username** | pełny adres e-mail skrzynki |
| **Password** | z `.env` (kolumna poniżej) |

**Twenty UI:** Settings → **Accounts** (lub Settings → Integrations → Email) → **Connect via IMAP/SMTP** → Test connection → Save.

**Ustawienia sync (zalecane na fazę równoległą):**

| Ustawienie | Wartość | Powód |
|------------|---------|-------|
| Sync direction | **Receive only** (jeśli dostępne) | Handlowcy nadal odpowiadają z Outlooka/BB do cutoveru |
| Date range (pierwsze podłączenie) | **Last 7 days** lub **Last 30 days** | Unikaj importu lat historii na start |
| Foldery | **Inbox** + **Sent** (sent opcjonalnie przy receive-only) | Zgodnie z potrzebą timeline |
| Auto-create records | Włączone (domyślne Twenty) | Docelowy model — Resolver (E12.2) obsłuży `id_oid` |

Po pierwszym udanym teście skopiuj ten sam szablon na kolejne skrzynki.

---

## FAZA 2 — Podłączenie skrzynek (E12.1)

**Zakres** (`IDENTITY` §5.5): 7 skrzynek. **`kontakt@owocni.pl` — NIE.**

**Kolejność:** najpierw skrzynki handlowców (julia362 **nie** auto-tworzy z nich leadów), **`leads@` na końcu** (największe nakładanie się z julia362). Zgodne z `IMPLEMENTATION_PLAN` §1.2.1 (wszystkie skrzynki) i ADR #13 (julia362 zostaje do końca).

### Mapowanie skrzynek → hasła w `.env`

Plik: `better-bitrix-main/.env` (repo siostrzane, **nie** `owocni-crm-github`).

| # | Skrzynka | Zmienna user | Zmienna hasło |
|---|----------|--------------|---------------|
| 1 | `copywriting@owocni.pl` | `SMTP_USER_MACIEJ` | `STMP_PASSWORD_MACIEJ` |
| 2 | `pomoc@owocni.pl` | `SMTP_USER_POMOC` | `STMP_PASSWORD_POMOC` |
| 3 | `marta@owocni.pl` | `SMTP_USER_MARTA` | `STMP_PASSWORD_MARTA` |
| 4 | `gosia@owocni.pl` | `SMTP_USER_GOSIA` | `STMP_PASSWORD_GOSIA` |
| 5 | `mariusz@owocni.pl` | `SMTP_USER_MARIUSZ` | `STMP_PASSWORD_MARIUSZ` |
| 6 | `studio@owocni.pl` | `SMTP_USER_STUDIO` | `STMP_PASSWORD_STUDIO` |
| 7 | `leads@owocni.pl` | `SMTP_USER_LEADS` | `STMP_PASSWORD_LEADS` |

### Checklist per skrzynka (powtórz 7×)

Dla każdej skrzynki z tabeli:

- [ ] **1.** Otwórz Settings → Accounts → Add account → IMAP/SMTP
- [ ] **2.** Wklej host/port/user/hasło z sekcji FAZA 1 + tabeli
- [ ] **3.** **Test connection** → musi być OK
- [ ] **4.** Save → poczekaj 5–15 min na pierwszy sync
- [ ] **5.** Sprawdź w Twenty: pojawiają się wątki / nowe People lub Opportunity
- [ ] **6.** Sprawdź logi: webhook `inbound_twenty_webhook` → GCP stub → `build_id: 2026-07-10-gcp-v5` → `task_queue` (`environment=sandbox`)
- [ ] **7.** Potwierdź w better-bitrix: **prod nadal działa** (julia362 log / nowy mail testowy na `leads@` tylko przy #7)
- [ ] **8.** Zaznacz skrzynkę jako DONE w tabeli poniżej

| Skrzynka | Test IMAP | Sync widoczny | Webhook Stape | BB prod OK |
|----------|-----------|---------------|---------------|------------|
| copywriting@ | ☐ | ☐ | ☐ | ☐ |
| pomoc@ | ☐ | ☐ | ☐ | ☐ |
| marta@ | ☐ | ☐ | ☐ | ☐ |
| gosia@ | ☐ | ☐ | ☐ | ☐ |
| mariusz@ | ☐ | ☐ | ☐ | ☐ |
| studio@ | ☐ | ☐ | ☐ | ☐ |
| leads@ | ☐ | ☐ | ☐ | ☐ |

**Test `leads@` (krok 7):** wyślij testowy mail na `leads@` z zewnętrznego konta → w ciągu ~5 min: rekord w Twenty **oraz** (równolegle) lead w better-bitrix od julia362. Oba systemy — to oczekiwane.

**PASS FAZA 2:** 7/7 skrzynek ACTIVE/synced; `kontakt@` niepodłączony; BB prod bez regresji.

---

## FAZA 3 — Po Email Sync (następne kroki — nie Ty sam w UI)

| ID | Zadanie | Kto | Status |
|----|---------|-----|--------|
| E12.2 | Identity Resolver T1–T5 w Stape (`IDENTITY` §5.2) | Agent + Dawid Stape | ☑ PASS 2026-06-16 |
| E12.3 | Szablony maili z better-bitrix → Twenty | Dawid + sprzedaż | ☐ → [E12_3_…](./E12_3_EMAIL_TEMPLATES_AND_TRAINING.md) |
| E12.3b | Rozdział wątków `leads@` → owner (`IMPLEMENTATION` §1.2.3) | Dawid | ☐ → ten sam runbook §B |
| E12.4 | Wyłączenie julia362 | Po **G7 + G-PAR** PASS | ☐ |
| 1.2.4 | Reconciliation 1×/dobę | Agent / cron | ☐ |

**G7 (identity-safety)** — test po E12.2:

- [x] Nowy nadawca mail → Resolver **T3** mint `id_oid` w Stape sandbox
- [x] Znany email → **T1** link bez duplikatu
- [x] T4 kolizja email≠phone → **brak auto-PATCH** (`T4_NEEDS_REVIEW`)
- [x] NR-3 równoległy mint → jeden `id_oid` (mint-guard)
- [ ] Stape niedostępny → **fail-closed** (kolejka, brak mint) — OPEN

**G-PAR** — przed go-live ([G_PAR_BETTER_BITRIX_PARITY.md](./G_PAR_BETTER_BITRIX_PARITY.md)):

- [ ] PAR-1…PAR-5 PASS (PAR-6 już z E12.2)
- [ ] PAR-2.4 LOST bez eventu platform
- [ ] PAR-3 — 7 skrzynek w timeline Twenty
- [ ] PAR-4 `leads@` + PAR-5 szablony (razem z E12.3)

---

## FAZA 4 — Czego nie dotykać (checklist bezpieczeństwa)

- [ ] **julia362** na `julia362.mikrus.xyz` — zostaje ON
- [ ] **better-bitrix** prod — handlowcy pracują tam do cutoveru
- [ ] **Sortownia prod** (`SORTOWNIA_V2_POPRAWIONY.js` na prod Stape) — bez zmian
- [ ] **Robot prod** — bez zmian env-guard
- [ ] **Webhook Twenty** — URL bez zmian (`/inbound/twenty_webhook`)
- [ ] **`kontakt@`** — świadomie poza CRM

---

## Troubleshooting

| Problem | Co sprawdzić |
|---------|----------------|
| Test IMAP fail | Hasło z `.env`; czy IMAP włączony na `mail.owocni.pl`; port 993 SSL |
| Sync ONGOING bez końca | Poczekaj 30 min; odłącz i podłącz; mniejszy date range |
| Duplikat leadów BB + Twenty | Oczekiwane na `leads@` do cutoveru — nie bug |
| Webhook nie leci | Settings → Webhooks; Publish Stape po zmianach tagów |
| Za dużo starych maili | Zmniejsz date range; nie „All emails” na pierwszym sync |

---

## Evidence (uzupełnij po wykonaniu)

| Data | Co | Dowód |
|------|-----|-------|
| | FAZA 0 cleanup | screenshot pustego kanban / notatka |
| | 7 skrzynek podłączonych | screenshot Settings → Accounts |
| | Test leads@ równoległy | Twenty opp + BB lead ten sam mail |

Zapisz w: `integrations/runbooks/E12_EMAIL_SYNC_EVIDENCE.md` — **utworzony 2026-06-16 (PASS sandbox)**.

---

## CROSS-REFERENCES

| Temat | Plik |
|-------|------|
| Master plan | `TWENTY_ROLLOUT_MASTER.md` |
| Kanały mailowe | `owocni-crm/IDENTITY_AND_INBOUND.md` §5.4–5.7 |
| Bramy G7, G-PAR | `owocni-crm/runbooks/IMPLEMENTATION_PLAN.md` §5.4 |
| E12.3 runbook | `E12_3_EMAIL_TEMPLATES_AND_TRAINING.md` |
| G-PAR macierz | `G_PAR_BETTER_BITRIX_PARITY.md` |
| Smoke (zamknięty) | `SMOKE_MATRIX_EVIDENCE_2026-06-15.md` |
