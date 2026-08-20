---
doc_id: CUTOVER_VIDEO_SCRIPTS
title: "Cutover — co nagrać (poradniki dla zespołu)"
layer: runbook
status: ready_to_record
owner: "Dawid"
last_verified: 2026-08-20
parent: CUTOVER_TWENTY_TEAM_PLAN.md
channel: "prywatny YouTube owocni@gmail.com"
audience: "Marta, Gosia, Maciej, Robert, Ewa (nie-techniczni)"
---

# Poradniki video — co nagrać i co pokazać

**Zasada:** jeden film = jedna czynność dnia. 3–6 minut. Bez żargonu (nie mów „Opportunity / workflow / D1” — mów „sprawa / lead / potwierdź SQL”).

**Kolejność nagrań:** najpierw **must** (V1–V3), potem **nice** (V4–V5). V6 dopiero z Mają po cutoverze.

**Jak nagrywać:** ekran Twenty + Twój głos. Na start 5 s: „Dziś pokażę X”. Na koniec 5 s: „Jak utkniesz — napisz do Dawida”.

**Kiedy wysłać:** linki **przed** 1:1 (albo zaraz po), żeby ludzie obejrzeli zanim pytasz „umiesz SQL?”.

---

## Must — nagraj przed dry-runem (27.08)

### V1 · Widok „moje sprawy na dziś” (~4 min)

**Dla kogo:** wszyscy.  
**Cel:** żeby nie bali się „ściany pustych pól”.

| Krok | Co pokazać na ekranie |
|------|------------------------|
| 1 | Lista spraw / kanban (ten widok, którego używasz na co dzień) |
| 2 | Filtr: **tylko moje** (owner = ja) |
| 3 | Ukrywanie kolumn / pól, których nikt nie czyta |
| 4 | Pin / zostawienie 4–6 rzeczy: nazwa, etap, mail, telefon, wartość, ostatni kontakt |
| 5 | Zapisanie widoku pod prostą nazwą („Moje dziś”) |

**Powiedz wprost:** *„To jest Twój ekran startowy. Reszty pól nie musisz oglądać.”*  
**Nie pokazuj:** ustawień admina, custom fields, workflowów.

---

### V2 · Maile: przeczytaj i odpisz z Twenty (~5 min)

**Dla kogo:** wszyscy (najczęstszy 🔴).  
**Cel:** klient dostaje odpowiedź, wątek widać przy sprawie.

| Krok | Co pokazać |
|------|------------|
| 1 | Gdzie jest skrzynka / wiadomości w Twenty |
| 2 | Otwórz mail **przychodzący** powiązany ze sprawą |
| 3 | Kliknij odpowiedź, napisz 1 zdanie testowe, wyślij |
| 4 | Pokaż, że poszło (wątek / status) i że widać to przy leadzie |
| 5 | (Opcja) Odpowiedź z `leads@` albo wspólnej skrzynki — tylko jeśli ktoś z zespołu z niej korzysta |

**Powiedz:** *„Mail robimy stąd — nie skaczemy do Bitrixa tylko po to, żeby odpisać.”*  
**Nie pokazuj:** synchronizacji IMAP, tokenów, błędów sync (to na 1:1 z Tobą).

---

### V3 · Etapy sprzedaży: SQL → oferta → wygrana / przegrana (~6 min)

**Dla kogo:** wszyscy; Ewa/Marta/Gosia szczególnie.  
**Cel:** bez „przeciągnąłem i niby SQL”.

| Krok | Co pokazać |
|------|------------|
| 1 | Sprawa na etapie wcześniejszym (np. kontakt) |
| 2 | **Przyjmij jako SQL** / potwierdzenie — modal lub przycisk (nie samo przeciągnięcie) |
| 3 | Po SQL: sprawa u handlowca, etap kwalifikowany |
| 4 | Przejście dalej (oferta / wysłana umowa — jak u Was w kanbanie) |
| 5 | **Wygrana (WON)** + wpisanie kwoty |
| 6 | **Przegrana (LOST)** vs **odrzucenie kampanii** — jedno zdanie różnicy: *„LOST = nie kupili; odrzucenie = takich leadów nie chcemy z reklam”* |

**Powiedz:** *„SQL to świadoma decyzja, nie przesunięcie kafelka.”*  
**Nie pokazuj:** guardów technicznych, Continuity, Account Owner (to działa w tle).

---

## Nice — jak zostanie czas (przed cutoverem lub w 1. tygodniu)

### V4 · Szukaj: osoba, sprawa, firma (~3 min)

| Pokazać | |
|---------|---|
| Pasek wyszukiwania | wpisz nazwisko / mail / firmę |
| Wejście w Person | telefon, mail, powiązane sprawy |
| Wejście w firmę | nazwa, NIP jeśli jest |

**Powiedz:** *„Najpierw szukaj — zanim założysz drugiego klienta.”*

---

### V5 · Dwa leady / ten sam klient — co wolno (~4 min)

| Pokazać | |
|---------|---|
| Przykład dubla (testowy) | ten sam mail / firma |
| Merge / łączenie **tylko jeśli macie prosty happy-path w UI** | albo: *„nie łącz samodzielnie — napisz do Dawida”* |

**Powiedz jasno regułę:** albo pokazujesz 30-sekundowy merge, albo filmik kończy się: *„przy dubletach pinguj Dawida — nie kasuj na ślepo.”*

---

### V6 · Faktura (później, z Mają) — nie blokuje cutoveru

Placeholder: kto klika, skąd dane firmy, gdzie ląduje dokument. **Nie nagrywaj teraz**, żeby nie mieszać priorytetów.

---

## Który film komu najpierw podlinkować

| Osoba | Najpierw obejrzyj | Potem |
|-------|-------------------|--------|
| Marta / Gosia | V2 maile → V3 SQL/WON → V1 widok | V4 |
| Maciej | V2 → V1 → V3 | V4 |
| Robert | V2 → V1 → V4 (FB sprawy w liście) | V3 |
| Ewa | V3 → V2 → V1 | V4 |

---

## Checklista nagrań (Dawid)

- [ ] V1 Widok „Moje dziś”
- [ ] V2 Maile IN/OUT
- [ ] V3 SQL / WON / LOST / odrzucenie
- [ ] Linki wrzucone na wspólny kanał / mail do zespołu
- [ ] V4 Szukanie (opcjonalnie)
- [ ] V5 Duble (opcjonalnie / albo „pisz do Dawida”)
- [ ] V6 Faktury — po cutoverze

**Świadomie pomijamy w filmikach:** Fakturownia, PayU, dyspozytor („Biorę”), Continuity, admin Twenty, Bitrix.
