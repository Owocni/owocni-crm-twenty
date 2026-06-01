# OPS_NOTES — operacje i fakty Twenty

**Last updated:** 2026-05-28

---

## Gdzie szukać

| Co | Gdzie |
|----|-------|
| Logi Twenty | Settings → Logs |
| Webhook delivery | Settings → Developers → Webhooks |
| Workflow runs | Workflow editor → Runs |
| Sortownia / Lista Zadań | Stape UI |
| Snapshoty git | `../twenty/snapshots/` |
| SSOT eventy | `../EVENT_CONTRACT.md` |

---

## Twenty Verified Facts

| Fact | Source | Verified | Last checked |
|------|--------|----------|--------------|
| Workflow credits Pro ≈ 50/rok | Twenty docs | tak | 2026-05-28 |
| Native webhook OUT: HMAC, 0 credits | Twenty docs | tak | 2026-05-28 |
| Webhooks: ALL event types to URL (filter w Sortowni) | Twenty docs | tak | 2026-05-28 |
| Custom fields: cannot be required | Twenty FAQ | tak | 2026-05-28 |
| createWorkflowVersion: FORBIDDEN via API key | POC 2026-05-25 | tak | 2026-05-25 |
| Audit logs: Pro=No, Organization=Yes | Pricing | tak | 2026-05-28 |
| llms.txt na docs.twenty.com | Twenty docs | tak | 2026-05-28 |

---

## Twenty → Sortownia signaling (MVP)

| SSOT event | Trigger Twenty | Status smoke test |
|------------|----------------|-------------------|
| qualify_lead | stage → QUALIFIED | POC workflow only — **do przebudowy** |
| purchase | stage → WON | j.w. |
| rejected_lead | campaignRejected true | POC verified |
| generate_lead | manual create | spec inbound — **do wdrożenia** |

---

## Workflow Runtime Registry

| Workflow | Trigger | Status |
|----------|---------|--------|
| deal · zmiana etapu · event do orkiestracji | stage update | POC — **zastąpić native webhook** |
| deal · campaign rejected · … | campaignRejected | POC — j.w. |

---

## Known issues

- R-18: manual create → trigger Created or Updated, nie Created only
- IMAP Email Sync na mail.owocni.pl — testować osobno (Opcja B)
- Terminal SM — brak enforcement (SSOT akceptuje duplikaty platform)

---

## Incydenty

*(pusta — uzupełniać po dry-run / cutover)*

---

## Bulk Operations Log

*(pusta)*
