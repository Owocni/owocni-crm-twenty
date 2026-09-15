---
doc_id: SMS_COMPOSER_V1
title: "SMS przy mailu — composer v2 + SMSAPI"
layer: runbook
status: live_needs_token
owner: "Dawid"
last_verified: 2026-09-15
live_version: "0.1.150"
related:
  - COMPOSER_V2_20260912.md
  - DATA_MODEL.md
source: "Plan Mariusza 15.09.2026; arkusz Firmao Dawida"
---

# SMS przy „Wyślij email” (v1)

**Po co:** ten sam gest co w Firmao / BB — przy wysyłce oferty można dołożyć SMS. Treści z Firmao 1:1, plus puste okno (dziewczyny często piszą własny tekst).

**Poza v1:** automaty ze statusu / terminu, konwersacje SMS, wpływ na „Do odpisania” / `lastContactAt` / etap.

## Gest

W ramce composera v2, obok **Wyślij email**:

1. Przycisk **SMS** (domyślnie wyłączony).
2. Panel: numer (`Telefon` z karty, da się poprawić) + textarea + 4 szablony z arkusza.
3. Klik szablonu **włącza** SMS i wkleja treść — potem wolno edytować.
4. SMS leci tylko gdy panel jest włączony **i** treść niepusta. Zły / pusty numer = stop **przed** odliczaniem; mail nie wychodzi.
5. Błąd SMS **nie cofa** maila. Status: `Mail wysłany · SMS wymaga sprawdzenia`. Na leadzie i tak jest notatka.

## Token

Nie w kodzie. Po deployu Owocni Mail **0.1.150**:

Twenty → Settings → Applications → **Owocni Mail** → zmienna **`SMSAPI_OAUTH_TOKEN`** (sekret).  
Wklej z Bitwardena. `better-bitrix-main/.env` zostaw — BB jeszcze wysyła.

Nadawca: `Owocni.pl` (aktywne w SMSAPI).

## Ślad

Notatka na Opportunity: `SMS · wysłany|błąd · +48…`, treść która faktycznie poszła, id SMSAPI albo powód.  
**Nie** rusza `isFollowUp`, `lastContactAt`, stage.

## Test

Karta [test9959058@fastman.eu · Strona](https://zany-maroon-panther.twenty.com/object/opportunity/a88aa583-646d-41f2-944f-20c988f63e3f), telefon `+48790359039`.

1. Cmd+Shift+R, wersja **0.1.150**.
2. Odpowiedz / Nowy mail → **SMS** → szablon albo własny tekst → wyślij.
3. SMS dochodzi z `Owocni.pl`.
4. Na karcie notatka. Mail też wyszedł.
5. Bez zaznaczenia SMS — tylko mail.

## Arkusz szablonów

https://docs.google.com/spreadsheets/d/18bspM9_ApK-DJ3EaE4qGls0hmhnyPirZ4gurtHmhu_Q/edit
