# Statystyki sprzedażowe — paczka do weryfikacji (właściciel)

> **Cel tego pliku:** właściciel sprawdza **plan i definicje**, zanim cokolwiek powstanie w Twenty lub w kodzie produkcyjnym.  
> **To NIE jest** instrukcja wdrożenia — to jest „czy dobrze rozumiemy, co mierzymy i jak to pokażemy".

---

## Status paczki

| | |
|---|---|
| **Plan zaakceptowany** | 2026-07-09 |
| **ADR #18** | Open — wdrożenie w toku |
| **Następny krok** | [`IMPLEMENTATION-STATUS.md`](./IMPLEMENTATION-STATUS.md) |

---

## Co już zostało przez Ciebie zdecydowane (2026-07-09)

Sprawdź, czy nadal tak ma być:

| Temat | Decyzja |
|-------|---------|
| Metryki | M1 cykl (dni), M2/M3 w **godzinach**, M4 WR, M5 WR/kanał, M6 kohorta, M7/M9 stock pipeline |
| Email Sync | Gotowy — M2 wchodzi razem z resztą |
| Stock pipeline | Tak — M9 „ile otwartych teraz" obok M6 |
| Kanały | `google`, `facebook`, `organic`, `referral`, **`direct-email`**, `manual`, `other`, `unknown` |
| Widoczność dashboardów | Jawne w workspace (D-11) |

---

## Co prosimy Cię zweryfikować (3 pytania)

1. **Czy definicje metryk w [`METRICS.md`](./METRICS.md)** odpowiadają temu, co chcesz oceniać u handlowców?
2. **Czy układ dashboardów w [`DASHBOARD-WIDGETY-SPEC.md`](./DASHBOARD-WIDGETY-SPEC.md)** ma sens (Oceny = per handlowiec, Zespół = agregaty)?
3. **Czy lista kanałów w [`BIZSOURCE-MAP.md`](./BIZSOURCE-MAP.md)** jest kompletna (`direct-email` zamiast mylącego „web")?

Komentarze → Dawid lub bezpośrednio w PR / issue.

---

## Czego NIE ma w tej paczce (świadomie — to faza 2)

| Element | Kto / kiedy |
|---------|-------------|
| Pola w Twenty | Dawid po akceptacji planu |
| Workflow w Twenty | Dawid po testach sandbox |
| Zmiana kodu adaptera (`direct-email`) | Dawid — mały PR |
| Wpis ADR #18 w `DECISION_REGISTER` | Dawid — formalny start wdrożenia |
| Promocja do `owocni-crm/METRICS.md` (SSOT) | Po wdrożeniu i PASS testów |

---

## Co to ADR #18? (dla właściciela — jedno zdanie)

To **wpis w rejestrze decyzji repozytorium**: „wdrażamy moduł statystyk zgodnie z tą paczką".  
**Nie musisz nic podpisywać technicznie** — wystarczy, że zaakceptujesz plan w review. Dawid otwiera ADR w pliku markdown jako znacznik startu prac.

---

## Kolejność po Twojej akceptacji

```
1. Ty: OK plan (ten review)
2. Dawid: ADR #18 open w DECISION_REGISTER
3. Dawid: sandbox Twenty (pola, workflow, testy)
4. Dawid: produkcja + dashboardy
5. Dawid: ADR #18 closed + dokumentacja w owocni-crm/
```

---

## Mapa dokumentów do czytania

| Priorytet | Plik | Po co |
|-----------|------|-------|
| 1 | [METRICS.md](./METRICS.md) | Formuły — „co liczymy" |
| 2 | [PLAN-MODUL-STATYSTYK.md](./PLAN-MODUL-STATYSTYK.md) | Kontekst i decyzje |
| 3 | [DASHBOARD-WIDGETY-SPEC.md](./DASHBOARD-WIDGETY-SPEC.md) | Jak to wygląda w UI |
| 4 | [BIZSOURCE-MAP.md](./BIZSOURCE-MAP.md) | Kanały (Google, direct-email…) |

*Dla Dawida technicznie:* [QUICKSTART-DAWID.md](./QUICKSTART-DAWID.md)
