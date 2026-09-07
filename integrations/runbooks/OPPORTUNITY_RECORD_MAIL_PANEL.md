---
doc_id: OPPORTUNITY_RECORD_MAIL_PANEL
title: "Karta Opportunity — wątek + Odpowiedz (RECORD_PAGE Owocni)"
layer: runbook
status: in_progress
owner: "Dawid"
last_verified: 2026-09-04
related:
  - E12_3_EMAIL_TEMPLATE_STRATEGY.md
  - BUILD_CALL_TRANSCRIPT_TWENTY_SCHEMA.md
  - KANBAN_CARD_SPEC.md
  - ../../apps/owocni-mail-twenty
---

# Karta Opportunity — własny RECORD_PAGE

Klik w kartę kanban otwiera **side panel** (zakładka Mail: ostatni wątek + lista + duży **Odpowiedz**). Pełna strona (pola z lewej, edytor z prawej) dopiero po tym przycisku — `navigate(RecordShowPage)`. `openRecordIn=SIDE_PANEL` na obiekcie i widokach lejka. Layout Owocni zastępuje standardową kartę; **Rozmowy** zostają.

## Archiwum — jak się cofnąć

Stara ścieżka **nie jest usunięta**:

| Co | Stan po wdrożeniu |
|---|---|
| Command menu **Odpowiedz** (pinned) | działa jak dotychczas — composer w command panelu |
| Command **Szablony maili** (GLOBAL) | bez zmian |
| `template-picker` FC `2d49aa61-…` | bez zmian identyfikatora |
| `deploy_opportunity_rozmowy_tab.py` | dopina Rozmowy do **naszego** layoutu, gdy istnieje; inaczej do systemowego |

**Rollback layoutu (karta znowu Twenty-default):**

1. Usunąć plik `apps/owocni-mail-twenty/src/page-layouts/opportunity.page-layout.ts` (albo wyłączyć go z builda).
2. `yarn twenty apply` (albo dotychczasowy patched deploy) — znika niesystemowy `RECORD_PAGE`.
3. Front Twenty wraca na layout systemowy (`isSystemSideEffect`).
4. `python3 integrations/tools/deploy_opportunity_rozmowy_tab.py` — wraca zakładka Rozmowy na standardzie, jeśli jej tam nie ma.
5. Pinned **Odpowiedz** zostaje — handlowcy wracają do command menu.

Nie kasować UUID z `universal-identifiers.ts` przy rollbacku jednorazowym (kolejny apply z tym samym plikiem odtworzy ten sam layout). Kasować tylko gdy świadomie porzucamy encję.

**Nie obiecujemy:** zamknięcie karty przeglądarki w trakcie 15 s = wysyłka. v1: zamknięcie **panelu Twenty** / zejście ze strony rekordu przy uzbrojonej wysyłce.

## Layout

Plik: `apps/owocni-mail-twenty/src/page-layouts/opportunity.page-layout.ts`

| Zakładka | position | Treść |
|---|---|---|
| Home | 10 | pasek SQL/odrzuć + `FIELDS` (Lead / Status / Więcej) |
| Mail | 15 | `CANVAS` + FC `opportunity-mail-panel` — **default w panelu/mobile** |
| Notes | 16 | natywny widget `NOTES` |
| Timeline | 17 | natywny widget `TIMELINE` |
| Tasks | 18 | natywny widget `TASKS` |
| Rozmowy | 20 | relacja `callTranscripts` (`FIELD` / `CARD`) |

Warunek: **jeden** niesystemowy `RECORD_PAGE` na Opportunity.

Po każdym `deploy_owocni_mail_patched.py` odpal `deploy_opportunity_record_page.py` (app sync zeruje `viewId` na widgecie FIELDS).

## Pełne okno + lewa kolumna + przyciski

Skrypt: `integrations/tools/deploy_opportunity_record_page.py`

| Co | Jak |
|---|---|
| Klik kanban → side panel | `opportunity.openRecordIn = SIDE_PANEL` + to samo na widokach lejka |
| Odpowiedz w panelu → pełna strona | `navigate(RecordShowPage)` — URL `/object/opportunity/:id` |
| Pola z lewej | widget FIELDS → widok `Opportunity Record Page Fields`; grupy **Lead / Status / Więcej** |
| Kolejność przycisków | `commandMenuItem.position` (workflowy miały wszystkie `0` — stąd inna kolejność u każdego) |

Kolejność akcji: Odpowiedz → Przyjmij jako SQL → Wystaw dokument → Wystaw fakturę → Odrzuć leada → Scal z leadem.

**SQL / Odrzuć (app, nie natywny workflow):** natywne pinned workflowy zawsze wiszą. Nasze command itemy mają `conditionalAvailabilityExpression` — **Przyjmij jako SQL** znika gdy `bizSqlConfirmed`, **Odrzuć leada** znika gdy `campaignRejected`. Lewa kolumna (Home) pokazuje ten sam stan: SQL jako chip z `bizSqlConfirmedAt`; odrzucenie jako nieaktywny chip z `rejectionReason` (osobnej daty odrzucenia w modelu nie ma). Natywne workflowy są odpięte z paska (zostają w ⌘K jako rollback).

**Nie obiecujemy:** jeśli handlowiec sam przeciągnie przyciski w swoim menu, Twenty może zapisać jego kolejność lokalnie — wtedy twardy refresh nie cofnie gestu. Workspace-default jest stały.

## FC

| Surface | Komponent | Zachowanie |
|---|---|---|
| `record-page` | `opportunity-mail-panel.tsx` | wąski panel = wątek + Odpowiedz; szeroka strona = dwie kolumny + composer |
| `command-menu` | `template-picker.tsx` (archiwum) | dotychczasowy composer w command panelu |

Id rekordu: `useSelectedRecordIds()[0]`. **Odpowiedz w sidebarze** to hostowy `<a href="/object/opportunity/:id?owocniCompose=1" target="_top">`. Intent `owocni-mail-compose-intent-v1` jest zjadany na pełnej karcie (także gdy URL jest nieczytelny). Nie blokować composera szerokością — w sandboxie `clientWidth` zostaje 0 i edytor nigdy nie wstaje. Na pełnej karcie klik Odpowiedz robi `setComposeRequested(true)`.

## Wysyłka 15 s (v1)

Uzbrojenie po `flushHtmlAsync()` + `resolveAccessToken()`. Deadline `Date.now() + 15000`. Anuluj zeruje ref. Unmount przy uzbrojeniu wysyła. Ciało: tylko `htmlBodyBase64`. Bez `visibilitychange` / `pagehide` w workerze.

## Smoke

1. Kanban → klik kartę → **side panel** na Mail (wątek + duży Odpowiedz), nie pełna strona.
2. Ostatnia wiadomość na górze (podświetlona na liście wątku); klik innej podmienia górę, lista zostaje kompletna.
3. Duży **Odpowiedz** w panelu → pełna strona z composerem. Natywny kwadrat (expand) → ta sama pełna strona **z edytorem**; Odpowiedz na niej otwiera composer w miejscu, nie nawiguje w próżnię. Kanban = tylko wątek, bez okna odpowiedzi.
4. Lead z rozmową → zakładka Rozmowy. Notes, Timeline i Tasks na karcie Owocni.
5. Wyślij → 15 s / Anuluj. Zamknięcie panelu przy odliczaniu → mail wychodzi.
6. Pinned Odpowiedz (command) nadal otwiera stary composer.
7. Lead bez SQL → „Przyjmij jako SQL” na pasku i na Home. Po przyjęciu przycisk znika, Home pokazuje datę.
8. Odrzucenie → przycisk znika z paska; Home pokazuje „Odrzucony · powód” (bez daty — nie ma takiego pola).
