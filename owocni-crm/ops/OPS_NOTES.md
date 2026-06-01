---
doc_id: OPS_NOTES
title: "OPS_NOTES — fakty platformowe Twenty, znane bugi, log operacji"
layer: ops
status: active
edit_scope: content_and_structure
owner: "Dawid (wykonawca techniczny)"
last_verified: 2026-05-31
recheck_trigger: "Twenty release / nowy known-issue / nowa operacja masowa / nowy incident"
default_trust: D:VERIFIED
related:
  - EVENT_CONTRACT
  - CRM_CONSTITUTION
  - DATA_MODEL
---

# OPS_NOTES — fakty platformowe i log operacji

## 0. LLM QUICK ENTRY

**Ten plik decyduje o:** zweryfikowanych faktach platformowych Twenty (HMAC, workflow credits, R-18, audit log gating, API key) — z datą i źródłem; logu operacji masowych (z kolumną `no_emit`); logu incydentów. Jest **domem faktów platformowych** — inne pliki cross-ref tutaj, nie powielają nazw.

**Ten plik NIE decyduje o:** zasadach projektowych (→ `CRM_CONSTITUTION.md`); mechanice eventów (→ `EVENT_CONTRACT.md`); polach (→ `DATA_MODEL.md`). Tu są **fakty wersjonowane**, nie decyzje.

**Zawsze czytaj razem z:** `EVENT_CONTRACT.md` (które fakty są konsumowane przez transport), `CRM_CONSTITUTION.md` (Prawo 1d — fakty platformowe żyją tutaj).

**Najgroźniejszy błąd:** potraktować fakt platformowy jak trwałą decyzję projektową (fakt się starzeje — ma `recheck_trigger`); albo skasować zweryfikowany `[F:docs]`/`[F:POC]` przy porządkach.

**Przy konflikcie:** fakt o Twenty (pricing/HMAC/limit) — ten plik rozstrzyga CO sprawdzono i kiedy; ostatecznym arbitrem jest instancja/docs, nie Markdown.

**Zmiana wymaga:** aktualizacji `row_class` + `last_checked` przy każdej weryfikacji. Klasa wiersza NADPISUJE `default_trust` pliku.

---

## 1. NEGATIVE RULES

| ID | Zakaz | Powód | Konsekwencja | Odmraża | Gdzie |
|---|---|---|---|---|---|
| NR-1 | **NIE tworzyć nowego inline systemu stempli** — używać KOLUMNY `row_class`. | Drugi system znaczników = chaos epistemiczny. | Niespójne oznaczanie pewności. | — | §5 |
| NR-2 | **NIE kasować zweryfikowanych `[F:docs]`/`[F:POC]`** przy porządkach. | To zarobiona wiedza (recheck kosztuje). | Utrata zweryfikowanych faktów. | — | §5 |
| NR-3 | **NIE przenosić faktów platformowych do plików-decyzji** (CONSTITUTION/EVENT_CONTRACT). Fakt wersjonowany żyje tu. | Fakt starzeje się niezauważony w pliku zasad. | Nieaktualny fakt udający zasadę. | — | `CRM_CONSTITUTION.md` Prawo 1d |
| NR-4 | **Operacja masowa w logu §5.3 MUSI mieć wartość w kolumnie `no_emit`.** | Brak = nie wiadomo, czy operacja emitowała do platform. | Niewidoczny sygnał reklamowy z bulk-op. | — | §5.3 |

---

## 2. PURPOSE

Dom faktów platformowych Twenty (wersjonowanych, z datą/źródłem/recheck), log operacji masowych i incydentów. To, czego nie wolno trzymać w plikach zasad (Prawo 1d). Status: żywy log operacyjny.

---

## 3. SCOPE

### Pokrywa
- Twenty Verified Facts (HMAC, credits, R-18, audit log gating, API key, permissions).
- Log operacji masowych (z `no_emit`), log incydentów.

### Nie pokrywa
- Zasad projektowych / mechaniki eventów / pól (→ pliki domenowe).

---

## 4. CANONICAL DEFINITIONS

**`row_class`** (KOLUMNA — nie inline stempel; NADPISUJE `default_trust` pliku):

| row_class | Znaczenie | Trust efektywny |
|---|---|---|
| `verified_fact` | Zweryfikowane na instancji lub w oficjalnych docs | D:VERIFIED |
| `platform_recheck_needed` | Wymaga sprawdzenia na instancji (niejednoznaczne / wersyjne) | D:OPEN do rechecku |
| `inference_from_docs` | Wniosek z docs, nie cytat dosłowny | D:RESEARCH/inference |
| `poc_result` | Wynik własnego POC | D:VERIFIED (w zakresie POC) |
| `incident` | Zdarzenie produkcyjne | log |
| `bulk_operation_log` | Operacja masowa | log |

---

## 5. BODY

### 5.1 Twenty Verified Facts

| Fakt | Wartość | row_class | source | last_checked | recheck_trigger |
|---|---|---|---|---|---|
| **HMAC — nazwy nagłówków** (#16) | `X-Twenty-Webhook-Signature` (HMAC SHA256) + `X-Twenty-Webhook-Timestamp` | `verified_fact` | docs.twenty.com | 2026-05-31 | Twenty release |
| **HMAC — signed string** (#16) | `{timestamp}:{payload}` — podpisywany jest timestamp **z** payloadem, NIE sam payload (bez prefiksu timestamp implementacja odrzuci legalne webhooki) | `verified_fact` | docs.twenty.com | 2026-05-31 | Twenty release |
| **Native webhook OUT — workflow credits** | Native webhook (Settings → Developers → Webhooks) **nie zużywa workflow credits**; workflow credits dotyczą Workflow actions (Code/HTTP) | `inference_from_docs` | docs.twenty.com (model pricing) | 2026-05-31 | Twenty pricing change |
| **Workflow credits — limit Pro** | Plan Pro ma limit workflow credits → przy ~5400 emisji/rok workflow HTTP niewykonalny; native webhook obowiązkowy | `inference_from_docs` | docs + credit budget | 2026-05-31 | Twenty pricing change |
| **R-18 — manual create trigger** | Manual UI create wyzwala trigger jako **Created or Updated** (autosave), nie czysty „Created" — stąd detekcja przez `idOid IS NULL`, nie typ operacji | `verified_fact` | instancja (POC) | 2026-05-29 | Twenty release |
| **Audit log** | Brak natywnego audit logu na planie Pro (Organization-tier) — stąd governance ręczne (snapshoty, OPS log, reason codes) | `verified_fact` | docs (plany) | 2026-05-31 | Twenty plan change |
| **Row-level permissions** | Brak na Pro (Organization/Premium); **field-level permissions SĄ na Pro** | `verified_fact` | docs (permissions) | 2026-05-31 | Twenty plan change |
| **Custom fields required** | Twenty 2.8.0 nie wspiera required na custom fields → walidacja przy emisji eventu, nie przy save | `verified_fact` | instancja/docs | 2026-05-31 | Twenty release |
| **createWorkflowVersion / workflow-as-code** | Workflowów nie da się pewnie definiować jako kod; snapshot JSON eksportowany ręcznie do git | `platform_recheck_needed` | docs (niejednoznaczne) | 2026-05-31 | Twenty release |
| **Nazwa eventu webhooka** (`*.created`/`*.updated` vs `record.*`) | Niejednoznaczna w źródłach — sprawdzić dokładną nazwę pola `event` w payloadzie na instancji | `platform_recheck_needed` | sprzeczność źródeł | 2026-05-31 | preflight (sandbox) |
| **API key — Workflow Code secrets** | Code Action wymaga kluczy w function body — nie secure runtime; secrets poza Twenty (Sortownia/n8n); wyjątek: Apps Framework `secret:true` | `verified_fact` | docs (Apps Framework) | 2026-05-31 | Twenty release |
| **Merge rekordów** | Dostępny od v1.3 (UI); zachowanie webhooka przy merge (oba ID?) → recheck | `platform_recheck_needed` | docs + IDENTITY §5.9 | 2026-05-31 | preflight |
| **Dashboards** | Beta / Early Access — nie fundament MVP | `verified_fact` | docs | 2026-05-31 | Twenty release |

> **Dom faktu HMAC = ten wiersz (#16).** `CRM_CONSTITUTION.md` Prawo 7g i `EVENT_CONTRACT.md` §5.1 robią cross-ref TUTAJ, nie powielają nazwy nagłówka. Zamknięte z docs — bez wiersza „recheck na instancji" dla samej nazwy/signed-string (recheck_trigger = Twenty release, standardowo).

### 5.2 Znane bugi / PR (śledzenie)

| Element | Status | row_class | source | last_checked |
|---|---|---|---|---|
| (pusto — uzupełniać przy napotkaniu) | — | — | — | — |

### 5.3 Log operacji masowych (bulk_operation_log — kolumna `no_emit` obowiązkowa, NR-4)

| Data | Operacja | Zakres | `no_emit` | Wykonał | Wynik |
|---|---|---|---|---|---|
| (pusto — uzupełniać przy każdej operacji masowej; każdy wiersz MUSI mieć wartość `no_emit`: TAK/NIE) | — | — | — | — | — |

> Każda operacja masowa (import / backfill / replay / mass-update) → wiersz z jawnym `no_emit`. `no_emit=NIE` jest dozwolone tylko dla operacji świadomie emitujących (rzadkość) i wymaga uzasadnienia w kolumnie Wynik.

### 5.4 Log incydentów (incident)

| Data | Incydent | Wpływ | row_class | Rozwiązanie |
|---|---|---|---|---|
| (pusto) | — | — | `incident` | — |

---

## 6. CROSS-REFERENCES

| Temat | Gdzie konsumowane |
|---|---|
| HMAC (#16) — transport webhooka | `EVENT_CONTRACT.md` §5.1 (cross-ref tutaj) |
| Workflow credits — czemu native webhook | `ARCHITECTURE.md` §5.8 / `EVENT_CONTRACT.md` §5.1 |
| R-18 — manual create przez `idOid IS NULL` | `EVENT_CONTRACT.md` §5.4 |
| Custom fields required / permissions | `CRM_CONSTITUTION.md` Prawo 8 / `DATA_MODEL.md` §5.4 |
| Reguła „fakty platformowe żyją w OPS" | `CRM_CONSTITUTION.md` Prawo 1d |

---

## 7. OPEN QUESTIONS / DECISIONS NEEDED

| ID | Pytanie | Owner | Blocks | Gdzie rozstrzygnąć |
|---|---|---|---|---|
| OQ-O1 | Dokładna nazwa pola `event` w payloadzie webhooka (`*.created` vs `record.*`) | Dawid | nie | sandbox |
| OQ-O2 | Czy native webhook payload Opportunity niesie `Person.idOid` | Dawid | nie | sandbox |

---

## 8. VERIFICATION / RECHECK

| Co sprawdzić | Kiedy | Kto | Dowód |
|---|---|---|---|
| Wiersze `platform_recheck_needed` rozstrzygnięte na instancji | Preflight | Dawid | sandbox |
| HMAC signed-string działa end-to-end (Sortownia weryfikuje) | Preflight | Dawid | runtime |
| Każda bulk-op ma `no_emit` w logu §5.3 | Po każdej operacji | Dawid | §5.3 |

---

## 9. CHANGELOG

| Data | Zmiana | Kto | Powód |
|---|---|---|---|
| 2026-05-31 | HMAC (#16) wpisany jako `verified_fact` (nazwy + signed-string) | Dawid | rozstrzygnięcie docs.twenty.com |

---

## LEGENDA ZNACZNIKÓW

- `[D:CORE]` / `[D:VERIFIED]` / `[D:RESEARCH]` / `[D:OPEN]` — jak w pozostałych plikach.
- **Dodatkowo w tym pliku:** `row_class` (kolumna) NADPISUJE `default_trust`. `verified_fact`/`poc_result` → D:VERIFIED; `platform_recheck_needed` → D:OPEN do rechecku; `inference_from_docs` → D:RESEARCH/inference.
- Default tego pliku: `D:VERIFIED` (fakty zweryfikowane). Wiersz `platform_recheck_needed` = świadome odchylenie.
