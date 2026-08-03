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
