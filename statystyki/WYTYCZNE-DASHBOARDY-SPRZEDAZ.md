# WYTYCZNE — Dashboardy sprzedażowe w Twenty (v2.18.x)

> Dokument roboczy (jak HANDOFF), NIE plik kanoniczny repo. Pliki kanoniczne do commitu: `METRICS.md` (draft w tej paczce) + delta do `DATA_MODEL.md`, `DECISION_REGISTER.md`, `ops/OPS_NOTES.md` (§9 poniżej).
> Data weryfikacji faktów platformowych: 2026-07-08. Wersja Twenty: linia v2.18.x (release 2026-07-02).

---

## 0. WYNIK KONTROLI (sedno)

**Nie, nie wszystkie dane są dostępne.** Dashboardy Twenty agregują tylko to, co jest zapisane w polach rekordu — a Twenty **nie przechowuje natywnie żadnych znaczników czasu przejść stage'a** ani czasu pierwszej odpowiedzi. Na datach dashboard umie policzyć wyłącznie Earliest/Latest; Average działa tylko na polach NUMBER.

**Dobra wiadomość:** Twenty ma na to **oficjalny, udokumentowany przepis** (docs: „Track How Long Opportunities Stay in Each Stage" + wzorzec „Formula Fields"): custom pola DATE_TIME + NUMBER wypełniane jednym workflow (Filter → Code → Update Record). To jest „sposób domyślny, rekomendowany przez Twenty" — nie hybryda, nie wynalazek. Docelowo (zapowiedź Twenty: natywne formula fields „coming in 2026") mechanizm wypełniania wymienimy, pola i definicje metryk zostają.

**Podział metryk po kontroli:**

| # | Metryka | Dostępna dziś „z pudełka"? | Co potrzeba |
|---|---|---|---|
| 1 | Śr. czas całego cyklu (per produkt) | NIE | pole `daysToClose` (NUMBER) + workflow; Average natywnie |
| 2 | Śr. czas 1. odpowiedzi mailowej | **NIE — zależna od Email Sync (Etap 1.2)** | odrębny etap D3; nie udawać, że jest |
| 3 | Śr. czas do SQL | NIE | pole `daysToQualified` (NUMBER) + workflow |
| 4 | Win Rate | **TAK** (po zawężeniu filtrem) | natywna opcja **Ratio** na polu SELECT `stage` |
| 5 | Win Rate per kanał | Prawie | jak 4 + pole `bizSource` (już zaprojektowane, nieutworzone — OQ-D1) |
| 6 | ~~Ilość leadów w pipeline~~ → **przedefiniowane przez właściciela (2026-07-08):** kohorta okienkowa + trend M8 | **TAK** | Aggregate: Count, `createdAt` w oknie ∧ stage otwarty; trend: 2× bar/mies. |
| 7 | Ilość SQL w pipeline | **TAK** | Count + filtr (definicja → decyzja D-3) |
| — | Wymiar „per produkt" | NIE | pole `bizProduct` (zaprojektowane [D:RESEARCH], nieutworzone — OQ-D1) |
| — | Wymiar „per sprzedawca" | do potwierdzenia | mechanizm ownera Opportunity — preflight PF-1 |
| — | Dostęp do statystyk per handlowiec | **ROZSTRZYGNIĘTE: wszystko jawne** (D-11, właściciel 2026-07-08) | dashboard „Oceny" wspólny; zapis pól nadal chroniony (read-only + workflow) |
| — | „Wybierz zakres dat" jednym ruchem | **NIE** | filtry dashboard-level = „coming soon"; dziś: filtr per widget (relative dates: „Past X days", „This month") |

**Netto do zbudowania: 4 pola + 1 workflow + dashboardy.** Zero custom obiektów, zero kodu poza jednym Code-node z przepisu Twenty, zero zmian w EVENT_CONTRACT.

---

## 1. FAKTY PLATFORMOWE (zweryfikowane 2026-07-08 — do wklejenia w OPS_NOTES §5.1)

| Fakt | Wartość | row_class | source | recheck_trigger |
|---|---|---|---|---|
| Wersja Twenty | v2.18.0 (2026-07-02); Twenty 2.0 (2026-04) = platforma apps/AI/git-backed workspace | `verified_fact` | github.com/twentyhq/twenty/releases | Twenty release |
| Dashboards — status | **Beta / Early Access** (Settings → Updates → Early Access). Struktura: Dashboard → Tabs → Widgets | `verified_fact` | docs.twenty.com/user-guide/dashboards/overview | Twenty release |
| Widgety | Bar, Pie, Line, Aggregate (KPI), iFrame, Rich Text. **Brak:** tabele, gauge (roadmap). Limity: 100 barów, 50 grup | `verified_fact` | docs …/dashboards/capabilities/widgets | Twenty release |
| Agregacje Y | Count (all/empty/not empty/unique), Sum/**Average**/Min/Max (tylko NUMBER), Percent empty/not empty, Boolean true/false; daty tylko Earliest/Latest; **Ratio** dla SELECT/Multi-select/Boolean (% rekordów z daną wartością) | `verified_fact` | docs …/dashboards/capabilities/chart-settings | Twenty release |
| Filtry widgetów | Per **widget** (jak w widokach tabel), advanced And/Or, daty **Is relative** („Past 7 days", „This month"). Grupowanie: X-axis + drugi wymiar Group by; date granularity Day…Year | `verified_fact` | docs …/chart-settings | Twenty release |
| **Filtry dashboard-level** | **NIE ISTNIEJĄ** — „on our roadmap"; również: brak eksportu, dane wg **strefy czasowej oglądającego** (per-dashboard timezone: coming soon) | `verified_fact` | docs …/dashboards/how-tos/dashboards-faq | Twenty release |
| **Widoczność dashboardów** | „Dashboards are visible to everyone who has access to your Twenty workspace. There is no private dashboard option at the moment" — kategoryczne; system uprawnień (3 obszary: Objects&Fields / Settings / Actions) NIE zawiera powierzchni „dashboardy" → **gating rolą niemożliwy** | `verified_fact` | docs …/dashboards/capabilities + …/permissions (2026-07-08) | Twenty release („at the moment") |
| **Field-level permissions — ODCZYT** | Reguły per pole zawierają poziom **„No Access (completely hidden)"** — pole całkowicie ukryte przed rolą (przykład w docs: People→Address→No Access); reguła pola nadpisuje ustawienie obiektu | `verified_fact` | docs …/permissions-access/capabilities/permissions | Twenty release |
| **Widoki — widoczność** | Dwa poziomy: Workspace (listowane dla wszystkich) i **Unlisted** — „hidden from other team members' view lists, **but can still be accessed by anyone with the direct link**" → ukrycie z listy, NIE kontrola dostępu | `verified_fact` | docs …/crm-essentials/view-management | Twenty release |
| Czas w stage'ach — wzorzec oficjalny | Custom pola „Last Entered [Stage]" (DATE_TIME) + „Days in [Stage]" (NUMBER), jeden workflow: trigger Record Updated (filtr: pole Stage), gałęzie Filter→Code→Update Record; pola read-only przez role (field-level permissions); analiza: dashboard/kanban Average | `verified_fact` | docs …/views-pipelines/how-tos/track-time-in-stage | Twenty release |
| Formula fields | Brak natywnych; oficjalny workaround = workflow (jw.); **natywne zapowiedziane „coming in 2026"** | `verified_fact` | docs …/crm-automations/formula-fields | Twenty release (→ migracja mechanizmu) |
| **Model kredytów — ZMIANA (jakościowy)** | Kredyty wg cyklu billingowego, nie planu: **5/mc** lub 50/rok; rollover cap = 1 okres; kroki standardowe (Search/Create/Update) = konsumpcja minimalna, **Code node / AI = więcej**; „5 monthly credits — more than enough for standard actions"; paczki dokupowalne; jedna wspólna pula: workflowy + AI agents + AI chat; usage w Settings → Billing | `verified_fact` | docs …/billing/capabilities/credits + …/workflows/capabilities/workflow-credits (odczyt 2026-07-08 ×2 + audyt zewn.) | Twenty pricing change |
| **Kwantyfikacja kredytów** | „1 kredyt = 1 USD; krok ~0,0001 USD (~10 000/kredyt); Code ~0,0001–0,001 USD; breakdown per akcję/workflow" — **NIEODNALEZIONE na publicznej stronie docs przy 3 niezależnych odczytach** (2× 2026-07-08, 1× audyt zewn.). Źródło: treść dostarczona przez właściciela 2026-07-08 z breadcrumbem „Billing / Reference / Credits" — możliwe pochodzenie: widok in-app / nowsza wersja strony. Rozstrzygnięcie: właściciel wskazuje źródło LUB odczyt Settings → Billing na instancji | `platform_recheck_needed` | wklejka właściciela vs docs (konflikt) | PF-6 / wskazanie źródła |

**Konsekwencja recheck dla istniejących wierszy OPS_NOTES:** wiersz „Workflow credits — limit Pro" jest **częściowo nieaktualny** (model = billing-cycle, nie plan-tier); wniosek NR-3 ARCHITECTURE (zakaz workflow HTTP do Sortowni) **pozostaje w mocy** — Code/HTTP nadal „more credits", native webhook nadal 0. Wiersz „createWorkflowVersion / workflow-as-code" — do rechecku: Twenty 2.0 wprowadziło git-backed workspace versioning (może zastąpić ręczne snapshoty JSON). To osobny wątek, nie blokuje dashboardów.

---

## 2. ARCHITEKTURA — trzy warstwy (żeby nie było spaghetti)

```
WARSTWA 1: DANE (fundament, przeżywa wszystko)
  4 pola custom na Opportunity (DATA_MODEL delta, §3)
  = jedyna inwestycja; czytelne przez GraphQL/REST/CSV/przyszły scoring

WARSTWA 2: MECHANIZM WYPEŁNIANIA (wymienny)
  dziś:  1 workflow „Track Stage Time" (oficjalny przepis Twenty)
  jutro: natywne formula fields (zapowiedź 2026) — podmiana bez ruszania pól

WARSTWA 3: PREZENTACJA (beta, wymienna, zero lock-inu)
  Dashboardy (Early Access) + fallback: widoki tabel/kanban z agregacjami
```

**Zgodność z konstytucją:**
- **Prawo 6 (granica CRM↔orkiestracja):** czasy procesu CRM = atrybuty stanu sprzedaży → dom: **Twenty**. Pola są **CRM-only** (jak `lossCategory`): NIGDY do payloadów SSOT, bez prefiksu `biz*`. GCS Ledger pozostaje domem analizy eventowej/atrybucyjnej — nie dublujemy go (GCS i tak nie widzi LOST/CONTACTED/PROPOSAL, bo te nie emitują eventów).
- **Prawo 7a:** workflow zawiera Code → wymagany mini-kontrakt `/workflows/track-stage-time.contract.md` (draft w paczce). Prawo 7f: Code bez sekretów (czysta arytmetyka dat) — zgodne.
- **Prawo 9:** Dashboards są poza rdzeniem MVP („Beta — nie fundament") → wejście do zakresu wymaga udokumentowanego use case'u + ADR (#17, §9). Warstwa 1–2 to nie „Dashboards" tylko model danych — ale uczciwie: cały pakiet wchodzi jednym ADR.
- **Prawo 3d:** każde pole z `description` w Settings (gotowe treści w §3).
- **INV-6 / G6:** workflow **wyłączony podczas importu** (jak wszystkie create/update — Prawo 7c); import nie wypełnia pól czasowych sam z siebie.

**Interakcja z EVENT_CONTRACT (sprawdzona):** zapis pól przez workflow generuje dodatkowy webhook OUT → adapter widzi `stage` bez zmiany → naturalny `SKIP_NO_RELEVANT_TRANSITION` (idempotencja NR-7). Zero ryzyka fałszywych eventów. Pętli własnej brak: trigger workflow jest zawężony do zmiany pola `stage`, a workflow pisze inne pola. Odnotować w runbooku, żeby dodatkowe SKIP-y w logach nikogo nie zaskoczyły.

**Alternatywa rozważona i odrzucona (na teraz): custom obiekt `Event`/`Interaction` — każde przejście jako osobny, niemutowalny rekord.** Powody odrzucenia dla tego zakresu: (1) dashboardy Twenty nie liczą różnic dat między rekordami ani joinów — metryki czasowe wymagałyby i tak Code + denormalizacji (duration, produkt, owner, kanał kopiowane na każdy event), czyli więcej mechaniki bez nowej zdolności; (2) niemutowalna historia zdarzeń ma już dom: GCS Ledger + Stape (Prawo 6a) — drugi log w CRM = dwa miejsca prawdy; (3) nowy obiekt = decyzja strukturalna (Prawo 2) o nieznanym zachowaniu przy merge — czwarta niewiadoma na trzech otwartych bramkach merge; (4) Prawo 9 — zakres na zapas bez udokumentowanego use case'u. **Ścieżka powrotu (tania, addytywna):** workflow Track Stage Time jest jedynym punktem przechwytu przejść — dopięcie kroku „Create Record (Event)" nie wymaga migracji niczego; do rozważenia jako ADR przy wdrożeniu scoringu, jeśli rekonsyliacja scoringu wykaże realną potrzebę (szkic scoringu §10.2 sam nakazuje: „wykorzystujemy istniejące w architekturze, nie dublujemy").

---

## 3. DELTA DATA_MODEL — 4 nowe pola Opportunity (+2 istniejące w projekcie)

Wszystkie 4 przechodzą 6 pytań (kto: workflow; kiedy: przejście stage'a; po co: metryki+scoring; wpływ na decyzję: TAK — zarządzanie sprzedażą; kategoria: analityczne/systemowe; gdzie: Twenty). CRM-only → **bez prefiksu** (reguła §5.6 DATA_MODEL: „pole tylko do analizy wewnętrznej"). Freeze: **OPEN** dziś; rozważyć FROZEN przy wdrożeniu scoringu (wtedy ADR). Typy nieodwracalne — dlatego preflight przed utworzeniem.

| Field (API) | Type | Owner | Empty | Used by | Freeze | Description (Settings — wkleić 1:1) |
|---|---|---|---|---|---|---|
| `qualifiedAt` | DATE_TIME | Workflow Track Stage Time | null = nigdy nie był SQL | metryki M3/M7, scoring (SLA/pending) | OPEN | Ostatnie wejście w stage QUALIFIED (SQL). Pisze wyłącznie workflow Track Stage Time. Nie edytować ręcznie. CRM-only — nie wchodzi do eventów. |
| `daysToQualified` | NUMBER (2 miejsca) | Workflow | null = jw. | metryka M3 (Average) | OPEN | Dni od utworzenia rekordu do wejścia w QUALIFIED. Liczone automatycznie. CRM-only. |
| `stageClosedAt` *(nazwa finalna → D-7)* | DATE_TIME | Workflow | null = otwarty | metryki M1/M4/M5 (kohorta po dacie zamknięcia) | OPEN | Wejście w stage terminalny (WON lub LOST) — **faktyczne** zamknięcie. ⚠ Opportunity ma **natywne `closeDate`** (planowana/prognozowana data) — stąd nazwa odróżnialna (D-7) + wypełnić description natywnego `closeDate` w Settings, żeby nikt nie pomylił prognozy z faktem. Jedno wspólne pole = jeden filtr dat dla Win Rate. Pisze workflow. CRM-only. |
| `daysToClose` | NUMBER (2 miejsca) | Workflow | null = otwarty | metryka M1 (Average, filtr WON) | OPEN | Dni od utworzenia do zamknięcia (WON lub LOST). Długość cyklu. Pisze workflow. CRM-only. |
| `bizProduct` | SELECT | Formularz/adapter/handlowiec | null | wymiar per produkt (M1–M8) + payload SSOT (Pricing Key!) | FROZEN (DATA_MODEL §5.5) | wartości = ODCZYT z SSOT Sortowni (**PF-9, BLOKUJE utworzenie pola** — SELECT values są nieodwracalne); hipoteza: `strony/logo/nazwa/…`, zakaz „default" |
| `bizSource`* (*nazwa do D-2, po PF-9) | SELECT | **Adapter inbound (projekcja atrybucji)** / handlowiec (manual) | null | metryka M5 + raporty; payload: **do weryfikacji PF-9** | OPEN | kierunek: Sortownia→Twenty (Prawo 6a); źródło mapowania + enum + nazwa: D-2 po PF-9 |

Świadome odchylenia od przepisu Twenty (nazwane, żeby nikt nie „poprawiał" wstecz):
1. **Diff liczony od `createdAt`**, nie od „Last Entered [poprzedni stage]" — przepis Twenty zakłada liniową progresję i wywala się na skoku stage'ów (null w polu poprzedniego etapu → śmieciowa liczba). `createdAt` istnieje zawsze. Nasze metryki (cykl, czas do SQL) i tak są zdefiniowane od utworzenia.
2. **Dni z 2 miejscami po przecinku** zamiast `Math.ceil` — Average na ceil'owanych dniach zawyża o ~0,5 dnia; przy cyklach B2B chcemy porównywalności między sprzedawcami.
3. **Jedno `stageClosedAt`** zamiast pary „Last Entered Won/Lost" — filtr widgetu operuje na JEDNYM polu daty; wspólne pole umożliwia kohortę Win Rate jednym filtrem. Stage rozróżnia WON/LOST.
4. **Nie tworzymy** „Last Entered" dla NEW/CONTACTED/PROPOSAL ani „Days in" per stage — 6 pytań nie przechodzi (brak konsumenta dziś; Prawo 9). Dołożenie później = ta sama mechanika, zero migracji.

---

## 4. WORKFLOW „Track Stage Time" (spec skrócona — pełny kontrakt w pliku obok)

- **Trigger:** Record Updated · Opportunity · tylko pole `stage` (field-scoped — nie odpala się na innych polach).
- **Gałęzie (Filter → Code → Update Record), równoległe — macierz dla rekomendowanej kombinacji D-8 (first-entry dla SQL) + D-9 (gałąź czyszcząca):**

| # | Filter (warunki wzajemnie wykluczające — Prawo 7d) | Update Record |
|---|---|---|
| B1 | `stage = QUALIFIED` ∧ `qualifiedAt` PUSTE | `qualifiedAt` = now · `daysToQualified` · wyczyść `stageClosedAt` + `daysToClose` |
| B2 | `stage = WON` | `stageClosedAt` = now · `daysToClose` |
| B3 | `stage = LOST` | `stageClosedAt` = now · `daysToClose` |
| B4 | `stage` ∈ {NEW, CONTACTED, PROPOSAL} ∧ `stageClosedAt` NIEPUSTE | wyczyść `stageClosedAt` + `daysToClose` |
| B5 | `stage = QUALIFIED` ∧ `qualifiedAt` NIEPUSTE ∧ `stageClosedAt` NIEPUSTE | wyczyść `stageClosedAt` + `daysToClose` |

  Rozłączność: B1⊥B5 (qualifiedAt puste/niepuste), B4 wyklucza QUALIFIED i terminale, B2/B3 = terminale. ⚠ Formuła z audytu zewnętrznego (jedna gałąź czyszcząca obejmująca QUALIFIED) **nakładała się na B1** — łamała Prawo 7d; powyższa wersja to koryguje kosztem +1 gałęzi. Jeśli D-8 = last-entry: B1 traci warunek `qualifiedAt PUSTE` i przejmuje czyszczenie, B5 znika (4 gałęzie). Jeśli D-9 = SOP zamiast gałęzi: B4/B5 znikają, czyszczenie ręczne wykonuje **rola z prawem zapisu (Dawid/admin)** — handlowiec z read-only fizycznie nie może (korekta sprzeczności F-3).
- Kill-switch: dezaktywacja workflow (1 klik). Snapshot JSON do gita przed aktywacją i po każdej zmianie (Prawo 7g).
- Field-level permissions (Pro je ma): 4 pola **read-only** dla ról handlowców — ręczna edycja nie zatruwa metryk (opcja wprost z przepisu Twenty).
- Rejestr: 1 wiersz w OPS_NOTES workflow registry + kontrakt `/workflows/track-stage-time.contract.md` (Code ⇒ pełny kontrakt wg Prawa 7a).

**Semantyka pól (jawna, do szkolenia — finalna po D-8/D-9):** `qualifiedAt` = **pierwsze** wejście w SQL (rekomendacja D-8; ping-pong QUALIFIED↔PROPOSAL nie zawyża M3; błędny klik koryguje wyłącznie rola z prawem zapisu — Dawid/admin). `stageClosedAt` = **ostatnie** wejście w terminal (re-close po reopenie słusznie nadpisuje); niezmiennik „niepuste ⇒ stage terminalny" utrzymuje gałąź B4/B5 (rekomendacja D-9). Sprostowanie rangi względem audytu: przeterminowane `stageClosedAt` **nie psuje żadnej z metryk M1–M7** (każdy widget używający tego pola filtruje też po stage) — gałąź chroni przyszłych konsumentów bez filtra stage (scoring, eksporty) i to wystarczający powód, ale nie „najsłabsze ogniwo".

---

## 5. SPEC DASHBOARDÓW (warstwa prezentacji)

**Wymóg właściciela (2026-07-08, doprecyzowany): statystyki per handlowiec służą OCENIE; powierzchnia = Twenty (decyzja właściciela — bez zewnętrznych arkuszy); dostęp docelowo tylko konto właściciela; handlowcy nie potrzebują dostępu.**

**Dostęp — ROZSTRZYGNIĘTE (D-11, właściciel 2026-07-08): wszystko jawne.** Dashboard „Oceny" wspólny dla całego workspace, bez No Access na polach. Kontekst faktów (§1) pozostaje zapisany na wypadek zmiany polityki: gating dashboardów rolą nie istnieje; field-level „No Access" istnieje (droga powrotu do ukrycia czasów); widoki Unlisted = pseudo-prywatność. **Rozgraniczenie:** jawny ODCZYT ≠ wolny ZAPIS — pola metryk pozostają read-only dla handlowców (pisze workflow; PF-3 testuje zapis mimo read-only).

**Podział powierzchni (Twenty-first):**

```
Dashboard „Sprzedaż — Oceny"   (dostęp: gating rolą, jeśli PF-8a przejdzie;
                                inaczej jawny za zgodą właściciela)
  Taby = OKNA CZASOWE: [7 dni] [14 dni] [30 dni] [90 dni]
  — te same widgety, różni je wyłącznie relative filter taba:
  M1  bar · X = handlowiec · Y = Average(daysToClose) · Group by = bizProduct
  M3  bar · X = handlowiec · Y = Average(daysToQualified) · Group by = bizProduct
  M4  bar · X = handlowiec · Y = Ratio(stage→WON) · Group by = bizProduct (PF-5)
  M6  bar · X = handlowiec · Count (createdAt w oknie ∧ otwarte) · Group by = bizProduct
  M7  bar · X = handlowiec · Count (stock — identyczny we wszystkich tabach)
  M5  bar · X = bizSource · Ratio→WON (globalnie; per handlowiec zbyt rzadkie dane)

Dashboard „Sprzedaż — Zespół"  (jawny zawsze, opcjonalny)
  Totale + per produkt, M8 napływ/odpływ, lejek, widget higieny.
  BEZ rozbicia per handlowiec (porównania osób tylko w „Oceny").
```

Ten układ likwiduje duplikację N dashboardów (jedno „Oceny" zamiast dashboardu per rep), a „wybierz okno" = klik w tab, „wszystkie produkty naraz" = zgrupowane słupki, „każdy handlowiec osobno" = oś X. Filtry per metryka (legacy, populacje) — 1:1 z macierzy poniżej i METRICS.md. Dane pozostają wyciągalne przez API niezależnie od losów prezentacji (warunek właściciela „ważne, żeby z danych dało się wyciągnąć" — spełniony strukturalnie).

**Dlaczego sekcją KPI nie są widoki (rozważone na wniosek właściciela):** widoki liczą agregaty kolumn (AVG/Count — M1/M3/M6/M7 tak), ale NIE liczą proporcji (M4/M5 Win Rate odpada), nie mają drugiego wymiaru grupowania, a macierz handlowiec × produkt × okno wymagałaby kilkudziesięciu zapisanych widoków lub ręcznego przestawiania filtrów; dostępowo są tak samo wspólne jak dashboardy. Rola widoków w planie = fallback operacyjny/ad-hoc (kanban AVG per stage — część oficjalnego przepisu), nie sekcja KPI.

**Forma widgetów — zasada:** 6 z 7 metryk to pojedyncze liczby → widget **Aggregate (kafelek KPI)**, nie wykres. Dashboard pełni tu rolę tablicy liczb. Wykres wchodzi wyłącznie tam, gdzie metryka zyskuje wymiar: **kategoria** (M5 — jedna liczba na każdy kanał → bar), **porównanie ludzi** (dashboard „Oceny" — bary X=handlowiec; jawny „Zespół" nie rozbija per osoby), **trend w czasie** (opcjonalny line, np. AVG(`daysToClose`) po miesiącach `stageClosedAt` — jedyne pytanie, na które kafelek nie odpowie: „czy się poprawia?"; żadna z 7 metryk w brzmieniu właściciela tego nie wymaga).

**Macierz definicji przekrojów** (kanon filtrów per metryka — obowiązuje 1:1 każdy widget: „Oceny" dodaje wymiar X=handlowiec, „Zespół" go pomija; ewentualny fallback API liczy identycznie):

| Metryka | Widget | Konfiguracja |
|---|---|---|
| M1 Śr. cykl | Aggregate | Source: Opportunities · Filtr: owner, bizProduct, `stage = WON`, `stageClosedAt` is relative, `srcSystem is not BETTER_BITRIX_LEGACY` · Y: **Average(`daysToClose`)** · suffix „ dni" |
| M3 Śr. czas do SQL | Aggregate | Filtr: owner, bizProduct, `qualifiedAt` is relative, `srcSystem is not BETTER_BITRIX_LEGACY` · Y: Average(`daysToQualified`) · suffix „ dni" |
| M4 Win Rate | Aggregate | Filtr: owner, bizProduct, `stage is any of (WON, LOST)`, `stageClosedAt` is relative · Y: pole `stage` + **Ratio → WON** · suffix „%" |
| M5 WR per kanał | Bar | jak M4, bez pojedynczego kanału · X: `bizSource` · Y: `stage` Ratio→WON (fallback jeśli Ratio niedostępne w bar → PF-5: stacked bar Group by stage + data labels) |
| M6 Świeże otwarte (kohorta) | Aggregate | Filtr: owner, bizProduct, `createdAt` **is relative** (domyślnie „Past 90 days"), `stage is none of (WON, LOST)` · Y: Count all. Odpowiada: „czy świeże leady zalegają?"; `campaignRejected=true` ŚWIADOMIE zostaje (≠ LOST) |
| M8 Napływ vs odpływ | 2× Bar obok siebie (ta sama skala) | Bar A: X = `createdAt` (miesiąc) · Count; Bar B: X = `stageClosedAt` (miesiąc) · Count, filtr `stage is any of (WON, LOST)`. Obie: `srcSystem is not BETTER_BITRIX_LEGACY`. Dom: dashboard „Zespół" (globalnie i per produkt); w tabach handlowców opcjonalnie — przy ~150 leadach/mc podział na handlowca × produkt × miesiąc może być zbyt rzadki, by trend był czytelny |
| M7 SQL w pipeline | Aggregate | wg decyzji D-3: wariant A `stage = QUALIFIED`; wariant B `qualifiedAt is not empty AND stage is none of (WON, LOST)`. **Stock, bez okna dat** (jw.) |
| kontekst | Bar | X: `stage` (sort: Position) · Y: Count — kształt lejka per produkt |

Dashboard „Zespół" (jawny): widgety z macierzy **bez wymiaru owner** — totale i rozbicie per produkt (Group by / X: `bizProduct`), M8, lejek. **Żadnego Group by owner na jawnej powierzchni** — porównania handlowców żyją tylko w powierzchni oceny (decyzja właściciela: zbiorcze ≠ ocena). Plus **widget higieny** (F-7): Aggregate Count `bizProduct is empty` (+ opcjonalnie owner pusty) — leady z nullami znikają z przekrojów per produkt/handlowiec (METRICS NR-5) i bez tego licznika nikt by tego nie zobaczył.

**Bilans utrzymania:** 2 dashboardy łącznie („Oceny" z 4 tabami-oknami + „Zespół") zamiast N per handlowiec. Zmiana definicji metryki = edycja widgetu ×4 taby (te same parametry poza relative filter) — akceptowalne; zmiany wyłącznie razem z METRICS.md (Prawo 1b).

**Fallback / analiza ad-hoc (nie-beta):** widok tabeli Opportunities z filtrami + kanban z agregacją Average na `daysToQualified`/`daysToClose` per kolumna stage'a — to część oficjalnego przepisu i działa niezależnie od losów bety dashboardów.

---

## 6. METRYKA 2 (1. odpowiedź mailowa) — etap D3, po Email Sync

Nie da się jej policzyć przed Etapem 1.2 (Email Sync to jej jedyne źródło danych). **Kotwica definicji (właściciel, 2026-07-08): `createdAt` → pierwszy mail WYCHODZĄCY od zespołu powiązany z rekordem** — nie klasyczne „inbound→reply"; zegar kara leżącego leada niezależnie od tego, czy klient napisał maila, czy tylko formularz. Definicja w `METRICS.md` (M2), pola (`firstResponseAt`, `hoursToFirstResponse`) **NIE powstają dziś** — Prawo 4b: nie ma wypełniacza, nie ma pola. Kandydaci implementacji do wyboru w D3: (a) workflow na zdarzeniu wiadomości / cron+Search po timeline'ie maili, (b) licznik SLA w scoringu (szkic scoringu §SLA używa dokładnie tego zegara — jedna implementacja obsłuży metrykę i scoring). Decyzja wtedy, nie teraz.

---

## 7. SEKWENCJA WDROŻENIA

**D0 — decyzje właściciela (§8) + ADR #17 w DECISION_REGISTER.**

**D1 — preflight (sandbox / EA workspace), Dawid:**

| PF | Co sprawdzić | Dowód PASS |
|---|---|---|
| PF-0 | **Wersja runtime workspace** (Cloud auto-update; konsultant #2 twierdzi v2.19.0 z 2026-07-08 — nieniepotwierdzone moim odczytem): odczytać wersję instancji; jeśli > v2.18.x → szybki recheck faktów §1 (dashboard filters, Ratio, group-by po relacji, field-scoped trigger, credits, formula fields, import createdAt/custom fields); wynik → OPS_NOTES z `last_checked` | odczyt wersji + OPS_NOTES |
| PF-1 | Mechanizm „per sprzedawca": czy Opportunity ma natywne pole właściciela (relacja do Workspace Member)? Jeśli nie → utworzyć relację (API name unikający kolizji z paid-`owner` Sortowni, np. `salesRep`; label „Handlowiec"). Czy chart **filtruje i grupuje po relacji**? (docs pokazują „Group by Owner" — potwierdzić na instancji) | widget z filtrem+Group by owner |
| PF-2 | Utworzenie 4 pól + `bizProduct`/`bizSource` (SELECT) na sandboxie; opisy w Settings; typy zgodne z §3 | Settings + snapshot |
| PF-3 | Workflow: trigger field-scoped na `stage` nie odpala się przy edycji innych pól; Code liczy poprawnie; Update zapisuje; **zapis pól NIE retriggeruje workflow**; **Update Record zapisuje pole mimo read-only roli handlowca** (przepis Twenty to sugeruje, mechanizm niepotwierdzony wprost); **Update Record umie wyczyścić pole do pustego** (gałęzie B1/B4/B5); Filter przyjmuje 2–3 warunki AND | run log |
| PF-4 | Adapter Sortowni: webhook po zapisie pól → `SKIP_NO_RELEVANT_TRANSITION` (zero EMITTED) | reason codes |
| PF-5 | Ratio: dostępne w Aggregate na `stage`→WON; dostępne w Bar per kategoria X? Filtr `is any of` na SELECT działa? Relative date na custom DATE_TIME działa? | widgety testowe |
| PF-6 | **Pomiar kredytów (realny, nie rutyna):** kwoty jednostkowe NIEPOTWIERDZONE w publicznych docs (§1) — tydzień działania workflow na sandboxie → Settings → Billing → breakdown per workflow; ekstrapolacja na ~150 leadów/mc. Hipoteza z wklejki właściciela: ~0,13–0,45 kredytu/mc. Jakościowo docs mówią: standardowe akcje „more than enough" w 5/mc — ryzyko biznesowe niskie niezależnie od wyniku (paczki dokupowalne, kill-switch) | odczyt billingu |
| PF-7 | Import: czy CSV pozwala ustawić `createdAt` / pola custom przy backfillu historii (dla D-5 wariant B) + czy import ustawia `srcSystem = BETTER_BITRIX_LEGACY` na 100% rekordów (warunek filtra legacy M1/M3) | test importu no_emit |
| PF-8 | **ZAMKNIĘTY (research docs + decyzja D-11 wariant 2):** (a) gating dashboardów = NIE (fakt §1); (b) „No Access" istnieje, ale nie wdrażamy (jawność); test wycieku agregatu bezprzedmiotowy. Bez zadań dla Dawida | — |
| PF-9 | **Odczyt kanonu z SSOT orkiestracji (NIE instancja Twenty — dokumentacja/reguły/kod Sortowni):** (a) pełna, dosłowna lista wartości `biz_product` używanych w regułach Pricing Key (hipoteza właściciela: `strony/logo/nazwa/…`, zakaz „default" — oznaczona „nie wiem, czy tak jest"); (b) czy `biz_source` istnieje w payloadzie; (c) dokładne nazwy pól atrybucji (`attr_utm_source/medium/campaign`?) dostępnych adapterowi. **Blokuje: utworzenie `bizProduct` (PF-2) i finalizację D-1/D-2** | link do SSOT Sortowni / reguł Pricing Key / kodu adaptera |

**Warunki NO-GO aktywacji produkcyjnej** (którykolwiek = stop): (1) owner/salesRep niepotwierdzony jako handlowiec (PF-1); (2) workflow retriggeruje się po zapisie własnych pól (PF-3); (3) adapter Sortowni emituje business event po zapisie pól metryk (PF-4); (4) legacy nieodróżnialne — import nie ustawia `srcSystem` (PF-7); (5) Ratio/Average niezgodne z ręcznym przeliczeniem CSV (METRICS §8); (6) oczekiwania poza zakresem zgłoszone jako wymaganie: historyczny stock pipeline (→ snapshoty, osobny ADR), M2 przed Email Sync (→ D3), scoring teraz (→ rekonsyliacja scoringu).

**D2 — wdrożenie produkcyjne (kolejność ważna):**
1. Pola w prod razem z resztą schemy Etapu 1.1 (jeden snapshot git, jedna brama G5).
2. Workflow utworzony jako draft; **aktywacja dopiero PO imporcie** (Prawo 7c / G6 — import z workflow OFF; wpis do OPS log operacji z `no_emit=TAK`). Import ustawia `srcSystem = BETTER_BITRIX_LEGACY` na każdym rekordzie legacy (fundament filtra M1/M3 i tak wymagana proweniencja).
3. Field-level read-only dla handlowców.
4. Early Access ON → budowa dashboardu-szablonu → duplikacja per handlowiec.
5. Wiersze do OPS_NOTES (§1), workflow registry, kontrakt do `/workflows/`, `METRICS.md` do repo, ADR #17 → closed z evidence.

**D3 — po Etapie 1.2:** metryka M2 (§6).

**Relacja do cutoveru CRM: ZERO sprzężenia.** ADR #17 = `blocks: none`. Nic tu nie dotyka G1–G8; jedyny punkt styku to dyscyplina „workflow OFF podczas importu", która i tak obowiązuje globalnie.

---

## 8. DECYZJE WŁAŚCICIELA (przed D1)

| ID | Decyzja | Rekomendacja | Dlaczego to decyzja semantyczna (Prawo 2/4) |
|---|---|---|---|
| D-1 | Wartości `bizProduct` | **Zasada (stoi twardo): SELECT w Twenty = 1:1 z wartościami `biz_product` w payloadzie** — to element Pricing Key, więc kanonem jest to, co faktycznie routują reguły orkiestracji. **Wartości: NIEZNANE do czasu odczytu (PF-9)** — wklejka właściciela (`strony/logo/nazwa`, zakaz `default`, reguły `generate_lead_strony_…`) = **hipoteza robocza** (właściciel sam oznaczył: „nie wiem, czy tak jest"); rekomendacja `web/…` ze scoringu wycofana z tego samego powodu. Po odczycie: brak opcji „default" w SELECT (jeśli hipoteza się potwierdzi), walidacja at-emission (Prawo 7b) | INV-1: żadna lista — ani z researchu, ani z pamięci — nie jest kanonem przed odczytem z SSOT Sortowni / reguł / kodu adaptera; zero warstwy mapującej |
| D-2 | Pole kanału dla M5 | **Kierunek (stoi twardo, z Prawa 6a — niezależnie od wklejki): master atrybucji = Sortownia → pole w Twenty = projekcja**, pisze adapter inbound przy tworzeniu leada (manual/telefon → handlowiec). **Do weryfikacji w PF-9 (wklejka = hipoteza):** czy `biz_source` istnieje w payloadzie (właściciel: „chyba nie ma") i czy atrybucję niosą `attr_utm_source/medium/campaign` — od tego zależy, z CZEGO adapter mapuje kanał. Lista startowa enum: `google / facebook / organic / referral / email / manual / other / unknown`; mapa (utm→kanał) = kontrakt adaptera. Nazwa pola: prefiks `biz*` wątpliwy, jeśli pole nie idzie do payloadów — rozstrzygnąć po PF-9 | M5 musi liczyć się w Twenty (LOST nie emituje eventu — GCS nie zna mianownika WR); Twenty = projekcja, nie master |
| D-3 | Definicja „SQL w pipeline" (M7) | **wariant B**: osiągnął SQL i nadal otwarty (`qualifiedAt` niepuste ∧ stage ∉ {WON,LOST}) | wariant A (stage=QUALIFIED teraz) gubi PROPOSAL-e, które przecież są SQL-ami w pipeline |
| D-4 | Mianownik Win Rate | WON / (WON+LOST) w oknie po `stageClosedAt` | alternatywa (WON/wszystkie) miesza otwarte z rozstrzygniętymi; `campaignRejected` NIE wchodzi do mianownika (≠ LOST) |
| D-5 | Historia sprzed cutoveru | **wariant A doprecyzowany:** metryki czasowe od cutoveru; legacy wykluczone z M1/M3 filtrem `srcSystem = BETTER_BITRIX_LEGACY` (bo `createdAt` legacy = data importu → fałszywie krótkie czasy, gdy deal przechodzi stage po cutoverze); legacy **wchodzi** do Win Rate przy zamknięciu po cutoverze | wariant B (backfill realnych dat przez CSV, no_emit) tylko jeśli PF-7 potwierdzi wiarygodność; fałszywy backfill gorszy niż brak; mechanizm używa istniejącego pola FROZEN zgodnie z jego przeznaczeniem (proweniencja, NIE loop-prevention — NR-4 nietknięte) |
| D-6 | Cykl (M1): tylko WON czy też LOST? | metryka główna = WON; bliźniaczy widget „śr. czas do przegranej" opcjonalnie | dwa różne pytania biznesowe; jedno pole `daysToClose` obsługuje oba |
| D-7 | API name pola faktycznego zamknięcia | **`stageClosedAt`** (alt.: `wonLostAt`); NIE `closedAt` | Opportunity ma natywne `closeDate` (prognoza) — prawie identyczne nazwy o różnej semantyce to pułapka dla ludzi, agentów i eksportów (Prawo 3c: nazwa raz); rename darmowy, bo pole jeszcze nie istnieje |
| D-8 | `qualifiedAt`: pierwsze czy ostatnie wejście w SQL? | **pierwsze** (Filter: `qualifiedAt` puste → zapis jednorazowy) | „czas do SQL" klasycznie = first-touch; last zawyża M3 przy ping-pongu QUALIFIED↔PROPOSAL; scoring (`stage_pending_sql_days`) też zakłada first; milczący wybór = utrwalona semantyka (Prawo 2/4) |
| D-9 | Niezmiennik terminala: gałąź czyszcząca czy SOP? | **gałąź B4/B5** (macierz §4) | utrzymuje „`stageClosedAt` niepuste ⇒ stage terminalny" dla przyszłych konsumentów bez filtra stage; zgodne z D5 (nie egzekwuje terminalności — sprząta dane); SOP-only = dyscyplina ludzka + tylko role z zapisem |
| D-10 | Historia wielkości pipeline? | **ROZSTRZYGNIĘTE (właściciel, 2026-07-08): wariant A** — bez snapshotów, świadoma akceptacja nieodwracalności luki; dodatkowo M6 przedefiniowane: czysty stock nieistotny → kohorta okienkowa (M6) + trend napływ/odpływ (M8) | decyzja semantyczna właściciela; M7 pozostaje jedynym licznikiem stanu |
| D-11 | Powierzchnia oceny per handlowiec | **ROZSTRZYGNIĘTE (właściciel, 2026-07-08): wariant 2 — WSZYSTKO JAWNE.** Dashboard „Oceny" wspólny dla workspace; No Access NIE wdrażamy; test wycieku agregatu bezprzedmiotowy. **Uwaga rozgraniczająca:** jawność dotyczy ODCZYTU — ochrona ZAPISU zostaje (pola metryk read-only dla handlowców, pisze wyłącznie workflow; to higiena danych, nie prywatność). Opcje No Access / custom page pozostają w historii decyzji jako droga powrotu, gdyby polityka jawności się zmieniła | gating dashboardów rolą niemożliwy (fakt §1); świadoma akceptacja: handlowcy widzą nawzajem swoje czasy, WR i liczniki |

---

## 9. MINIMUM DOKUMENTACJI (dokładnie tyle, nie więcej)

| Artefakt | Gdzie | Dlaczego wymagany (nie opcjonalny) |
|---|---|---|
| **ADR #17** „Analytics: pola metryk + workflow + dashboardy (EA)" | `DECISION_REGISTER.md` §5.3 (open, `blocks: none`) → closed z evidence po D2 | Prawo 9: „każdy nowy moduł/metryka wymaga udokumentowanego use case'u"; Dashboards jawnie poza rdzeniem MVP |
| **6 wierszy pól** | `DATA_MODEL.md` §5.1 (tabela §3 tego pliku) | Prawo 3/4: pole bez wpisu = ustawienie domyślne, nie decyzja |
| **`METRICS.md`** (draft w paczce) | nowy plik kanoniczny `owocni-crm/METRICS.md` | reguła powstawania pliku (CONSTITUTION §5.6): definicje metryk to dom treści, którego nie unosi żaden plik — DATA_MODEL trzyma pola, nie formuły; bez kanonu formuł każdy przyszły pobór „tych samych liczb" (API/scoring/BI) policzy je inaczej. Nowy plik = [D:CORE] = wchodzi tym samym ADR #17 |
| **`/workflows/track-stage-time.contract.md`** (draft w paczce) | repo, katalog `workflows/` | Prawo 7a: workflow z Code bez kontraktu nie wchodzi |
| **7 wierszy faktów** | `ops/OPS_NOTES.md` §5.1 (tabela §1) + wiersz w workflow registry + recheck 2 starych wierszy | Prawo 1d: fakty wersjonowane żyją w OPS |
| Notka o SKIP-ach + SOP cofnięcia terminala | runbook/szkolenie (IMPLEMENTATION_PLAN §5.6) | żeby logi adaptera i edge-case nie były niespodzianką |
| Kontrakt joba raportowego (warunkowo — przy D-11 wariant B) | contract md przy jobie (n8n) | Prawo 7: złożona logika poza Twenty = własny kontrakt; formuły = pointer do METRICS.md, nie kopia |

Czego **NIE** dokumentujemy: konfiguracji widget-po-widgecie w osobnym pliku (dashboard = prezentacja; kanon liczb siedzi w METRICS.md; układ klikamy wg §5), instrukcji obsługi dashboardów (docs Twenty wystarczą — Prawo 1c: nie dokumentujemy tego, co Twenty wie).

### 9a. ADR #17 — tekst gotowy do wklejenia w DECISION_REGISTER

**Wiersz do §5.3 OPEN NON-BLOCKING:**

| ADR | Decyzja | Uwaga |
|---|---|---|
| #17 | Analytics: pola metryk czasowych + workflow Track Stage Time + dashboardy (EA) + plik METRICS.md | `blocks: none`; zamknięcie z evidence po wdrożeniu D2; wejściowe decyzje semantyczne D-1…D-10 → właściciel (D-10 closed 2026-07-08: wariant A + redefinicja M6/M8) |

**Wpis do §5.5 DECISION DETAILS:**

> **ADR #17 (Analytics — metryki sprzedażowe) — open, blocks: none.**
> **Kontekst:** 7 metryk (cykl, czas do SQL, 1. odpowiedź, Win Rate ±kanał, leady/SQL w pipeline) per produkt × handlowiec × okres. Twenty nie przechowuje czasów przejść stage'a; Dashboards = Beta/Early Access — Prawo 9 wymaga udokumentowanego use case'u + ADR przed wejściem do zakresu.
> **Decyzja (3 warstwy):** (1) 4 pola CRM-only na Opportunity (`qualifiedAt`, `daysToQualified`, `stageClosedAt`, `daysToClose`; bez prefiksu, NIGDY do payloadów) + utworzenie `bizProduct`/`bizSource` w tym samym preflighcie; (2) workflow Track Stage Time wg oficjalnego wzorca Twenty (track-time-in-stage / formula-fields), kontrakt w `/workflows/track-stage-time.contract.md`, aktywacja PO imporcie; (3) dashboardy EA jako wymienna prezentacja, fallback = widoki/kanban. Kanon formuł = nowy plik kanoniczny `METRICS.md` (powstaje tym ADR — reguła CONSTITUTION §5.6). Metryka M2 (1. odpowiedź) odroczona do Etapu 1.2 (zależność: Email Sync).
> **Obalony kontrargument A** („dane już są, wystarczą agregacje w dashboardach"): Average działa wyłącznie na NUMBER, daty mają tylko Earliest/Latest — czasów przejść nie ma w danych, więc nie ma czego agregować.
> **Obalony kontrargument B** („custom obiekt Event zamiast pól — uniwersalniej na przyszłość"): dashboardy nie liczą joinów ani różnic dat między rekordami (event i tak wymagałby Code + denormalizacji produktu/ownera/kanału); niemutowalny log zdarzeń ma już dom — GCS Ledger + Stape (Prawo 6a); nowy obiekt = decyzja strukturalna (Prawo 2) o nieznanym zachowaniu przy merge (czwarta niewiadoma na 3 otwartych bramkach); Prawo 9 — zakres na zapas. Ścieżka powrotu addytywna: krok „Create Record (Event)" w tym samym workflow — kandydat na osobny ADR przy wdrożeniu scoringu.
> **Koszt:** jakościowo niski (docs: standardowe akcje mieszczą się w 5 kredytach/mc z zapasem); kwotowo NIEPOTWIERDZONE — hipoteza ~0,13–0,45 kredytu/mc z wklejki właściciela, weryfikacja = PF-6 (fakt + konflikt źródeł → `ops/OPS_NOTES.md`).
> **Wpływ na cutover:** zero — nie dotyka G1–G8; jedyny styk = „workflow OFF podczas importu" (obowiązuje globalnie, Prawo 7c/G6).
> **Zamknięcie (evidence):** pola w Settings + snapshot git; workflow aktywny po imporcie z wpisem `no_emit=TAK` w OPS log; PF-1…PF-7 PASS; `METRICS.md` + kontrakt w repo; verified_by: Dawid + właściciel.

---

## 10. RED TEAM — Adwokat Diabła (test planu)

**„Czy na pewno nic nie wymyślamy?"**
Rdzeń mechanizmu to skopiowany 1:1 oficjalny how-to Twenty (track-time-in-stage + formula-fields). Trzy świadome odchylenia są nazwane i uzasadnione w §3 (diff od `createdAt`, decimals, wspólne `stageClosedAt`) — każde UPRASZCZA względem przepisu, żadne nie dodaje mechaniki. Nie budujemy: custom obiektów, event-store'a w Twenty, drugiego GCS, żadnej integracji. **Ale uczciwie: dwa punkty to nadal założenia do PF** — Ratio w bar charts (PF-5) i grupowanie po relacji owner (PF-1). Jeśli PF-5 padnie, M5 degraduje do stacked-bar z etykietami (nadal natywne, mniej eleganckie).

**„Czy nie spowoduje to problemów?"** Trzy realne ryzyka i ich domknięcia:
1. *Sprzężenie z orkiestracją:* zapisy workflow → dodatkowe webhooki → adapter SKIP-uje naturalnie (idempotencja NR-7); pętla własna wykluczona przez field-scoped trigger; **zweryfikować oba na PF-3/PF-4, nie wierzyć dokumentowi** (Prawo 1).
2. *Kredyty:* jakościowo bezpieczne (docs `verified_fact`: 5/mc „more than enough" dla standardowych akcji; Code = więcej; paczki dokupowalne); **kwotowo niepotwierdzone** — stawki jednostkowe pochodzą z wklejki właściciela i nie występują na publicznej stronie docs (3 niezależne odczyty) → hipoteza ~0,13–0,45 kredytu/mc, pomiar = PF-6. Realny wektor wyczerpania wspólnej puli to przyszłe AI (agenci/chat), nie ten workflow — breakdown per-workflow w Billing to rozdzieli. Zakaz workflow HTTP do Sortowni nietknięty.
3. *Zatrucie danych:* ręczna edycja pól → field-level read-only (Pro ma); cofnięcie z WON → SOP czyszczenia (D5 świadomie nie egzekwuje terminalności — respektujemy tę decyzję, nie dobudowujemy enforcementu); import → workflow OFF + `no_emit` w logu.

**„Czy nie odkrywamy koła na nowo / czy to najbardziej zunifikowany sposób w środowisku Twenty?"**
Tak w warstwie mechanizmu (dosłownie ich przepis) i prezentacji (natywne dashboardy). Jedno kolizyjne pytanie zadaliśmy sobie wprost: *czemu nie liczyć czasów z eventów w Sortowni/GCS, skoro tam już płyną?* Odpowiedź: GCS widzi tylko qualify_lead/purchase/rejected — **nie widzi LOST ani czasów pipeline'u** (celowo, EVENT_CONTRACT), a metryki per handlowiec to operacyjna praca CRM (Prawo 6a: „aktualny stan sprzedaży → Twenty"). Liczenie ich poza Twenty wymagałoby nowego kanału danych — to byłoby właśnie odkrywanie koła.

**„Czy nie wymyślamy optymizmu / akcji, których nie ma?"** Wszystkie twierdzenia o możliwościach platformy w §1 mają źródło (docs, 2026-07-08) i status `verified_fact` albo jawny PF. Trzy rzeczy, których plan ŚWIADOMIE nie obiecuje, bo ich nie ma: filtr globalny dashboardu („wybierz zakres" jednym ruchem — jest per widget), metryka M2 przed Email Sync, tabele/gauge w dashboardach. Jedna rzecz może nas wyprzedzić in plus: natywne formula fields (zapowiedź 2026) — architektura 3-warstwowa czyni to migracją mechanizmu, nie danych.

**„Czy plan rozwiązuje wszystkie założenia jednoznacznie dla osoby czytającej pierwszy raz?"** Wymaganie→rozwiązanie: daty→relative filters per widget (z jawnym ograniczeniem), sprzedawca→dashboard per handlowiec + Group by (PF-1), produkt→taby + `bizProduct`, 7 metryk→macierz §5 z formułami w METRICS.md. Niedomknięte pozostają wyłącznie decyzje semantyczne D-1…D-6 — i słusznie: to rola właściciela (CONSTITUTION, Rola 1), nie agenta ani Dawida.

**Znaleziska poboczne (poza zakresem, ale uczciwość każe zgłosić):**
- **Audyt zewnętrzny (2026-07-08):** 8 znalezisk F-1…F-8 — wszystkie przyjęte, dwa z korektą: F-2 potwierdzony re-checkiem docs (kwoty kredytów = wklejka właściciela, nie docs → reclasyfikacja), F-4 zasadny kierunkowo, ale (a) proponowana gałąź czyszcząca nakładała się na gałąź QUALIFIED (łamała Prawo 7d — poprawiona na B4/B5), (b) ranga zawyżona: M1–M7 są chronione filtrami stage, gałąź chroni przyszłych konsumentów. Audyt potwierdził też niezależnie wszystkie pozostałe fakty platformowe §1 w żywych docs.
- Czwarta sprzeczność szkicu scoringu (dokładka audytu): kryterium OUT „stage=lost z lost_reason" zakłada wymuszalność pola, której Twenty nie ma (INV-9) → walidacja u konsumenta scoringu, nie przy save.
- **Piąta sprzeczność szkicu scoringu (warunkowa — po PF-9):** JEŚLI wartości `biz_product` w payloadzie ≠ klucze `product_lanes` (`web/marketing/logo/name`) — a hipoteza właściciela na to wskazuje — scoring przy budowie mapuje się do kanonu payloadu, nie odwrotnie.
- **Audyt zewnętrzny #2 (2026-07-08):** przyjęte 3 kluczowe znaleziska — (a) legacy zatruwa M1/M3 przez `createdAt`=data importu (naprawa: filtr `srcSystem`, lepsza od jego propozycji „null w gałęziach" — zero dublowania logiki w workflow); (b) M6/M7 = stock, nie historia (jawne oczekiwanie + alternatywa okienkowa); (c) PF-0 wersja runtime (Cloud auto-update; jego „v2.19.0 z 8.07" niepotwierdzone). Przyjęte pomniejsze: wartości techniczne bizProduct/bizSource, rollout minimalny + jawność dashboardów, konsolidacja NO-GO. Odrzucone: „null zgodnie z D-5" w gałęziach workflow (dubluje warunek ×3), fallback M5 „ręczne przeliczenie" (mamy stacked-bar), wymóg jednego Code-node (nigdy nie był w planie — Code od początku per gałąź B1–B3). Uwaga: recenzował przedaudytową wersję planu (krytykował last-entered `qualifiedAt` i pomijał B4/B5 oraz rename D-7 — już rozwiązane po audycie #1).
- Szkic scoringu (`Przyszly-scoring.md`) zakłada stage'e **spoza zamrożonego enuma** (rozmowa/decision/nurture), pole `lostReason` (u nas `lossCategory`, CRM-only) oraz zawiera wewnętrzną sprzeczność cache (nagłówek: workflow zapisuje `salesScore`; §9: „on-the-fly, NIE cache'owany"). Pola z tego planu są prekursorami scoringu (SLA clock, czas do SQL, `qualifiedAt`), ale **scoring wymaga własnej rekonsyliacji przed budową** — nie rozstrzygamy jej tutaj.
- OPS_NOTES: 2 wiersze do rechecku po skoku wersji 2.8→2.18 (kredyty, workflow-as-code) — §1.

---

## RAMA WYKONAWCZA
1. Zadanie rozumiem jako: kontrola, czy 7 metryk sprzedażowych da się policzyć natywnie w Twenty v2.18.x, plus wytyczne wdrożenia „po bożemu" (zgodnie z Twenty i SSOT OWOCNI) i minimum dokumentacji, z finalnym testem Red Team.
2. Kontekst: repo SSOT po refaktorze, przed cutoverem; dashboardy jawnie poza rdzeniem MVP (Prawo 9); pola czasowe = grunt pod scoring.
3. Cel odpowiedzi: gotowy do wykonania plan D0→D3 z preflightem dla Dawida, decyzjami dla właściciela i 2 plikami dokumentacji do repo.
