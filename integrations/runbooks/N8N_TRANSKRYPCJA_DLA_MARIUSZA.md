---
doc_id: N8N_TRANSKRYPCJA_DLA_MARIUSZA
title: "Transkrypcje rozmów — przepływ, gdzie edytować prompty, wynik testu 10.09"
audience: "Mariusz"
owner: "Dawid"
status: ready_to_send
last_verified: 2026-09-10
---

# Transkrypcje rozmów — przepływ, prompty, test

Nowe nagrania z Play idą przez ElevenLabs Scribe (z podziałem na osoby) i prompty w n8n, potem na kartę Rozmowa w Twenty. Stare karty same się nie poprawią — tylko nowe rozmowy.

Workflow: **Play PBX → GCP CallTranscript**  
https://owocni.app.n8n.cloud/workflow/hAA7hgesnXdBbFcf

---

## 1. Przepływ

```
Centralka Play (nagranie)
  → Cloud Run Job  telefony-play-poller   co 5 min
       pobiera i deszyfruje audio, ffmpeg
       ElevenLabs Scribe v2  (polski, 2 mówców, diaryzacja)
       składa turny i czas mówienia
  → n8n  Play PBX → GCP CallTranscript
       filtr poczty głosowej / za krótki tekst
       Prompt 2 — kto jest Sprzedawcą, kto Klientem
       kod składa transkrypt: CZAS ROZMOWY / Sprzedawca / Klient / timestampy
       Prompt 3 — podsumowanie faktów + mirroring języka klienta
  → worker GCP
  → Twenty  karta Rozmowa
```

Audio **nie** leci przez n8n. n8n dostaje już tekst z rolami `speaker_0` / `speaker_1`. Dzięki temu można stroić jakość zapisu w CRM, a długie WAV-y nie walą timeoutów n8n Cloud.

Nieodebrane omijają n8n — osobna ścieżka, bez transkryptu.

W dokumencie ustawień Scribe „Prompt 1” to parametry modelu (język, 2 mówców, temperatura). To jest w Jobie, nie w n8n. W n8n są **Prompt 2** i **Prompt 3**.

---

## 2. Co zmieniasz — tylko te dwa nody

Otwórz workflow → kliknij nod → **Messages** → wiadomość **system** (ta długa instrukcja).

| Nod | Co steruje | Co ląduje w Twenty |
| --- | --- | --- |
| **Prompt 2 — tożsamość** | Który speaker to pracownik Owocni, które imię z listy, jak nazywa się klient | Etykiety `Sprzedawca: Marta` / `Klient: …` w pełnym transkrypcie |
| **Prompt 3 — mirroring** | Jak model streści fakty i zbierze język klienta | Pole **summary** oraz górna część transkryptu (przed kreską `---`) |

Po zmianie: **Save**, potem **Publish**. Bez Publish produkcja jedzie starą wersją.

**Lista zamknięta pracownika** (Prompt 2 nie może wybrać kogoś spoza niej):

- Marta Słowik
- Gosia Zielińska
- Ewa Malanowska
- Maciej Wysocki

Numer telefonu z centralki jest nadrzędny, gdy należy do tej czwórki. Robert (`48575970640`) nie jest na liście — model ma rozpoznać go tylko z treści rozmowy („Robert z Owocni”).

---

## 3. Czego nie ruszać

| Nod | Po co jest |
| --- | --- |
| Webhook Play | Wejście z Joba |
| Filter + payload | Poczta głosowa / tekst &lt; 100 znaków — przed LLM, żeby nie palić tokenów |
| Pass? | Rozdział: idzie dalej albo do kosza |
| Apply identity | Kod: CZAS ROZMOWY, procenty, `Sprzedawca` / `Klient` |
| Assemble Twenty | Składa `summary` + transkrypt na kartę |
| Enqueue GCP | Zapis do Twenty (ten sam worker co dotychczas) |
| Dropped (noop) | Kosz na odrzucone |

Zmiana formatu JSON wychodzącego z Prompt 2 (inne nazwy pól) rozjedzie **Apply identity**. Treść instrukcji można kręcić; kontrakt wyjścia zostaw.

Scribe (jakość rozpoznawania mowy, liczba mówców, temperatura) — nie tu. To Job, zmiana po stronie Dawida i deploy.

Klucza ElevenLabs **nie wklejać** do n8n ani do Docs. STT jest w Jobie. W n8n są tylko modele od Prompt 2/3.

---

## 4. Co jest na karcie w Twenty

Trzy części:

1. **Podsumowanie faktów** — Prompt 3, sekcja 1  
2. **Mirroring (język klienta)** — Prompt 3, sekcja 2  
3. **Pełny transkrypt** — po kresce `---`: czas rozmowy, czas mówienia, `[MM:SS] Sprzedawca` / `Klient`, na dole `ARCHIWUM SCRIBE: …`

---

## 5. Test 10 września 2026

Job przetworzył 3 nagrania z okna 2h. Wszystkie trzy weszły do n8n (wykonania **577, 578, 579**).

| Nagranie | Co to było | Wynik |
| --- | --- | --- |
| 10:51 · przychodzące na Gosię | Automat: „Do którego dzwonisz, prowadzi w tej chwili rozmowę” (~3 s) | Scribe OK. n8n **odrzucił** (`too_short`) — filtr działa, Prompt 2/3 nie palone |
| 10:21 · Robert → pani Paulina (~48 s) | Follow-up o social media; klientka: remonty się przedłużyły | Scribe z dwiema osobami. Role **trafne** (`Sprzedawca` = Robert). Weszło do kolejki Twenty |
| 10:54 · Robert → pani Ewelina (~30 s) | Follow-up o płatność | Scribe z dwiema osobami. Weszło do kolejki. **Role odwrócone** — klientka („Słucham?”) dostała `Sprzedawca`, Robert `Klient` |

Wniosek: tor działa (audio → Scribe → n8n → kolejka). Diaryzacja jest. Filtr poczty głosowej jest. Pierwsze strojenie, które warto zrobić w n8n, to Prompt 2 na rozmowach Roberta (nie ma go na liście numerów).

W n8n: ten sam workflow → zakładka **Executions** → 577 / 578 / 579.

---

## 6. Co z dokumentu Scribe świadomie nie jest w n8n

- **Scribe** — Job, parametry z pipeline 1.2.0 (m.in. `scribe_v2`, `pl`, 2 mówców, `detect_speaker_roles=false`). Czekanie 90 s + webhook Scribe odpadło: to było obejście timeoutu n8n; Job czeka synchronicznie na plik.
- **Czas mówienia i timestampy** — liczy kod, nie model. Prompt 2 tylko mówi, *kto* jest kim.
- **Zapis do Twenty** — nadal worker (karty, match osoby/szansy, „Do przypięcia”). Tego nie dublujemy klockami n8n.

Jeśli po strojeniu promptów Scribe nadal będzie zjadał zdania — to model STT / ustawienia Joba, nie powrót audio do n8n.
