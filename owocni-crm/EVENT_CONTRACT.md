# EVENT_CONTRACT — Twenty CRM ↔ Sortownia

**Wersja:** 1.0 (SSOT OWOCNI CRM)  
**Data:** 2026-05-28  
**Synchronizacja:** `DATA_MODEL.md`, SSOT orkiestracji Sortowni  
**Zastępuje (legacy):** `../twenty/EVENT_CONTRACT_OWOCNI.md` — nie używać jako SSOT bez rekonsyliacji

---

## 1. Co ten dokument pokrywa

**Pokrywa:**
- Mapowanie zmian w Twenty → nazwy eventów SSOT (`qualify_lead`, `purchase`, `rejected_lead`, `generate_lead` manual)
- Konfiguracja Twenty native webhook OUT
- Reguły adaptera `inbound:twenty_webhook` w Sortowni
- Loop prevention, smoke testy, failure modes

**NIE pokrywa:**
- Pełnych definicji SSOT eventów w orkiestracji (Sortownia) — patrz dokumentacja orkiestracji
- Inteligentnego Routingu, Pricing Key, Robot, Adapterów platform — SSOT Sortowni

---

## 2. Mapowanie Twenty → SSOT (KANONICZNE)

| Zmiana w Twenty | Event SSOT | Uwagi |
|-----------------|------------|-------|
| `stage` → QUALIFIED | `qualify_lead` | Tylko przejście **do** QUALIFIED |
| `stage` → WON | `purchase` | NIE `lead_won` — zgodność z SSOT orkiestracji |
| `campaignRejected` false → true | `rejected_lead` | NIE zależy od stage LOST |
| `stage` → LOST | **brak eventu** | Analiza tylko w CRM; brak sygnału do platform |
| `_operation=create` + `Person.idOid` null | `generate_lead` (manual) | Lead z polecenia / telefonu |
| Formularz owocni.pl | `generate_lead` | Przez Sortownię — **nie** z Twenty |

### Rozróżnienie biznesowe (obowiązkowe)

| Pojęcie | Mechanizm | Event |
|---------|-----------|-------|
| **Przegrany deal** (klient nie kupił) | Stage LOST | żaden |
| **Odrzucony wzorzec kampanii** (nadal można sprzedawać) | `campaignRejected = true` | `rejected_lead` |
| **Wygrany** | Stage WON | `purchase` |

---

## 3. Transport outbound (DECYZJA D2)

**Mechanizm docelowy:** Twenty **native webhook OUT** (Settings → Developers → Webhooks).

| Parametr | Wartość |
|----------|---------|
| Auth | HMAC SHA256 (`X-Twenty-Webhook-Signature`, `X-Twenty-Webhook-Timestamp`) |
| Koszt credits | **ZERO** (native webhook nie zużywa workflow credits) |
| Target | `https://<sortownia>/inbound/twenty_webhook` |
| Obiekty | Opportunity, Person (create + update) |

**NIE używać w produkcji:** Workflow → HTTP Request do Sortowni (limit Pro: **50 credits/rok**; przy ~150 leadach/mc × 3 eventy ≈ 5400/rok).

**POC (25–26.05):** Workflow Code + HTTP → webhook.site — **tylko dowód techniczny**, do zastąpienia przed Fazą 4.

---

## 4. Webhook adapter Sortowni (`inbound:twenty_webhook`)

1. Weryfikacja HMAC  
2. Loop prevention: SKIP gdy `updatedBy.source=API` AND `name=OWOCNI_SORTOWNIA_KEY`  
3. Mapowanie (z `data.before`/`data.after` LUB pamięć Stape Store: `last_stage`, `last_campaignRejected` per `opportunity_id`)  
4. Emit do Inteligentnego Routingu lub SKIP (noise)

**Pseudologika mapowania:**

```
if create AND person.idOid IS NULL → generate_lead (manual)
elif stage → QUALIFIED (transition) → qualify_lead
elif stage → WON (transition) → purchase
elif campaignRejected false→true → rejected_lead
else → SKIP
```

---

## 5. Inbound kanoniczny (nie Ten dokument — architektura)

Formularz → Sortownia `generate_lead` → adapter `crm:twenty_create_lead` → Twenty REST/GraphQL.

Szczegóły: `CRM_ARCHITECTURE_CURRENT.md` §5.1.

---

## 6. Loop prevention

- Twenty webhook zawsze: `src_system: "crm"` w payloadach **wysyłanych z CRM workflow** (jeśli używane pomocniczo).
- Adapter Sortowni: SKIP gdy `src_system == "crm"` przy **inbound** create (żeby qualify_lead nie tworzył drugiego deala).
- Backfill `idOid` przez `crm:twenty_update_person` → webhook z API → SKIP przez observer.

---

## 7. Smoke testy (brama Fazy 4)

| # | Scenariusz | Oczekiwany event |
|---|------------|------------------|
| 1 | CONTACTED → QUALIFIED | `qualify_lead` |
| 2 | QUALIFIED → WON (+ opcjonalnie bizValueWon) | `purchase` |
| 3 | campaignRejected false → true | `rejected_lead` |
| 4 | Manual create Opportunity (idOid null) | `generate_lead` + backfill |
| 5 | Zmiana opisu bez stage/rejected | SKIP (brak zadań na Liście) |

---

## 8. Changelog

| Data | Zmiana |
|------|--------|
| 2026-05-28 | v1.0 SSOT: purchase/rejected_lead/qualify_lead; LOST bez eventu; native webhook zamiast workflow HTTP; campaignRejected → rejected_lead |
