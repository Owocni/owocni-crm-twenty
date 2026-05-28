# INBOUND_EDGE_CASES — inbound spoza Sortowni

**Status:** Draft (cutover-blocking)  
**Powiązane decyzje:** `DECISION_REGISTER.md` #12, #13  
**Cel:** domknąć czarną dziurę inbound dla kanałów: `kontakt@`, telefon, ręczne utworzenie.

---

## 1. Problem

Gdy lead nie przechodzi przez kanoniczny flow `Sortownia -> crm:twenty_create_lead`, ryzykujemy:

- brak `idOid`,
- brak pełnego śladu zdarzeń i alertów,
- duplikaty przy wielu kanałach kontaktu,
- problemy z późniejszą automatyzacją Etapu 2 (wątki telefoniczne, odpowiedzi kontekstowe).

---

## 2. Kanały spoza kanonu (do obsługi)

1. Mail przychodzący bezpośrednio na `kontakt@owocni.pl`.
2. Lead telefoniczny (sprzedawca wpisuje ręcznie).
3. Inny kanał ręczny/import, który tworzy rekord poza formularzem.

---

## 3. Decyzje wymagane przed cutoverem

1. **Ownership `idOid`:** kto i kiedy nadaje `idOid` dla leadów spoza kanonu.
2. **Deduplikacja cross-channel:** reguły łączenia mail+telefon+manual w jeden byt klienta.
3. **Egzekucja:** co dzieje się z rekordem bez `idOid` (blokada, kolejka naprawcza, auto-backfill).
4. **Audit:** minimalny log techniczny dla rozliczalności (kto/scenariusz/skutek).
5. **Fallback:** co robi zespół, gdy automatyka nie nada `idOid` w SLA.

---

## 4. Minimalna specyfikacja operacyjna (MVP)

- Rekord utworzony ręcznie w Twenty (`idOid=null`) uruchamia workflow `generate_lead (manual)`.
- Sortownia mintuje `idOid` i wykonuje backfill do rekordu.
- Brak backfill w SLA -> alert + zadanie naprawcze.
- Deduplikacja oparta co najmniej o: `email`, `telefon`, oraz sygnał manual merge.

---

## 5. Kryteria PASS (brama cutover)

1. Dla każdego kanału spoza kanonu można odtworzyć ścieżkę nadania `idOid`.
2. Test mail+telefon tego samego klienta nie tworzy nieskontrolowanej duplikacji.
3. Brak rekordu produkcyjnego bez `idOid` dłużej niż ustalone SLA.
4. Monitoring i alerty działają (Ratownik + log zdarzeń).
