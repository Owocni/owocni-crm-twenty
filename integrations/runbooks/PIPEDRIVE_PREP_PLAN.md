# Pipedrive → Twenty — plan przygotowań (kolejne kroki)

Decyzje: `PIPEDRIVE_MIGRATION_CHECKLIST.md` (domknięte).

---

## Odpowiedzi właściciela

| # | Pytanie | Odpowiedź |
|---|---------|-----------|
| Q1–Q6 | Metadata / Ewa / staging / webhook / token / ADR | jak wcześniej |
| Q7 | Kamil/Patryk/E5 → `owocni@gmail.com` | **TAK** (2026-08-04) |

---

## Postęp

| # | Krok | Status |
|---|------|--------|
| **1–5** | ADR + Metadata | **DONE** |
| **6** | Ewa | **DONE** |
| **7** | Metryki | **DONE** |
| **8** | Rollback | **DONE** |
| **9** | Token PD | **DONE** |
| **10** | Delete-webhooki | **SKIP** |
| **11** | Eksport PD → staging | **DONE** 2026-08-04 — run `20260804T065324Z` |
| **12** | Mailbox map B1 | **DONE** 2026-08-04 — 1710/3251 deali z mailami; 9334 msgs; note drafts gotowe |
| **13** | Mapa bizProduct | **DONE** 2026-08-04 — 463 mapped / 2788 null; HIG wyklucza PIPEDRIVE_LEGACY |
| **14** | Kolizje identity | **DONE** — ASK domknięty (same email ⇒ link) |
| **15** | Workflowy OFF / `no_emit` | **DONE** 2026-08-04 — inbound deployed + 8 WF OFF |
| **16** | Sample load 10–20 | **DONE** 2026-08-04 — **23** Opp + backfill nazw/`INNE`/junk company |
| **17** | Review próbki + GO full | **DONE** 2026-08-04 — owner GO |
| **18** | Full load | **DONE** 2026-08-04 — **3251/3251** Opp (`…/full/`); retry 14 phone/email |
| **19** | IMAP + WF ON | **WF ON DONE** 2026-08-06 — 8× ACTIVE; IMAP później; rollback tylko przed IMAP |

### Eksport run `20260804T065324Z`

Ścieżka: `integrations/pipedrive-staging/runs/20260804T065324Z/`  
Cutoff: `add_time >= 2023-08-04`  
Manifest sha256: `06fdd2c3b3c2633646178e73ff20c1bc1154f2ac184001ce6046e604c0d2f22c`

| Encja | Total w PD | W oknie 3 lat |
|-------|------------|---------------|
| deals | 5864 | **3251** |
| persons | 7019 | **4235** |
| organizations | 3472 | **1699** |
| activities | 24630 | **14942** |
| notes | 15121 | **9805** |
| mailbox→deal | — | **1710** deali / **9334** msgs |
| deal products | 492 line-items | **463** deali z mapą bizProduct |

**bizProduct (krok 13):** `products/MAPPING.md`, `products/bizproduct_map.jsonl`  
Rozkład: MARKETING 359 · WEB 55 · LOGO 12 · COPY 10 · NAME 4 · OPAK 1 · INNE 22 · **null 2788** (brak line-itemów).  
Polityka: null OK; HIG nie liczy `PIPEDRIVE_LEGACY`.

**Identity (krok 14):** `identity/REVIEW.md`, `identity/candidates.csv` (+ jsonl)  
Snapshot Twenty: 24 724 people / 16 853 companies.  
Kandydaci: cross email **901** · phone **9** · company name **93** · PD internal email **964** · phone **570** (= **2537**).  
Priorytet review: `cross_system_email` bez `role_email` (736 „osobistych”); 368 z istniejącym `idOid`.

**Gate (krok 15):** `runbooks/PIPEDRIVE_IMPORT_GATE.md` + `gate/must_off.json`  
8 workflowów MUST_OFF przed loadem (nie wyłączone na żywo — czekają na GO).  
`no_emit`: `SKIP_LEGACY_IMPORT` w `twenty-inbound-webhook` (deploy przed sample).

Artefakty B1: `mailbox/…`  
Skrypty: `pipedrive_export_staging.py`, `pipedrive_export_mailbox_map.py`, `pipedrive_map_bizproduct.py`, `pipedrive_identity_collisions.py`, `pipedrive_workflow_gate.py`

---

## Zasady

1. Nic nie commitować bez prośby.  
2. Hurtowy load dopiero po próbce + GO.  
3. Rollback tylko przed IMAP.
