---
doc_id: ARCHITECTURE
title: "ARCHITECTURE — granice systemów i przepływy in/out"
layer: core_ssot
status: active
edit_scope: structure_only
owner: "Właściciel (biznes) / Dawid (techniczny)"
last_verified: 2026-07-10
recheck_trigger: "zmiana granic systemów / nowy system w przepływie / zmiana backup path"
default_trust: D:CORE
related:
  - EVENT_CONTRACT
  - IDENTITY_AND_INBOUND
  - DATA_MODEL
  - ops/OPS_NOTES
---

# ARCHITECTURE — granice systemów i przepływy

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** który system za co odpowiada (boundary matrix: Twenty / Sortownia / Stape / Robot / n8n / Bitrix24 / legacy); jak płyną dane (inbound / outbound / manual create); co legacy do wyłączenia; backup path formularzy (Sheets); decyzje architektoniczne D1–D6; out-of-scope.

**Ten plik NIE decyduje o:** jak techniczne zdarzenie staje się business eventem (→ `EVENT_CONTRACT.md`); szczegółach runbookowych (→ `runbooks/`); tożsamości (→ `IDENTITY_AND_INBOUND.md`); polach (→ `DATA_MODEL.md`).

**Zawsze czytaj razem z:** `EVENT_CONTRACT.md` (mapowanie zdarzenie→event), `IDENTITY_AND_INBOUND.md` (kanały).

**Najgroźniejszy błąd:** architektura zaczyna dublować kontrakt eventów — obie wersje się rozjeżdżają. Architektura mówi „kto za co"; kontrakt mówi „jak zdarzenie → event".

**Przy konflikcie:** granice systemów — ten plik. Mechanika eventu → `EVENT_CONTRACT.md`.

**Zmiana wymaga:** ADR (granice = `[D:CORE]`); usunięcie `sendToGoogleSheets` z backup path → ADR.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie decyzja |
|---|---|---|---|---|---|
| NR-1 | NIE dublować `EVENT_CONTRACT` — architektura mówi „kto za co", kontrakt mówi „jak zdarzenie → event". | Dwie wersje mechaniki rozjadą się. | Sprzeczna mechanika w 2 plikach. | Właściciel + ADR | `EVENT_CONTRACT.md` |
| NR-2 | NIE usuwać `sendToGoogleSheets` z opisu backup bez ADR. | Backup zapisu PII leada (fire-and-forget) — niezależny od CRM. | Utrata ścieżki backup formularzy. | Właściciel + ADR | §3.1 |
| NR-3 | NIE używać workflow HTTP Request Twenty → Sortownia w produkcji. | Limit workflow credits Pro (fakt → `ops/OPS_NOTES.md`); ~5400 emisji/rok. | Wyczerpanie credits, brak emisji. | Właściciel + ADR | §5 + `ops/OPS_NOTES.md` |
| NR-4 | NIE duplikować pełnego GTM/GCP dla testów CRM — rozdzielenie ruchu po `environment` (`sandbox`/`prod`) z twardymi guardami. | Anti-chaos; uniknięcie kosztownej kopii infry. | Sandbox wysyła do produkcyjnych adapterów. | Właściciel + ADR | §4 |

---

## 2. PURPOSE

Opisuje **stan** (granice systemów i przepływy danych), nie aspirację. Jedna wersja „jak jest / jak będzie po cutoverze". Spina pliki domenowe (eventy, tożsamość, pola), nie dublując ich. Rekonsyliacja 2026-05-28.

---

## 3. SCOPE

### Pokrywa
- Granice systemów (boundary matrix), przepływy inbound/outbound, manual create, legacy do wyłączenia, backup path (Sheets), D1–D6, credit budget (konsekwencja), out-of-scope.

### Nie pokrywa
- Mechaniki zdarzenie→event (→ `EVENT_CONTRACT.md`), tożsamości (→ `IDENTITY_AND_INBOUND.md`), pól (→ `DATA_MODEL.md`), faktów platformowych (→ `ops/OPS_NOTES.md`).

---

## 4. CANONICAL DEFINITIONS

- **CURRENT vs TARGET:** ten plik opisuje stan docelowy (po cutoverze) oraz legacy do wyłączenia. Sufiks „CURRENT" usunięty (mylił stan z aspiracją).
- **Granica CRM ↔ orkiestracja:** Twenty = praca CRM; Sortownia = atrybucja marketingowa. Twenty NIGDY nie mintuje `idOid` (zasada → `CRM_CONSTITUTION.md` Prawo 6).

---

## 5. BODY

### 5.1 Legacy (do wyłączenia)

| Element | Opis |
|---|---|
| **better-bitrix** `/lead` | Supabase, kanban, dialogi won/lost/rejected |
| **julia362** | IMAP watcher → `POST crm.owocni.pl/api/newEmail` |
| **Pipeline email** | Formularz → mail leads@ → julia362 → GPT-4o → Supabase |
| **Bitrix24** | Deale księgowe — **poza** migracją CRM operacyjnego |

### 5.2 Docelowy MVP (Etap 1)

| Element | Opis |
|---|---|
| **Twenty** | Pipeline operacyjny (Opportunity = lead) |
| **Inbound** | Sortownia `generate_lead` → `crm:twenty_create_lead` → Twenty |
| **Outbound** | Twenty native webhook OUT → Stape edge (`/inbound/twenty_webhook`) → **GCP inbound CF** (sandbox) lub pełny tag Stape (prod legacy) → `task_queue` → Robot |
| **julia362** | Wyłączony w cutover (data w `runbooks/IMPLEMENTATION_PLAN.md`) |
| **Helpdesk** | **Poza MVP** |

### 5.3 Diagram inbound (kanoniczny)

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

**Opcjonalnie (kontekst):** Twenty Email Sync — hub mailowy sprzedaży (wszystkie skrzynki → `IDENTITY_AND_INBOUND.md`); odpowiedzi, timeline, docelowo podsumowania/zadania.

**Legacy (wyłączyć):** julia362 → better-bitrix → Supabase.

**Cutover blocker:** inbound spoza kanonicznego flow (kontakt@, telefon, manual) — spec: `IDENTITY_AND_INBOUND.md`.

#### 5.3.1 Ścieżka równoległa / backup inbound (formularze)

Migracja na Twenty **nie zastępuje** równoległego zapisu leadów z formularzy. Przy submit (np. `/kontakt`) działają **niezależne** ścieżki:

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
|---|---|---|
| `sendToGoogleSheets` | repo strony www `AdrianKrauza/owocni` — `packages/ui/src/form/utils/sendToGoogleSheets.ts` | Backup zapisu PII leada do arkusza |
| Make webhook (Sheets) | repo strony www `AdrianKrauza/owocni` — `packages/ui/src/form/utils/sendMail.ts` oraz formularze `apps/owocni/app/**/components/form.tsx` | Most do Google Sheets (backup) |
| `dataLayer` → Sortownia | GTM/sGTM | Ścieżka kanoniczna orkiestracji |
| Make webhook (mail) | `form.tsx` | Backup powiadomienia gdy Stape/GTM padnie |

**Zasady:**
1. **Nie usuwać** `sendToGoogleSheets` przy refaktorze formularzy pod Twenty — wymaga ADR (NR-2).
2. Błąd Sheets **nie blokuje** submitu (celowo — użytkownik widzi „dziękujemy").
3. To **nie jest** ten sam arkusz co **safe sink sandboxu outbound** z Twenty (D7/env-guard) — inbound backup ≠ debug webhooków CRM.
4. Cutover Twenty / wyłączenie julia362 **nie dotyka** tej ścieżki (strona → Make → Sheets niezależna od CRM).

> Uwaga: to jest **warstwa strony www** (formularze). Nie mylić z `../integrations/` — tam jest runtime Sortowni/Robota, nie kod formularzy.

**Weryfikacja przed cutoverem:** scenariusz backup inbound (plan testów — `runbooks/IMPLEMENTATION_PLAN.md`).

### 5.4 Diagram outbound

```
Handlowiec: zmiana stage / campaignRejected / workflow MANUAL w Twenty UI
       │
       ▼
Twenty native webhook OUT (HMAC, native — nie zużywa workflow credits)
       │
       ▼
Stape Client: POST /inbound/twenty_webhook  (INBOUND_TWENTY_WEBHOOK_CLIENT.sGTM.js)
       │
       ├── sandbox ──► Stape stub ──► GCP twenty-inbound-webhook (build gcp-v5)
       │                      │ mapowanie + transition + fingerprint dedup
       │                      ▼
       └── prod (legacy) ──► pełny tag INBOUND_TWENTY_WEBHOOK.sGTM.legacy-full.js
                              │ (docelowo: twenty-inbound-webhook-prod)
                              ▼
                    Stape Store: task_queue + shadow-state (last_stage, …)
                              │ env-guard (sandbox/prod)
                              │ mapowanie → qualify_lead | purchase | rejected_lead
                              ▼
                    Robot (GoogleCloudRobot.js) → arkusze debug / platformy reklamowe
```

**Workflow MANUAL (nie webhook OUT):** „Przyjmij jako SQL", „Odrzuć leada" — mogą wysłać syntetyczny POST do `/inbound/twenty_webhook` po UPDATE rekordu (patrz `integrations/runbooks/TWENTY_WORKFLOWS_REJECT_AND_GUARD.md`).

**NIE:** Twenty Workflow HTTP Request jako **docelowy** transport outbound (limit workflow credits — `ops/OPS_NOTES.md`). Wyjątek: jednorazowy POST po akcji MANUAL (odrzucenie) — nie zastępuje native webhook dla zmian stage.

Mapowanie zdarzenie→event, transition detection, loop-prevention, `biz_value` → `EVENT_CONTRACT.md` (NR-1, nie dublować tu).

**Zasada środowiskowa (anti-chaos):** nie duplikujemy pełnego GTM/GCP dla testów CRM. Preferowany model: jedna orkiestracja z rozdzieleniem ruchu po `environment` (`sandbox`/`prod`) i twardymi guardami przed wysyłką sandboxu do produkcyjnych adapterów.

### 5.5 Manual create (wyjątek jawny)

```
Handlowiec tworzy Opportunity w Twenty (idOid = null)
       → webhook OUT (create LUB update)
       → Sortownia: generate_lead (manual)  [rozpoznanie: idOid IS NULL]
       → mint id_oid + backfill crm:twenty_update_person
```

Mechanika rozpoznania (`idOid IS NULL`), cold-start, TRANSITION EXCEPTION backfill → `EVENT_CONTRACT.md` (właściciel).

### 5.6 Boundary matrix

| System | Source of truth / trzyma | Nie robi | Failure mode |
|---|---|---|---|
| **Twenty** | Stan CRM, UI, native webhook OUT | Nie mintuje idOid; nie outbound przez workflow HTTP w MVP | Webhook delivery fail → retry Twenty |
| **Sortownia** | id_oid, atrybucja, routing, adapter webhook | Nie pełnego outboxa custom — Lista Zadań Stape | Stape down → fail-closed (nie mintuj) |
| **Robot** | Retry zadań, VBB gate w adapterach | Nie decyzji semantycznych | Retry z kolejki |
| **n8n** | Ad-hoc LLM | Nie critical path | Poza SSOT |
| **Bitrix24** | Deale księgowe | Osobny system | — |

### 5.7 Decyzje architektoniczne (D1–D6)

| Decyzja | Wybór |
|---|---|
| D1 Implementacja | No-code Settings UI + snapshoty git |
| D2 Outbound | Native webhook → adapter Sortowni |
| D3 Kolejka | Lista Zadań Stape (nie custom outbox) |
| D4 Manual idOid | Sortownia mint przy generate_lead |
| D5 Terminal SM | Brak enforcement po naszej stronie |
| D6 Agent routing | README sekcja w tym repo |

Uzasadnienia D1–D6 (np. czemu nie Apps Framework, Stape Store vs Twenty Filter, „czego NIE budujemy", „nie egzekwujemy terminal SM") — materiał historyczny; szczegóły transportu i mapowania → `EVENT_CONTRACT.md`.

### 5.8 Credit budget (konsekwencja faktu platformowego)

~150 leadów/mc (**całość ruchu, wszystkie kanały** — nie mylić z ~80/mc kanałem mailowym, `IDENTITY_AND_INBOUND.md`) × 3 eventy ≈ **5400 emisji/rok** → workflow HTTP **nie wchodzi w grę** (limit workflow credits → `ops/OPS_NOTES.md`). Workflow credits zarezerwowane dla prostych automacji wewnętrznych (Search/Update).

### 5.9 Poza Etapem 1 (out-of-scope)

Helpdesk, Dashboards jako fundament, MCP write, auto handoff WON→Bitrix24 (MVP = manual SOP), Apps Framework migration. Pełna lista → `CRM_CONSTITUTION.md` Prawo 9.

---

## 6. CROSS-REFERENCES

| Temat | Gdzie jest prawda |
|---|---|
| Mapowanie zdarzenie→event, transport, loop-prevention, manual-create | `EVENT_CONTRACT.md` |
| Kanały wejścia, Resolver, Email Sync, ~80 mail | `IDENTITY_AND_INBOUND.md` |
| Pola, srcSystem, idOid | `DATA_MODEL.md` |
| Workflow credits, HMAC, audit log gating | `ops/OPS_NOTES.md` |
| Cutover/rollback, plan wdrożenia | `runbooks/IMPLEMENTATION_PLAN.md` |
| Decyzje D2/D7 (env-guard) status | `DECISION_REGISTER.md` |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-A1 | env-guard sandbox/prod safe-sink — finalna konfiguracja | Dawid | nie | DECISION_REGISTER (D7 closed) / preflight |

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Backup path formularzy (Sheets) działa po refaktorze pod Twenty | Preflight | Dawid | runtime |
| Native webhook OUT konfiguracja (target, obiekty) | Preflight | Dawid | Settings |
| env-guard rozdziela sandbox/prod | Preflight | Dawid | runtime |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` — decyzja własna OWOCNI; zmiana tylko właściciel + ADR
- `[D:VERIFIED]` — fakt zweryfikowany na platformie; recheck po triggerze
- `[D:RESEARCH]` — rekomendacja researchu; podważyć tylko dowodem z instancji
- `[D:OPEN]` — świadomie otwarte; agent nie domyka
- Default tego pliku: `D:CORE`. Inline = odchylenie.
