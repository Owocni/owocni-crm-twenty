---
doc_id: SKELETON
title: "SKELETON — wzorzec formatu plików rdzeniowych SSOT OWOCNI CRM"
layer: meta
status: frozen
edit_scope: structure_only
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-05-31
recheck_trigger: "zmiana systemu znaczników zaufania / zmiana liczby plików kanonicznych"
default_trust: D:CORE
---

# SKELETON — wzorzec formatu plików rdzeniowych

> Ten plik definiuje, JAK wygląda każdy plik kanoniczny w `owocni-crm/`.
> Nie jest treścią SSOT — jest kontraktem formatu. Kopiuj strukturę, nie treść.

---

## A. SYSTEM ZNACZNIKÓW ZAUFANIA (obowiązkowy)

Każda decyzja w plikach rdzeniowych ma przypisany poziom zaufania. Mechanizm chroni rdzeń OWOCNI przed cofnięciem przez LLM, który inaczej traktuje domysł konsultanta na równi z przemyślaną decyzją cutoveru.

### Cztery poziomy

| Znacznik | Znaczenie | Kto może zmienić |
|---|---|---|
| `[D:CORE]` | Decyzja własna OWOCNI — przemyślana pod bezpieczeństwo cutoveru / logikę systemu. Najwyższe zaufanie. | **Tylko właściciel + ADR.** Agent NIGDY nie zmienia samodzielnie, nawet gdy research sugeruje inaczej. |
| `[D:VERIFIED]` | Fakt zweryfikowany na platformie/instancji (Settings, API, docs — z datą i dowodem). | Recheck po triggerze; zmiana = nowy dowód, nie opinia. |
| `[D:RESEARCH]` | Decyzja oparta na researchu/rekomendacji konsultanta, niezweryfikowana na instancji. Najniższe zaufanie. | Agent może podważyć — ale TYLKO dowodem z instancji, nigdy innym researchem. |
| `[D:OPEN]` | Świadomie nierozstrzygnięte. Biała plama. | Wymaga decyzji właściciela + danych. Agent NIE domyka domyślnie. |

### Reguła nadrzędna (kopiowana do CRM_CONSTITUTION.md — sekcja 0 INVARIANTS)

> **Research ≠ decyzja. `[D:CORE]` bije `[D:RESEARCH]` zawsze.**
> Jeśli kontekst (raport, research, inny agent) zaleca zmianę czegoś `[D:CORE]` lub `[D:VERIFIED]` — to jest hipoteza do ADR, nie podstawa do edycji.
> Podważyć `[D:CORE]`/`[D:VERIFIED]` można WYŁĄCZNIE dowodem z instancji/platformy, nigdy innym researchem.

**Uwaga o ADR w tym refaktorze:** dopóki katalog `adr/` nie istnieje, słowo „ADR" oznacza **inline ADR-light entry w `DECISION_REGISTER.md`**. NIE wolno tworzyć fizycznego katalogu `adr/` tylko dlatego, że `[D:CORE]` wymaga ADR. Katalog `adr/` powstaje dopiero po triggerze wydzielenia (patrz STRUKTURA_I_ROLE §1).

### Jak stosować (zasada „default + odchylenia")

- Każdy plik deklaruje `default_trust` w front-matterze (zwykle `D:CORE`; dla OPS_NOTES `D:VERIFIED`).
- Inline znacznik stawiasz **tylko przy odchyleniu od domyślu pliku.**
- Skutek: nic nie jest bez przypisanego poziomu (default pokrywa resztę), a `[D:RESEARCH]`/`[D:OPEN]`/`[D:VERIFIED]` w pliku CORE-owym **świeci**, zamiast tonąć w morzu `[D:CORE]`.
- Pełne pokrycie, minimalny szum. To realizuje „znaczniki wszędzie" bez utraty czytelności.

### Format zapisu decyzji odchylonej (wzór z `bizSource`)

```
**bizSource = SELECT** [D:RESEARCH]
- Decyzja: znormalizowany SELECT, rozszerzalny przez Metadata API.
- Powód: wolny TEXT = chaos atrybucji ("Facebook"/"FB"/"Meta" jako 3 źródła); pole zasila wydatki reklamowe.
- Obalony kontrargument: "SELECT = migracja DDL przy nowym kanale" — FAŁSZ. Dodanie opcji do SELECT = operacja Metadata API, nie DDL. Migracja grozi tylko przy zmianie TYPU pola.
- Status weryfikacji: rekomendacja researchu + obalenie kosztu. Niezweryfikowane na instancji → preflight F6.
```

Zapis obalonego kontrargumentu jest obowiązkowy przy `[D:RESEARCH]` — chroni przed odtworzeniem błędu, który już raz popełniono.

### Sufiksy znaczników (reguła — zamyka furtkę do pół-stanów)

Dozwolone sufiksy (identyfikator lub zawężenie zakresu, NIE osłabienie poziomu):
- `[D:OPEN:F1]` — identyfikator konkretnego otwartego stanu.
- `[D:CORE:refactor-scope]` — zawężenie zakresu obowiązywania decyzji.

**Zakazane:**
- sufiksy osłabiające bazowy poziom (np. `[D:VERIFIED — pending]`) — to pół-stan, który łamie cały system (był realnym błędem, naprawionym);
- mieszanie `VERIFIED` z `pending`/`open`;
- sufiks jako ukryty piąty poziom zaufania.

Jeśli potrzebny opis, pisz go **poza** znacznikiem: `[D:VERIFIED] — brak generatora dziś`, nie `[D:VERIFIED: brak generatora]`. Znacznik niesie poziom; opis jest tekstem obok.

---

## B. ZAMKNIĘTY FRONT-MATTER (9 pól obowiązkowych)

Front-matter jest krótki celowo — bogaty nagłówek podnosi koszt inferencji i ryzyko, że agent zignoruje resztę pliku. Pola opcjonalne dodaje się tylko gdy niosą treść.

```yaml
---
doc_id: EVENT_CONTRACT            # stabilny identyfikator (NIE zmieniać — to klucz cross-ref)
title: "EVENT_CONTRACT — Twenty CRM ↔ Sortownia"
layer: core_ssot                  # navigator | core_ssot | execution | audit | ops | adr_index | archive
status: active                    # draft | active | frozen | deprecated | archived
edit_scope: structure_only        # full | structure_only | append_only | generated_only
owner: "Właściciel / Dawid"       # biznes / techniczny
last_verified: 2026-05-31
recheck_trigger: "Twenty release / zmiana kanonu eventów / zmiana adaptera Sortowni"
default_trust: D:CORE             # domyślny poziom zaufania pliku
---
```

**Pola opcjonalne** (dodawać tylko gdy realnie potrzebne, nie dla kompletności):
`depends_on`, `related`, `supersedes`, `unfreeze_authority`.

---

## C. STRUKTURA CIAŁA PLIKU (sekcje stałe + moduł zmienny)

Kolejność sekcji jest stała dla wszystkich plików rdzeniowych. Treść sekcji 5 (BODY) różni się per typ pliku — to jedyny moduł zmienny.

```markdown
# <TYTUŁ PLIKU>

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:**
- 3–7 punktów.

**Ten plik NIE decyduje o:**
- 3–7 punktów. (zakres negatywny — blokuje scope creep i "dopowiadanie" przez agenta)

**Zawsze czytaj razem z:**
- pliki wymagane do poprawnej interpretacji.

**Najgroźniejszy błąd:**
- jeden konkretny błąd, którego agent ma unikać.

**Przy konflikcie:**
- reguła pierwszeństwa źródeł.

**Zmiana wymaga:**
- ADR / owner approval / update generated snapshot / update runbook.

---

## 1. NEGATIVE RULES / LOCAL INVARIANTS

| ID | Zakaz | Powód | Konsekwencja naruszenia | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | ... | ... | ... | Właściciel + ADR | ADR-NNN |

(To główny bezpiecznik przed "ładny Markdown, słabszy systemowo". Każdy plik
deklaruje czego NIE wolno — z powodem, konsekwencją i autorytetem odmrożenia.)

---

## 2. PURPOSE

Krótko: po co istnieje ten plik. 2–4 zdania.

---

## 3. SCOPE

### Pokrywa
- ...

### Nie pokrywa
- ...

---

## 4. CANONICAL DEFINITIONS

Definicje pojęć, których nie wolno zgubić przy refaktorze.
(np. LOST ≠ rejected_lead; WON = stage, purchase = event.)

---

## 5. BODY — moduł zmienny per typ pliku

Główna treść. Tu żyją decyzje ze znacznikami [D:*] (inline tylko przy odchyleniu
od default_trust). Struktura zależy od typu — patrz §D niżej.

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| ... | ... |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|

(Format nie pozwala ukryć niewiedzy w prozie — [D:OPEN] musi być widoczne.)

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|

---

## LEGENDA ZNACZNIKÓW (stopka każdego pliku rdzeniowego)

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: patrz `default_trust` we front-matterze. Inline = odchylenie.
```

---

## D. MODUŁ BODY (sekcja 5) PER TYP PLIKU

To jedyne miejsce, gdzie pliki różnią się strukturą. Sekcje 0–4 i 6–9 są identyczne wszędzie.

| Plik | default_trust | Co w BODY (sekcja 5) | Odstępstwo od skeletonu |
|---|---|---|---|
| `README.md` (root) | D:CORE | topologia repo, co SSOT / co archiwum, instrukcja LLM, kolejność czytania | navigator — krótki, bez sekcji 4; sekcja 1 (NEGATIVE) skrócona do "co ignorować" |
| `README.md` (SSOT) | D:CORE | routing temat→plik, priorytet konfliktów | navigator — bez sekcji 4; body = tabela routingu |
| `CRM_CONSTITUTION.md` | D:CORE | **Sekcja 0 INVARIANTS (zawsze ładowana, primacy)** + sekcja 0a LLM QUICK ENTRY + 9 praw + role + klasy decyzji + AI governance | INVARIANTS (sekcja 0) przed LLM QUICK ENTRY (0a); rdzeń ≤100 linii, pełne brzmienie praw progressive disclosure niżej |
| `ARCHITECTURE.md` | D:CORE | granice systemów, boundary matrix, przepływy in/out, legacy do wyłączenia | bez odstępstw |
| `IDENTITY_AND_INBOUND.md` | D:CORE | Resolver T1–T5, macierz email×phone, zamknięta lista kanałów, VBB gate | bez odstępstw |
| `DATA_MODEL.md` | D:CORE | semantyka pól, ownership, frozen policy (3 warstwy), prefiksy, 6 pytań | pełny ręczny SSOT pól krytycznych `[D:VERIFIED]` (brak generatora dziś); typy→generated/ dopiero gdy pipeline istnieje |
| `EVENT_CONTRACT.md` | D:CORE | mapowanie Twenty→SSOT, LOST vs rejected, cold-start, adapter logic, wchłonięte STAGE_MAPPING | najpełniejszy; sekcja 5 ma podsekcje: transport, catalog, trigger, transition, idempotency, loop-prevention, test matrix |
| `DECISION_REGISTER.md` | D:CORE | single-file register: open/closed + inline ADR-light body (decision/context/options/consequences); brama cutoveru | pełne decyzje ZOSTAJĄ inline (adr/ nie w tym refaktorze — refactor-scope); sekcja = legenda 3 osi faz (nienaruszalna); future extraction trigger |
| `ops/OPS_NOTES.md` | **D:VERIFIED** | Twenty Verified Facts, known issues, workflow registry, bezpieczeństwo integracji | fakty z klasą (F-DOCS/F-PRICING/F-POC/IMPL/Z/DO-TESTU) + recheck; bez decyzji, bez procedur; **klasa wiersza nadpisuje default_trust — `D:VERIFIED` NIE awansuje F-POC/IMPL/Z/DO-TESTU do verified** |

---

## E. KTÓRE PLIKI ŁAMIĄ SKELETON (świadomie)

| Plik | Łamie? | Dlaczego |
|---|---|---|
| README (root + SSOT) | częściowo | navigator, nie SSOT treści — bez długiego body, bez sekcji 4 |
| CRM_CONSTITUTION | tak, świadomie | INVARIANTS jako sekcja 0 przed wszystkim (primacy position, przeżywa kompaktację); LLM QUICK ENTRY = 0a |
| DECISION_REGISTER | częściowo | single-file register + inline ADR-light — pełna treść zostaje (adr/ wydzielane dopiero po triggerze) |
| OPS_NOTES | częściowo | fakty operacyjne, nie semantyka — default_trust = VERIFIED, nie CORE |

Pliki wykonawcze (`runbooks/`, `audits/`) mają własne, lżejsze wzorce — NIE są plikami rdzeniowymi i nie podlegają temu skeletonowi w pełni. Runbook ma kroki/go-no-go/rollback. **`adr/` NIE powstaje w tym refaktorze** (`[D:CORE:refactor-scope]`) — decyzje żyją inline w DECISION_REGISTER jako ADR-light. Gdy w przyszłości trigger wydzielenia zadziała (patrz STRUKTURA_I_ROLE §1), pliki ADR dostaną format MADR-min (kontekst/opcje/decyzja/konsekwencje/powiązane invarianty). To przyszła ścieżka, nie obecny katalog.

**Reguła powstawania nowego pliku kanonicznego (funkcjonalna, nie liczbowa)** `[D:CORE]`: plik powstaje, gdy istnieje dom treści, którego żaden obecny plik nie unosi bez utraty czytelności lub mieszania profili zaufania. Liczba plików = wynik tej reguły, nigdy przyczyna. Nowy plik kanoniczny = `[D:CORE]` = ADR + właściciel. (Zastępuje wszelkie sformułowania typu „N plików jako sufit".)

---

## F. CO TEN PLIK ZAMYKA (warstwa 1)

- [x] Liczba plików kanonicznych w `owocni-crm/`: **8** — jako WYNIK reguły funkcjonalnej (§C), nie sufit `[D:CORE]`
- [x] Root README: **warunkowy** `[D:OPEN:F1]` — istnieje tylko jeśli Dawid potwierdzi topologię repo z poziomem nadrzędnym (patrz §G.1)
- [x] INVARIANTS = sekcja 0 konstytucji, nie osobny plik `[D:CORE]`
- [x] ARCHITECTURE i DATA_MODEL osobne (nie scalone) `[D:CORE]`
- [x] 2 README (root topologia + SSOT routing) `[D:OPEN:F1]` — decyzja robocza warstwy 1; do potwierdzenia oględzinami realnego repo przez Dawida (patrz §G.1)
- [x] `generated/` istnieje wyłącznie jako scaffold/future target `[D:CORE]`
- [x] Brak działającego generatora/pipeline'u na dziś `[D:VERIFIED]`; do czasu jego powstania `DATA_MODEL.md` = pełny ręczny SSOT pól krytycznych
- [x] OPS_NOTES w `ops/` `[D:CORE — decyzja właściciela]`
- [x] System znaczników zaufania + default w front-matter + inline odchylenia `[D:CORE]`
- [x] Front-matter 9 pól obowiązkowych `[D:CORE]`
- [x] Jeden skeleton, moduł BODY zmienny per typ `[D:CORE]`
- [x] llms.txt — NIE `[D:VERIFIED]`

**Warstwa 1 zamknięta.** Stany otwarte — patrz §G.

---

## G. STANY OTWARTE (operacyjne — z warunkiem wycofania/zamknięcia)

Każdy wpis mówi: co go cofa LUB zamyka i kto. To nie są notatki — to warunki, które trzeba świadomie zamknąć, zanim staną się cichym założeniem.

### G.1 `[D:OPEN]` F1 — topologia repo (2 README)
- **Stan:** decyzja "2 README" oparta na topologii z *dokumentów* (root README opisuje `owocni-crm-github/` z root + `owocni-crm/` + `twenty/`), nie z oględzin realnego GitHub.
- **Warunek wycofania:** jeśli Dawid potwierdzi, że produkcyjne repo ma `owocni-crm/` jako root (bez poziomu nadrzędnego) → wracamy do **1 README**, root README znika.
- **Kto zamyka:** Dawid — oględziny realnego repo.
- **Do czasu zamknięcia:** znacznik przy 2 README to `[D:OPEN:F1]` (decyzja robocza), NIE `[D:VERIFIED]` — bo nie ma jeszcze oględzin repo.
- **Po potwierdzeniu przez Dawida:** jeśli topologia 2-poziomowa potwierdzona → zmień marker w §F z `[D:OPEN:F1]` na `[D:VERIFIED]`. Jeśli zaprzeczona → 1 README, root znika.

### G.2 srcSystem — loop-prevention ROZSTRZYGNIĘTE `[D:CORE]`
- **Stan:** rozstrzygnięte trzecią drogą (nie A status-quo, nie pełny ledger §6.4). Spór był fałszywą alternatywą.
- **Decyzja:** loop-prevention = **efemeryczny pending-write w Stape** (single-layer); Sortownia przy zapisie zapisuje krótkotrwały znacznik (rekord + TTL), webhook w oknie → SKIP operacji, po TTL znika. `srcSystem` zdegradowany do **proweniencji** (pole raportowe), NIGDY mechanizm SKIP. Idempotencja z **istniejącego Stape Store** (detekcja przejść), bez osobnego event_ledger.
- **Invariant (zamknięty, w konstytucji):** "loop-prevention NIGDY na trwałym polu" — opiera się na zasadzie inżynierskiej (trwałe pole ≠ marker operacji), nie na zachowaniu Twenty.
- **Powód:** trwałe `srcSystem`-SKIP wycisza legalne późniejsze zdarzenia handlowca = cicha awaria atrybucji (§6.3, potwierdzone 3 niezależnymi ścieżkami).
- **Test G.2 (przepisywanie pola):** zdegradowany z bramy do **opcjonalnego** — mechanizm nie zależy od trwałości pola, więc wynik testu nie zmienia rozwiązania.

### G.3 Poza warstwą 1 (do kolejnych tur, NIE blokują)
- Preflight instancji **F2–F14** (research K1) — weryfikacja faktów Twenty, które determinują *treść*, nie skeleton. (F1 = topologia repo, §G.1 — osobny świat, NIE preflight Twenty.)
- Sekwencja wykonania przeszczepów — warstwa 2.

### G.4 Pending dla warstwy 2 (reguły treści, nie formatu — NIE wpisywać do SKELETON)
- **DATA_MODEL — NEGATIVE RULE:** zakaz zapisu "prawda techniczna jest w `generated/`", dopóki generator nie istnieje. `generated/` jest dziś scaffoldem; DATA_MODEL = pełny ręczny SSOT pól krytycznych. Ta reguła trafia do sekcji 1 (NEGATIVE RULES) pliku DATA_MODEL.md przy jego pisaniu — nie tutaj (to reguła treści, nie kontraktu formatu).

---

## CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-05-31 | Utworzenie skeletonu warstwy 1 | Konsolidator | Zamknięcie liczby plików + formatu + systemu zaufania |
| 2026-05-31 | Dodano §G (stany otwarte z warunkami wycofania/zamknięcia); F1 → "pending" | Konsolidator | Zamiana notatek na operacyjne warunki; rozdzielenie reguł formatu od reguł treści (G.4) |
| 2026-05-31 | §G.2 srcSystem: z [D:OPEN] na [D:CORE rozstrzygnięte] — pending-write single-layer, srcSystem→proweniencja, idempotencja z istniejącego Stape Store; test G.2 zdegradowany do opcjonalnego | Konsolidator | Trzecia droga rozbraja §6.3 bez "lotniskowca"; synchronizacja ze STRUKTURA_I_ROLE |
| 2026-05-31 | Reguła plików: usunięto sprzeczność „pełne decyzje → adr/" (DECISION_REGISTER = inline ADR-light); adr/ → refactor-scope nie zakaz; dodano regułę funkcjonalną powstawania pliku (§C); 8 plików = wynik reguły, nie sufit | Konsolidator | K1+K2: „N plików jako sufit" to tautologia blokująca roadmapę; skeleton sam zapraszał do adr/ (konflikt warstwy 1) |
| 2026-05-31 | 3 poprawki: (1) `[D:VERIFIED — F1 pending]` → czysty `[D:OPEN:F1]` (hybryda łamała system znaczników); (2) licznik front-matter 8→9 (realnie 9 pól obowiązkowych); (3) język „do INVARIANTS" → „CRM_CONSTITUTION.md sekcja 0a" (ryzyko fantomowego pliku) | Konsolidator | Pół-stan znacznika podważał cały system zaufania; spójność kontraktu formatu |
| 2026-05-31 | Przegląd końcowy (P0/P1): root README rozdzielony od 8 plików (`[D:OPEN:F1]` vs `[D:CORE]`); definicja „ADR = inline ADR-light, nie twórz adr/"; numeracja INVARIANTS ujednolicona 0a→0 (QUICK ENTRY=0a); F1–F14→F2–F14 (F1=topologia, nie preflight Twenty); generated/ rozdzielone scaffold[CORE]/brak-pipeline[VERIFIED]; OPS row-class nadpisuje default_trust | Konsolidator | Usunięcie pół-stanów i furtek interpretacyjnych; synchronizacja numeracji ze STRUKTURA; bez zmiany decyzji |
| 2026-05-31 | Reguła sufiksów znaczników (S2): dozwolone identyfikator/zawężenie (`[D:OPEN:F1]`, `[D:CORE:refactor-scope]`); zakazane osłabienie poziomu (`[D:VERIFIED — pending]`); opis poza znacznikiem. Naprawiono własne złamanie reguły `[D:VERIFIED: brak generatora]` → opis obok znacznika | Konsolidator | Zamknięcie furtki do pół-stanów na stałe; reguła ujawniła 2 własne naruszenia |
