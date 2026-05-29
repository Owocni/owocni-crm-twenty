# DECISION_REGISTER — decyzje otwarte i ADR

**Last updated:** 2026-05-28

**Reguła:** Dopóki pozycja **ADR** z `Blocks=cutover` ma status **open**, cutover **nie startuje**.

---

## Sekcja A — Open decisions

| # | Decyzja | Klasa | Blocks | Type | Faza | Kto | Status |
|---|---------|-------|--------|------|------|-----|--------|
| 1 | Konwencja nazw pól (camelCase, prefiks id/biz) | Strukturalna | none | known-fact | 2 | — | **closed** |
| 2 | Model obiektów (Opportunity/Person/Company/Note) | Strukturalna | none | known-fact | 2 | — | **closed** (POC) |
| 3 | idOid unique + null tolerance | Strukturalna | step | preflight | 2 | Dawid | **open** — sandbox test |
| 4 | Ingress kanoniczny: crm:twenty_create_lead | Strukturalna | step | impl. standard | 3 | Dawid | **open** — implementacja Sortowni |
| 5 | Kryteria stage'ów + mapowanie eventów | Semantyczna | **cutover** | **ADR** | 4 | Właściciel | **closed** (plan) — szkolenie Twenty przed cutover |
| 6 | Twenty Pro vs Organization | Semantyczna+$$ | **cutover** | **ADR** | 4 | Właściciel | **closed** — **Twenty Pro** na start (2026-05-28) |
| 7 | Sandbox + prod (bez duplikacji całego GTM/GCP) | Proceduralna | cutover | ADR | 5 | Właściciel | **closed** — env-guard + safe sink |
| 8 | Runbook cutover (data, rollback) | Proceduralna | cutover | ADR | 5 | Właściciel | **open** — data po testach + parzycie BB |
| 9 | Rekonsyliacja docs po cutoverze | Procedurowa | step | impl. standard | 5 | Właściciel | **open** |
| 10 | Routing SSOT + webhook adapter Sortowni | Semantyczna | cutover | ADR | 4 | Dawid | **open** (impl.) |
| 11 | Native webhook payload (data.before?) | Strukturalna | step | preflight | 4 | Dawid | **open** — 1 test sandbox |
| 12 | Inbound spoza Sortowni (Email Sync, telefon, manual) | Semantyczna+operacyjna | **cutover** | **ADR** | 4 | Dawid | **open** (impl.) — plan §5.1; `kontakt@` nie obsługiwana; Email Sync Etap 1.2 |
| 13 | idOid ownership, Identity Resolver T1–T5, wskaźniki Stape | Strukturalna+operacyjna | **cutover** | **ADR** | 4 | Dawid | **open** (impl.) — plan §8.4 |
| 14 | Nomenklatura eventów w SSOT orkiestracji (`purchase` vs `lead_won`) | Semantyczna | **cutover** | **ADR** | 4 | Dawid | **open** (impl.) — wpisane w plan |
| 15 | Zakres MVP vs Etap 2/3 (telefony, transkrypty, auto-odpowiedzi, liczniki) | Produktowa | cutover | ADR | 5 | Właściciel | **closed** (plan) — schedule mail, SMS, AI podsumowania = **Etap 2+** (po uruchomieniu; BB dziś tego nie ma) |
| 16 | Rekonsyliacja SSOT z Twenty 2.8.0 + docs.twenty.com (best practices) | Strukturalna+proceduralna | cutover | ADR | 5 | Dawid | **open** |

### Decyzja #7 — doprecyzowanie (zamknięta)

- Sandbox i produkcja zostają rozdzielone logicznie po `environment` (`sandbox` / `prod`).
- Dla `sandbox` outbound z Twenty trafia do safe sink (np. Google Sheets), bez wysyłki do produkcyjnych adapterów reklamowych.
- Nie wymagamy pełnej kopii infrastruktury GTM/GCP do testów CRM.

### Mapowanie eventów (do zamknięcia w #5)

| Twenty | Event SSOT |
|--------|------------|
| → QUALIFIED | qualify_lead |
| → WON | purchase |
| campaignRejected true | rejected_lead |
| → LOST | *(brak)* |

### Decyzje planowe zamknięte (2026-05-28)

| Temat | Ustalenie | Dokument |
|-------|-----------|----------|
| `kontakt@owocni.pl` | Istnieje, bez forwardu; **nie obsługujemy** w Twenty/CRM | `IDENTITY_AND_INBOUND.md` §5.1 |
| Email Sync | `leads@`, `studio@`, skrzynki handlowców — Etap **1.2**; **bez** `kontakt@` | §5.1 |
| Owner techniczny | **Dawid** (Twenty, GTM, sGTM, Stape/Sortownia) | `PLAN_DZIALAN.md` |
| Szablony maili | Migracja z better-bitrix **przed** cutover — must-have | `SALES_OPS_REQUIREMENTS.md` |
| Twenty Pro | Na start | ADR #6 zamknięte |
| Schedule mail / SMS / AI | Etap 2+ po uruchomieniu | ADR #15 zamknięte |
| Szkolenie | Nowe szkolenie Twenty przed cutover (stage’e już znane) | `PLAN_DZIALAN.md` |
| Ścieżki kanałów | Opisane w §5–6 | `IDENTITY_AND_INBOUND.md` |
| Identity Resolver | Plan ADD-2 → ADD-1 → ADD-3 (+ FIX osobno) | §8.4 |

### Priorytety po review 2026-05-28

- **P1:** #12 i #13 (inbound spoza Sortowni + idOid/deduplikacja) blokują bezpieczny cutover.
- **P1:** #14 (jednoznaczne nazwy eventów) — usuwa chaos implementacyjny w adapterach.
- **P2:** #15 (scope Etap 1 vs Etap 2/3) — ogranicza mieszanie wymagań MVP i roadmapy.
- **P2:** #16 (rekonsyliacja z Twenty 2.8.0 + best practices) — podnosi zaufanie do SSOT.

### Task rekonsyliacji dokumentów (#14 + #16) — owner: **Dawid**

- [ ] Ujednolicić nazewnictwo eventów w dokumentacji orkiestracji (Google Docs) — `purchase` zamiast `lead_won`/`closed_won`
- [ ] Zaktualizować mapowanie w `GoogleCloudRobot.js` jeśli nadal `lead_won`
- [ ] Potwierdzić zgodność pól i stage z Twenty 2.8.0
- [ ] Zsynchronizować `owocni-crm/*` po cleanupie

### Procedura audytów (fault-only)

| Audyt | Kiedy | Plik |
|-------|-------|------|
| AKK kroki 1–7 (wewnętrzny) | **Teraz** (tura A) | `AUDIT_AKK.md` |
| AKK kroki 8–9 (Twenty + Stape) | **Preflight** po P1 | `AUDIT_AKK.md` |
| AKK meta: pusty wynik ≠ cutover OK | Zaakceptowane w SSOT | `AUDIT_AKK.md` § Meta-pytanie |
| Audyt migracji 1–7 | **Przed dry-run importu** | `AUDIT_MIGRACJA.md` |

---

## Sekcja B — Closed decisions (ADR)

*Pusta na start. Po cutoverze: migracja zamkniętych z Sekcji A.*

---

## Kiedy NIE pisać ADR

Zmiana labelu, saved view, bugfix rutynowy, pole OPEN kosmetyczne.

---

## Zamknięte przez dokumentację SSOT (2026-05-28)

| Temat | Decyzja |
|-------|---------|
| lead_lost vs rejected_lead | LOST bez eventu; rejected_lead tylko campaignRejected |
| lead_won vs purchase | purchase |
| Outbound POC workflow vs native webhook | native webhook (D2) |
| Helpdesk w MVP | nie (Prawo 9) |
| julia362 | legacy, wyłączenie w cutover |

Szczegóły: `EVENT_CONTRACT.md`, `POC_MAPPING.md`.
