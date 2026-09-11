---
doc_id: ARCHIWUM_BIURO_PLAN
title: "Archiwum biurowe — SMB faktury + Open Archiver (studio@)"
layer: runbook
status: decision_closed — implementation not_started
owner: "Dawid"
audience: "Dawid + Mariusz; SOP dla Marty/Gosi/Kingi"
last_verified: 2026-09-11
related:
  - MACIEJ_MAILBOX_SWAP_DECISION.md
  - CUTOVER_MAIL_HISTORY_DECISION.md
  - E12_EMAIL_SYNC_EXECUTION.md
source: "Wyprowadzka Firmao 11.09.2026; decyzja poczty: Open Archiver 11.09.2026"
---

# Archiwum biurowe — SMB + Open Archiver

**Po co:** po wyłączeniu Firmao Marta (i reszta) musi w 30 sekund znaleźć duplikat FV, korektę albo mail sprzed 3 lat — po **nazwie klienta** albo numerze. Nie w CRM, nie w Thunderbirdzie.

**Gdzie — decyzja 11.09:**

| Co | Gdzie | Jak szukają ludzie |
|---|---|---|
| Faktury (PDF, 5 lat) | udział SMB na PC biurowym | folder klienta + `INDEKS_FAKTUR.xlsx` |
| Poczta `studio@` (i ewent. kolejne skrzynki) | **Open Archiver** na tym samym PC | przeglądarka w LAN, `http://biuro-pc:3000` |

**Czego tu nie ma:** nowych faktur (Fakturownia / Twenty) i żywej poczty do pisania (IMAP / Twenty). To jest **kopia do czytania**, nie drugi CRM.

---

## 1. Zasada, od której zależy wygoda

Szukanie „po kliencie” na udziale sieciowym **nie polega na Spotlight**. Spotlight i Windows Search na SMB działają słabo albo wcale.

Dlatego:

1. **Folder per klient** — otwierasz `Faktury/wg_klienta/Nazwa/` i widzisz wszystko.
2. **Nazwa pliku zawiera klienta + numer + datę** — wystarczy wpisać w pasek wyszukiwania okna (Finder filtruje bieżący folder).
3. **Excel `INDEKS_FAKTUR.xlsx`** — pewne szukanie: filtr, sort, „nieopłacone”. CSV z eksportu **nie otwierać z Excela i zapisywać** (zamieni `1535/2025` na datę). Indeks robimy osobnym xlsx.

Jeden PDF leży na dysku **raz**. Widok „wg klienta” i „wg roku” to twarde linki (hardlink) na tym samym komputerze — zero podwójnego miejsca.

---

## 2. Udział — jak to podłączyć

| | |
|---|---|
| Protokół | **SMB** (działa z Windowsa i Maca) |
| Adres (przykład) | Windows: `\\BIURO-PC\ArchiwumOwocni` · Mac: `smb://biuro-pc/ArchiwumOwocni` |
| Uprawnienia | wszyscy: **tylko odczyt**. Zapis: konto admina na tym PC (Dawid / Kinga) |
| Sen | komputer **zawsze włączony**, wyłączone uśpienie dysków |
| Sieć | kabel, stały IP albo nazwa w DNS/Bonjour |

Dwa widoki uprawnień, jeśli da się bez kombinowania:

- `ArchiwumOwocni` — tylko **faktury** (codzienna robota)
- `ArchiwumOwocni_Surowo` — JSON, logi, hashe — tylko admin (nie do klikania)
- Poczta **nie** idzie na SMB — tylko Open Archiver

Druga kopia (obowiązkowa, 5 lat): dysk T5 / szafa, **nie** ten sam komputer. Retention jak przy starym programie: po roku można skasować najstarszy rocznik z kopii roboczej, kanon zostaje do 5 lat.

---

## 3. Układ folderów

```
ArchiwumOwocni/
├── CZYTAJ_TO.txt
├── INDEKS_FAKTUR.xlsx
├── Faktury/
│   ├── wg_klienta/
│   │   ├── IETT_AS/
│   │   │   ├── 2019-03-05__FV_152-2019__SPRZEDAZ.pdf
│   │   ├── Pralnia_Chemiczna_Julita_Jaworska/
│   │   └── _BRAK_NAZWY/
│   ├── wg_roku/
│   │   ├── 2019/SPRZEDAZ/
│   │   ├── 2019/ZAKUP/
│   │   └── …
│   ├── _NIEOPLACONE/          ← skróty do otwartych FV (P0 Marty)
│   └── _USUNIETE/
└── _Surowo_Firmao/            ← nie udostępniać na co dzień
    ├── json/  manifest_faktury.csv  log.txt  podsumowanie.txt
```

Poczta jest w Open Archiver, nie w tym drzewie.

### Faktury — nazwa pliku

Wzorzec (to widzi Finder):

`RRRR-MM-DD__TYP_numer__SPRZEDAZ-lub-ZAKUP.pdf`

Przykład: `2026-03-15__FV_1233-2026__SPRZEDAZ.pdf` w folderze klienta.

Slug folderu klienta: bez `/ \ : * ?` , spacje → `_`, max ~60 znaków. Konflikty nazw (`IETT AS` vs `iett as`) → jeden folder. Ten sam NIP / ta sama nazwa z manifestu = ten sam folder.

Źródło nazw: kolumna `kontrahent` z `manifest_faktury.csv` (już jest w eksporcie).

### Poczta — Open Archiver (przyjęte 11.09)

**Przyjęte.** Self-host na PC biurowym: [Open Archiver](https://github.com/LogicLabs-OU/OpenArchiver) (AGPL). GUI + Meilisearch. Źródło: [docs](https://docs.openarchiver.com/).

Odrzucone: foldery `.eml` na SMB · MailStore Home (zakaz na pocztę firmową i `studio@`) · mail-archiver/s1t5 (brak indeksu załączników) · wlanie archiwum do Twenty · MailStore Server (nie jako plan B).

| Potrzeba | Jak |
|---|---|
| Szukaj po kliencie / adresie / temacie | pasek + filtry from/to/data/skrzynka |
| Szukaj w treści i w PDF w załączniku | indeks body + PDF/DOCX/XLSX |
| Otwórz wątek | podgląd + wątek z boku |
| Kilka osób w LAN | przeglądarka, bez instalacji na Macu/Windowsie |
| Bez kasowania | `ENABLE_DELETION=false`; Marta/Gosia/Maciej/Kinga = `read`+`search` |
| Nie ruszać IMAP | ingest = **kopia** z `mail.owocni.pl`. Nic nie przenosić w Thunderbirdzie |

**LAN (żeby weszło z innych komputerów, nie tylko z tego PC):**

1. Docker Compose, autostart, komputer nie usypia.
2. `.env`: `APP_URL` i `ORIGIN` = `http://<IP-LAN-PC>:3000` — **nie** `localhost`.
3. Zapora: port 3000 **tylko LAN**, nie internet.
4. Pierwsze wejście = konto admina (Dawid). Reszta: osobne loginy, rola audytora.
5. Źródło IMAP `studio@` (kopia, bez delete). Ciągły sync = archiwum się dopisuje; Twenty zostaje do pisania.

Wymagania: Docker, **≥ 4 GB RAM** wolne. UI bez polskiego (EN/DE/…). Hasła IMAP tylko u admina, nie w Open Archiver u Marty.

---

## 4. Jak szukać (SOP na `CZYTAJ_TO.txt`)

**Faktura, znam klienta**  
`Faktury/wg_klienta/` → folder → plik.

**Faktura, znam numer** (np. `1535/2025`)  
Otwórz `INDEKS_FAKTUR.xlsx` → filtr kolumny Numer. Albo Finder w `Faktury/` wpisz `1535-2025`.

**Nieopłacona**  
Folder `_NIEOPLACONE` albo filtr w indeksie (kolumna Status).

**Mail do klienta**  
Przeglądarka → Open Archiver → w wyszukiwarkę nazwa / adres / fragment treści. Filtr nadawcy albo daty, jeśli trzeba.

**Czego nie robić:** nie przenosić plików między folderami (zerwą się linki). Nie zapisywać indeksu „na czata” z CSV. Nie wrzucać tu nowych FV z Fakturowni bez osobnej decyzji (roczna zrzutka — tak; codzienny sync — nie).

---

## 5. Komputer biurowy — minimum

- Dysk lokalny, nie „Dokumenty iCloud” i nie OneDrive jako jedyna kopia.
- SMB udostępniony, goście: konto firmowe bez hasła admina.
- Wyłączone uśpienie; po restarcie share wstaje sam.
- Indeksowanie Windows Search **na serwerze** (opcjonalne, przyspiesza szukanie z PC Windows). Mac i tak polega na folderach.
- Docker Desktop (albo Docker Engine) — pod Open Archiver. ≥ 4 GB RAM wolne poza resztą.
- Miejsce: faktury z tego eksportu to rząd **1–3 GB**. Indeks `studio@` w Open Archiver może być **dziesiątki GB** — zmierzyć skrzynkę przed ingestem.
- Ten PC nie jest backupem sam w sobie. T5 (albo drugi dysk w szafie) = kopia 2.

---

## 6. Kolejność robót (po eksporcie Firmao)

Eksport na T5 zostawiamy jako kanon surowych PDF-ów (`faktury/SPRZEDAZ/RRRR/MM/…`). Widok dla ludzi: `ARCHIWUM-FIRMAO/Dla_ludzi/` (11.09). Na PC biurowym w przyszłym tygodniu: SMB + Open Archiver.

| # | Co | Kto | Stan 11.09 |
|---|---|---|---|
| 1 | PDF-y + odbiór w panelu | skrypt / Dawid | **DONE** — 15 377 OK. Zakupy pusto. Brak zakładki usunięte. |
| 2 | Druga kopia całego `ARCHIWUM-FIRMAO` | Dawid | do zrobienia (nie ten sam dysk) |
| 3 | SMB na PC biurowym | Dawid + Kinga | przyszły tydzień |
| 4 | Skopiować `Dla_ludzi/` + kanon `faktury/` na PC | Dawid | przyszły tydzień |
| 5 | Widok klienta + `INDEKS_FAKTUR.xlsx` + `_NIEOPLACONE` | skrypt `zbuduj_widok_ludzi.py` | **DONE** na T5 (`Dla_ludzi/`) |
| 6 | Docker: Open Archiver; konta read/search | Dawid | przyszły tydzień |
| 7 | Ingest IMAP `studio@` (kopia, bez delete) | Dawid | przyszły tydzień |
| 8 | 15 min z Martą | Marta | po komputerze-archiwum |
| 9 | Po roku: najstarszy rocznik z kopii roboczej | Mariusz | później |

Krok 7 świadomie **nie** idzie przez produkcyjny Thunderbird. Marta ma 4809 nieodebranych; przenoszenie do podfolderów psuje zasysanie. Open Archiver zaciąga kopię IMAP; skrzynka produkcyjna nietknięta.

---

## 7. Indeks Excel — kolumny minimum

`INDEKS_FAKTUR.xlsx` (UTF-8, numer jako **tekst**):

Klient · Numer · Typ (FV / korekta / proforma / …) · Sprzedaż/Zakup · Data · Brutto · Waluta · Status płatności · Ścieżka pliku · Id Firmao

Filtry, które Marta realnie kliknie: Klient, Numer, rok, Status = nieopłacone.

Źródło statusu: pole z API (`actualPaymentDate` / pozostało do zapłaty) — dociągnąć przy budowie indeksu, nie ręcznie.

---

## 8. Świadomie poza tym planem

- Import starych FV do **Fakturowni** — nie. Fakturownia = nowe dokumenty.
- Wlanie archiwum `studio@` do Twenty — nie (to ten sam problem co z `maciej@` / `pomoc@`: pierwszy sync wciąga całość i już nie wyjmiesz).
- Google Drive / Docs jako jedyne archiwum prawne — nie.
- Żywe foldery IMAP / `.eml` na udziale SMB — nie. Poczta = wyłącznie Open Archiver.
- Open Archiver na internecie — nie. Tylko LAN.
- MailStore Home / MailStore Server — nie (decyzja: Open Archiver).

Nowe faktury od cutoveru: Fakturownia. SMB = historia FV. Open Archiver = historia `studio@`.

---

## 9. Kryterium „gotowe”

Marta bez pomocy:

1. Znajduje FV po nazwie klienta.
2. Znajduje `1535/2025` (albo inny numer z indeksu) i otwiera PDF.
3. W Open Archiver znajduje mail po nazwie klienta / adresie / fragmencie treści i otwiera wątek.
4. Nie musi logować się do Firmao ani odświeżać Thunderbirda.

Dopiero wtedy można wyłączyć konto Firmao.
