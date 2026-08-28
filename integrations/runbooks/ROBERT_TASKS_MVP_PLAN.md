---
doc_id: ROBERT_TASKS_MVP_PLAN
title: "Robert — MVP tasków w Twenty (plan wdrożenia)"
layer: runbook
status: proposed
owner: "Dawid"
last_verified: 2026-08-24
parent: CUTOVER_TWENTY_TEAM_PLAN.md
related:
  - CUTOVER_1ON1_CHECKPOINT_SHEET.md
  - CUTOVER_SESSION_SCRIPTS.md
  - LEAD_DISPATCHER_PLAN.md
---

# Robert — MVP tasków w Twenty

## 1. Decyzja

**Przyjęty wariant:**  
**Kanban = prawda o etapie sprzedaży**  
**Task = czynność dnia / przypomnienie operacyjne**

Nie budujemy kopii Pipedrive przed cutoverem.  
Robimy **MVP tasków jako overlay do Kanbanu**.

## 2. Cel biznesowy

Robert ma po cutoverze móc:
- zobaczyć, **co dziś zrobić**
- rozróżnić **typ zadania**
- ustawić **priorytet**
- wejść z taska do właściwego leada / klienta
- pracować bez wracania do Pipedrive jako głównego systemu dnia

## 3. Zakres MVP

### Wchodzi do MVP

1. Dwa pola na Task:
   - `taskType` — typ zadania
   - `taskPriority` — priorytet
2. Jeden praktyczny widok:
   - `Robert — dziś`
3. Prosta zasada pracy:
   - etap sprawy = na **Lejku**
   - czynność do wykonania = w **Taskach**
4. Krótka sesja z Robertem:
   - jak zakładać task
   - jak filtrować
   - jak używać tasków obok kanbanu

### Nie wchodzi do MVP

- Calendly -> auto task
- rozbudowany kalendarz / goście / busy
- zaawansowana automatyka tasków
- generowanie wielu tasków z etapów
- pełna replika PD task-first
- rollout tasków dla całego zespołu

## 4. Model danych

### 4.1 Pole: `taskType`

**Typ:** `SELECT`

**Opcje MVP:**

| API value | Etykieta UI | Użycie |
|-----------|-------------|--------|
| `NEW_LEAD` | Nowy lead | auto przy wpłynięciu leada (form/mail); dueAt = teraz+1h (placeholder SLA) |
| `FIRST_CALL` | Pierwszy telefon | pierwszy kontakt / pierwsza próba |
| `FOLLOW_UP` | Follow-up | oddzwonić / wrócić / przypomnieć się |
| `OFFER` | Oferta | przygotować / wysłać ofertę |
| `VIDEO` | Video | wysłać video / materiał / case |
| `MEETING` | Spotkanie | rozmowa / spotkanie umówione |
| `ADMIN` | Admin | rzeczy pomocnicze / wewnętrzne |

### 4.2 Pole: `taskPriority`

**Typ:** `SELECT`

**Opcje MVP:**

| API value | Etykieta UI |
|-----------|-------------|
| `HIGH` | Wysoki |
| `MEDIUM` | Średni |
| `LOW` | Niski |

## 5. Widok roboczy

### Widok: `Robert — dziś`

**Obiekt:** `Task`

**Filtry:**
- assignee = Robert
- status != done / completed
- due today **lub** overdue
- opcjonalnie: tylko taski powiązane z Opportunity

**Sortowanie:**
1. termin rosnąco
2. priorytet malejąco

**Kolumny rekomendowane:**
- title
- taskType
- taskPriority
- dueAt / dueDate
- status
- target opportunity / person
- stage opportunity (jeśli da się pokazać relacyjnie)

**Cel widoku:** rano Robert otwiera `Robert — dziś` i widzi listę działań, a nie całą bazę tasków.

## 6. Zasady użycia

### Co idzie na Kanban

Na Kanbanie Robert prowadzi:
- etap sprzedaży
- ruch sprawy do przodu
- ocenę „na jakim etapie jest lead”

### Co idzie do Taska

Task opisuje:
- **co konkretnie zrobić**
- **kiedy**
- **jakiego typu to ruch**
- **na ile pilne**

### Prosty wzorzec tytułu taska

Rekomendowany format:

`[Typ] · [Klient / lead]`

Przykłady:
- `FU · Anna Kowalska`
- `Oferta · ABC Sp. z o.o.`
- `1. telefon · Lead z formularza`
- `Video · Klient po wycenie`

Nie automatyzujemy tego w MVP, tylko ustalamy jako prostą zasadę operacyjną.

## 7. Plan wdrożenia

### Etap 0 — akceptacja (teraz)

**Decyzje już podjęte:**
- robimy wariant rekomendowany
- taski są overlayem do kanbanu
- zakres = Robert MVP, nie cały zespół

### Etap 1 — konfiguracja metadata

1. Dodać pole `taskType` na obiekcie `Task`
2. Dodać pole `taskPriority` na obiekcie `Task`
3. Ustawić etykiety PL i kolejność opcji

**Owner:** agent + Dawid  
**Ryzyko:** niskie

### Etap 2 — widok roboczy

1. Zbudować widok `Robert — dziś`
2. Ustawić filtry
3. Ustawić sortowanie
4. Dobrać kolumny

**Owner:** agent  
**Ryzyko:** niskie

### Etap 3 — sesja z Robertem

Na sesji pokazać:
1. Lejek jako główny obraz sprzedaży
2. `Robert — dziś` jako lista działań
3. jak dodać task:
   - typ
   - priorytet
   - termin
   - powiązanie z leadem
4. jak zamknąć task po wykonaniu

**Owner:** Dawid  
**Ryzyko:** średnie, bo to moment weryfikacji czy kupuje model

### Etap 4 — korekta po sesji

Po 1. sesji z Robertem:
- potwierdzić, czy kategorie są wystarczające
- sprawdzić, czy brakuje 1 dodatkowego typu
- nie rozszerzać zakresu bez wyraźnej potrzeby

## 8. Kryteria PASS

MVP uznajemy za gotowe, jeśli:

1. Robert ma widok `Robert — dziś`
2. może utworzyć task z:
   - typem
   - priorytetem
   - terminem
   - powiązaniem do leada
3. akceptuje zasadę:
   - **Kanban = etap**
   - **Task = czynność dnia**
4. nie potrzebuje wracać do PD do samego zarządzania listą zadań dziennych

## 9. Kryteria FAIL / sygnały ostrzegawcze

Wracamy do tematu, jeśli po sesji okaże się, że:
- Robert nadal próbuje prowadzić dzień wyłącznie po taskach i odrzuca kanban
- brakuje mu krytycznie jednego typu taska
- brak widoku `Robert — dziś` powoduje chaos
- zaczyna oczekiwać Calendly / kalendarza jako must-have przed cutoverem

## 10. Co po MVP

Jeśli MVP się przyjmie, kolejny etap może objąć:
- dodatkowe statusy tasków
- automatyczne tworzenie tasków z wybranych zdarzeń
- prostsze wejście z taska do pełnego kontekstu klienta
- integrację Calendly
- ewentualny rollout podobnego modelu dla innych osób

Nie robić tego przed potwierdzeniem, że MVP faktycznie pomaga Robertowi.

## 11. Rekomendowana komunikacja do Roberta

> Nie kopiujemy całego Pipedrive 1:1.  
> U Ciebie w Twenty:
> - **Lejek** pokazuje, na jakim etapie jest sprzedaż,
> - **Task** mówi, co konkretnie masz dziś zrobić.
>
> Na start dajemy typy zadań, priorytet i widok `Robert — dziś`.  
> Calendly i bardziej rozbudowane taski są osobnym krokiem po cutoverze.

## 12. Plan techniczny wdrożenia

To **nie jest duża zmiana**.  
Technicznie to:

1. dodanie 2 pól metadata na obiekcie `Task`
2. zbudowanie 1 widoku tasków dla Roberta
3. smoke na 2–3 taskach

### 12.1 Obiekty i elementy, których dotykamy

| Element | Zakres zmiany |
|---------|---------------|
| `Task` object metadata | dodanie pól `taskType`, `taskPriority` |
| View: `Robert — dziś` | nowy widok tasków |
| Task record page | bez zmian obowiązkowych w MVP |
| Workflow / automaty | brak zmian w MVP |
| Integracje | brak zmian w MVP |

### 12.2 Dokładna specyfikacja pól

#### Pole 1: `taskType`

| Właściwość | Wartość |
|------------|---------|
| Object | `Task` |
| API name | `taskType` |
| Label PL | `Typ zadania` |
| Type | `SELECT` |
| Required | nie |
| Default | brak |

**Opcje:**
- `NEW_LEAD` → `Nowy lead` (auto: form/mail notify; dueAt = teraz+1h do czasu realnego SLA z rozdzielania)
- `FIRST_CALL` → `Pierwszy telefon`
- `FOLLOW_UP` → `Follow-up`
- `OFFER` → `Oferta`
- `VIDEO` → `Video`
- `MEETING` → `Spotkanie`
- `ADMIN` → `Admin`

#### Pole 2: `taskPriority`

| Właściwość | Wartość |
|------------|---------|
| Object | `Task` |
| API name | `taskPriority` |
| Label PL | `Priorytet zadania` |
| Type | `SELECT` |
| Required | nie |
| Default | brak lub `MEDIUM` jeśli UX w Twenty wymaga domyślnej wartości |

**Opcje:**
- `HIGH` → `Wysoki`
- `MEDIUM` → `Średni`
- `LOW` → `Niski`

### 12.3 Kolejność wdrożenia

#### Krok A — metadata

1. dodać `taskType`
2. dodać `taskPriority`
3. sprawdzić, czy pola są widoczne w formularzu tworzenia / edycji Task

#### Krok B — widok `Robert — dziś`

Utworzyć widok na `Task` z:

**Filtrami:**
- assignee = Robert
- status != done/completed
- due date = today **lub** overdue

**Sortowaniem:**
1. due date ASC
2. taskPriority DESC / logiczne grupowanie wysokich na górze

**Kolumnami:**
- title
- taskType
- taskPriority
- due date
- status
- assignee
- relation do opportunity / person

#### Krok C — smoke test

Na koncie testowym / na 2–3 realnych taskach:

1. utworzyć task `FIRST_CALL`
2. utworzyć task `FOLLOW_UP`
3. ustawić różne priorytety
4. przypisać do Roberta
5. powiązać z leadem / opportunity
6. sprawdzić, czy widok `Robert — dziś` pokazuje je we właściwej kolejności

#### Krok D — sesja z Robertem

Pokazać:
- jak dodać typ
- jak dodać priorytet
- jak korzystać z widoku
- jak zakończyć task po wykonaniu

### 12.4 Narzędzia / sposób wdrożenia

#### Opcja rekomendowana

Wdrożyć to bezpośrednio przez:
- metadata w Twenty
- widok tasków w Twenty

Nie potrzeba:
- zmian w kodzie aplikacji frontendowej
- deployu workflowów
- zmian w GCP workerach

#### Jeśli robimy to agentem / API

Potrzebne operacje:
1. `create_field_metadata` dla `Task`
2. `create_view`
3. `create_many_view_fields`
4. `create_many_view_filters`
5. `create_many_view_sorts`

### 12.5 Smoke checklist techniczny

Po wdrożeniu sprawdzić:

| Check | PASS |
|-------|------|
| `taskType` istnieje na `Task` | ✅ |
| `taskPriority` istnieje na `Task` | ✅ |
| można utworzyć task z obiema wartościami | ✅ |
| widok `Robert — dziś` istnieje | ✅ |
| task Roberta z terminem dziś wpada do widoku | ✅ |
| task po oznaczeniu DONE wypada z widoku | ✅ |
| sortowanie nie chowa wysokiego priorytetu w chaosie | ✅ |

### 12.6 Rollback

Jeśli Robert odrzuci model albo coś okaże się nieczytelne:

**Rollback minimalny:**
1. zostawić pola metadata
2. ukryć / nie używać widoku `Robert — dziś`
3. wrócić do samego Lejka na czas cutoveru

**Rollback pełny:**
1. usunąć widok `Robert — dziś`
2. opcjonalnie usunąć pola `taskType` i `taskPriority`

Rekomendacja: **nie usuwać pól od razu**, bo koszt ich zostawienia jest mały.

### 12.7 Ryzyka techniczne

| Ryzyko | Ocena | Mitigacja |
|--------|-------|-----------|
| Task ma już natywne pole podobne do priorytetu | niskie | przed wdrożeniem sprawdzić metadata `Task` |
| Widok tasków nie pokaże wygodnie relacji do opportunity | niskie | zostawić minimum: title + due + type + priority |
| Robert będzie chciał więcej typów od razu | średnie | zacząć od 6 i dopiero po sesji rozszerzać |
| Priorytet nie sortuje się intuicyjnie | średnie | w razie czego przejść na prosty due date + ręczny porządek |

### 12.8 Proponowana kolejność czasowa

| Etap | Czas |
|------|------|
| Metadata pól | 10–20 min |
| Widok `Robert — dziś` | 10–20 min |
| Smoke techniczny | 10 min |
| Sesja z Robertem | 20–30 min |
| Korekta po sesji | 10–15 min |

Łącznie: **mała zmiana**, do zrobienia bez dużego projektu.

## 13. Następny krok

Po akceptacji tego planu technicznego:

1. wdrożyć pola `taskType` i `taskPriority`
2. zbudować widok `Robert — dziś`
3. zrobić smoke
4. pokazać Robertowi na sesji
