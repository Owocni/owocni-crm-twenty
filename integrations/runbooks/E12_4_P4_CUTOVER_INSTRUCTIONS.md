---
doc_id: E12_4_P4_CUTOVER_INSTRUCTIONS
title: "E12.4 P4 — instrukcja cutover Szablony maili (dla Dawida)"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-16
related:
  - E12_4_OWOCNI_MAIL_RESET_PLAN.md
  - E12_EMAIL_SYNC_EVIDENCE.md
  - E12_3_EMAIL_TEMPLATES_AND_TRAINING.md
---

# P4 — co zrobić teraz (cutover Szablony maili)

**Cel:** formalnie zamknąć MVP Owocni Mail (PAR-5.2 + szkolenie) i mieć dowód, że handlowiec może wysłać mail **bez Better-Bitrix**.

**Środowisko testowe:** `https://zany-maroon-panther.twenty.com`  
**Czas:** ok. 1–2 h (admin) + 15 min (handlowiec)

---

## Zanim zaczniesz — szybki check (5 min)

| # | Sprawdź | Gdzie | Oczekiwany wynik |
|---|---------|-------|------------------|
| 1 | Owocni Mail zainstalowany | Settings → Applications | Tylko **Uninstall** (app aktywna) |
| 2 | Konto email zsynchronizowane | Settings → Accounts | Status **Synced** |
| 3 | App zsynchronizowana po ostatnich zmianach | lokalnie: `cd apps/owocni-mail-twenty && yarn twenty dev --once` | `✓ Synced Owocni Mail` |
| 4 | Osoba testowa ma **Email** | Karta Person → pole Email | Np. Twój adres testowy |

Jeśli punkt 2 FAIL → najpierw dokończ sync skrzynki (plan E12.4 §P1).

---

## Krok 1 — Tematy szablonów (P4.2, ~30 min)

**Dlaczego:** 13/19 szablonów miało pusty `subject` w eksporcie BB.

**Uwaga:** App **częściowo** uzupełnia temat z nazwy szablonu (część po ` — `). Np. szablon `Sprzedaż — LOGO - oferta` dostanie temat `LOGO - oferta`. To wystarczy na test, ale warto poprawić MUST-y na docelowe tematy z BB.

### Gdzie edytować

Twenty → **Szablony maili** (menu Owocni Mail) → otwórz rekord → pole **Temat** (`subjectTemplate`).

### Priorytet MUST — uzupełnij tematy (jeśli puste lub złe)

| Nazwa w Twenty (skrót) | Sugerowany temat (z BB lub biznesu) |
|------------------------|-------------------------------------|
| Sprzedaż — LOGO - oferta | *(ustal z zespołem — w BB był pusty)* |
| Sprzedaż — FAKTURA - Start pro forma | *(ustal z zespołem)* |
| Sprzedaż — FAKTURA - Finał pro forma | *(ustal z zespołem)* |
| Strona — Strona - Ewa (Czy mają kasę?) | *(ustal z zespołem)* |
| Strona — Strona - Ewa (Mają kasę!) | *(ustal z zespołem)* |
| Helpdesk — Problem z uruchomieniem WordPressa | *(ustal z zespołem)* |
| Helpdesk — Strona uruchomiana | *(ustal z zespołem)* |
| Helpdesk — Uruchomienie strony | *(ustal z zespołem)* |
| Helpdesk — Podłączenie Przelewy24… | `Podłączenie systemu szybkich płatności Przelewy24 do Państwa sklepu` |

**PASS P4.2:** Otwierasz 3 losowe MUST szablony w pickerze — pole **Temat** nie jest puste (albo świadomie uzupełniasz ręcznie przed wysyłką).

---

## Krok 2 — Test PAR-5.2 (Ty lub handlowiec, ~10 min)

**Definicja PASS:** 1 handlowiec, 1 mail z szablonu, **bez BB**, całość **&lt; 60 sekund** od otwarcia pickera do snackbara „Email wysłany”.

### Przygotowanie

1. Wybierz **prawdziwą Person** z uzupełnionym emailem (najlepiej **własny** adres testowy).
2. Otwórz **stoper** w telefonie.
3. **Nie** otwieraj Better-Bitrix.

### Kroki (odpal stoper na kroku 1)

| # | Akcja | Oczekiwany wynik |
|---|--------|------------------|
| 1 | Karta **Person** → Command Menu (**⌘K** / Ctrl+K) → **Szablony maili** | Panel boczny z listą szablonów |
| 2 | Wybierz szablon MUST (np. LOGO - oferta) | Ładuje się temat + treść wizualna |
| 3 | Dopisz w edytorze test: `PAR52-TEST` | Widać zmianę w treści |
| 4 | Poczekaj **~2 s** (autosave draftu) | — |
| 5 | Kliknij **Wyślij email** | Snackbar: „Email wysłany do …”, panel się **zamyka** |
| 6 | Zatrzymaj stoper | **&lt; 60 s** |
| 7 | Sprawdź **skrzynkę odbiorcy** | Mail przyszedł, w treści jest `PAR52-TEST` |
| 8 | Wróć do **Person** → zakładka **Emails** / Timeline | Widać wysłaną wiadomość (jeśli sync działa) |

### Jeśli FAIL

| Objaw | Co zrobić |
|-------|-----------|
| „Treść maila jest pusta” | Odśwież stronę (Ctrl+Shift+R), powtórz; ewentualnie wyślij przez **Kod HTML** jako obejście i zgłoś dev |
| „Nie można wysłać” / send-readiness | Settings → Accounts — sync skrzynki |
| Mail bez `PAR52-TEST` | Zgłoś dev (sync edytora) |
| Panel nie zamyka się | Kosmetyka — nie blokuje PAR-5.2 jeśli mail doszedł |
| Stoper &gt; 60 s | OK na pierwszy raz; powtórz — drugi raz powinno być szybciej |

**Zapisz wynik:** data, kto testował, szablon, czas w sekundach, PASS/FAIL.

---

## Krok 3 — Dowody (PAR-5.3, ~15 min)

Uzupełnij `integrations/runbooks/E12_EMAIL_SYNC_EVIDENCE.md` — nowa sekcja:

```markdown
## G-PAR / PAR-5.2 — wysyłka z pickera (DATA)

| Pole | Wartość |
|------|---------|
| Tester | … |
| Person | … |
| Szablon | … |
| Czas (s) | … |
| Mail w inbox | PASS/FAIL |
| Timeline Person | PASS/FAIL |
| Edycja wizualna w mailu | PASS/FAIL |
| Bez BB | PASS |

Screenshoty: snackbar, inbox, timeline (opcjonalnie).
```

---

## Krok 4 — SOP dla handlowców (P4.3)

**Wyślij im** (Slack / Notion / 1 strona PDF) poniższą instrukcję:

---

### Jak wysłać mail z szablonu (Twenty)

1. Otwórz **kartę klienta** (Person) — upewnij się, że ma **Email**.
2. Naciśnij **⌘K** (Mac) lub **Ctrl+K** (Windows).
3. Wpisz **Szablony** i wybierz **Szablony maili**.
4. Kliknij **szablon** z listy (MUST = najczęstsze).
5. Sprawdź **temat** i popraw treść w edytorze (piszesz jak w Wordzie).
6. Kliknij **Wyślij email**.
7. Poczekaj na komunikat **„Email wysłany do …”** — panel sam się zamknie.

**Nie używaj** Better-Bitrix do wysyłki szablonów dziennych.

**Tryb zaawansowany:** link **Kod HTML** — tylko gdy trzeba poprawić formatowanie ręcznie.

**Problemy?** Brak email u klienta → uzupełnij pole Email. Brak przycisku wyślij → zgłoś adminowi (konto email nie zsynchronizowane).

---

## Krok 5 — Po PASS PAR-5.2 (kolejność)

| Kolejność | Akcja | Owner |
|-----------|--------|-------|
| 1 | Szkolenie 15 min z 1–2 handlowcami (SOP powyżej) | Dawid |
| 2 | Sync app na **produkcyjne** Twenty (jeśli inne niż sandbox) | Dev |
| 3 | Powtórz PAR-5.2 na prod z handlowcem | Dawid |
| 4 | **G-PAR** — szerszy checklist parity z BB | Dawid + zespół |
| 5 | **E12.4** — wyłączenie julia362 / ścieżki BB dla szablonów | po G-PAR PASS |
| 6 | **E12.3b** — routing `leads@` | osobny etap |

**Nie wyłączaj BB** dla wszystkich, dopóki G-PAR nie przejdzie i handlowcy nie potwierdzą, że Twenty wystarcza.

---

## Szybka checklista „done”

```
[ ] P4.2 — tematy MUST sprawdzone / uzupełnione
[ ] PAR-5.2 — test &lt; 60 s, mail w inbox, edycja w treści
[ ] PAR-5.3 — evidence w E12_EMAIL_SYNC_EVIDENCE.md
[ ] P4.3 — SOP wysłany do handlowców
[ ] Szkolenie 15 min zrealizowane
[ ] (opcjonalnie) prod sync + powtórka PAR-5.2
```

---

## Powiązane pliki

| Plik | Rola |
|------|------|
| [E12_4_OWOCNI_MAIL_RESET_PLAN.md](./E12_4_OWOCNI_MAIL_RESET_PLAN.md) | Plan master |
| [E12_EMAIL_SYNC_EVIDENCE.md](./E12_EMAIL_SYNC_EVIDENCE.md) | Dowody PASS |
| [exports/bb_email_templates/](./exports/bb_email_templates/) | Oryginalne tematy BB |
