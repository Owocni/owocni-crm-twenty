---
doc_id: MACIEJ_MAILBOX_SWAP_DECISION
title: "Decyzja Mariusz — czy odwracać role skrzynek Macieja (copywriting@ / maciej@)"
layer: runbook
status: awaiting_mariusz
owner: "Dawid"
audience: "Mariusz"
last_verified: 2026-09-08
related:
  - E12_EMAIL_SYNC_EXECUTION.md
  - ../../owocni-crm/IDENTITY_AND_INBOUND.md
  - PLAN_NAPRAWCZY_GATES.md
  - ../../owocni-crm/DECISION_REGISTER.md
source: "pytanie operacyjne 8.09.2026 — podmiana skrzynki sprzedaży Macieja bez utraty leadów i historii"
---

# Skrzynki Macieja — czy odwracać `copywriting@` i `maciej@`?

**Do:** Mariusz  
**Od:** Dawid  
**Data:** 8.09.2026  
**Status:** czeka na Twoją decyzję. **Sugestia: nie odwracać.** Dziś nic nie odłączamy i nic nie kasujemy.

**Pytanie:** Maciej loguje się jako `maciej@owocni.pl`, a sprzedaż w CRM idzie z `copywriting@owocni.pl` (`maciej@` = projekty). Czy porządkujemy to „po imieniu (sprzedaż z `maciej@`, projekty z `copywriting@`), czy zostawiamy jak działa.

---

## W skrócie

1. Dziś układ jest **niesymetryczny w nazwach**, ale **spójny w działaniu**: CRM + Odpowiedz = `copywriting@`, projekty = `maciej@`. Klienci, stopka, Owocni Mail i historia wątków są na `copywriting@`.
2. Odwrócenie ról jest **technicznie możliwe**. Nie kasuje kart na lejku. Nie wymaga kasowania adresu `copywriting@`.
3. **Pełne** odwrócenie (sprzedaż naprawdę „mieszka” w `maciej@`, projekty w `copywriting@`) wymaga **przeniesienia wszystkich wiadomości w obie strony**: sprzedaż z `copywriting@` → `maciej@` **oraz** projekty z `maciej@` → `copywriting@`. To jest duży koszt. Taniej byłoby tylko wtedy, gdyby hostingodawca **u siebie** podmienił / przemianował te dwie skrzynki (tego nie zakładamy — trzeba by pytać theCamels).
4. **Sugestia: nie robić tego.** Koszt i ryzyko (historia, From, foldery, kontakty projektowe w CRM) są niewspółmierne do zysku. Obecny układ działa.
5. Zysk z odwrócenia to głównie **czytelność adresu** (From = `maciej@`). Operacyjnie sprzedaż już działa.
6. Jeśli mimo to zdecydujesz „odwracamy” — da się to zrobić ostrożnie. Poniżej są problemy, które wtedy bierzemy na siebie.

---

## Jak jest dziś (i czemu to działa)

|                                    | Sprzedaż (CRM)                        | Projekty           |
| ---------------------------------- | ------------------------------------- | ------------------ |
| Skrzynka                           | `copywriting@owocni.pl`               | `maciej@owocni.pl` |
| Login Macieja w Twenty             | `maciej@owocni.pl`                    | —                  |
| Wysyłka z przycisku Odpowiedz      | zawsze `copywriting@` (twarda reguła) | poza CRM           |
| Historia wątków sprzedaży w Twenty | przy kanale `copywriting@`            | nie dotyczy        |

Karty na lejku **nie wiszą na skrzynce**. Copywriting i tak idzie na Macieja po użytkowniku. Formularz / `leads@` nie zależy od `copywriting@`.

To, co wygląda „niechlujnie” (login `maciej@`, From `copywriting@`), jest **świadomą regułą**, nie błędem. Dzięki niej Maciej odpowiada z tej samej skrzynki, na którą klienci piszą od lat.

---

## Co dałoby odwrócenie

|                                            | Dziś               | Po odwróceniu                                       |
| ------------------------------------------ | ------------------ | --------------------------------------------------- |
| Sprzedaż w Twenty (From / nowe odpowiedzi) | `copywriting@`     | `maciej@`                                           |
| Stare wątki sprzedaży w Twenty             | `copywriting@`     | nadal `copywriting@` (inaczej ginie historia w CRM) |
| Projekty (Thunderbird)                     | `maciej@`          | `copywriting@` — albo zostają na `maciej@`          |
| Adres `copywriting@` na hostingu           | skrzynka sprzedaży | musi zostać (stare odpowiedzi klientów)             |

Nawet po „udanym” odwróceniu **nigdy nie będzie jednej skrzynki**. Stare maile sprzedaży mają From = `copywriting@`. Klient, który kliknie Odpowiedz u siebie, nadal wyśle na copywriting. Trzeba by przez lata trzymać obie skrzynki w CRM albo gubić te odpowiedzi.

---

## Rekomendacja: zostawić jak jest (opcja A)

Nie podpinamy `maciej@` do sprzedaży. Nie ruszamy Owocni Mail. Nie mieszamy projektów z `copywriting@`. Maciej dalej sprzedaje z `copywriting@`, projekty prowadzi z `maciej@`.

**Dlaczego:**

- Zero przenoszenia historii IMAP w obie strony.
- Zero ryzyka, że kontakty projektowe z `maciej@` wpadną do Twenty.
- Zero ryzyka utraty historii w Twenty i pomyłki From przy Odpowiedz.
- Zero okresu, w którym część klientów odpisuje na `copywriting@`, a część na `maciej@`.
- Zero filtrów folderów w Thunderbirdzie, które ktoś musi pamiętać.
- Login `maciej@` + skrzynka sprzedaży `copywriting@` to już znany układ (cutover, Owocni Mail, stopka).

**Cena zostawienia:** adres From przy sprzedaży nadal brzmi `copywriting@`, nie `maciej@`. Jeśli to przeszkadza wizerunkowo — to jedyny realny powód, żeby iść w B.

---

## Opcja B — odwrócić (możliwe, nie rekomendowane)

Gdyby jednak zdecydować „sprzedaż z `maciej@`”:

| Krok | Co trzeba zrobić                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 1    | Podpiąć `maciej@` w Twenty (Inbox + Sent, pełna treść) **obok** `copywriting@` — nie zamiast          |
| 2    | Na `copywriting@` wyłączyć tworzenie kontaktów z maila                                                |
| 3    | Zdjąć w Owocni Mail regułę „Maciej → From = copywriting@”                                             |
| 4    | Stopka: widoczny adres = `maciej@`                                                                    |
| 5    | Jeśli projekty idą na `copywriting@`: folder `Projekty` w Thunderbirdzie, **wyłączony** z sync Twenty |
| 6    | Filtr: stare odpowiedzi sprzedaży → Inbox (to CRM ma widzieć)                                         |

`copywriting@` **zostaje podpięte**. Odłączenie kasuje historię maili **w CRM** (na serwerze poczty zostają).

To jest wariant **bez** pełnej zamiany treści skrzynek — nowe From, stara historia zostaje na `copywriting@`. Pełne odwrócenie (punkt niżej) jest droższe.

---

## Problemy i koszty, jeśli odwracamy

To nie jest „podmiana adresu w ustawieniach”. To rozplecenie dwóch ról, które dziś są czysto rozdzielone.

**Pełna zamiana treści — wszystkie wiadomości w obie strony**

Żeby skrzynki naprawdę zamieniły się rolami (nie tylko From w CRM):

- **wszystkie** maile sprzedaży z `copywriting@` muszą trafić do `maciej@`,
- **wszystkie** maile projektowe z `maciej@` muszą trafić do `copywriting@`.

To tysiące wątków, Inbox + Sent + foldery, w dwie strony, bez pomylenia sprzedaży z projektem. Ręczne / skryptowe kopiowanie IMAP jest długie i łatwo o duplikat albo lukę. Twenty przy podpięciu `maciej@` zassie **to, co w tej chwili leży w tej skrzynce** — jeśli nie przeniesiemy projektów wcześniej, wciągnie historię projektową.

Jedyna tańsza ścieżka: **hostingodawca (theCamels) podmienia skrzynki u siebie** — np. zamienia magazyny IMAP za adresami albo przemianowuje obie. Tego nie umiemy z CRM. Trzeba pytać, czy w ogóle się da, co z hasłami, aliasami i Thunderbirdem. Jeśli **nie da się** — zostaje kosztowna kopia w obie strony. Dlatego sugestia: nie odwracać.

**Kontakty projektowe wpadają do Twenty**

`maciej@` dziś **nie** jest skrzynką sprzedaży w CRM. Są tam klienci **w projekcie**. Projekt = wcześniej był lead.

Jeśli podpinamy `maciej@` do Twenty (żeby sprzedaż szła z tego adresu), Email Sync wciąga tę skrzynkę:

- każdy dotychczasowy nadawca projektowy może pojawić się w Twenty jako **osoba / ruch przy leadzie**,
- auto-create robi **nowy kontakt**; nawet przy wyłączonym auto-create mail i tak dopina się do **istniejącej karty** (bo ten klient już był na lejku),
- na lejku widać wtedy korespondencję **projektową** jakby to była sprzedaż — szum, mylące „do odpisania”, pomyłka etapu.

Sitko folderów tego w pełni nie zdejmuje, jeśli historia projektów już siedzi w Inbox/Sent `maciej@` w momencie pierwszego sync.

**Historia i odłączenie**

- Odłączenie `copywriting@` z Twenty **kasuje wątki z kart** (maile zostają na IMAP). Tego nie wolno robić jako pierwszego kroku.
- Nawet bez odłączania: dwa kanały w CRM (stare = copywriting, nowe = maciej) — na karcie klienta widać obie skrzynki. Łatwiej o pomyłkę „z której odpowiadam”.

**Wysyłka**

- Dopóki `copywriting@` jest podpięte i nie zdejmiemy reguły w Owocni Mail, **Odpowiedz i tak wyśle z copywriting**. Podpięcie `maciej@` samo z siebie nic nie zmienia.
- Po zdjęciu reguły: nowa sprzedaż z `maciej@`, stare wątki — klient nadal pisze na `copywriting@`. Przez miesiące (lata) dwa strumienie odpowiedzi.

**Projekty vs sprzedaż (jeden Inbox)**

- `copywriting@` to **jedna** skrzynka. Twenty i Thunderbird widzą ten sam Inbox.
- Mail projektowy do kogoś, kto **już jest** w CRM, wpadnie na kartę sprzedaży. Wyłączenie tworzenia leadów tego nie zatrzymuje — blokuje tylko **nowe osoby**.
- Sitko = folder `Projekty` poza sync + dyscyplina Macieja. Jeden mail wrzucony w Inbox = projekt na lejku.

**Ludzie i narzędzia**

- Stopka, Owocni Mail, mapowanie skrzynek (E12, kierunek maila, julia362 jeśli jeszcze żyje) — kilka miejsc do poprawy naraz. Jedno pominięte = zły From albo martwa wysyłka.
- Okres cięcia: Maciej musi wiedzieć, z której skrzynki sprzedaje, z której robi projekt, i nie pomylić folderów.

**Czego odwrócenie nie naprawia**

- Starych maili u klientów (From nadal `copywriting@`).
- Kart na lejku (i tak są Macieja).
- Formularza / `leads@`.

**Szacunek kosztu vs zysk**

|        | Zostawić (A) | Odwrócić (B)                                                                 |
| ------ | ------------ | ---------------------------------------------------------------------------- |
| Praca  | zero         | **kopia wszystkich maili w obie strony** (albo pytanie do theCamels o podmianę skrzynek) + Owocni Mail + stopka + foldery + test Odpowiedz |
| Ryzyko | brak zmiany  | kontakty projektowe w Twenty / na lejku, zły From, historia z kart, dwa strumienie odpowiedzi, luka przy kopiowaniu IMAP |
| Zysk   | —            | ładniejszy From (`maciej@`) przy **nowej** sprzedaży                         |

---

## Czego nie robimy w żadnej opcji

- kasowania `copywriting@` na `mail.owocni.pl` (klienci nadal tam odpisują)
- odłączania `copywriting@` z Twenty bez świadomej zgody, że historia zniknie z kart
- auto-kart z maila na skrzynce handlowca (fabryka kart = `leads@` / formularz)

---

## Prośba o decyzję

**Skrzynki Macieja**

- [ ] **A** — zostawić jak jest: sprzedaż = `copywriting@`, projekty = `maciej@` _(sugestia)_
- [ ] **B** — odwrócić (pełna zamiana treści skrzynek albo podmiana u hosta, jeśli w ogóle się da; `maciej@` w Twenty = ryzyko kontaktów projektowych na lejku) _(możliwe, koszt i ryzyka jak wyżej)_

Jeśli B: czy projekty na pewno mają iść na `copywriting@`, czy zostają na `maciej@` (wtedy odwracamy tylko sprzedaż w CRM)?

- [ ] projekty → `copywriting@` (folder poza Twenty)
- [ ] projekty zostają na `maciej@`

**Uwagi / wyjątki:**

_……………………………………………………………………………………_

---

**Data decyzji:** …………  
**Podpis:** …………
