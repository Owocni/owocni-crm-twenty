# Pipedrive → Twenty — plan przygotowań (kolejne kroki)

Decyzje: `PIPEDRIVE_MIGRATION_CHECKLIST.md` (domknięte).  
Agent robi **jeden krok na prompt** (albo zwartą paczkę bez pytania).

---

## Odpowiedzi właściciela (2026-07-31)

| # | Pytanie | Odpowiedź |
|---|---------|-----------|
| Q1 | Prod Metadata od razu? | **TAK** |
| Q2 | Ewa Malanowska | Zaproszenie wysłane — **dam znać gdy konto gotowe** (IMAP nie wymagany od razu) |
| Q3 | Staging path | **`integrations/pipedrive-staging/`** (+ gitignore) |
| Q4 | Delete-webhooki | **Pomijamy** — sam eksport |
| Q5 | Klucz PD | Lecimy na obecnym (w `.env.local`) |
| Q6 | ADR | Draft + OK właściciela wystarczy |

---

## Postęp

| # | Krok | Status |
|---|------|--------|
| **1** | ADR #20 + DATA_MODEL / DECISION_REGISTER | **DONE** 2026-07-31 |
| **2** | `srcSystem += PIPEDRIVE_LEGACY` | **DONE** (Metadata) |
| **3** | `bizSource += PIPEDRIVE_IMPORT` | **DONE** (Metadata) |
| **4** | `pipedriveId` ×3 | **DONE** (Metadata) |
| **5** | `legacyCreatedAt` + `legacyPipedriveStageName` | **DONE** (Metadata) |
| **6** | WorkspaceMember Ewa Malanowska | **WAIT** — właściciel da znać |
| **7** | Patch `verify_metrics_pf5.py` (+ METRICS) | **NEXT** |
| **8** | Runbook + skrypt rollback | pending |
| **9** | Token PD w `.env.local` | **DONE** |
| **10** | Delete-webhooki | **SKIP** (decyzja Q4) |
| **11** | Skrypt eksportu → staging | pending |
| **12** | Mailbox map B1 | pending |
| **13** | Mapa bizProduct PD→Twenty | pending |
| **14** | Lista kolizji identity | pending |
| **15–19** | Load / IMAP | później |

Skrypt Metadata (idempotentny): `integrations/tools/deploy_pipedrive_migration_fields.py`

---

## Zasady

1. Nic nie commitować bez prośby.  
2. Hurtowy load dopiero po próbce + GO.  
3. Rollback możliwy tylko przed IMAP.
