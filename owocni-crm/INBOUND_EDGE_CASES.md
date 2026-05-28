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

1. Mail przychodzący bezpośrednio na `kontakt@owocni.pl` (watcher julia362 **nie** nasłuchuje tej skrzynki wprost — sprawdzić forward/alias na `mail.owocni.pl`).
2. Mail bezpośrednio na skrzynki zespołu (`studio@`, `marta@`, `gosia@`, `pomoc@`, `copywriting@`, `mariusz@`) — julia362 je **nasłuchuje**, ale po przełączeniu na Sortownię jako główne źródło łatwo obsłużyć tylko flow „ze strony”, nie każdy taki mail.
3. Lead telefoniczny (sprzedawca wpisuje ręcznie).
4. Inny kanał ręczny/import, który tworzy rekord poza formularzem.

### Legacy: co nasłuchuje julia362 (IMAP)

Skrzynki w `app2.js` (7): `copywriting@`, `pomoc@`, `studio@`, `marta@`, `gosia@`, `mariusz@`, `leads@`.  
Auto-tworzenie leada w better-bitrix (historycznie): głównie **`leads@` + INBOX**.

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

---

## 6. Pytania rozstrzygające (checklista I1–I4)

Szczegół: `CHECKLIST_REVIEW.html` blok 6. Skrót stanu wiedzy:

| ID | Co wiemy (SSOT teraz) | Co musimy ustalić |
|----|------------------------|-------------------|
| **I1** | Kanon: formularz → Sortownia → idOid; kanały częściowo wymienione | Zamknięta matryca wszystkich kanałów + trigger idOid lub adnotacja „sierota” |
| **I2** | julia362: 7 skrzynek (nie kontakt@ wprost); auto-lead legacy = leads@ INBOX | Forward kontakt@; pierwszy obserwator po cutoverze |
| **I1** | julia362 nasłuchuje skrzynki zespołu; po Sortowni głównie formularz | Maile wprost na studio@/marta@…; pełna matryca kanałów |
| **I3** | S1 sekwencyjny (mail → telefon) w `STRESS_TEST_PLAN.md`; w Sortowni działa resolve `_oid -> email -> phone -> ga_client_id` + multi-key write | Test równoległy anty-kolizyjny + dowód PASS/FAIL |
| **I4** | idOid nadaje tylko Sortownia (także dla ręcznie dodanych leadów); szkic dedup email/telefon | Klucz merge, adapter (np. `system:merge_oid`), reguła konfliktu gdy email i telefon wskazują dwa istniejące profile (2 idOid) |
