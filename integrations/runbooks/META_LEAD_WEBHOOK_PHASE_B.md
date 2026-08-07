# Meta Lead Ads — Faza B (webhook → Twenty)

## Deployed (sandbox)

| Element | Wartość |
|---------|---------|
| CF | `meta-lead-webhook-sandbox` |
| Callback URL | `https://meta-lead-webhook-sandbox-hsxlhvflrq-lm.a.run.app` |
| Worker action | `ingest_meta_lead` → `crm:twenty_create_lead` |
| Pola Twenty | `metaLeadgenId`, `metaAdId`, `metaAdgroupId` |
| `bizSource` | `FACEBOOK` (`src_action_source=meta_instant_form`) |
| Owner | zawsze **Robert Mańk** (`TWENTY_OWNER_ROBERT`) — bez RR Marta/Gosia |

Verify token: lokalnie w `.env.local` → `META_WEBHOOK_VERIFY_TOKEN`.

## Konfiguracja w Meta (ręczne, ~5 min)

1. [developers.facebook.com/apps/1067456139304005](https://developers.facebook.com/apps/1067456139304005)
2. Use cases → **Create & manage ads** → **Webhooks**
3. **Select product** = **Page**
4. Callback URL = URL powyżej
5. Verify token = wartość `META_WEBHOOK_VERIFY_TOKEN` z `.env.local`
6. **Verify and save**
7. W subskrypcjach pól zaznacz **`leadgen`**
8. Strona Owocni powinna mieć subskrypcję appki (`subscribed_apps` + `leadgen`) — skrypt deploy / Graph API

## Test

1. Lead z **płatnej reklamy** (nie Podgląd reklamy).
2. W logach CF: `meta-lead-webhook events 1`
3. W Twenty: Opportunity z `bizSource=FACEBOOK`, wypełnionym `metaLeadgenId`, **owner = Robert Mańk**

## Deploy

```bash
# worker (createLead + ingest_meta_lead)
cd integrations/cloud-functions/twenty-crm-worker && bash deploy.sh

# webhook Meta
cd integrations/cloud-functions/meta-lead-webhook && bash deploy.sh
```

## Poza zakresem tej fazy

- Prawdziwy Graph CAPI przy SQL (`lead_id` + `action_source=system`) — Robot nadal Sheets imitation; osobny krok.

## Incydent 2026-07-28 (Iwona / EKF)

- Lead w Meta był (`leadgen_id=3191234824398181`, 22:14 CEST), w Twenty nie.
- Przyczyna: app webhook subskrypcja Page miała `active=true`, ale **bez `fields=leadgen`** → Meta nie wysyłała POST-ów (0 requestów na CF).
- Naprawa: `POST /{app-id}/subscriptions` z `fields=leadgen` + verify token. Lead dogoniony ręcznie `ingest_meta_lead`.
- Dodatkowo: mapowanie `full name` (spacja) w `metaLeadIngest.js`.

## Incydent 2026-08-04…06 (Jendrek / Barbara + seria)

- Subskrypcja `leadgen` wygląda OK, CF działa (GET verify 200), page `subscribed_apps` OK — **ale nadal 0 POST-ów** na webhook od Meta.
- Najbardziej prawdopodobne: app **Owocni Lead CRM** jest w trybie **Development** (webhooki tylko dla testerów/adminów; realne leady z reklam są w Graph, ale nie lecą push).
- Mitigacja: ręczny backfill `ingest_meta_lead` z Graph; **wymagane: przełączenie appki na Live** w Meta Developers + ewentualny review uprawnień.

## Incydent 2026-08-06…07 (Arek / Pinokio) + poll fallback

- Publish appki + polityka prywatności **nie naprawiły** pushy — nadal 0 POST-ów `leadgen`.
- Przykłady w Graph, brak push: `arek@acrofamily.pl` (`1738660847476678`), `Matketing@pinokio.pl` (`1797276394917098`) — dogonione `ingest_meta_lead`.
- **Produkcyjny fallback:** Cloud Scheduler `meta-lead-poll-every-5min` → `POST` CF z `{action:"poll_meta_leads"}` + header `X-Meta-Poll-Secret` (= `META_WEBHOOK_VERIFY_TOKEN`). Pull z Graph (`META_FORM_IDS`, domyślnie `1073605628462622`) → worker; idempotencja po `metaLeadgenId`.
- Webhook zostaje jako bonus; poll jest źródłem prawdy.
