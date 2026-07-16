# integrations/shared/

Wspólne stałe i helpery **dla dokumentacji LLM** oraz runtime **Node (Robot)**.

| Plik | Runtime | Rola |
|------|---------|------|
| `ssotPaths.js` | Node (+ kopia const w tagach Stape) | Nazwy adapterów, kolekcje Stape Store, kanon eventów |
| `envGuard.js` | Node (`GoogleCloudRobot.js`) | `sandbox` → bez prod Ads/Meta/GA4 MP |
| `isFreeMail.js` / `is_free_mail.py` | Node / Python | `company_domain_key` gate — exact match SSOT v1 (bez substring) |

**Free-mail SSOT:** kanon `../../owocni-crm/data/free_mail_domains_v1.json` · runtime bundle `data/free_mail_domains_v1.json` (obok `isFreeMail.js`) · docs: `SSOT_free-mail-domains_v1.md` · generator: `../tools/gen_free_mail.py` (pisze kanon + runtime + CF inbound).

**Stape (sGTM):** tagi nie używają `require()` — thin `companyDomainKey` w Sortowni (exact set); patrz `../runbooks/FREE_MAIL_SHIELD.md`.

**GCP Cloud Functions:** przy deploy kopiowane są do:
- `cloud-functions/robot-task-monitor/shared/` (z tego katalogu + `GoogleCloudRobot.js`)
- `cloud-functions/twenty-inbound-webhook/shared/` (config, twentyRest, stapeStore, **isFreeMail.js + data/**)
- `cloud-functions/twenty-crm-worker/shared/`

Zmiana stałych SSOT → zaktualizuj źródło tutaj i prze-deployuj odpowiedni CF.
