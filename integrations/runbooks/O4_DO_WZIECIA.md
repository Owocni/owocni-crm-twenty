---
doc_id: O4_DO_WZIECIA
title: "O-4 — czym jest „do wzięcia”"
layer: decision
status: answered
owner: "Dawid"
last_verified: 2026-09-03
related:
  - PLAN_NAPRAWCZY_GATES.md
---

# O-4 — odpowiedź

**„Do wzięcia” to widok tabeli na Opportunity**, nie etap, nie kolumna kanbanu, nie opcja pola.

| | |
|---|---|
| Obiekt | Opportunity |
| Typ | TABLE |
| Id | `fc2d2e30-8f96-4cea-918d-b1ec6aa090b0` |
| Ikona | `IconHandStop` (ta sama co przycisk Biorę) |
| Widoczność | workspace |

Usunięcie albo ukrycie tego **widoku nie zeruje etapu na kartach**.

## Dlaczego Maciek widzi pusto, a Biorę działa

To dwa byty:

1. Widok „Do wzięcia” — kolejka (u niego pusta m.in. dlatego, że nie jest w parze Marta/Gosia, R-8).
2. Przycisk **Biorę** — pinned manual workflow na każdej karcie Opportunity. Działa z lejka niezależnie od widoku.

## Czy Twenty schowa Biorę po kliknięciu

**Nie.** Manual trigger ma tylko Global / Single / Bulk + pinned. Nie ma warunku „ukryj gdy workflow już wykonany” ani „ukryj gdy `bizAckAt` jest wypełnione”. Przycisk zostaje. Ponowny klik to kolejny `lead_ack`.

Żeby zniknął z paska: odpiąć (Unpin) — wtedy zostaje w Cmd+K, nadal na każdej karcie.
