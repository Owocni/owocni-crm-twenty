---
doc_id: STUDIO_AT_AUTO_LEAD_DECISION
title: "Decyzja Mariusz — czy mail na studio@ ma tworzyć kartę na lejku"
layer: runbook
status: awaiting_mariusz
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-09-03
related:
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - G_PAR_BETTER_BITRIX_PARITY.md
  - LEADS_AT_INBOUND_TEST.md
  - LEAD_DISPATCHER_PLAN.md
  - ../../owocni-crm/DECISION_REGISTER.md
  - ../../owocni-crm/ops/SYSTEM_HEALTH.md
source: "research Twenty native 2026-09-03 + audyt instancji (Godlewski wycena logo) + IDENTITY §5.4–5.7"
---

# Mail na studio@ — karta na lejku czy tylko wątek?

**Do:** Mariusz  
**Od:** Dawid  
**Data:** 3.09.2026  
**Status:** czeka na Twoje A / B / C — nic z tego nie wdrażamy wcześniej.

**Pytanie:** czy nowy nadawca na `studio@owocni.pl` ma dostawać kartę na kanbanie (jak z `leads@`), czy tylko zapis wątku — i czy to samo ma dotyczyć skrzynek Marty i Gosi.

To **nie** jest dokument o widokach poczty. Widoki (własna skrzynka vs podgląd) są osobno. Tu tylko: czy z maila ma powstać **karta na lejku**.

Proszę odhaczyć jedną opcję **A / B / C** na dole + odpowiedź na pytanie o `gosia@` / `marta@`.

---

## W skrócie

1. Na `leads@` działa auto-karta: nowy zewnętrzny nadawca → kontakt + sprawa na lejku → Marta/Gosia (albo Maciej, gdy copywriting).
2. Na `studio@` mail **już wpada** do Twenty (widać wątek), ale **nie** powstaje ani kontakt, ani karta. Przykład: Piotr Godlewski, „wycena logo”, 30.08 godz. 20:36 — mail jest, karty nie ma.
3. W starym CRM (Better Bitrix) `studio@` **nigdy** nie robił auto-leada. Auto-lead był tylko z `leads@` + INBOX. `studio@` = zapis wątku.
4. W planie Twenty zapisaliśmy odważniej: nowy nadawca na `studio@` → kontakt + karta. Tego **nie wdrożyliśmy**.
5. `studio@` to nie to samo co `leads@`. Na studio wpada dużo więcej śmieci i maili operacyjnych (umowy Autenti, faktury, istniejący klient, newslettery). Ślepa kopia `leads@` zaleje lejek.
6. Twenty samo z siebie **nie** robi karty z maila. Robi kontakt (osobę) z maila — i to tylko gdy włączymy to na skrzynce. Kartę trzeba by dodać osobno.
7. Domyślna polityka Twenty na kanale to **„tylko wysłane”**: przy niej **żadna wiadomość przychodząca nie tworzy kontaktu**, także od klienta z domeny firmowej. Zanim ruszy A, B albo C, na `studio@` trzeba przestawić tworzenie kontaktu z maila przychodzącego. Bez tego Godlewski zostaje wątkiem bez osoby, niezależnie od wybranej opcji.

---

## Jak jest dziś

| Skrzynka | Mail w Twenty | Kontakt (osoba) | Karta na lejku |
|---|---|---|---|
| `leads@` | tak | tak (przy auto-karcie) | **tak** — nowy nadawca zewnętrzny |
| `studio@` | tak | **nie** (Godlewski: osoba pusta) | **nie** |
| `gosia@` / `marta@` | tak (sync) | zależnie od ustawień skrzynki | **nie** (świadomie, jak w BB) |
| `kontakt@` | nie obsługujemy | — | — |

Na `leads@` pomijamy: maile wewnętrzne (`@owocni.pl`), nadawcę który **już ma** otwartą sprawę (dopinamy wątek, nie druga karta), oraz to, co nie jest INCOMING na tej skrzynce.

Owner nowej karty z maila: pula Marta/Gosia (copywriting → Maciej). To samo mielibyśmy na `studio@`, jeśli włączymy karty.

Odpowiedź handlowca **zawsze ze swojej skrzynki** (`marta@`, `gosia@`…), nawet gdy klient napisał na `studio@` albo `leads@`. Tego nie ruszamy.

---

## Przykład: Godlewski

30.08, 20:36 — mail na `studio@`, temat **„wycena logo”**, nadawca `piotr.godlewski@fgghip.com`.

- Wątek w Twenty: **jest**
- Osoba w CRM: **brak**
- Karta na lejku: **brak**
- W BB też by nie powstał lead (studio ≠ leads)

To jest sprawa nr 1 do posprzątania, gdy wybierzesz opcję z kartą albo choćby z kontaktem.

---

## Dwie drogi, jeśli ma być karta

Obie robią to samo na końcu (kontakt + sprawa na lejku). Różnią się **sitkiem**.

**Jak `leads@` (twarda bramka)**  
Wpadł mail z zewnątrz na tę skrzynkę → karta. System **nie czyta**, czy to zapytanie, umowa, czy „pobierz podpisany dokument”. Sitko jest tylko: nie nasz domenowy, nie druga karta na tego samego, nie spam-folder.

**Z filtrem (sitko treści)**  
Najpierw: czy to wygląda na zapytanie ofertowe? Śmieci, bounce, Autenti, faktury, wątek istniejącego klienta → **tylko dopiąć mail**, bez nowej karty.

`leads@` ma dziś **twardą bramkę**, nie filtr treści. Na `leads@` to działa, bo ta skrzynka jest prawie czystym wejściem leadów. Na `studio@` — nie.

---

## Opcje

### Opcja A — tylko kontakt, bez karty na lejku

Jak Twenty i jak BB na `studio@`: mail widać przy osobie, **lejek bez nowej sprawy**.

| | |
|---|---|
| **Co** | Włączamy tworzenie kontaktu z maila na `studio@`. Godlewski (i podobni) pojawiają się jako osoby. Karta: **nie**. |
| **Efekt** | Handlowiec znajduje wątek przy osobie / w poczcie. Nikt nie dostaje „nowego leada” z każdego maila na studio. |
| **Ryzyko** | Niska. Zapytanie na `studio@` może umknąć, jeśli nikt nie czyta tej skrzynki w Twenty. |
| **Czas** | krótki (ustawienie skrzynki + ewentualnie ręcznie Godlewski) |

### Opcja B — karta tylko gdy wygląda na zapytanie (rekomendowane)

Sitko treści. Godlewski („wycena logo”) **dostaje kartę**. Mail „Pobierz podpisany dokument Autenti” — **nie**.

| | |
|---|---|
| **Co** | Kontakt z maila **oraz** karta, ale tylko przy zapytaniu ofertowym. Spam, bounce, wewnętrzne, istniejąca otwarta sprawa → wątek, nie druga karta. Produkt z tematu (Godlewski = logo; jak nie wiadomo = INNE). Owner = Marta/Gosia, jak reszta puli. |
| **Efekt** | `studio@` zaczyna karmić lejek, ale nie zalewa go umowami i operacją. |
| **Ryzyko** | Sitko może **odrzucić** echte zapytanie albo **przepuścić** śmieć — trzeba przez pierwszy tydzień zerkać. |
| **Czas** | dłużej niż A (reguła + test na Godlewskim i 2–3 kolejnych) |

### Opcja C — karta jak na `leads@` (każdy nowy nadawca)

Ślepa kopia. Każdy nowy zewnętrzny nadawca na `studio@` = nowa sprawa.

| | |
|---|---|
| **Co** | Ta sama maszyna co `leads@`, druga skrzynka. Bez oceny „czy to zapytanie”. |
| **Efekt** | Nic nie umknie. Lejek zapełni się też Autenti, fakturami, starymi klientami piszącymi na studio. |
| **Ryzyko** | wysokie zaśmiecenie. Marta/Gosia będą zamykać / scalać śmieci. |
| **Czas** | podobny do dzisiejszego `leads@` (krótszy niż B) |

---

## Osobne pytanie: `gosia@` i `marta@`

To **nie** jest to samo co ogólna `studio@`.

W BB auto-lead był tylko z `leads@`. Skrzynka handlowca = praca na istniejących sprawach, nie fabryka nowych kart.

Jeśli włączymy auto-kartę na `gosia@` / `marta@`, każda nowa osoba pisząca bezpośrednio do nich (i dziś nieobecna w CRM) zrobi sprawę na lejku. W tym: klienci w toku, dostawcy, prywatne, DW z `studio@`.

**Rekomendacja:** auto-karty **tylko** na ogólnej `studio@` (jeśli w ogóle B albo C). Skrzynki osobiste — bez auto-karty. Kontakt z maila na ich skrzynkach można włączyć osobno (widać wątek przy osobie), bez nowej sprawy.

---

## Czego ten dokument nie rozstrzyga

Widoki poczty (własna skrzynka, osobny podgląd `studio@`, czy Marta/Gosia widzą surowy `leads@`) — **nie tu**. To osobna decyzja o podglądach. Tu tylko: czy z maila ma powstać karta.

Formularz ze strony — **nie tu**. Inny licznik zdrowia, inna ścieżka.

---

## Czego nie robimy w żadnej opcji

- karta ze spamu / bounce / maila wewnętrznego `@owocni.pl`
- druga karta, gdy ten sam email **już ma** otwartą sprawę (dopinamy wątek)
- odpowiadanie „z `studio@`” — OUT nadal ze skrzynki handlowca
- mieszanie tego z formularzem ze strony (to inny licznik zdrowia; tu nie formularz)

Po Twojej decyzji: Godlewski jako pierwsza sprawa do sprawdzenia (backfill).

---

## Prośba o decyzję

**1. Mail na `studio@` od nowego nadawcy**

- [ ] **A** — tylko kontakt, bez karty na lejku (jak BB, jak Twenty „z pudełka”)
- [ ] **B** — karta, ale tylko gdy wygląda na zapytanie ofertowe *(rekomendacja)*
- [ ] **C** — karta jak na `leads@`: każdy nowy nadawca zewnętrzny

**2. Skrzynki `gosia@` / `marta@`**

- [ ] **Nie** — bez auto-karty (jak BB) *(rekomendacja)*
- [ ] **Tak** — to samo sitko co wybrane dla `studio@`

**Uwagi / wyjątki:**

_……………………………………………………………………………………_

---

**Data decyzji:** …………  
**Podpis:** …………
