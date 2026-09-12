---
doc_id: MAIL_EDITOR_REBUILD_20260912
title: "Owocni Mail 0.1.133 — rollback do wysyłki z 11.09 ~10:17 (0.1.128/0.1.121)"
layer: runbook
status: live_0.1.133_morning_send_path
owner: "Dawid"
last_verified: 2026-09-12
related:
  - QUEUE_TRIAGE_20260912.md
  - QUEUE_TRIAGE_T1_CHAT_20260912.md
source: "Plan Mariusza = epik osobno; ten slice = cofnięcie filtrów z 0.1.123+"
---

# Owocni Mail

Plan Mariusza (cały composer w iframe, natywne `sendEmail`) zostaje **osobnym epikiem**. Nie wycinamy go na żywo.

## Co się zepsuło ~10:20 w piątek

| Czas | Wersja | Skutek |
|---|---|---|
| ~10:17 11.09 | **0.1.121** / git HEAD 0.1.128 | Iframe `srcDoc` **z tokenem** (remount). Autosave szkicu. Flush czyta szkic ≠ ziarno. Wysyłka idzie. |
| ~10:20+ | **0.1.122** | Iframe bez przebudowy — tekst zostaje w oknie, ale React/send nie widzi edycji. |
| 0.1.123+ | ACK + blokada „pusta treść” | Gosia nie może kliknąć Wyślij. Sobota: toast *sama stopka, cytat albo placeholder*. |
| 0.1.129–132 | ten sam filtr + brak tokenu w srcDoc | Edytor widać, send = toast. |

**0.1.133** = kod wysyłki i edytora z git `HEAD` (0.1.128 = zachowanie 0.1.121). Bez `isUnintendedEmptyReply` na przycisku. Szkic z API znowu może dokleić treść, gdy keepalive obetnie body.

## Odbiór

1. Cmd+Shift+R.
2. Test na `test9959058@fastman.eu`: wpisać zdanie, poczekać ~2 s (autosave po tokenie), Wyślij.
3. Oferty do żywych klientów: nadal Thunderbird, aż plan Mariusza.
4. Nie wracać do 0.1.123 / 0.1.131.
