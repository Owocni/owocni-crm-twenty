TWENTY_RESEARCH_PROTOCOL v2.3 — wiążący, gdy załadowany
0. QUICK ENTRY

Cel modułu: odpowiedź na „jak zrobiliby to deweloperzy Twenty NA NASZYM MIEJSCU" — dla modelu danych, zdarzeń i operacji na instancji (pola, relacje, widoki, workflow, integracje, dopasowanie tożsamości, retencja). Budowa własnej apki = rzadki podprzypadek (T3), nie domyślna ścieżka. Zasada konstrukcyjna: rygor dotyczy TWIERDZEŃ (co wolno stwierdzić i jak oznaczyć: fakt / wzorzec / projekcja / hipoteza) — NIE ścieżek szukania i rozumowania. Ścieżka dowolna; etykieta obowiązkowa. Decyduje o: (a) jak głęboko kopać — tryb §1 · (b) jak weryfikować każdy fakt · (c) co wolno cytować jako wzorzec i jak daleko wolno go rzutować · (d) kiedy fakt traci ważność — REGUŁA PRZEBICIA (§2). Nie decyduje o: semantyce naszego systemu (→ SSOT repo) ani o decyzji (INV-1). Werdykt o rozwiązaniu → SOLUTION_ANALYSIS_PLAYBOOK; ten moduł dostarcza mu DOWODY. 5 najgroźniejszych błędów: fakt o Twenty z pamięci modelu lub analogii do innego CRM · wzorzec ze źródła bez autorytetu (§4) · głębokość SONDY tam, gdzie wynik idzie do SSOT · fałszywy [BRAK]/TROP z powodu budżetu, katalogu albo zbyt wąskiego testu analogii tam, gdzie legalna jest PROJEKCJA (§5) · mocny ślad bez kotwicy wersji / bez testu przebicia — „aktualna" strona docs może opisywać archaiczną drogę.

1. TRYB RESEARCHU — wybierz PRZED pierwszym fetchem, zadeklaruj w 1. linii odpowiedzi
Tryb	Pytanie-wyzwalacz	Obowiązkowy zakres	Budżet (koszt oczekiwany)	Wynik
SONDA	„czy Twenty ma / czy się da / jaki limit / od której wersji"	grep /llms.txt → 1 strona docs (.md) → release notes, gdy świeże	≤3 fetche	klasyfikacja §11 + kotwica + data. ZERO projektowania
WZORZEC	„jak zrobiliby to deweloperzy Twenty" · projekt feature'u / customizacji / hybrydy / sposobu operowania na danych i zdarzeniach	SONDA + Bramka 0 (§4) + Bramka 1 (§5) + katalog (§6) + delta i translacja (§8)	~5–8 zapytań	werdykt §11 (wzorzec / projekcja) + ślad decyzyjny
SSOT	wynik trafi do kontraktu / SSOT / ADR / kodu produkcyjnego	WZORZEC + archeologia PR (jak doszli, nie tylko gdzie są) + test negatywny (szukaj wyjątków od wzorca) + korpus własny PRZED platformą (§8.1) + jawny zakres przeszukania	bez limitu; plan przeszukania jawny NA STARCIE; wynik → artefakt, nie ściana czatu	komplet faktów + per opcja tabela „co musiałoby być prawdą, żeby wygrała"

Reguły trybu:

Eskalacja w górę zawsze legalna i tania; degradacja w dół w tej samej sprawie — nigdy.
Wątpliwość SONDA↔WZORZEC → wykonaj SONDĘ + zaproponuj eskalację. Sygnał „pójdzie do SSOT/kontraktu/kodu" → tryb SSOT obowiązkowo.
Budżet = koszt oczekiwany, nie twardy limit. Wyczerpany bez odpowiedzi → zgłoś i kontynuuj albo zaproponuj eskalację trybu. ZAKAZ raportowania [BRAK] z powodu budżetu — [BRAK] wynika wyłącznie z przeszukania o podanym zakresie.
Wynik SONDY nie uprawnia do decyzji projektowej. Tryb to MINIMUM zakresu, nie maksimum.
2. ZASADY NADRZĘDNE
Trzy warstwy regularnie sprzeczne: marketing (wyprzedza) > kod (prawda) > docs (w tyle). Rozjazd → wygrywa release note / kod. Zawsze.
Issue ≠ feature. PR zmergowany = feature. Roadmapa = nic; zamiast obietnic — tripwire (§5).
Fakt ma datę ważności — REGUŁA PRZEBICIA. Każdy fakt i wzorzec z kotwicą: wersja mechanizmu lub data dowodu (timestamp strony docs ≠ kotwica — strony bywają odświeżane kosmetycznie). Nowszy dowód klasy L0–L2 (release note · PR zmergowany · kod · nowsza apka first-party używająca mechanizmu) PRZEBIJA starszy — także mocny i także stojący w „aktualnych" docs; „kiedyś na około" przegrywa z „dziś natywnie". Sygnał nowości z L3/L4 sam NIE przebija — uruchamia weryfikację na L0–L2. TEST PRZEBICIA obowiązkowy, gdy dowód: (a) starszy niż kwartał w obszarze rotującym · (b) starszy niż 6 mies. gdziekolwiek · (c) sam nazywa się obejściem („until native support", workaround, emulacja przez workflow) lub zapowiada następcę („coming in …"). Wykonanie: skan releases / compare od daty dowodu do dziś + grep /llms.txt pod natywną funkcję. Wynik negatywny też jest wynikiem: kotwica odświeżona + tripwire zapisany.
Wykonalność ≠ poprawność ≠ sankcja. „Ktoś to zbudował" dowodzi wyłącznie, że się da — a wykonalność to najmniej ciekawe pytanie researchu.
Zakaz wnioskowania z analogii do Salesforce/HubSpot. Twenty często NIE MA rzeczy „oczywistych".
Moduł = rusztowanie, nie klatka: §6/§9 są datowane i rotują; rozjazd z żywym repo → wygrywa repo + zgłoś do aktualizacji modułu. Metoda stała, treść wymienna.
3. ŚRODOWISKO + DRABINA ŹRÓDEŁ L0–L4

Środowisko: Twenty Cloud, wersja bieżącego miesiąca. NIE odpowiadaj danymi self-hosted. Drabina = hierarchia ZAUFANIA przy wnioskowaniu, nie wymuszona trasa nawigacji. /llms.txt zawsze pierwszy (tani indeks); dalej wchodź na poziom właściwy dla klasy pytania: schemat / model danych → L2 od razu · istnienie / limit / zachowanie → L1 · „czy weszło i kiedy" → L0.

L	Źródło	Rola
0	github.com/twentyhq/twenty/releases · …/releases/tag/v{X} · …/compare/twenty/v{A}...twenty/v{B} · apps.umbrel.com/app/twenty (wtórne, rzetelne streszczenia — szybszy skan)	prawda o wersji — „czy weszło i kiedy"
1	docs.twenty.com — /llms.txt POTWIERDZONY 2026-07-15 (pełny indeks stron + api-reference/openapi.json): obowiązkowy PIERWSZY fetch każdego researchu; grep indeksu zamiast nawigacji. Każda strona ma wariant .md (mniejszy kontekst)	jedyna oficjalna dokumentacja: zachowania i granice — NIE schematy; how-to bywa obejściem (→ test przebicia §2)
2	kod twentyhq/twenty: packages/twenty-server/src/modules/* · …/engine/metadata-modules/ · packages/twenty-apps/ · packages/twenty-shared/ · PRODUCT.md / DESIGN.md. Apki first-party czytaj jako wzorce modelowania danych i zdarzeń (preferencja ujawniona) — nie jako instrukcję budowy apki. Szukaj po PR-ach, nie issues. Kotwice historii decyzji: Discussion #209 (permissions) · #251 (mail) · #16735 (integracje). Dostęp bez tokenu: API GitHub = 60 req/h wspólnego IP → fallback raw.githubusercontent.com (pliki) / HTML …/tree/main/{path} (katalogi, 200=istnieje)	jedyne źródło wzorca „JAK budować"
3	answeroverflow.com (zindeksowany Discord; odpowiedzi core teamu — często jedyne „nie ma i nie będzie") → Discord live	kierunek / trop
4	blogi, recenzje, case studies (twenty.com/customers), listingi marketplace bez kodu	hipoteza / kształt — nigdy dowód
4. BRAMKA 0 — AUTORYTET (zawsze pierwsza; tu wypada ~90% znalezisk)

Audyt autorstwa PRZED czytaniem treści (30 s): kto · czy org/scope twentyhq · gdzie mieszka KOD · afiliacja, gwiazdki · data. Dopracowany README ≠ autorytet. Autorytet apki oceniaj po autorze i miejscu kodu — nigdy po samym fakcie listingu na marketplace.

Klasa źródła	Wzorzec „JAK budować"?
kod twentyhq/twenty — w tym apki @twentyhq/* / packages/twenty-apps/	✅ jedyne źródło wzorca; liczy się do N. Stan 2026-07-15: cały marketplace twenty.com/apps = ta klasa („built and maintained by Twenty", „vetted by our team")
docs.twenty.com / twenty.com	✅ zachowania i granice · ❌ schematy
third-party z vettingiem Twenty (badge/review na marketplace)	⚠+ silny trop — klasa dziś PUSTA na storefroncie; tooling app:publish ją zapowiada. Gdy się pojawi: dowód wykonalności + zgodności z bieżącym API + przejścia review o NIEUSTALONYM zakresie. Wolno cytować MECHANIKĘ (które API/trigger/uprawnienia użyto); ❌ schemat/model danych; nie liczy się do N. Przed podniesieniem rangi ustal zakres vettingu [fakt, nie założenie]
case study twenty.com/customers	⚠ potwierdza kształt („zrobiono X"), zero schematu
wypowiedź zespołu [MÓWIONE] (Discord/wywiad)	⚠ kierunek, nigdy fakt
marketplace third-party BEZ vettingu / społeczność / cudze repo	⛔ nie wzorzec — trop, gdzie szukać; uczy co najwyżej na błędach i poprawkach

Vetting ≠ sankcja architektury: review (gdy powstanie) sprawdza to, co sprawdza — nie „tak byśmy to zrobili". Dwa legalne użycia ⚠/⛔: (1) generowanie hipotez do weryfikacji na L0–L2; (2) mapa niestabilnych powierzchni — zgłoszenia „pękło po update" wskazują kruche obszary; każde takie twierdzenie weryfikuj w release notes / kodzie. Nie liczą się do N (§5). Ostrzeżenie z dowolnego źródła wolno SPRAWDZIĆ — wzorca z niego nie kopiować.

5. BRAMKA 1 — MECHANIZM · N≥2 · FALSYFIKACJA (tylko dla tego, co przeszło Bramkę 0)

Kolejność nienaruszalna: 0 AUTORYTET → 1 MECHANIZM → 2 N≥2 → 3 FALSYFIKACJA.

Trzy operacje na dowodzie first-party — rosnące ryzyko; ZAWSZE nazwij, której używasz:

Operacja	Kiedy	Dowód wymagany	Status wyniku
TRANSFER	ten sam mechanizm w innej dziedzinie (np. ta sama fabryka kompozytów: emails ↔ phones)	dwie definicje obok siebie + JAWNA lista różnic; każda różnica sklasyfikowana: incydentalna (wniosek stoi) / strukturalna (transfer pada). Identyczność „znak w znak" NIE jest wymagana — wymagane jest rozliczenie każdej różnicy	wniosek przenosi się wprost
PROJEKCJA	wzorzec ustalony (N≥2) rzutowany na NOWY przypadek bez własnej implementacji (np. wzorzec per-kanał → kanał, którego jeszcze nie ma)	(a) wzorzec + wypisane WARUNKI BRZEGOWE (co przypadek musi spełniać, żeby wzorzec go obejmował), (b) nowy przypadek spełnia każdy warunek — punkt po punkcie, (c) tripwire zerwania	przewidywanie „tak by zrobili", nie fakt — oznacz [PROJEKCJA]
INSPIRACJA	podobieństwo dziedziny / powierzchni bez wspólnego mechanizmu	—	wyłącznie hipoteza do weryfikacji (jak ⚠/⛔); nie liczy się do N
N≥2: 1 instancja first-party = przypadek · 2 niezależne = wzorzec · 3 = metodologia. Do N liczą się WYŁĄCZNIE instancje pierwszej strony; głosy ⚠/⛔ dorzucone do N zafałszowują, nie wzmacniają.
Dywergencja first-party: SYNCHRONICZNA (dwie bieżące realizacje różne) = wzorzec nieustalony ⇒ nie kopiuj żadnej, odnotuj sygnał. DIACHRONICZNA (stara vs nowa praktyka, np. moduł core vs apka) = nowsza odpowiada na „jak zrobiliby DZIŚ" — kierunek potwierdź (PR / release / [MÓWIONE] core teamu), starszą oznacz jako legacy; odnotuj obie. Diachroniczna = szczególny przypadek REGUŁY PRZEBICIA (§2).
Świadomy brak wzorca = obszar bez metodologii (nie luka do zalania analogią) ⇒ nasza decyzja stoi na własnych nogach i jest tak OZNACZONA.
Preferencja ujawniona > deklaracja — ważona świeżością: to, co zrobili ostatnio, bije to, co robili kiedyś; [MÓWIONE] core teamu może korygować wagę PROJEKCJI, nigdy zastępować wzorca.
Falsyfikacja / tripwire: dla każdego wzorca i każdej projekcji — obserwowalne zdarzenie w kodzie, które je obala (np. „PR wprowadzający kanał jako wartość enuma zamiast nowego obiektu").

Ruchy operacyjne: przeformułuj problem na klasę decyzji projektowej (1 zdanie: „to jest przypadek X-a") ZANIM zaczniesz szukać · odwróć pytanie („gdzie już to zrobiono?" zamiast „czy się da?") · szukaj mechanizmu, nie funkcji (generator/fabryka > pojedynczy przypadek) · najpierw sprawdź, czy platforma już rozwiązała twój problem (reguły remisu, re-match, GC — kradnij, nie wymyślaj) · datuj każdą instancję (commit/wersja); obszary rotujące → ważność 1 kwartał.

6. KATALOG STARTOWY — gdzie mieszka odpowiedź pierwszej strony o DANYCH i ZDARZENIACH (✓ ścieżki zweryfikowane w main 2026-07-15; ROTUJĄ — rozjazd → grep repo + zgłoś)
Klasa problemu	Gdzie patrzeć
kanał komunikacji (model danych interakcji)	twenty-server/src/modules/messaging/ · …/calendar/ · …/call-recording/
dopasowanie identyfikator→encja, reguły remisu	twenty-server/src/modules/match-participant/ (+ utils/: remisy, technika jsonb @>)
pole pochodne / agregacja cross-obiektowa	twenty-apps/public/twenty-last-contact/
import z systemu zewnętrznego certyfikowany przez Twenty	twenty-apps/public/twenty-fireflies/ · …/call-recorder/
wzorzec minimalnych uprawnień (role)	dowolne */default-role.ts / roles/ w twenty-apps
typy pól, kompozyty	twenty-shared/src/types/composite-types/
narzędzia AI / MCP	twenty-shared/src/ai/constants/ · core-modules/tool-provider/
GC / retencja / co platforma skasuje	twenty-server/src/modules/messaging/message-cleaner/
„co w ogóle możliwe" w warstwie rozszerzeń	docs developers/extend/** (API, webhooki, apps) — tabela typów encji: …/apps/getting-started/concepts
wizja i zasady twórców	PRODUCT.md · DESIGN.md (korzeń repo) · dyskusje kat. „Engineering vision"

Katalog = akcelerator, nie granica: klasa problemu bez wiersza → grep całego repo po słowach domenowych i symbolach; znalezione nowe gniazdo → zaproponuj wiersz. Wiersze z twenty-apps czytaj jako wzorce operowania na danych (pole pochodne, import, uprawnienia minimalne) — nie jako przepis na apkę.

7. SKALA TRUDNOŚCI WDROŻENIA (mapuj każde rozwiązanie; numer § stały — cross-ref PLAYBOOK)

Granica trudności = koniec metadata layer: obiekt / pole / widok / workflow = konfiguracja; dalej = kod.

T	Klasa	Zakres	Gdzie szukać
T1	user-config (bez kodu)	widoki, filtry, unlisted, ulubione, sidebar, konto mailowe — CAŁA przestrzeń	wyłącznie docs.twenty.com/user-guide/
T2	dev-łatwe	custom objects/fields/relacje z Settings, workflows, webhooki, REST/GraphQL, MCP	/developers/
T3	dev-trudne	Apps framework: npx create-twenty-app, defineObject, logic functions, front components, AI skills; fork	/developers/extend/apps/** — docs najsłabsze; rozstrzyga kod packages/twenty-apps/

Większość naszych pytań = T1/T2 + metodologia danych i zdarzeń. T3 (budowa apki) = wyjątek wymagający osobnej decyzji — nie domyślna ścieżka researchu.

8. DELTA I TRANSLACJA vs NASZ SYSTEM — obowiązkowe w trybie WZORZEC i SSOT
Najpierw korpus własny: grep naszego SSOT i naszego kodu PRZED pytaniem do platformy — połowa „odkryć" jest już zapisana. Nasz kod odpowiada na „czy u nas", Twenty na „czy w ogóle". [BRAK u nas] też wymaga podanego zakresu.
Wzorzec Twenty × nasz SSOT/INVARIANTS → jeden z werdyktów: ZGODNY · ŚWIADOMA RÓŻNICA (powód + gdzie zapisana + tripwire odwrotu) · KOLIZJA z INV = NO-GO + eskalacja (bez wyjątków).
Pole to ogniwo, nie pole: nowy/zmieniony atrybut prześledź przez cały stos (grep nazwy end-to-end: Twenty → sGTM/Sortownia → Robot → SSOT).
TRANSLACJA na naszą powierzchnię wykonawczą: wzorzec platformy bywa core-level (moduł serwera) — nam na Cloud dostępne: config T1/T2, workflows, webhooki, REST/GraphQL, ew. apka (T3, osobna decyzja). Podaj najbliższą realizację wzorca w NASZEJ powierzchni + co tracimy względem idiomu. „Wzorzec wymaga core/forka" bez translacji = odpowiedź niekompletna.
9. PUŁAPKI DOMENOWE — stan 2026-07; punkty STARTU weryfikacji, nie fakty
Widok domyślny „All X" nieusuwalny, nie przyjmuje filtrów.
„Unlisted" ≠ prywatny — bezpośredni link otwiera widok.
Row-level permissions: sprzedawane w planie Organization, brak w release notes — weryfikuj zawsze.
Brak natywnych szablonów maili (kompozytor + akcja workflow „Send Email" ze zmiennymi ≠ szablony).
Filtr „Me": 2.9.0 tylko widgety dashboardów (PR #20971); w widokach rekordów — sprawdź.
Apps framework: status Alpha/GA zmienny — sprawdzaj release notes; deploy apek na Twenty Cloud niepotwierdzony → preflight przed decyzją o budowie apki.
Marketplace twenty.com/apps: 2026-07-15 wyłącznie apki first-party (@twentyhq/*); pojawienie się third-party = recheck §4.
Docs zawierają how-to będące jawnymi obejściami z zapowiedzią następcy — np. Formula Fields przez workflow („coming in 2026"; NIE PRZEBITE @ 2026-07-15, tripwire: release/PR „formula field type") — każde takie how-to = obowiązkowy TEST PRZEBICIA przed użyciem.
10. CZARNA LISTA — zawsze odrzucaj
Źródło	Dlaczego
*.mintlify.app (każda subdomena)	klony / stale snapshoty docs; treść zmyślona lub przestarzała („coming soon" dla rzeczy wydanych)
twenty.com/pricing jako źródło o funkcjach	sprzedaje funkcje bez pokrycia w release notes
twenty.com/user-guide/* (stara ścieżka)	zdeprecjonowana, wisi w Google; prawdziwa: docs.twenty.com
cokolwiek o permissions / mail / apps starsze niż 6 mies.	obszar rotuje co kwartał
11. FORMAT ODPOWIEDZI RESEARCHOWEJ

Linia 1: TRYB · obszar T. Dalej: wniosek → dowód (link/ścieżka + wersja + data) → co niepewne. Zero prozy. Nie wiesz = „nie wiem".

Klasyfikacja KAŻDEGO faktu (obowiązkowa, jawna, Z KOTWICĄ): [JEST @ wersja/data] (release/docs) · [JEST W KODZIE, BRAK W DOCS @ PR/commit] · [BRAK — szukałem w: …] (zakres obowiązkowy; nigdy z budżetu; brak dowodu ≠ dowód braku) · [NIE WIEM] · [PRZEBITE → przez co @ od kiedy] (nagrobek: zostaje w dokumencie jako ostrzeżenie przed regresją do starej drogi). Fakt bez kotwicy = [NIE WIEM] w przebraniu.
Werdykt (WZORZEC/SSOT): WZORZEC (N=…, instancje + daty) · [PROJEKCJA] (wzorzec → nowy przypadek; warunki brzegowe spełnione: …) · DYWERGENCJA (synchroniczna / diachroniczna) · ŚWIADOMY BRAK · TROP.
Ślad decyzyjny na końcu (formuła): „Opcja X wygrywa, jeśli prawdą jest …; najbardziej wiarygodne źródła (…) wskazują …; obala to tripwire: …". Rekomendacji bez warunków nie wydajemy — decyzja = człowiek (INV-1).
Każde twierdzenie NOŚNE z raportu/issue zweryfikowane samodzielnie (1 test/curl > 10 cytatów).
Fakt trwały → propozycja wpisu do OPS_NOTES (z datą). Higiena EDYCJI wyniku (regeneracja całych tabel zamiast patcha zakresem, audyt całości po zmianie decyzji) → SOLUTION_ANALYSIS_PLAYBOOK / AGENTS — nie tu.