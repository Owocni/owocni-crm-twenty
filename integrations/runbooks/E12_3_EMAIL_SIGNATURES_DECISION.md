---
doc_id: E12_3_EMAIL_SIGNATURES_DECISION
title: "Decyzja Mariusz — stałe stopki maili w odpowiedziach z Twenty"
layer: runbook
status: option_a_accepted — live i git Owocni Mail **0.1.61** (2026-09-03). Stopka: `apps/owocni-mail-twenty/src/utils/mailSignature.ts`. Wątkowanie D-2: nie kopiować workspace-latest do `In-Reply-To`. Numer **0.1.58** z wcześniejszej wersji tego dokumentu nigdy nie istniał w git.
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-09-03
related:
  - E12_3_EMAIL_TEMPLATES_AND_TRAINING.md
  - E12_3_EMAIL_TEMPLATE_STRATEGY.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - ../../owocni-crm/DECISION_REGISTER.md
  - CUTOVER_1ON1_CHECKPOINT_SHEET.md
source: "pytanie operacyjne 31.08.2026 + research Twenty Cloud + eksport BB 16.06.2026"
---

# Stopki w odpowiedziach z Twenty — prośba o decyzję

**Do:** Mariusz  
**Od:** Dawid  
**Data:** 31.08.2026  
**Pytanie:** czy wdrażamy stałe stopki jak w Thunderbirdzie / Firmao — każda odpowiedź z Twenty wychodzi z podpisem osoby (skrzynki), bez ręcznego wklejania.

---

## W skrócie

1. Dziś mail z Twenty **wychodzi bez stopki**. Twenty tego nie umie (nie ma ustawienia jak w Thunderbirdzie). Gmail / Google też **nie doklei** — wysyłamy przez skrzynkę IMAP (`mail.owocni.pl`), nie przez okno Gmaila.
2. Handlowiec odpowiada wyłącznie z **Owocni Mail** (przycisk Odpowiedz). Natywne Reply Twenty jest wyłączone — tak ma zostać (ADR #22: IN może być na `leads@`, OUT zawsze ze swojej skrzynki).
3. Szablony (20 szt.) to **treść oferty**, nie podpis. Wklejenie stopki do każdego szablonu nie załatwia wolnej odpowiedzi ani odpowiedzi bez szablonu.
4. **Opcja A — przyjęta 31.08:** jedna stopka na skrzynkę. **Zawsze widać ją na końcu edytora** (wstawiona jako treść, jak w Thunderbirdzie). **Wychodzi dokładnie to, co jest w edytorze — nic ponadto.** System **nie** dokleja stopki przy wysyłce. Skasujesz w edytorze → klient jej nie dostanie.
5. Stopki z BB (Marta, Gosia, pomoc) zostają. Brakującym (Maciej, Ewa, Robert, Mariusz) skopiowano układ Marty, zmieniono imię/mail. **Telefonów nie zgadywano** — dopisz, jeśli mają być. Poniżej szkice do Twojego przeglądu.

---

## Co handlowiec zobaczy po wdrożeniu

Marta klika **Odpowiedz** na dowolnego leada (także z `leads@`).

- **Od:** `marta@owocni.pl`
- Na dole treści: jej podpis (Pozdrawiam, Marta Słowik, Owocni.pl, RODO…)
- Wysyła — klient dostaje **dokładnie to, co widać w edytorze** (treść + stopka, o ile jej nie skasowano)
- Gosia / Maciej: to samo, **swoja** skrzynka, **swoja** stopka
- Zmiana „Od” (gdy ktoś ma więcej niż jedną skrzynkę) → podmiana stopki

Nie trzeba pamiętać, nie trzeba wklejać, nie zależy od tego, do kogo piszemy.

---

## Dlaczego nie „ustawimy w Google / Thunderbirdzie”

| Pomysł | Dlaczego odpada |
|---|---|
| Stopka w Gmailu | Twenty nie wysyła przez okno Gmaila. Podpis Gmaila **nie wchodzi** do maila z CRM. |
| Stopka w Thunderbirdzie | Działa tylko gdy ktoś pisze **z Thunderbirda**. Z Twenty dalej nagie maile. |
| Wpisać podpis w 20 szablonów | Wolna treść i zwykła odpowiedź **bez szablonu** zostają bez stopki. |
| Czekać aż Twenty to doda | Nie mają tego w produkcie. Kiedyś może — nie na cutover. |

Wcześniejszy zapis cutoveru („stopka = poczta Google, nie Twenty”) **nie działa** na naszej ścieżce. Trzeba to odwołać albo świadomie zostawić maile bez podpisu.

---

## Opcje

### Opcja A — wdrażamy w Owocni Mail (rekomendowane)

| | |
|---|---|
| **Co** | Stopka przypisana do skrzynki (`marta@`, `gosia@`, `copywriting@`…). Wstawiana **do edytora** na starcie. Wysyłka = kopia edytora, **bez** dodatkowego doklejania. |
| **Efekt** | Domyślnie każda nowa odpowiedź **ma stopkę w edytorze**. Klient dostaje to, co handlowiec widzi i zatwierdza przyciskiem Wyślij. |
| **Czas** | **1 dzień** po Twojej mapie skrzynek (kod + wgranie + test Marty i Macieja) |
| **Koszt** | niski — apka Owocni Mail już jest; HTML z BB gotowy |
| **Ryzyko** | niskie. Nie ruszamy lejka, Sortowni, syncu IMAP. Źle przypisana mapa = zła osoba na stopce — stąd tabela poniżej. |
| **Cutover** | nie blokuje startu; warto **przed** szkoleniem PAR-5.3, żeby handlowiec nie uczył się pisać bez podpisu |

### Opcja B — nic nie robimy

| | |
|---|---|
| **Co** | zostawiamy jak jest |
| **Efekt** | maile z Twenty bez „Pozdrawiam / Owocni.pl / RODO”. Klient widzi goły tekst. |
| **Czas** | 0 |
| **Ryzyko** | wizerunek + handlowiec wraca do Thunderbirda/BB „bo tam jest stopka” |

### Opcja C — każdy wkleja sam (szablon albo schowek)

| | |
|---|---|
| **Co** | szkolenie: „pamiętaj o stopce” |
| **Efekt** | część maili z podpisem, część bez — zależy od osoby i pośpiechu |
| **Czas** | 0 kodu, ciągły koszt uwagi |
| **Ryzyko** | to nie jest Thunderbird. Po miesiącu znów pytanie „czemu nie ma stopek” |

---

## Co świadomie pomijamy (w opcji A)

- czekanie na natywną funkcję Twenty,
- stopki w Google / Thunderbird jako substytut wysyłki z CRM,
- wpisywanie podpisu w treść wszystkich szablonów,
- kilka stopek na jedną osobę do wyboru przy każdym mailu (Kinga-zastępstwo itd.) — **v1 = jedna domyślna na skrzynkę**,
- autoresponder.

Jeśli ktoś potrzebuje drugiej stopki (np. „piszę za Gosię”), to osobna decyzja później — nie w v1.

---

## Mapa skrzynka → stopka (szkice 31.08 — do przeglądu)

| Skrzynka OUT | Kto | Źródło | Podgląd (to widać na końcu edytora; wyjdzie, jeśli zostanie) | Do sprawdzenia |
|---|---|---|---|---|
| `marta@owocni.pl` | Marta Słowik | BB, bez zmian | Pozdrawiam, Marta Słowik · Owocni.pl · *Wierzymy w małe firmy!* · +48 660 970 980 · studio@owocni.pl · www · RODO | telefon, studio@ jako kontakt firmowy |
| `gosia@owocni.pl` | Małgorzata Zielińska | BB, bez zmian | Pozdrawiam, Małgorzata Zielińska · … · +48 570 704 470 · studio@owocni.pl · www · RODO | j.w. |
| `copywriting@owocni.pl` | Maciej Wysocki | **nowa** (układ Marty) | Pozdrawiam, Maciej Wysocki · Owocni.pl · slogan · copywriting@owocni.pl · www · RODO | **brak telefonu** · mail = From, nie studio@ |
| `ewamalanowska@owocni.pl` | Ewa Malanowska | **nowa** | Pozdrawiam, Ewa Malanowska · … · ewamalanowska@owocni.pl · www · RODO | **brak telefonu** |
| `robertmank@owocni.pl` | Robert Mańk | **nowa** | Pozdrawiam, Robert Mańk · … · robertmank@owocni.pl · www · RODO | **brak telefonu** |
| `mariusz@owocni.pl` | Mariusz Słowik | **nowa** | Pozdrawiam, Mariusz Słowik · … · mariusz@owocni.pl · www · RODO | **brak telefonu** · login CRM to `owocni@gmail.com`, From i tak `mariusz@` jeśli wyśle z tej skrzynki |
| `pomoc@owocni.pl` | pomoc | BB, bez zmian | Owocni, zawsze pomocni · pomoc@owocni.pl | krótsza, bez RODO — tak ma zostać? |
| `studio@` / `leads@` | nie handel | BB „Owocni” | Pozdrawiamy, Owocni.pl · slogan | tylko gdyby operator wysłał; handlowcom nie przypisujemy |

HTML nowych stopek: `exports/bb_email_templates/signatures_draft_2026-08-31/`.

**Nie wgrywamy z BB:** kinga, kinga-zastępstwo, Maja, Bartek, Łukasz, test nowej stopki.

---

## Jak to działa w edytorze (opcja A — twarda reguła)

**Wychodzący mail = treść edytora. Zero dopisków przy sendzie.**

1. Otwierasz Odpowiedz / wolną treść → kursor na górze, **stopka już jest na dole**.
2. Piszesz nad nią. Możesz stopkę poprawić albo skasować w tej jednej wiadomości.
3. Wysyłasz → klient dostaje **to, co było w edytorze**. Ani znaku więcej.
4. Skasowana stopka **nie wraca** przy wysyłce.
5. Zakaz: serwer / `send-template-email` **nie** dokleja HTML stopki do body.

Zmiana „Od” na inną swoją skrzynkę podmienia stopkę **w edytorze** (jeszcze przed wysyłką) — nadal widać, co wyjdzie.

---

## Decyzja (31.08)

```
Opcja: A
Stopka zawsze widoczna na końcu edytora (wstawiona jako treść): TAK
Wychodzący mail = dokładnie edytor (zakaz doklejania przy sendzie): TAK
Jedna stopka na skrzynkę: TAK
Blok RODO: TAK u sprzedaży (Marta/Gosia + szkice Maciej/Ewa/Robert/Mariusz);
           pomoc@ = wariant BB bez RODO, dopóki nie powiesz inaczej

Mapa:
  marta@            → BB Marta Słowik
  gosia@            → BB Małgorzata Zielińska
  copywriting@      → nowa Maciej Wysocki (szkic)
  pomoc@            → BB „Owocni, zawsze pomocni”
  mariusz@          → nowa Mariusz Słowik (szkic)
  robertmank@       → nowa Robert Mańk (szkic)
  ewamalanowska@    → nowa Ewa Malanowska (szkic)
  studio@ / leads@  → firmowa Owocni, nie dla handlu

Szkice (Maciej / Ewa / Robert / Mariusz): telefon nieznany — Szef dopisuje albo zostawiamy bez.
Po OK stopek → wdrożenie w Owocni Mail + smoke Marta i Maciej.
```
