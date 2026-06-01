# STAGE_MAPPING — język sprzedaży vs Twenty vs eventy

**Status:** Draft (cutover-blocking semantic alignment)  
**Powiązane decyzje:** `DECISION_REGISTER.md` #5, #14  
**Cel:** usunąć rozjazd nazewniczy między CRM, orkiestracją i zespołem sprzedaży.

---

## 1. Zasada podstawowa

- `WON` to **stage handlowy** w CRM.
- `purchase` to **event_name integracyjny**.
- `WON`/`closed_won`/`lead_won` nie mogą być używane jako `event_name`.

---

## 2. Mapowanie kanoniczne

| Język handlowy (legacy) | Stage Twenty (docelowo) | Event SSOT | Komentarz |
|---|---|---|---|
| Zapytania | NEW / CONTACTED | brak | Praca handlowa bez emisji eventu do platform |
| Odpowiedzi | CONTACTED | brak | Jak wyżej |
| Kwalifikowany (SQL) | QUALIFIED | `qualify_lead` | SQL = odpowiednik etapu QUALIFIED |
| Analiza | PROPOSAL (lub custom, jeśli ADR) | brak | CRM-only |
| Wpłaca | PROPOSAL/WON transition | brak | CRM-only operacyjne |
| Obsługa | WON + obsługa post-sale | `purchase` przy wejściu do WON | Event tylko na przejściu do WON |
| Przegrany | LOST | brak | Brak eventu reklamowego |
| Odrzucony kampanijnie | `campaignRejected=true` | `rejected_lead` | UI Twenty: **„Odrzuć leada”** (API: `campaignRejected`). ≠ LOST |

---

## 3. SQL vs QUALIFIED (jawne doprecyzowanie)

- Dla potrzeb Etapu 1 przyjmujemy: **SQL = QUALIFIED** (różnica tylko językowa/UI).
- Jeśli sprzedaż wymaga osobnego kroku SQL, trzeba to zamknąć w ADR #5 przed cutoverem.

---

## 4. Tabela decyzyjna: LOST vs rejected_lead

| Stan w CRM | Emitować `rejected_lead`? | Dlaczego |
|---|---|---|
| `campaignRejected=true` | TAK | Lead marketingowo odrzucony |
| `stage=LOST`, `campaignRejected=false` | NIE | Przegrana sprzedaż, nie odrzucenie kampanijne |
| `stage=LOST`, `campaignRejected=true` | TAK | Z powodu `campaignRejected`, nie z powodu LOST |
| `lostReason` uzupełniony | NIE (samo z siebie) | To opis przegranej, nie trigger eventu |

---

## 5. Zakazane nazwy eventów (do cleanup)

- `closed_won`
- `WON`
- `lead_won`

Cleanup tych nazw w dokumentacji orkiestracji jest częścią ADR #14.
