# Agenda — rozmowa z Mariuszem (do potwierdzenia przed przeszczepem SSOT)

**Data przygotowania:** 2026-06-01  
**Kontekst:** Warstwa 1 (struktura + konstytucja) — decyzje `[D:CORE]` wymagają zgody właściciela, nie tylko dokumentacji.

---

## 1. INV-3 / `srcSystem` vs pending-write w Stape

**Problem:** Echo webhooka po zapisie Sortowni do Twenty — adapter musi wiedzieć, kiedy **nie** emitować eventu drugi raz.

| | Obecny opis (Twoja dokumentacja) | Propozycja Mariusza |
|---|----------------------------------|---------------------|
| Mechanizm | Pole `srcSystem` w rekordzie = loop prevention | Krótkotrwały znacznik w **Stape Store** (TTL), znika sam |
| `srcSystem` w Twenty | SKIP gdy wartość = Sortownia | Tylko **raport** (skąd lead) — **bez SKIP** |

**Ryzyko starego podejścia:** trwałe `srcSystem` może wyciszać **legalne** późniejsze zmiany handlowca (stage → QUALIFIED/WON) — sygnały do Google/Meta nie wychodzą, UI Twenty wygląda OK.

**Do potwierdzenia:**
- [ ] Akceptujemy kierunek: **pending-write w Stape**, `srcSystem` = wyłącznie proweniencja?
- [ ] Rozumiemy koszt: **implementacja w adapterze** + testy przed cutoverem (nie tylko zmiana MD)?
- [ ] **L-1 (wyjątek przejściowy):** stary `srcSystem`-SKIP na backfill `idOid` zostaje **do** smoke test #4 PASS — kolejność (1) pending-write → (2) test → (3) usunięcie SKIP?

**Pytanie na call:** „Jeśli nie pending-write — świadomy ADR i uzasadnienie, czemu ryzyko cichej awarii nas nie dotyczy.”

---

## 2. INV-1 / znaczniki `[D:*]` — agent nie zmienia `[D:CORE]` bez ADR

**Sens:** Research i sugestie LLM **nie zastępują** decyzji cutoveru. Zmiana fundamentu = wpis w `DECISION_REGISTER` (ADR-light) + zgoda właściciela.

| Znacznik | Znaczenie skrótowo |
|----------|-------------------|
| `[D:CORE]` | Decyzja OWOCNI — agent **nie edytuje sam** |
| `[D:VERIFIED]` | Fakt z instancji Twenty — recheck po release |
| `[D:RESEARCH]` | Rekomendacja — nie traktować jako prawdy bez testu |
| `[D:OPEN]` | Świadomie otwarte — agent **nie domyka** bez testu + ADR |

**Do potwierdzenia:**
- [ ] Ten model zaufania obowiązuje dla całego projektu (zgodnie z mailem)?
- [ ] **Dawid** = gatekeeper techniczny ADR (evidence, testy); **właściciel** = semantyka / cutover?
- [ ] Prompty typu „popraw całą dokumentację” **bez wskazania SSOT** = poza trybem pracy?

**Pytanie na call:** „ADR = inline w DECISION_REGISTER, bez folderu `adr/` na teraz — OK?”

---

## 3. Słowo „owner” — rozdzielenie nazewnictwa

**Problem:** Słowo **owner** oznacza co najmniej 4 różne rzeczy (dokumentacja projektu, rola w projekcie, kanał first-touch w Sortowni, handlowiec przy Opportunity w Twenty). Mylenie (3) i (4) psuje atrybucję i kod.

### Propozycja: „Owner” tylko dla leada w Twenty

| Kontekst | **Nie używać** | **Proponowana nazwa** |
|----------|----------------|------------------------|
| Handlowiec przy Opportunity (Twenty UI + docs biznesowe) | — | **Owner** (lub po polsku w szkoleniu: **„handlowiec przypisany”** / **„opiekun leada”**) |
| Kanał first-touch w Sortowni / paid (`owner` w Stape) | owner | **`firstTouchChannel`** / **`kanal_first_touch`** (w docs: **„kanał first-touch”**) |
| Drugi kanał (para z first-touch) | assist (może zostać) | **`assistChannel`** / **„kanał assist”** — do uzgodnienia |
| Kolumna w tabelach dokumentacji (kto domyka decyzję) | Owner | **`Decision owner`** / **`Odpowiedzialny`** / **`Właściciel decyzji`** |
| Rola w projekcie („Owner techniczny: Dawid”) | Owner techniczny | **`Odpowiedzialny techniczny`** / **`Tech lead`** / **`Wdrożenie (Dawid)`** |

**Zasada:** W dokumentacji SSOT i na callach technicznych — słowo **Owner** (wielka litera jako termin) = **wyłącznie Opportunity owner w Twenty** (znaczenie 4). Wszystko inne = inna etykieta.

**Do potwierdzenia:**
- [ ] Mariusz akceptuje rozdzielenie w docs (glosariusz + IDENTITY + konstytucja)?
- [ ] W **szkoleniu handlowców**: nie używamy „owner” przy kanałach reklamowych — tylko „źródło” / „kanał”?
- [ ] W **kodzie Stape** rename `owner` → dłuższa praca — czy na teraz wystarczy rozróżnienie w dokumentacji, a rename pola w Stape = osobny task po cutoverze?

**Pytanie na call:** „Czy wprowadzamy tę konwencję nazw do SZKIELETU / glosariusza jako `[D:CORE]`?”

---

## Inne punkty struktury (krótko, jeśli starczy czasu)

| ID | Temat | Propozycja |
|----|-------|------------|
| **F1** | 1 vs 2 README w repo | Repo jest dwupoziomowe (`owocni-crm-github/` + `owocni-crm/`) → **2 README** OK? |
| **Struktura** | 8 plików kanonicznych + `integrations/` | Akceptacja drzewa z `STRUKTURA_I_ROLE` — bez powrotu do ~20 plików płasko |
| **Pliki spoza drzewa** | AUDIT_AKK, CHECKLIST, STRESS_TEST, CUTOVER_RUNBOOK… | Archiwum / `_legacy/` / usunąć z repo? |
| **Kod** | Sortownia + Robot w `integrations/` | OK że SSOT kodu jest w repo Owocnych (nie AdrianKrauza)? |

---

## Po callu — następny krok

Po zamknięciu powyższych: dalszy **review treści** w kanonicznym `owocni-crm/` (batch po batchu, z ledgerem pokrycia). *(2026-06-01: struktura z `mariusz-pliki/` jest już w root repo; stara docs w `_legacy/`.)*

**Kolejna rata wyjaśnień (dla Dawida):** `README.md` (root + SSOT navigator).

---

*Plik roboczy — nie jest częścią SSOT produkcyjnego. Lokalizacja: `_DO_USUNIECIA/proces-refaktoryzacji/` (docelowo usunąć z repo).*
