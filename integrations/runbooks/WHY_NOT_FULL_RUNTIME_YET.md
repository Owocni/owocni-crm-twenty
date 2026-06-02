---
doc_id: WHY_NOT_FULL_RUNTIME_YET
title: "Dlaczego Sortownia/Robot nie są w 100% „docelowe” na tym etapie"
layer: runbook
status: active
owner: "Dawid"
last_verified: 2026-06-02
---

# Dlaczego nie da się jeszcze zamknąć pełnego runtime Sortowni + Robota

Dokumentacja SSOT jest **wystarczająca do projektu**, ale **niewystarczająca do bezbłędnego hardcodu** bez instancji. Poniżej konkretne blokery — nie „lenistwo”, tylko ograniczenia epistemiczne i techniczne.

## 1. Payload Twenty nie jest jednoznaczny w tekście

| Nieznane | Skutek błędnego hardcodu |
|----------|-------------------------|
| Dokładna nazwa pola `event` webhooka (OQ-E2) | Filtr NR-5 odrzuca wszystko lub przepuszcza obce |
| Ścieżka JSON do `Person.idOid` na Opportunity (OQ-E3) | Fałszywy/brak `generate_lead` manual |
| Wartości enum `stage` w API (string vs internal id) | Złe mapowanie `qualify_lead` / `purchase` |

**Wymagane:** preflight z żywym sandboxem → `fixtures/webhook-captures/` + `[D:VERIFIED]` w `OPS_NOTES.md`.

## 2. Dwa różne runtimes (Stape sGTM ≠ Node GCP)

| Warstwa | Środowisko | `require()` |
|---------|------------|-------------|
| Sortownia, `inbound:twenty_webhook`, `crm:twenty_*` | Stape custom template | **NIE** |
| `GoogleCloudRobot.js` | Google Cloud Functions (Node) | **TAK** |

Wspólna logika musi być **zdublowana** (const + copy-paste) albo generowana później pipeline’em. Jedna wspólna biblioteka npm nie działa w tagu sGTM bez build stepu.

## 3. Sekrety i konfiguracja instancji

- Twenty API URL + token, webhook secret HMAC, Stape `API_BASE`, ID arkusza safe-sink — **nie w repo**.
- Bez tego `crm:twenty_create_lead` wysyłałby w próżnię lub na złą instancję.

## 4. Loop-prevention i L-1 to zachowanie czasowe, nie tylko kod

- Pending-write TTL musi być dobrane na realnych webhookach (echo po `crm:twenty_update_person`).
- `srcSystem`-SKIP to **tymczasowy** guard migracyjny — usunięcie przed smoke #4 = rozdwojenie `idOid` (nieodwracalne).

Kod można przygotować, ale **włączenie** wymaga testu, nie samej dokumentacji.

## 5. Paid Sortownia ≠ adapter Twenty

`SORTOWNIA_V2_POPRAWIONY.js` to **ścieżka paid** (formularz, identity_map, `generate_lead`).  
Adaptery Twenty to **osobne tagi** (`INBOUND_TWENTY_WEBHOOK.js`, `CRM_TWENTY_*.js`) podpinane w Stape UI — mieszanie w jeden plik zwiększa ryzyko regresji produkcji formularzy.

## 6. Robot nie zna semantyki CRM — tylko `task_queue`

Robot poprawnie:
- normalizuje `event_name`,
- stosuje env-guard,
- wysyła do platform.

Nie powinien parsować webhooków Twenty — to rola Sortowni. „Docelowy Robot” pod Twenty = **ten sam Robot** + taski z kanonicznymi polami, nie nowy monolit.

## 7. Co jest już sensownie przygotowane w repo (bez deploy)

| Artefakt | Cel |
|----------|-----|
| `TWENTY_PATHS.md` | Mapa ścieżek dla LLM |
| `INBOUND_TWENTY_WEBHOOK.js` | Logika adaptera (Stape) — do podpięcia Store/API |
| `CRM_TWENTY_*.stub.js` | Szkielety outbound do Twenty |
| `shared/envGuard.js` + `ENV_GUARD.sGTM.js` | sandbox/prod |
| `shared/ssotPaths.js` | Stałe nazw |
| Zmiany w `GoogleCloudRobot.js` | env-guard + SSOT event names |
| `SORTOWNIA` + pole `environment` | Spójność z Robot |

**Deploy** = podpięcie sekretów + weryfikacja payloadów, nie przepisanie SSOT od zera.

---

## Kiedy można uznać runtime za „docelowy”

1. Preflight payloadów PASS (Faza 2).
2. Adapter `inbound:twenty_webhook` zapisuje poprawne `task_queue` (Faza 3).
3. Smoke matrix 8/8 PASS (Faza 4).
4. Evidence w `INTEGRATIONS_PARITY` + `DECISION_REGISTER`.

Dopiero wtedy merge do jednego „produkcyjnego” tagu Stape bez sufiksu `.stub` / bez TODO.
