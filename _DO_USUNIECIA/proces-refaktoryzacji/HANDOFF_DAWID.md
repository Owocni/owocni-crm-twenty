# HANDOFF — refaktoryzacja SSOT owocni-crm (dla Dawida)

> To NIE jest plik repo — to przekazanie po refaktorze dokumentacji. Repo gotowe w `owocni-crm/` (12 plików ready + 1 conditional).

## 1. Co zrobione

13 plików dokumentacji SSOT przepisanych do nowej struktury (front-matter + sekcje 0–9 + INVARIANTS + NEGATIVE RULES + cross-ref + legenda znaczników). Treść decyzji [D:CORE]/[D:VERIFIED] zachowana 1:1; zmieniona tylko obudowa i organizacja. STAGE_MAPPING wchłonięty (mapowanie→EVENT_CONTRACT, enum stage→DATA_MODEL), oryginał → archive stub.

## 2. OTWARTE RYZYKA / [D:OPEN] (wymagają Twojej decyzji lub testu)

| ID | Co | Gdzie | Blokuje cutover? | Działanie |
|---|---|---|---|---|
| **L-1** | TRANSITION EXCEPTION backfill idOid — usunięcie `srcSystem`-SKIP DOPIERO po smoke #4 PASS (sekwencja 1-2-3) | `EVENT_CONTRACT.md` §6.1 | **TAK** (G4) | smoke test #4: manual create → backfill → brak drugiego `generate_lead` |
| **MERGE-1** | Webhook przy merge — czy payload niesie oba ID? | `IDENTITY_AND_INBOUND.md` §5.9 | **TAK** (G8) | test na instancji/sandbox |
| **MERGE-2** | Merge nieodwracalny — reguła przepięcia `canonical_oid` | `IDENTITY_AND_INBOUND.md` §5.9, §11 | **TAK** (G8) | reguła + szkolenie |
| **MERGE-3** | T5 przy dwóch paid id_oid — ścieżka admin | `IDENTITY_AND_INBOUND.md` §5.2 | **TAK** (G8) | procedura admin |
| **F1** | Topologia repo: 1 czy 2 README (root znika, jeśli `owocni-crm/` jest rootem) | `README.md` (root) | nie | **oględziny rzeczywistej struktury repo** — root README jest `conditional_not_ready_for_commit` |
| **R-R-2** | Dokładna nazwa eventu webhooka Twenty (`*.created` vs `record.*`) | `ops/OPS_NOTES.md` §5.1 (`platform_recheck_needed`) | nie | sprawdzić pole `event` w payloadzie na instancji |
| **R-R-3** | Native webhook 0 credits — oznaczone `inference_from_docs`, nie cytat | `ops/OPS_NOTES.md` §5.1 | nie | potwierdzić na instancji/pricingu |
| **OQ-D1** | bizSource/bizProduct = SELECT — potwierdzenie na instancji | `DATA_MODEL.md` §5.5 (`[D:RESEARCH]`) | nie | preflight sandbox |
| **OQ-E3** | Czy Opportunity webhook niesie `Person.idOid` | `EVENT_CONTRACT.md` §7 | nie | sandbox |

## 3. DECYZJE wymagające właściciela/Dawida przed cutoverem

Z `DECISION_REGISTER.md` §5.2 (OPEN CUTOVER BLOCKERS):
- **#12** — inbound: które skrzynki → Twenty, `kontakt@` poza zakresem (właściciel + Dawid).
- **#13** — Email Sync + Resolver działają PRZED wyłączeniem julia362 (Dawid).
- **#14** — cleanup `lead_won`→`purchase` w kodzie Robot + docs orkiestracji (Dawid).
- **L-1, MERGE** — jak w tabeli §2.

**Brama startu cutoveru:** wszystkie `blocks: cutover` = closed (z evidence) **I** wszystkie MUST-PASS G1–G8 + G-PAR = PASS (`runbooks/IMPLEMENTATION_PLAN.md` §5.4).

## 4. ROZSTRZYGNIĘTE w tej turze

- **HMAC (#16, ex R-R-1):** `X-Twenty-Webhook-Signature` + `X-Twenty-Webhook-Timestamp`, signed string `{timestamp}:{payload}` (nie sam payload). `[D:VERIFIED]` z docs.twenty.com. Dom = `ops/OPS_NOTES.md`. CONSTITUTION Prawo 7g (był błędny `x-twenty-signature`) poprawiony. Bez wiersza „recheck na instancji" dla nazwy. ADR #16 closed z evidence.

## 5. Coverage ledger

Pełny dziennik batchy (plik-po-pliku, grep-checki, semantic-diff) → `REFACTOR_STATE.md`. Split-move STAGE_MAPPING → `stage_mapping_split_ledger.md`. Mapa wyjścia + WHITELIST clean-room → `OUTPUT_MANIFEST.md`.

## 6. Higiena commitu

- 12 plików: `ready`.
- 1 plik (`README.md` root): `conditional_not_ready_for_commit` — **nie commituj, dopóki nie rozstrzygniesz F1**. Jeśli `owocni-crm/` jest rootem repo → usuń root README, zostaje tylko `owocni-crm/README.md` [1].
- `_process/` (REFACTOR_STATE, split-ledger, OUTPUT_MANIFEST, ten handoff) — **NIE commitować do repo produktu** (artefakty procesu).
