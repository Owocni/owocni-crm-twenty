# SALES_OPS_REQUIREMENTS — wymagania operacyjne sprzedaży

**Status:** Draft (scope alignment)  
**Powiązane decyzje:** `DECISION_REGISTER.md` #15  
**Cel:** spisać wymagania z review i rozdzielić je na MVP vs Etap 2/3.

---

## 1. Stage naming (język handlowy)

Aktualny język zespołu sprzedaży (legacy):

- Zapytania
- Odpowiedzi
- Kwalifikowany (SQL)
- Analiza
- Wpłaca
- Obsługa

Mapowanie techniczne do Twenty i eventów jest w `STAGE_MAPPING.md`.

---

## 2. Must-have do pracy handlowej (minimum operacyjne)

1. Szablony maili.
2. Wysyłka maila na wskazaną godzinę.
3. Wyszukiwarka klienta po adresie email.
4. Automatyczna wysyłka SMS wraz z mailem.

**Status implementacyjny:** do potwierdzenia przez ownera produktu, co jest krytyczne w Etapie 1, a co dopiero w Etapie 2.

---

## 3. Złoto (high-value backlog)

- Wyszukiwanie po fragmencie treści maila (analogicznie do Firmao).

---

## 4. Dystrybucja leadów (propozycja zasad)

1. Round-robin między sprzedawcami.
2. Limit nieodpisanych: jeśli sprzedawca ma >X nieodpisanych, nie dostaje nowych.
3. Tryb urlopowy: automatyczne przekierowanie leadów do drugiego sprzedawcy.

**Uwaga:** to jest obszar automatyzacji operacyjnej, nie core cutover Etapu 1.

---

## 5. Tagowanie i widoczność źródła

Wymagane tagi:

- Kategoria zapytania (np. nazwa/logo/strony; obecnie odpowiednik `Główny produkt`)
- Źródło leada

**Wniosek:** `bizSource` z `DATA_MODEL.md` musi być widoczne i użyteczne w workflow sprzedaży, nie tylko w treści zapytania.

---

## 6. Liczniki leadów (raportowanie operacyjne)

### Dzienny

Kolumny:

- Kategoria
- Źródło
- Liczba leadów dziś
- Liczba leadów wczoraj
- Zmiana %

### Tygodniowy

Kolumny:

- Kategoria
- Źródło
- Ten tydzień
- Poprzedni tydzień
- Śr. z 4 tygodni
- % vs średnia (zielony/żółty/czerwony)

---

## 7. Zakres etapów (wstępny)

### Etap 1 (cutover-ready)

- Stabilny flow leadów + eventów (bezpieczny cutover)
- Minimalne dane i pola do pracy handlowej
- Brak regresji procesu sprzedaży

### Etap 2+

- Wątki rozmów telefonicznych jako tekst
- Enrichment danych firmy (np. po NIP)
- Zaawansowane reguły przydziału
- Zaawansowane liczniki i analityka

---

## 8. Open questions do ADR #15

1. Które elementy sekcji 2 są twardym MVP?
2. Co musi być gotowe przed cutoverem, a co może wejść w T+30?
3. Kto jest właścicielem backlogu operacyjnego sprzedaży?
