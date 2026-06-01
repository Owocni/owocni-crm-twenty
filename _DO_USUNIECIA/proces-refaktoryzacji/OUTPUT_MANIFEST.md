# OUTPUT_MANIFEST — refaktoryzacja SSOT owocni-crm

Data: 2026-05-31 · Plików: 13 · Linii: 2319 · Pliki sterujące (NIE w repo): 6 · Klasa A źródeł: 12

| # | output_path | source_logical_id | operation | linie | clean_room_pass | commit_readiness | notes |
|---|---|---|---|---|---|---|---|
| 1 | `owocni-crm/CRM_CONSTITUTION.md` | CRM_CONSTITUTION | rewrite + INVARIANTS §0 | 344 | ✅ | ready | rdzeń+progressive disclosure; HMAC nazwa→OPS |
| 2 | `owocni-crm/DATA_MODEL.md` | DATA_MODEL (+ stage z STAGE_MAPPING) | rewrite + split-in | 208 | ✅ | ready | 12 API names; frozen 3-warstwy; default D:VERIFIED |
| 3 | `owocni-crm/EVENT_CONTRACT.md` | EVENT_CONTRACT + STAGE_MAPPING | rewrite + wchłonięcie | 294 | ✅ (WL: SKIP_COLD_START_BASELINE) | ready | reason codes 7; cold-start 4; L-1 [D:OPEN] |
| 4 | `owocni-crm/IDENTITY_AND_INBOUND.md` | IDENTITY_AND_INBOUND | light rewrite | 344 | ✅ | ready | T1-T5; 3 bramki merge [D:OPEN]; VBB |
| 5 | `owocni-crm/ARCHITECTURE.md` | CRM_ARCHITECTURE_CURRENT | rename + rewrite | 250 | ✅ | ready | bez „CURRENT"; sendToGoogleSheets; D1-D6 |
| 6 | `owocni-crm/DECISION_REGISTER.md` | DECISION_REGISTER | keep + rewrite | 187 | ✅ (WL: #16 HMAC w ADR) | ready | 3 osie faz; closed z evidence; #16=ex R-R-1 |
| 7 | `owocni-crm/README.md` | 02_owocni-crm (routing) | rewrite navigator | 58 | ✅ | ready | navigator SSOT [1] |
| 8 | `ops/OPS_NOTES.md` | OPS_NOTES | move + rewrite | 165 | ✅ | ready | DOM HMAC #16; row_class kolumna; default D:VERIFIED |
| 9 | `runbooks/IMPLEMENTATION_PLAN.md` | PLAN_DZIALAN | move + rewrite | 202 | ✅ | ready | 8 MUST-PASS gates + G-PAR; cutover/rollback |
| 10 | `audits/AUDIT_MIGRACJA.md` | AUDIT_MIGRACJA | move + light | 163 | ✅ | ready | 7 kroków 1:1; preflight; side-effect guard |
| 11 | `archive/STAGE_MAPPING.md` | STAGE_MAPPING | archive stub | 41 | ✅ | ready | deprecated; split-move potwierdzony |
| 12 | `README.md` (ROOT) | 01_ROOT | rewrite warunkowy | 51 | ✅ | **conditional_not_ready_for_commit** | F1 [D:OPEN] — oględziny Dawida |
| 13 | `generated/README.md` | — | placeholder | 12 | ✅ | ready (placeholder) | NOT GENERATED YET |

## WHITELIST clean-room (uzasadnienia)

| Token | Plik:linia | Dlaczego dozwolone |
|---|---|---|
| `SKIP_COLD_START_BASELINE` | EVENT_CONTRACT:205 | Natywna nazwa reason code adaptera (1 z 7 ze STRUKTURA — zakaz zmiany). NIE etykieta procesu refaktoru. |
| `lead_won` | DECISION_REGISTER:133 | ADR #14 opisuje *cleanup* tej nazwy w kodzie Robot (bloker cutoveru). Kontekst zakazu/usunięcia, nie żywy event_name. |
| `x-twenty-signature` | DECISION_REGISTER:130 | ADR #16 dokumentuje, że nazwa była BŁĘDNA → poprawiona. Zapis decyzji z evidence, nie użycie. |
| `X-Twenty-Webhook-Signature` | OPS_NOTES + DECISION_REGISTER | Dom faktu = OPS; DECISION_REGISTER cytuje jako treść closed ADR #16 (wymóg evidence_source). CONSTITUTION/EVENT_CONTRACT = cross-ref bez nazwy (=0). |

## Grep globalny (liczby końcowe)

- kody napraw `P[012]-[0-9]`: **0** ✅
- słowa procesu (refactor/przeszczep/red-team/WDROZENIE/Konsolidator/DOMKNIECIE/semantic-diff/READ-PACK): **0** ✅
- kody ryzyk `R-[A-S]\b`: **0** ✅ (R-R-1 → przemianowane na #16)
- `x-twenty-signature` jako żywa nazwa: **0** ✅ (tylko w ADR #16 jako „błąd")
- pół-stany `[D:VERIFIED —/:`: **0** ✅
- cross-ref do nieistniejących plików: **0** ✅ (GLOSSARY.md=future/OQ; contract.md=wzorzec ścieżki)
- front-matter 9 pól + sekcje 0–9 + NEGATIVE + legenda: **9/9 plików kanonicznych** ✅
- INVARIANTS §0 przed QUICK ENTRY: ✅
