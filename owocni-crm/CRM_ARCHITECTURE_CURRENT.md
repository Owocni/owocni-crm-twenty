# CRM_ARCHITECTURE_CURRENT — stan systemu

**Status:** aktualny (rekonsyliacja 2026-05-28)  
**Owner:** OWOCNI.PL

Opisuje **stan**, nie aspirację. Sufiks CURRENT = jedyna wersja „jak jest / jak będzie po cutoverze”.

---

## 1. Legacy (do wyłączenia)

| Element | Opis |
|---------|------|
| **better-bitrix** `/lead` | Supabase, kanban, dialogi won/lost/rejected |
| **julia362** | IMAP watcher → `POST crm.owocni.pl/api/newEmail` |
| **Pipeline email** | Formularz → mail leads@ → julia362 → GPT-4o → Supabase |
| **Bitrix24** | Deale księgowe — **poza** migracją CRM operacyjnego |

---

## 2. Docelowy MVP (Etap 1)

| Element | Opis |
|---------|------|
| **Twenty** | Pipeline operacyjny (Opportunity = lead) |
| **Inbound** | Sortownia `generate_lead` → `crm:twenty_create_lead` → Twenty |
| **Outbound** | Twenty native webhook OUT → Sortownia `inbound:twenty_webhook` |
| **julia362** | Wyłączony w cutover (data w runbooku) |
| **Helpdesk** | **Poza MVP** |

---

## 3. Diagram inbound (kanoniczny)

```
Formularz owocni.pl
       │
       ▼
  Sortownia (generate_lead)
       │ mint id_oid, Profil Klienta, Lista Zadań
       ▼
  Adapter crm:twenty_create_lead
       │
       ▼
  Twenty: Person + Opportunity (NEW) + Note
```

**Opcjonalnie (kontekst):** Twenty Email Sync — hub mailowy sprzedaży (wszystkie skrzynki §5.1 w `IDENTITY_AND_INBOUND.md`); odpowiedzi, timeline, docelowo podsumowania/zadania w Twenty.

**Legacy (wyłączyć):** julia362 → better-bitrix → Supabase.

**Cutover blocker:** inbound spoza kanonicznego flow (kontakt@, telefon, manual) — spec: `IDENTITY_AND_INBOUND.md`.

### 3.1 Ścieżka równoległa / backup inbound (formularze ze strony)

Migracja na Twenty **nie zastępuje** równoległego zapisu leadów z formularzy. Przy submit formularza (np. `/kontakt`) działają **niezależne** ścieżki:

```
Formularz owocni.pl (submit)
       │
       ├──► dataLayer.push(generate_lead) ──► GTM/sGTM ──► Sortownia ──► (docelowo Twenty)
       │
       ├──► Make.com webhook ──► mail / powiadomienie zespołu
       │
       └──► sendToGoogleSheets() ──► Make.com ──► Google Sheets  (backup, fire-and-forget)
```

| Element | Gdzie w kodzie | Rola |
|---------|----------------|------|
| `sendToGoogleSheets` | repo `AdrianKrauza/owocni` — `packages/ui/src/form/utils/sendToGoogleSheets.ts` | Backup zapisu PII leada do arkusza |
| Make webhook (Sheets) | ten sam repo — m.in. `form.tsx`, `sendMail.ts` | Most do Google Sheets |
| `dataLayer` → Sortownia | GTM/sGTM | Ścieżka kanoniczna orkiestracji |
| Make webhook (mail) | `form.tsx` | Backup powiadomienia gdy Stape/GTM padnie |

**Zasady:**

1. **Nie usuwać** `sendToGoogleSheets` przy refaktorze formularzy pod Twenty — wymaga ADR.
2. Błąd Sheets **nie blokuje** submitu (celowo — użytkownik widzi „dziękujemy”).
3. To **nie jest** ten sam arkusz co **safe sink sandboxu outbound** z Twenty (ADR #7) — inbound backup ≠ debug webhooków CRM.
4. Cutover Twenty / wyłączenie julia362 **nie dotyka** tej ścieżki (strona → Make → Sheets jest niezależna od CRM).

**Weryfikacja przed cutoverem:** scenariusz **S0** w `STRESS_TEST_PLAN.md`.

---

## 4. Diagram outbound

```
Handlowiec: zmiana stage / campaignRejected w Twenty UI
       │
       ▼
Twenty native webhook OUT (HMAC, 0 credits)
       │
       ▼
Sortownia inbound:twenty_webhook
       │ mapowanie + env-guard (sandbox/prod)
       │ sandbox → safe sink (np. Google Sheets), prod → routing reklamowy
       │ mapowanie → qualify_lead | purchase | rejected_lead
       ▼
Inteligentny Routing → Lista Zadań → Robot → Adaptery (Google/Meta/GA4)
```

**NIE:** Twenty Workflow HTTP Request (limit 50 credits/rok).

**Zasada środowiskowa (anti-chaos):** nie duplikujemy pełnego GTM/GCP tylko dla testów CRM.  
Preferowany model: jedna orkiestracja z rozdzieleniem ruchu po `environment` (`sandbox` / `prod`) i twardymi guardami przed wysyłką sandboxu do produkcyjnych adapterów.

---

## 5. Manual create (wyjątek jawny)

```
Handlowiec tworzy Opportunity w Twenty (idOid = null)
       → webhook OUT (create)
       → Sortownia: generate_lead (manual)
       → mint id_oid + WRITE_AKT_WLASNOSCI + crm:twenty_update_person (backfill)
```

---

## 6. Boundary matrix (skrót)

| System | Trzyma | Nie robi |
|--------|--------|----------|
| **Twenty** | Stan CRM, UI, native webhook OUT | Nie mintuje id_oid; nie outbound przez workflow HTTP w MVP |
| **Sortownia** | id_oid, atrybucja, routing, adapter webhook | Nie pełnego outboxa custom — Lista Zadań Stape |
| **Robot** | Retry zadań | Nie decyzji semantycznych |
| **n8n** | Ad-hoc LLM | Nie critical path |
| **Bitrix24** | Deale księgowe | Osobny system |

---

## 7. Integracja Twenty ↔ SSOT orkiestracji

Szczegóły transportu i mapowania: `EVENT_CONTRACT.md`.

Decyzje architektoniczne (D1–D6): patrz `../twenty/OWOCNI_CRM_fundamenty (1).md` Część III.

| Decyzja | Wybór |
|---------|-------|
| D1 Implementacja | No-code Settings UI + snapshoty git |
| D2 Outbound | Native webhook → adapter Sortowni |
| D3 Kolejka | Lista Zadań Stape (nie custom outbox) |
| D4 Manual idOid | Sortownia mint przy generate_lead |
| D5 Terminal SM | Brak enforcement po naszej stronie |
| D6 Agent routing | README sekcja w tym repo |

---

## 8. Credit budget (Twenty Pro)

~150 leadów/mc × 3 eventy ≈ **5400 emisji/rok** → workflow HTTP **nie wchodzi w grę**.

Workflow credits (~50/rok) zarezerwowane dla prostych automacji wewnętrznych (Search/Update).

---

## 9. Poza Etapem 1

Helpdesk, Dashboards jako fundament, MCP write, auto handoff WON→Bitrix24 (MVP = manual SOP), Apps Framework migration.

---

## 10. Powiązane dokumenty

- Analiza migracji (HTML): `../twenty/analiza-migracja-twenty.html`
- POC dowody: `../twenty/snapshots/`
- Mapowanie POC: `POC_MAPPING.md`
