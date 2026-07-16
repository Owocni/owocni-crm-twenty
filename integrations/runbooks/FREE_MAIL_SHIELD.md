# Free-mail full shield — runbook

## Cel

Dwie warstwy przeciw firmom-widmom z free-mail (Gmail, WP, Onet, …):

| Warstwa | Cel | Gdzie |
|---------|-----|--------|
| **A** | `company_domain_key = null` dla freemail → brak merge firmowego | Sortownia + inbound mint → `identity_map` |
| **B** | Email Sync i tak mintuje Company → unlink Person + DELETE | inbound CF na `company.*` / Person z `companyId` |

SSOT exact-match: `owocni-crm/data/free_mail_domains_v1.json` → runtime `integrations/shared/data/` (+ kopia w CF `shared/data/`).

## Deploy inbound CF

```bash
cd integrations/cloud-functions/twenty-inbound-webhook
./deploy.sh   # bundluje isFreeMail.js + JSON, build_id w shared/config.js
```

Po deploy: **Twenty UI → Settings → Webhooks** — na tym samym URL co Opportunity/Person dodaj obiekt **Company** (created + updated). Bez tego warstwa B na `company.*` milczy (Person path nadal próbuje strip przy `companyId`).

## Sortownia (Stape)

Po zmianie `SORTOWNIA_V2_POPRAWIONY.js` wklej tag w Stape (blok `FREE_MAIL_SHIELD` + `company_domain_key` w profilu). Helper źródłowy: `integrations/shared/companyDomainKey.sGTM.js`.

## Cleanup jednorazowy

```bash
python3 integrations/tools/twenty_cleanup_freemail_companies.py --dry-run
# po review listy:
python3 integrations/tools/twenty_cleanup_freemail_companies.py --apply
```

Domyślnie `safe` (name == domain). `--mode broad` tylko świadomie (np. „Orange Polska” @ orange.pl).

Apply: najpierw PATCH People `companyId: null`, potem DELETE Company.

## Canary PASS

1. `livechat.com` / `acme.com` / `terravita.pl` — **nie** freemail; `gmail.com` / `wp.pl` — **tak**
2. Nowy Person `@gmail.com` (Email Sync) → w ~1 min brak Company `gmail.com`
3. `identity_map` freemail: `company_domain_key` null
4. Cleanup dry-run bez FP na canary

```bash
cd integrations/shared && node --test isFreeMail.test.js
```

## Regeneracja listy

```bash
python3 integrations/tools/gen_free_mail.py
# pisze: owocni-crm/data + shared/data + CF inbound shared/data
# potem: zregeneruj companyDomainKey.sGTM.js / Sortownię i re-deploy CF
```

## Poza zakresem (faza 2)

Disposable domains cron · `patterns_optional` MS ccTLD · fork Twenty `isWorkEmail`.
