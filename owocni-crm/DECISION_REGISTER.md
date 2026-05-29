# DECISION_REGISTER — decyzje otwarte i ADR

**Last updated:** 2026-05-28

**Reguła:** Dopóki pozycja **ADR** z `Blocks=cutover` ma status **open**, cutover **nie startuje**.

---

## Sekcja A — Open decisions

| # | Decyzja | Klasa | Blocks | Type | Faza | Kto | Status |
|---|---------|-------|--------|------|------|-----|--------|
| 1 | Konwencja nazw pól (camelCase, prefiks id/biz) | Strukturalna | none | known-fact | 2 | — | **closed** |
| 2 | Model obiektów (Opportunity/Person/Company/Note) | Strukturalna | none | known-fact | 2 | — | **closed** (POC) |
| 3 | idOid unique + null tolerance | Strukturalna | step | preflight | 2 | Developer | **open** — sandbox test |
| 4 | Ingress kanoniczny: crm:twenty_create_lead | Strukturalna | step | impl. standard | 3 | Developer | **open** — implementacja Sortowni |
| 5 | Kryteria stage'ów + mapowanie eventów | Semantyczna | **cutover** | **ADR** | 4 | Właściciel + handlowcy | **open** |
| 6 | Twenty Pro vs Organization | Semantyczna+$$ | **cutover** | **ADR** | 4 | Właściciel | **open** |
| 7 | Sandbox + prod (bez duplikacji całego GTM/GCP) | Proceduralna | cutover | ADR | 5 | Właściciel | **closed** — env-guard + safe sink |
| 8 | Runbook cutover (data, rollback) | Proceduralna | cutover | ADR | 5 | Właściciel | **open** |
| 9 | Rekonsyliacja docs po cutoverze | Procedurowa | step | impl. standard | 5 | Właściciel | **open** |
| 10 | Routing SSOT + webhook adapter Sortowni | Semantyczna | cutover | ADR | 4 | Owner Sortowni | **open** |
| 11 | Native webhook payload (data.before?) | Strukturalna | step | preflight | 4 | Developer | **open** — POC test |
| 12 | Inbound spoza Sortowni (kontakt@, telefon, manual, Email Sync) | Semantyczna+operacyjna | **cutover** | **ADR** | 4 | Właściciel + Owner Sortowni | **open** — spec: `IDENTITY_AND_INBOUND.md` |
| 13 | idOid ownership, Identity Resolver T1–T5, wskaźniki Stape | Strukturalna+operacyjna | **cutover** | **ADR** | 4 | Właściciel + Developer | **open** — spec: `IDENTITY_AND_INBOUND.md` |
| 14 | Nomenklatura eventów w SSOT orkiestracji (`purchase` vs `WON`/`closed_won`) | Semantyczna | **cutover** | **ADR** | 4 | Owner Sortowni | **open** — rekonsyliacja nazewnictwa |
| 15 | Zakres MVP vs Etap 2/3 (telefony, transkrypty, auto-odpowiedzi, liczniki) | Produktowa | cutover | ADR | 5 | Właściciel | **open** |
| 16 | Rekonsyliacja SSOT z Twenty 2.8.0 + docs.twenty.com (best practices) | Strukturalna+proceduralna | cutover | ADR | 5 | Właściciel + Developer | **open** |

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

### Priorytety po review 2026-05-28

- **P1:** #12 i #13 (inbound spoza Sortowni + idOid/deduplikacja) blokują bezpieczny cutover.
- **P1:** #14 (jednoznaczne nazwy eventów) — usuwa chaos implementacyjny w adapterach.
- **P2:** #15 (scope Etap 1 vs Etap 2/3) — ogranicza mieszanie wymagań MVP i roadmapy.
- **P2:** #16 (rekonsyliacja z Twenty 2.8.0 + best practices) — podnosi zaufanie do SSOT.

### Task rekonsyliacji dokumentów (#14 + #16)

- [ ] Ujednolicić nazewnictwo eventów w dokumentacji orkiestracji (usunąć `closed_won`/`WON` jako event_name).
- [ ] Potwierdzić zgodność pól i stage z aktualną wersją Twenty (2.8.0 lub nowszą).
- [ ] Zweryfikować założenia custom fields i ograniczeń platformy względem docs.twenty.com.
- [ ] Zsynchronizować `owocni-crm/*` z dokumentacją orkiestracji po cleanupie.

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
